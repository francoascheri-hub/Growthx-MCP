import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import * as t from "@/lib/tools";
import { EVENTS_SKYBRIDGE_URI, EVENTS_UI_URI, MCP_APP_MIME, SKYBRIDGE_MIME, eventsWidgetHtml } from "@/lib/ui";

export const runtime = "nodejs";
export const maxDuration = 60;

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });

async function run(fn: () => Promise<unknown>) {
  try {
    return json(await fn());
  } catch (err) {
    return { ...json({ error: (err as Error).message }), isError: true };
  }
}

// Same text JSON as run(), plus structuredContent for MCP Apps / OpenAI Apps widgets.
async function runUi(fn: () => Promise<unknown>) {
  try {
    const data = (await fn()) as Record<string, unknown>;
    return { ...json(data), structuredContent: data };
  } catch (err) {
    return { ...json({ error: (err as Error).message }), isError: true };
  }
}

const uiMeta = (invoking: string, invoked: string) => ({
  ui: { resourceUri: EVENTS_UI_URI },
  "ui/resourceUri": EVENTS_UI_URI,
  "openai/outputTemplate": EVENTS_SKYBRIDGE_URI,
  "openai/toolInvocation/invoking": invoking,
  "openai/toolInvocation/invoked": invoked,
  "openai/widgetAccessible": false,
});

const eventId = z.string().describe("Event id from search_events / recommend_events");
const goal = z.string().min(3).describe("What you want out of SF events, e.g. 'raise a pre-seed for my AI agents startup'");

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "search_events",
      "Search upcoming San Francisco tech/founder events (GrowthX catalog). Filter by free-text query, tags, date range (YYYY-MM-DD, PT), neighborhood, free only.",
      {
        query: z.string().optional(),
        tags: z.array(z.string()).optional(),
        date_from: z.string().optional(),
        date_to: z.string().optional(),
        neighborhood: z.string().optional(),
        free_only: z.boolean().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
      (a) => run(() => t.searchEvents(a)),
    );
    server.tool("get_event", "Full details for one event.", { event_id: eventId }, (a) => run(() => t.getEvent(a)));
    server.registerResource(
      "growthx-events-widget",
      EVENTS_UI_URI,
      { title: "GrowthX events widget", description: "Event cards for recommend_events / plan_my_week", mimeType: MCP_APP_MIME },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: MCP_APP_MIME, text: eventsWidgetHtml(), _meta: { ui: { prefersBorder: true } } }],
      }),
    );
    server.registerResource(
      "growthx-events-widget-skybridge",
      EVENTS_SKYBRIDGE_URI,
      { title: "GrowthX events widget (OpenAI Apps)", mimeType: SKYBRIDGE_MIME },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: SKYBRIDGE_MIME,
            text: eventsWidgetHtml(),
            _meta: { "openai/widgetPrefersBorder": true, "openai/widgetDescription": "Cards for recommended SF events." },
          },
        ],
      }),
    );
    server.registerTool(
      "recommend_events",
      {
        description: "Top events for a goal, each with a short 'why'.",
        inputSchema: { goal, limit: z.number().int().min(1).max(10).optional() },
        _meta: uiMeta("Finding events for your goal…", "Recommended events"),
      },
      (a) => runUi(() => t.recommendEvents(a)),
    );
    server.tool(
      "draft_intro",
      "Draft a short intro DM to send to someone (host, speaker or guest) before an event.",
      { event_id: eventId, goal, target: z.string().optional().describe("Person or org to write to; defaults to best match") },
      (a) => run(() => t.draftIntro(a)),
    );
    server.registerTool(
      "plan_my_week",
      {
        description: "Non-conflicting agenda of events for a week (30-min buffer between events), ranked by goal.",
        inputSchema: {
          goal,
          week_start: z.string().optional().describe("Any date in the target week, YYYY-MM-DD; defaults to the next week with events"),
          max_per_day: z.number().int().min(1).max(4).optional(),
          max_events: z.number().int().min(1).max(15).optional(),
        },
        _meta: uiMeta("Planning your week…", "Your week of events"),
      },
      (a) => runUi(() => t.planMyWeek(a)),
    );
    server.tool("who_to_meet", "Who to meet at an event for your goal (guests, hosts, sponsors).", { event_id: eventId, goal }, (a) =>
      run(() => t.whoToMeet(a)),
    );
    server.tool("event_brief", "One-page prep brief for an event: TL;DR, logistics, people, talking points.", { event_id: eventId }, (a) =>
      run(() => t.eventBrief(a)),
    );
    server.tool("register_event", "Registration (Luma) link for an event. Never registers on your behalf.", { event_id: eventId }, (a) =>
      run(() => t.registerEvent(a)),
    );
    server.tool("add_to_calendar", "Google Calendar link plus .ics file content for an event.", { event_id: eventId }, (a) =>
      run(() => t.addToCalendar(a)),
    );
    server.tool(
      "sponsor_match",
      "For brands: events whose audience matches yours, with past sponsors, reach and tiers within budget.",
      {
        audience: z.string().min(3).describe("Who you want to reach, e.g. 'AI infra engineers at startups'"),
        budget: z.number().min(0).optional().describe("USD"),
        limit: z.number().int().min(1).max(20).optional(),
      },
      (a) => run(() => t.sponsorMatch(a)),
    );
    server.tool(
      "trending_topics",
      "Most common topics and most active hosts across upcoming SF events.",
      { days: z.number().int().min(1).max(90).optional(), limit: z.number().int().min(1).max(30).optional() },
      (a) => run(() => t.trendingTopics(a)),
    );
    server.tool(
      "similar_events",
      "Events similar to a given one (shared topics, same host/community).",
      { event_id: eventId, limit: z.number().int().min(1).max(20).optional() },
      (a) => run(() => t.similarEvents(a)),
    );
  },
  {
    serverInfo: { name: "growthx", version: "0.1.0" },
    instructions:
      "GrowthX: discover San Francisco tech/founder events. Start with recommend_events or plan_my_week for a goal, then who_to_meet, draft_intro, add_to_calendar. Read-only.",
  },
  { basePath: "/api", maxDuration: 60, verboseLogs: false },
);

export { handler as GET, handler as POST, handler as DELETE };
