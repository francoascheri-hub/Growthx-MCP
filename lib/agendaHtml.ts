// Self-contained HTML version of the PDF agenda (lib/pdf.tsx): same events, order, ranks and design. Inline CSS, no JS.
import type { Agenda, AgendaItem } from "./agenda";
import { cleanTitle, fmt, realHost, sentenceCase, short, time } from "./format";
import { laDate } from "./time";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const AGENDA_CSS = `
*{box-sizing:border-box;margin:0}
body{background:#000;color:#fff;font:300 14px/1.45 Inter,"Helvetica Neue",system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1100px;margin:0 auto;padding:36px 28px 28px}
.kicker{font-size:11px;font-weight:500;color:#95bf47;letter-spacing:.2em;text-transform:uppercase}
h1{font-size:clamp(30px,5vw,48px);font-weight:200;line-height:1.08;margin-top:10px;letter-spacing:-.01em}
.sub{color:#bdbdbd;font-size:15px;margin-top:8px}
.strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-top:26px;border-top:1px solid #333;border-bottom:1px solid #333}
.day{padding:12px 10px;border-right:1px solid #222}
.day:last-child{border-right:0}
.dn{font-size:10px;font-weight:500;color:#95bf47;letter-spacing:.15em;text-transform:uppercase}
.dd{font-size:22px;font-weight:200;margin:2px 0 8px}
.dl{font-size:12px;color:#d8d8d8;margin-bottom:6px;line-height:1.3}
.r{color:#95bf47;font-weight:500}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;margin-top:24px;align-items:stretch}
.card{background:#0e0e0e;border:1px solid #262626;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;height:100%}
.cover{display:block;height:120px;background:linear-gradient(135deg,#95bf47,#2f4a14) center/cover no-repeat}
.body{padding:12px 14px 14px;display:flex;flex-direction:column;flex:1}
.row{display:flex;justify-content:space-between;align-items:center;gap:8px}
.pill{font-size:11px;font-weight:500;color:#000;background:#95bf47;border-radius:999px;padding:2px 9px;white-space:nowrap}
.badge{font-size:12px;font-weight:500;color:#95bf47;border:1px solid #95bf47;border-radius:999px;padding:0 8px}
.t{font-size:17px;font-weight:300;line-height:1.25;margin-top:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.m{font-size:12px;color:#9a9a9a;margin-top:5px}
.w{font-size:13px;color:#e6e6e6;margin-top:8px;line-height:1.4;flex:1}
.f{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px}
.tags{display:flex;flex-wrap:wrap;gap:4px}
.tag{font-size:10px;color:#95bf47;border:1px solid #3a4a20;border-radius:999px;padding:1px 7px}
a.reg{font-size:13px;font-weight:500;color:#95bf47;text-decoration:none;white-space:nowrap}
a.reg:hover{text-decoration:underline}
.foot{display:flex;justify-content:space-between;color:#666;font-size:11px;margin-top:24px}
.empty{color:#bdbdbd;font-size:16px;margin-top:30px}
@media (max-width:700px){.wrap{padding:24px 18px}.grid{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}}
@media (max-width:520px){.wrap{padding:24px 16px}.grid{grid-template-columns:1fr}}
`;

export const WIDGET_EXTRA_CSS = `
.body .w{flex:0 1 auto}
.f{margin-top:8px}
.btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:10px}
.btn{font:inherit;font-size:13px;font-weight:500;border-radius:999px;padding:6px 14px;cursor:pointer;border:1px solid #95bf47;background:transparent;color:#95bf47;text-decoration:none;display:inline-block}
.btn:hover{background:#1a2a0e}
.btn.pri{background:#95bf47;color:#000;border-color:#95bf47}
.btn.pri:hover{filter:brightness(1.05)}
`;

export type AgendaWidgetView = {
  title: string;
  subtitle: string;
  from: string;
  to: string;
  pdfUrl: string;
  days: { weekday: string; date: string; lines: { time: string; title: string; rank: number }[] }[];
  items: {
    rank: number;
    pill: string;
    title: string;
    meta: string;
    why: string;
    tags: string[];
    url: string;
    cover?: string;
    start: string;
    end: string;
    venue: string;
  }[];
};

