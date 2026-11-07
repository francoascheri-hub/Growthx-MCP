// Smoke test: tools/list + every tool against a running server. Usage: node scripts/smoke.mjs [baseUrl]
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const base = process.argv[2] || process.env.MCP_BASE_URL || "http://localhost:3000";
const client = new Client({ name: "growthx-smoke", version: "0.1.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/api/mcp`)));

const expected = [
  "search_events", "get_event", "recommend_events", "draft_intro", "plan_my_week", "who_to_meet",
  "event_brief", "register_event", "add_to_calendar", "sponsor_match", "trending_topics", "similar_events",
];
const { tools } = await client.listTools();
const names = tools.map((t) => t.name);
const missing = expected.filter((n) => !names.includes(n));
if (missing.length) throw new Error(`missing tools: ${missing.join(", ")}`);
console.log(`ok  tools/list (${names.length})`);

let failures = 0;
async function call(name, args, check = () => true) {
  const t0 = Date.now();
  try {
    const res = await client.callTool({ name, arguments: args });
    const data = JSON.parse(res.content[0].text);
    if (res.isError) throw new Error(data.error);
    if (!check(data)) throw new Error(`check failed: ${JSON.stringify(data).slice(0, 200)}`);
    console.log(`ok  ${name} (${Date.now() - t0}ms)`);
    return data;
  } catch (err) {
    failures++;
    console.log(`FAIL ${name}: ${err.message}`);
    return null;
  }
}

const goal = "I'm a pre-seed AI agents founder raising money and looking for design partners";
const search = await call("search_events", { limit: 5 }, (d) => d.results.length > 0);
console.log(`    backend=${search?.backend} events=${search?.events}`);
const rec = await call("recommend_events", { goal }, (d) => d.recommendations.length > 0);
const id = rec?.recommendations[0]?.id ?? search?.results[0]?.id;
await call("get_event", { event_id: id }, (d) => d.id === id);
await call("draft_intro", { event_id: id, goal }, (d) => d.message.length > 20);
await call("plan_my_week", { goal }, (d) => Array.isArray(d.agenda));
await call("who_to_meet", { event_id: id, goal }, (d) => Array.isArray(d.who_to_meet));
await call("event_brief", { event_id: id }, (d) => d.logistics.register);
await call("register_event", { event_id: id }, (d) => d.register_url.startsWith("http"));
await call("add_to_calendar", { event_id: id }, (d) => d.ics.includes("BEGIN:VEVENT") && d.google_calendar_url.includes("calendar.google.com"));
await call("sponsor_match", { audience: "AI engineers and founders building agents", budget: 5000 }, (d) => Array.isArray(d.matches));
await call("trending_topics", {}, (d) => d.topics.length > 0);
await call("similar_events", { event_id: id }, (d) => Array.isArray(d.similar));

await client.close();
if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nsmoke passed");
