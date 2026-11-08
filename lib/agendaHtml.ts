// Self-contained HTML version of the PDF agenda (lib/pdf.tsx): same events, order, ranks and design. Inline CSS, no JS.
import type { Agenda, AgendaItem } from "./agenda";
import { cleanTitle, fmt, realHost, sentenceCase, short, time } from "./format";
import { laDate } from "./time";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const AGENDA_CSS = `
*{box-sizing:border-box;margin:0}
body{background:#0b0c0a;color:#ededE8;font:400 14px/1.5 Geist,"SF Pro Text",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.mono,.kicker,.dn,.tm,.r,.pill,.badge,.chip,.tag,.ov,.foot{font-family:"Geist Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
.wrap{max-width:1100px;margin:0 auto;padding:36px 28px 28px}
.kicker{font-size:11px;font-weight:500;color:#95bf47;letter-spacing:.18em;text-transform:uppercase}
h1{font-size:clamp(26px,4vw,36px);font-weight:300;line-height:1.12;margin-top:12px;letter-spacing:-.02em;max-width:34ch;text-wrap:balance}
.sub{color:#8a8f85;font-size:14px;margin-top:8px}
.sum{margin-top:20px;padding:2px 0 2px 16px;border-left:2px solid #95bf47;color:#d9dbd3;font-size:14px;line-height:1.65;white-space:pre-line;max-width:72ch}
.acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.btn{font:inherit;font-size:13px;font-weight:500;line-height:1;border-radius:999px;padding:9px 16px;cursor:pointer;border:1px solid #2c3226;background:transparent;color:#ededE8;text-decoration:none;display:inline-flex;align-items:center;white-space:nowrap;transition:transform .3s cubic-bezier(.16,1,.3,1),background-color .3s cubic-bezier(.16,1,.3,1),border-color .3s cubic-bezier(.16,1,.3,1)}
.btn:hover{transform:translateY(-1px);border-color:#3d4535;background:#171a14}
.btn:active{transform:translateY(1px) scale(.98)}
.btn.pri{background:#95bf47;color:#0b0c0a;border-color:#95bf47}
.btn.pri:hover{background:#a3cb57;border-color:#a3cb57}
.strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:30px;border-top:1px solid #1f231b;border-bottom:1px solid #1f231b}
.day{padding:16px 16px 12px;border-left:1px solid #1f231b;min-width:0}
.day:first-child{border-left:0;padding-left:0}
.dn{font-size:10.5px;font-weight:500;color:#95bf47;letter-spacing:.16em;text-transform:uppercase}
.dd{font-size:22px;font-weight:300;letter-spacing:-.01em;margin:4px 0 10px}
.dl{font-size:12.5px;color:#c9ccc3;margin-bottom:8px;line-height:1.4}
.tm{font-size:11px;color:#8a8f85}
.r{font-size:11px;color:#95bf47;font-weight:500}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));grid-auto-flow:dense;gap:16px;margin-top:28px;align-items:stretch}
.card{position:relative;background:#121410;border:1px solid #1f231b;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;min-width:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.04);transition:transform .3s cubic-bezier(.16,1,.3,1),border-color .3s cubic-bezier(.16,1,.3,1)}
.card:hover{transform:translateY(-2px);border-color:#2c3226}
.card.feat{grid-column:span 2;order:-1;background:#171a14}
.cover{display:block;position:relative;height:132px;overflow:hidden;background:linear-gradient(135deg,#0b0c0a 0%,#171f10 55%,#4d6a22 130%)}
.feat .cover{height:200px}
.ini{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:56px;font-weight:300;color:#95bf47}
.feat .ini{font-size:84px}
.cimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.chips{position:absolute;top:10px;left:10px;display:flex;gap:6px;z-index:1}
.chip{font-size:11px;font-weight:500;color:#ededE8;background:rgba(11,12,10,.72);border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:3px 9px;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.chip.best{color:#95bf47;text-transform:uppercase;letter-spacing:.12em;font-size:10px;padding-top:4px}
.body{padding:14px 16px 16px;display:flex;flex-direction:column;flex:1;min-width:0}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.pill{font-size:11px;color:#95bf47;border:1px solid #2f3a20;background:rgba(149,191,71,.06);border-radius:999px;padding:3px 9px;white-space:nowrap}
.ov{font-size:11px;color:#e0b04a;border:1px solid rgba(224,176,74,.45);border-radius:999px;padding:3px 9px;white-space:nowrap}
.t{font-size:17px;font-weight:400;line-height:1.3;letter-spacing:-.01em;margin-top:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.feat .t{font-size:22px;font-weight:300;letter-spacing:-.015em}
.m{font-size:12.5px;color:#8a8f85;margin-top:6px;line-height:1.45}
.w{font-size:13.5px;color:#c9ccc3;margin-top:10px;line-height:1.5}
.pp{font-size:12.5px;color:#a9b98a;margin-top:8px}
.f{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:12px}
.tags{display:flex;flex-wrap:wrap;gap:5px}
.tag{font-size:10.5px;color:#8a8f85;border:1px solid #262b21;border-radius:6px;padding:2px 7px}
.btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:16px}
.foot{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;color:#5d6258;font-size:11px;margin-top:32px;padding-top:16px;border-top:1px solid #1f231b}
.empty{margin-top:36px;max-width:46ch}
.empty .et{font-size:20px;font-weight:300;letter-spacing:-.01em}
.empty .eh{color:#8a8f85;font-size:14px;margin-top:6px}
@keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:no-preference){.card{animation:up .7s cubic-bezier(.16,1,.3,1) backwards;animation-delay:calc(var(--i,0) * 60ms)}}
@media (max-width:640px){.wrap{padding:24px 16px}.grid{grid-template-columns:1fr}.card.feat{grid-column:span 1}.feat .cover{height:160px}.strip{grid-template-columns:1fr}.day{border-left:0;padding-left:0;border-top:1px solid #1f231b}.day:first-child{border-top:0}}
`;