/** JSON-safe view of the PDF agenda for the MCP Apps widget (same copy, order and styling intent as agendaHtml). */
export function agendaWidgetView(a: Agenda, pdfUrl: string): AgendaWidgetView {
  const n = a.items.length;
  const dayKeys: { key: string; items: AgendaItem[] }[] = [];
  for (const it of a.items) {
    const key = laDate(it.e.start);
    const d = dayKeys.find((x) => x.key === key);
    if (d) d.items.push(it);
    else dayKeys.push({ key, items: [it] });
  }
  const days: AgendaWidgetView["days"] = dayKeys.map((d) => ({
    weekday: fmt(d.items[0].e.start, { weekday: "short" }),
    date: fmt(d.items[0].e.start, { month: "short", day: "numeric" }),
    lines: d.items.map((it) => ({
      time: time(it.e.start),
      title: short(cleanTitle(it.e.title).replace(/\s*\([^)]*\)/g, ""), 34),
      rank: it.rank,
    })),
  }));
  const items = a.items.map((it) => {
    const e = it.e;
    const host = realHost(e.host);
    const meta = [e.venue, host && `by ${host}`, e.price].filter(Boolean).join(" · ");
    const url = /^https?:\/\//.test(e.url) ? e.url : "";
    return {
      rank: it.rank,
      pill: `${fmt(e.start, { weekday: "short", month: "short", day: "numeric" })} · ${time(e.start)} PT`,
      title: cleanTitle(e.title),
      meta: short(meta, 90),
      why: it.why,
      tags: e.tags.slice(0, 3),
      url,
      cover: it.cover,
      start: e.start,
      end: e.end,
      venue: e.venue,
    };
  });
  return {
    title: short(sentenceCase(a.title), 90),
    subtitle: `Your ${n} best room${n === 1 ? "" : "s"}, ranked from ${a.total} SF event${a.total === 1 ? "" : "s"}`,
    from: a.from,
    to: a.to,
    pdfUrl,
    days,
    items,
  };
}

function card(it: AgendaItem): string {
  const e = it.e;
  const url = /^https?:\/\//.test(e.url) ? esc(e.url) : "";
  const host = realHost(e.host);
  const meta = [e.venue, host && `by ${host}`, e.price].filter(Boolean).join(" · ");
  const coverStyle = it.cover ? ` style="background-image:url('${esc(it.cover)}'),linear-gradient(135deg,#95bf47,#2f4a14)"` : "";
  const cover = url ? `<a class="cover" href="${url}" target="_blank" rel="noopener"${coverStyle}></a>` : `<div class="cover"${coverStyle}></div>`;
  const tags = e.tags.slice(0, 3).map((t) => `<span class="tag">#${esc(t)}</span>`).join("");
  return (
    `<article class="card">${cover}<div class="body">` +
    `<div class="row"><span class="pill">${esc(`${fmt(e.start, { weekday: "short", month: "short", day: "numeric" })} · ${time(e.start)} PT`)}</span><span class="badge">#${it.rank}</span></div>` +
    `<div class="t">${esc(short(cleanTitle(e.title), 80))}</div>` +
    (meta ? `<div class="m">${esc(short(meta, 90))}</div>` : "") +
    `<div class="w">${esc(it.why)}</div>` +
    `<div class="f"><div class="tags">${tags}</div>${url ? `<a class="reg" href="${url}" target="_blank" rel="noopener">Register on Luma ›</a>` : ""}</div>` +
    `</div></article>`
  );
}

export function agendaHtml(a: Agenda): string {
  const days: { key: string; items: AgendaItem[] }[] = [];
  for (const it of a.items) {
    const key = laDate(it.e.start);
    const d = days.find((x) => x.key === key);
    if (d) d.items.push(it);
    else days.push({ key, items: [it] });
  }
  const n = a.items.length;
  const strip = days
    .map(
      (d) =>
        `<div class="day"><div class="dn">${esc(fmt(d.items[0].e.start, { weekday: "short" }))}</div><div class="dd">${esc(fmt(d.items[0].e.start, { month: "short", day: "numeric" }))}</div>` +
        d.items
          .map((it) => `<div class="dl">${esc(`${time(it.e.start)} · ${short(cleanTitle(it.e.title).replace(/\s*\([^)]*\)/g, ""), 34)}`)} · <span class="r">#${it.rank}</span></div>`)
          .join("") +
        `</div>`,
    )
    .join("");
  const body = n
    ? `<div class="strip">${strip}</div><div class="grid">${a.items.map(card).join("")}</div>`
    : `<div class="empty">No matching events in this window. Try a broader goal or dates.</div>`;
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GrowthX events</title><style>${AGENDA_CSS}</style></head>` +
    `<body><div class="wrap"><div class="kicker">GrowthX · San Francisco</div><h1>${esc(short(sentenceCase(a.title), 90))}</h1>` +
    `<div class="sub">Your ${n} best room${n === 1 ? "" : "s"}, ranked from ${a.total} SF event${a.total === 1 ? "" : "s"}</div>${body}` +
    `<div class="foot"><span>growthx-mcp.vercel.app</span><span>${esc(`${a.from} – ${a.to}`)} · times in PT</span></div></div></body></html>`
  );
}


export function plainAgendaList(a: Agenda): string {
  return a.items
    .map((it) => {
      const e = it.e;
      const when = `${fmt(e.start, { weekday: "short", month: "short", day: "numeric" })} ${time(e.start)} PT`;
      return `#${it.rank} ${when} — ${cleanTitle(e.title)}`;
    })
    .join("\n");
}
