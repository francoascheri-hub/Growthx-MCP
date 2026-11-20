// Self-contained HTML version of the PDF agenda (lib/pdf.tsx): same events, order, ranks and design. Inline CSS, no JS.
// Warm brand palette (shared with lib/pdf.tsx): page moss #1B1C13, cards moss-2 #272819, hairlines line-dark #383A27,
// titles/accents butter #F3E47A (hover #F7EC9E), body/muted olive-soft #A6A97A, olive #545A2A for fills/rules.
// Terracotta #D4532A only once per page: the 6px dot before the featured [ BEST PICK ] label. No italics.
// Type: "Inter Tight" 400 body / 500 headlines; "Geist Mono" 400 uppercase +.04em for labels (brackets via CSS).
import type { Agenda, AgendaItem } from "./agenda";
import { cleanTitle, fmt, realHost, sentenceCase, short, time } from "./format";
import { laDate } from "./time";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const AGENDA_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Geist+Mono:wght@400&display=swap");
*{box-sizing:border-box;margin:0}
body{background:#1B1C13;color:#A6A97A;font:400 14px/1.5 "Inter Tight",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;font-style:normal;-webkit-font-smoothing:antialiased}
.mono,.kicker,.dn,.tm,.r,.pill,.badge,.chip,.tag,.ov,.foot{font-family:"Geist Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:400;text-transform:uppercase;letter-spacing:.04em}
.wrap{max-width:1100px;margin:0 auto;padding:36px 28px 28px}
.kicker{font-size:11px;color:#F3E47A}
.kicker::before,.dn::before,.chip.best::before{content:"[ "}
.kicker::after,.dn::after,.chip.best::after{content:" ]"}
h1{font-size:clamp(26px,4vw,36px);font-weight:500;color:#F3E47A;line-height:1.12;margin-top:12px;letter-spacing:-.02em;max-width:34ch;text-wrap:balance}
.sub{color:#A6A97A;font-size:14px;margin-top:8px}
.sum{margin-top:20px;padding:2px 0 2px 16px;border-left:2px solid #545A2A;color:#A6A97A;font-size:14px;line-height:1.65;white-space:pre-line;max-width:72ch}
.acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.btn{font:inherit;font-size:13px;font-weight:500;line-height:1;border-radius:999px;padding:9px 16px;cursor:pointer;border:1px solid #383A27;background:transparent;color:#F3E47A;text-decoration:none;display:inline-flex;align-items:center;white-space:nowrap;transition:transform .3s cubic-bezier(.16,1,.3,1),background-color .3s cubic-bezier(.16,1,.3,1),border-color .3s cubic-bezier(.16,1,.3,1),color .3s cubic-bezier(.16,1,.3,1)}
.btn:hover{transform:translateY(-1px);border-color:#545A2A;background:#272819;color:#F7EC9E}
.btn:active{transform:translateY(1px) scale(.98)}
.btn.pri{background:#F3E47A;color:#1B1C13;border-color:#F3E47A}
.btn.pri:hover{background:#F7EC9E;border-color:#F7EC9E;color:#1B1C13}
.strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:30px;border-top:1px solid #383A27;border-bottom:1px solid #383A27}
.day{padding:16px 16px 12px;border-left:1px solid #383A27;min-width:0}
.day:first-child{border-left:0;padding-left:0}
.dn{font-size:10.5px;color:#F3E47A}
.dd{font-size:22px;font-weight:500;color:#F3E47A;letter-spacing:-.01em;margin:4px 0 10px}
.dl{font-size:12.5px;color:#A6A97A;margin-bottom:8px;line-height:1.4}
.tm{font-size:11px;color:#A6A97A}
.r{font-size:11px;color:#F3E47A}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));grid-auto-flow:dense;gap:16px;margin-top:28px;align-items:stretch}
.card{position:relative;background:#272819;border:1px solid #383A27;border-radius:6px;overflow:hidden;display:flex;flex-direction:column;min-width:0;transition:transform .3s cubic-bezier(.16,1,.3,1),border-color .3s cubic-bezier(.16,1,.3,1)}
.card:hover{transform:translateY(-2px);border-color:#545A2A}
.card.feat{grid-column:span 2;order:-1}
.cover{display:block;position:relative;height:132px;overflow:hidden;background:#1B1C13;border-bottom:1px solid #383A27}
.feat .cover{height:200px}
.ini{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:56px;font-weight:500;color:#F3E47A}
.feat .ini{font-size:84px}
.cimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.chips{position:absolute;top:10px;left:10px;display:flex;gap:6px;z-index:1}
.chip{font-size:11px;color:#F3E47A;background:rgba(27,28,19,.78);border:1px solid rgba(243,228,122,.18);border-radius:999px;padding:3px 9px}
.chip.best{color:#F3E47A;background-color:rgba(27,28,19,.78);border-color:rgba(243,228,122,.18);font-size:10px;padding:4px 9px 3px 21px;background-image:radial-gradient(circle,#D4532A 0 3px,transparent 3.5px);background-size:6px 6px;background-position:9px 50%;background-repeat:no-repeat;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.body{padding:14px 16px 16px;display:flex;flex-direction:column;flex:1;min-width:0}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.pill{font-size:11px;color:#1B1C13;border:1px solid #F3E47A;background:#F3E47A;border-radius:999px;padding:3px 9px;white-space:nowrap}
.ov{font-size:11px;color:#A6A97A;border:1px solid #A6A97A;background:transparent;border-radius:999px;padding:3px 9px;white-space:nowrap}
.t{font-size:17px;font-weight:500;color:#F3E47A;line-height:1.3;letter-spacing:-.01em;margin-top:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.feat .t{font-size:22px;letter-spacing:-.015em}
.m{font-size:12.5px;color:#A6A97A;margin-top:6px;line-height:1.45}
.w{font-size:13.5px;color:#A6A97A;margin-top:10px;line-height:1.5}
.pp{font-size:12.5px;color:#A6A97A;margin-top:8px}
.f{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:12px}
.tags{display:flex;flex-wrap:wrap;gap:5px}
.tag{font-size:10.5px;color:#A6A97A;background:transparent;border:1px solid #383A27;border-radius:4px;padding:2px 7px}
.btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:16px}
.foot{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;color:#A6A97A;font-size:11px;margin-top:32px;padding-top:16px;border-top:1px solid #383A27}
.empty{margin-top:36px;max-width:46ch}
.empty .et{font-size:20px;font-weight:500;color:#F3E47A;letter-spacing:-.01em}
.empty .eh{color:#A6A97A;font-size:14px;margin-top:6px}
@keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:no-preference){.card{animation:up .7s cubic-bezier(.16,1,.3,1) backwards;animation-delay:calc(var(--i,0) * 60ms)}}
@media (max-width:640px){.wrap{padding:24px 16px}.grid{grid-template-columns:1fr}.card.feat{grid-column:span 1}.feat .cover{height:160px}.strip{grid-template-columns:1fr}.day{border-left:0;padding-left:0;border-top:1px solid #383A27}.day:first-child{border-top:0}}
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
  // Generic GrowthX cover (butter initial on moss) underneath; the Luma image covers it and removes itself if it fails.
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