export const WIDGET_EXTRA_CSS = `
html,body{height:auto;min-height:0}
#app{display:flow-root}
button.btn{-webkit-appearance:none;appearance:none}
`;

export type AgendaWidgetView = {
  title: string;
  subtitle: string;
  summary: string;
  from: string;
  to: string;
  pdfUrl: string;
  icsUrl: string;
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
    initial: string;
    overlapsWith?: number;
    people?: string;
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
      initial: initialOf(e.title),
      overlapsWith: it.overlapsWith,
      people: it.people,
      start: e.start,
      end: e.end,
      venue: e.venue,
    };
  });
  return {
    title: short(sentenceCase(a.title), 90),
    summary: a.summary,
    subtitle: `Your ${n} best room${n === 1 ? "" : "s"}, ranked from ${a.total} SF event${a.total === 1 ? "" : "s"}`,
    from: a.from,
    to: a.to,
    pdfUrl,
    icsUrl: icsUrlFor(pdfUrl),
    days,
    items,
  };
}

/** Same query as the PDF link, served as a whole-agenda .ics calendar. */
export const icsUrlFor = (pdfUrl: string) => pdfUrl.replace("/api/agenda.pdf", "/api/agenda.ics");

/** Letter shown on the generic GrowthX cover when an event has no (or a broken) image. */
export const initialOf = (title: string) => (cleanTitle(title).match(/[\p{L}\p{N}]/u)?.[0] ?? "G").toUpperCase();

function card(it: AgendaItem, i: number): string {
  const e = it.e;
  const url = /^https?:\/\//.test(e.url) ? esc(e.url) : "";
  const host = realHost(e.host);
  const meta = [e.venue, host && `by ${host}`, e.price].filter(Boolean).join(" · ");
  // Generic GrowthX cover (initial on gradient) underneath; the Luma image covers it and removes itself if it fails.
  const feat = it.rank === 1;
  const chips = `<span class="chips"><span class="chip">#${it.rank}</span>${feat ? `<span class="chip best">Best pick</span>` : ""}</span>`;
  const inner = `${chips}<span class="ini">${esc(initialOf(e.title))}</span>${it.cover ? `<img class="cimg" src="${esc(it.cover)}" alt="" onerror="this.remove()">` : ""}`;
  const cover = url ? `<a class="cover" href="${url}" target="_blank" rel="noopener">${inner}</a>` : `<div class="cover">${inner}</div>`;
  const tags = e.tags.slice(0, 3).map((t) => `<span class="tag">#${esc(t)}</span>`).join("");
  return (
    `<article class="card${feat ? " feat" : ""}" style="--i:${i}">${cover}<div class="body">` +
    `<div class="row"><span class="pill">${esc(`${fmt(e.start, { weekday: "short", month: "short", day: "numeric" })} · ${time(e.start)} PT`)}</span>${it.overlapsWith ? `<span class="ov">Overlaps with #${it.overlapsWith}</span>` : ""}</div>` +
    `<div class="t">${esc(short(cleanTitle(e.title), 80))}</div>` +
    (meta ? `<div class="m">${esc(short(meta, 90))}</div>` : "") +
    `<div class="w">${esc(it.why)}</div>` +
    (it.people ? `<div class="pp">${esc(it.people)}</div>` : "") +
    (tags ? `<div class="f"><div class="tags">${tags}</div></div>` : "") +
    (url ? `<div class="btns"><a class="btn pri" href="${url}" target="_blank" rel="noopener">Register on Luma</a></div>` : "") +
    `</div></article>`
  );
}

export function agendaHtml(a: Agenda, icsUrl?: string): string {
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
          .map((it) => `<div class="dl"><span class="tm">${esc(time(it.e.start))}</span> · ${esc(short(cleanTitle(it.e.title).replace(/\s*\([^)]*\)/g, ""), 34))} · <span class="r">#${it.rank}</span></div>`)
          .join("") +
        `</div>`,
    )
    .join("");
  const body = n
    ? `<div class="strip">${strip}</div><div class="grid">${a.items.map((it, i) => card(it, i)).join("")}</div>`
    : `<div class="empty"><div class="et">No rooms matched this window.</div><div class="eh">Try broadening your interests or widening the dates.</div></div>`;
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GrowthX events</title><style>${AGENDA_CSS}</style></head>` +
    `<body><div class="wrap"><div class="kicker">GrowthX · San Francisco</div><h1>${esc(short(sentenceCase(a.title), 90))}</h1>` +
    `<div class="sub">Your ${n} best room${n === 1 ? "" : "s"}, ranked from ${a.total} SF event${a.total === 1 ? "" : "s"}</div>` +
    (a.summary ? `<div class="sum">${esc(a.summary)}</div>` : "") +
    (icsUrl && n ? `<div class="acts"><a class="btn pri" href="${esc(icsUrl)}">Add whole week to calendar</a></div>` : "") +
    body +
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
