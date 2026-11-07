import { headers } from "next/headers";
import fixtures from "@/data/events.json";
import CopyButton from "./copy-button";

export const dynamic = "force-dynamic";

type FixtureEvent = { id: string; title: string; start: string; end: string; venue: string; neighborhood: string; tags: string[]; audience: string[] };

const TOOLS: [string, string][] = [
  ["search_events", "Filter SF events by topic, date, area"],
  ["get_event", "Full details for one event"],
  ["recommend_events", "Top 3 for your goal, with why"],
  ["plan_my_week", "Non-conflicting weekly agenda"],
  ["who_to_meet", "Guests, hosts, sponsors to find"],
  ["draft_intro", "Short intro DM before the event"],
  ["event_brief", "One-page prep brief"],
  ["register_event", "Luma registration link"],
  ["add_to_calendar", "Google Calendar + .ics"],
  ["sponsor_match", "Events that fit your audience"],
  ["trending_topics", "What SF is building this week"],
  ["similar_events", "More like this one"],
];

const DEMO_PROMPT = "Plan my week to meet seed AI investors";

// Static demo: 3 non-overlapping investor-friendly events from the example fixtures.
function demoEvents(): FixtureEvent[] {
  const events = (fixtures as { events: FixtureEvent[] }).events
    .filter((e) => e.tags.includes("ai") && (e.tags.includes("fundraising") || e.audience.includes("investors")))
    .sort((a, b) => a.start.localeCompare(b.start));
  const picked: FixtureEvent[] = [];
  for (const e of events) {
    if (picked.length === 3) break;
    if (picked.some((p) => p.start.slice(0, 10) === e.start.slice(0, 10))) continue;
    picked.push(e);
  }
  return picked;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", hour: "numeric", minute: "2-digit" });

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function Home() {
  const mcpUrl = `${await siteUrl()}/api/mcp`;
  const cursorLink = `cursor://anysphere.cursor-deeplink/mcp/install?name=growthx&config=${encodeURIComponent(
    Buffer.from(JSON.stringify({ url: mcpUrl })).toString("base64"),
  )}`;
  const configs: { title: string; note: string; code: string }[] = [
    { title: "Claude Code", note: "Terminal", code: `claude mcp add --transport http growthx ${mcpUrl}` },
    { title: "Cursor", note: "~/.cursor/mcp.json", code: JSON.stringify({ mcpServers: { growthx: { url: mcpUrl } } }, null, 2) },
    { title: "ChatGPT", note: "Settings → Connectors → Advanced → Developer mode → Create", code: mcpUrl },
  ];
  const demo = demoEvents();

  return (
    <main>
      <nav className="nav">
        <span className="logo">
          <span className="dot" />
          GrowthX
        </span>
        <span className="pill">MCP server · read-only</span>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <h1>Add GrowthX to your agent</h1>
          <p className="sub">SF tech events, people to meet and intros, inside Claude, Cursor or ChatGPT. No new app.</p>

          <div className="url-field">
            <code>{mcpUrl}</code>
            <CopyButton text={mcpUrl} />
          </div>

          <div className="actions">
            <details className="claude-steps">
              <summary className="btn primary">Add to Claude</summary>
              <ol>
                <li>Open Claude → Settings → Connectors</li>
                <li>Click “Add custom connector”</li>
                <li>Name it GrowthX and paste the MCP URL above</li>
              </ol>
            </details>
            <a className="btn" href={cursorLink}>
              Add to Cursor
            </a>
          </div>
        </div>

        <div className="chat" aria-label="Example conversation">
          <div className="bubble user">{DEMO_PROMPT}</div>
          <div className="bubble agent">
            <span className="tool-call">growthx · plan_my_week</span>
            <p>Here are 3 non-conflicting picks, ranked for you:</p>
            {demo.map((e) => (
              <div className="event-card" key={e.id}>
                <div className="event-when">{when(e.start)}</div>
                <div className="event-title">{e.title}</div>
                <div className="event-meta">{[e.venue, e.neighborhood].filter(Boolean).join(" · ")}</div>
              </div>
            ))}
            <div className="added">✓ Added to calendar</div>
          </div>
          <p className="chat-note">Example data</p>
        </div>
      </section>

      <section>
        <h2>12 tools your agent can call</h2>
        <div className="chips">
          {TOOLS.map(([name, desc]) => (
            <div className="chip" key={name}>
              <code>{name}</code>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Configs</h2>
        <div className="configs">
          {configs.map((c) => (
            <div className="config" key={c.title}>
              <div className="config-head">
                <div>
                  <strong>{c.title}</strong>
                  <span>{c.note}</span>
                </div>
                <CopyButton text={c.code} />
              </div>
              <pre>{c.code}</pre>
            </div>
          ))}
        </div>
      </section>

      <footer>Read-only. No account needed. Events from the GrowthX catalog of SF tech events.</footer>
    </main>
  );
}
