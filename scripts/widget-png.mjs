// Render the MCP Apps widget with sample structuredContent and save tmp/widget.png (Edge headless).
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { buildAgenda, agendaUrl } from "../lib/agenda.ts";
import { agendaWidgetView } from "../lib/agendaHtml.ts";
import { eventsWidgetHtml } from "../lib/ui.ts";

const agenda = await buildAgenda({ tool: "plan", goal: "Meet seed AI investors", limit: 6 }, { imageBytes: false });
const ids = agenda.items.map((it) => it.e.id);
const pdf = agendaUrl("https://growthx-mcp.vercel.app", {
  tool: "plan",
  goal: "Meet seed AI investors",
  ids,
  from: agenda.from,
  to: agenda.to,
});
const sample = { agendaView: agendaWidgetView(agenda, pdf) };
let html = eventsWidgetHtml();
const boot = `<script>window.addEventListener("DOMContentLoaded",function(){window.postMessage({jsonrpc:"2.0",method:"ui/notifications/tool-result",params:{structuredContent:${JSON.stringify(sample)}}},"*");});</script>`;
html = html.replace("</body>", `${boot}</body>`);
mkdirSync("tmp", { recursive: true });
const file = "tmp/widget-preview.html";
writeFileSync(file, html);
const href = pathToFileURL(`${process.cwd()}/${file}`).href;
const candidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const edge = candidates.find((p) => existsSync(p));
if (!edge) throw new Error("Edge not found for headless screenshot");
const r = spawnSync(edge, ["--headless", "--disable-gpu", "--window-size=700,1200", "--screenshot=tmp/widget.png", href], {
  timeout: 45000,
});
if (r.status !== 0) {
  process.stderr.write(r.stderr || "");
  throw new Error(`screenshot failed (${r.status})`);
}
console.log("wrote tmp/widget.png");
