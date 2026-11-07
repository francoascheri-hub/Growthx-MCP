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
    server.registerTool(
      "search_events",
      {
        description:
          "Keyword/filter search of upcoming SF tech/founder events (free-text query, tags, date range YYYY-MM-DD PT, neighborhood, free only). For goal-based asks (what to attend, who to meet, fundraising, hiring, learning) use recommend_events; for a schedule use plan_my_week.",
        inputSchema: {
        query: z.string().optional(),
        tags: z.array(z.string()).optional(),
        date_from: z.string().optional(),
        date_to: z.string().optional(),
        neighborhood: z.string().optional(),
        free_only: z.boolean().optional(),
        limit: z.number().int().min(1).max(50).optional(),
        },
        _meta: uiMeta("Searching events…", "Events found"),
      },
      (a) => runUi(() => t.searchEvents(a)),
    );
    server.registerTool(
      "get_event",
      { description: "Full details for one event.", inputSchema: { event_id: eventId }, _meta: uiMeta("Loading event…", "Event") },
      (a) => runUi(() => t.getEvent(a)),
    );
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
        description:
          "Preferred tool for any goal-based ask about SF events (e.g. 'events to meet investors', 'where to hire AI engineers'): top events for the goal, each with a short 'why'. Shows interactive event cards.",
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
        description:
          "Preferred tool for 'plan my week' / schedule asks: non-conflicting agenda of events for a week (30-min buffer), ranked by goal. Shows interactive event cards.",
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
    server.registerTool(
      "event_brief",
      {
        description: "One-page prep brief for an event: TL;DR, logistics, people, talking points.",
        inputSchema: { event_id: eventId },
        _meta: uiMeta("Preparing brief…", "Event brief"),
      },
      (a) => runUi(() => t.eventBrief(a)),
    );
    server.tool("register_event", "Registration (Luma) link for an event. Never registers on your behalf.", { event_id: eventId }, (a) =>
      run(() => t.registerEvent(a)),
    );
    server.tool("add_to_calendar", "Google Calendar link plus .ics file content for an event.", { event_id: eventId }, (a) =>
      run(() => t.addToCalendar(a)),
    );
    server.registerTool(
      "sponsor_match",
      {
        description: "For brands: events whose audience matches yours, with past sponsors, reach and tiers within budget.",
        inputSchema: {
          audience: z.string().min(3).describe("Who you want to reach, e.g. 'AI infra engineers at startups'"),
          budget: z.number().min(0).optional().describe("USD"),
          limit: z.number().int().min(1).max(20).optional(),
        },
        _meta: uiMeta("Matching events…", "Sponsorship matches"),
      },
      (a) => runUi(() => t.sponsorMatch(a)),
    );
    server.tool(
      "trending_topics",
      "Most common topics and most active hosts across upcoming SF events.",
      { days: z.number().int().min(1).max(90).optional(), limit: z.number().int().min(1).max(30).optional() },
      (a) => run(() => t.trendingTopics(a)),
    );
    server.registerTool(
      "similar_events",
      {
        description: "Events similar to a given one (shared topics, same host/community).",
        inputSchema: { event_id: eventId, limit: z.number().int().min(1).max(20).optional() },
        _meta: uiMeta("Finding similar events…", "Similar events"),
      },
      (a) => runUi(() => t.similarEvents(a)),
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
