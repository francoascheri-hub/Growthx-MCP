import { headers } from "next/headers";
import CopyButton from "./copy-button";

export const dynamic = "force-dynamic";

const TOOLS: { name: string; desc: string }[] = [
  { name: "search_events", desc: "Find SF events by keyword, date range, topic, or neighborhood." },
  { name: "get_event", desc: "Full details for one event: time, venue, hosts, speakers, link." },
  { name: "recommend_events", desc: "Ranked picks matched to your role, stage, and goals." },
  { name: "draft_intro", desc: "Write a short, specific intro message for someone at an event." },
  { name: "plan_my_week", desc: "Build a non-conflicting weekly schedule of the best events." },
  { name: "who_to_meet", desc: "Speakers, hosts, and sponsors worth meeting at an event, and why." },
  { name: "event_brief", desc: "A one-page prep brief: context, people, talking points." },
  { name: "register_event", desc: "Get the registration link and steps to RSVP." },
  { name: "add_to_calendar", desc: "Google Calendar link and .ics data for any event." },
  { name: "sponsor_match", desc: "Events whose audience fits what you want to sponsor or sell." },
  { name: "trending_topics", desc: "What the SF builder scene is talking about this week." },
  { name: "similar_events", desc: "More events like one you already liked." },
];

const DEMO_PROMPT =
  "I'm a seed-stage AI agents founder in SF raising a pre-seed round. Plan my week of Nov 9 with GrowthX: pick non-conflicting events, tell me who to meet at each, draft an intro for the best one, and give me calendar links.";

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="code">
      <pre>
        <code>{code}</code>
      </pre>
      <CopyButton text={code} />
    </div>
  );
}

export default async function Home() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/api/mcp`;

  const claudeCode = `claude mcp add --transport http growthx ${url}`;
  const desktopConfig = JSON.stringify(
    { mcpServers: { growthx: { command: "npx", args: ["-y", "mcp-remote", url] } } },
    null,
    2,
  );
  const cursorConfig = JSON.stringify({ mcpServers: { growthx: { url } } }, null, 2);

  return (
    <main className="wrap">
      <header className="hero">
        <p className="eyebrow">GrowthX · MCP server</p>
        <h1>Add GrowthX to your agent</h1>
        <p className="lede">
          Events discovery for SF founders and builders — not another bot, but a public MCP server your
          agent already knows how to use.
        </p>
        <div className="url">
          <code>{url}</code>
          <CopyButton text={url} label="Copy URL" />
        </div>
      </header>

      <section>
        <h2>Connect</h2>

        <div className="client">
          <h3>Claude Code</h3>
          <CodeBlock code={claudeCode} />
        </div>

        <div className="client">
          <h3>Claude Desktop / claude.ai</h3>
          <p>
            Settings → Connectors → Add custom connector → paste the URL. Or add this to{" "}
            <code className="inline">claude_desktop_config.json</code>:
          </p>
          <CodeBlock code={desktopConfig} />
        </div>

        <div className="client">
          <h3>Cursor</h3>
          <p>
            Add to <code className="inline">~/.cursor/mcp.json</code>:
          </p>
          <CodeBlock code={cursorConfig} />
        </div>

        <div className="client">
          <h3>ChatGPT</h3>
          <p>Settings → Connectors → Developer mode → add the MCP server URL above.</p>
        </div>
      </section>

      <section>
        <h2>Tools</h2>
        <ul className="tools">
          {TOOLS.map((t) => (
            <li key={t.name}>
              <code>{t.name}</code>
              <span>{t.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Try it</h2>
        <div className="prompt">
          <p>{DEMO_PROMPT}</p>
          <CopyButton text={DEMO_PROMPT} label="Copy prompt" />
        </div>
      </section>

      <footer>Fixtures mode uses example data. Read-only. No account needed.</footer>
    </main>
  );
}
