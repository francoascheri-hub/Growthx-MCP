// Data for the downloadable PDF agenda (/api/agenda.pdf). Same events as the tool that linked to it.
import { getEventById, getEvents } from "./data";
import { laDate } from "./time";
import { planMyWeek, reasonsFor, recommendEvents, searchEvents } from "./tools";
import type { GxEvent } from "./types";

export type AgendaQuery = {
  tool: "plan" | "recommend" | "search";
  goal?: string;
  title?: string;
  from?: string;
  to?: string;
  limit: number;
  ids?: string[];
};

export type AgendaItem = {
  rank: number;
  e: GxEvent;
  why: string;
  /** Rank of a higher-ranked event this one overlaps (30-min buffer), if any. */
  overlapsWith?: number;
  /** "Investors: … · Sponsors: …" from intel, if any. */
  people?: string;
  cover?: string; image?: { data: Buffer; format: "jpg" | "png" } };
export type Agenda = { title: string; from: string; to: string; total: number; items: AgendaItem[] };

export const MAX_PDF_EVENTS = 8;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function parseQuery(sp: URLSearchParams): AgendaQuery {
  const tool = sp.get("tool");
  const date = (k: string) => (DATE.test(sp.get(k) ?? "") ? sp.get(k)! : undefined);
  const ids = sp.get("ids")?.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_PDF_EVENTS);
  return {
    tool: tool === "recommend" || tool === "search" ? tool : "plan",
    goal: sp.get("goal")?.trim().slice(0, 200) || undefined,
    title: sp.get("title")?.trim().slice(0, 120) || undefined,
    from: date("from"),
    to: date("to"),
    limit: Math.min(MAX_PDF_EVENTS, Math.max(1, Number(sp.get("limit")) || 6)),
    ids: ids?.length ? ids : undefined,
  };
}

/** Absolute PDF link for a tool result: pins the exact events (ids, in rank order) and the date window. */
export function agendaUrl(origin: string, p: { tool?: string; goal?: string; title?: string; ids: string[]; from?: string; to?: string }) {
  const sp = new URLSearchParams();
  if (p.tool) sp.set("tool", p.tool);
  if (p.goal) sp.set("goal", p.goal.slice(0, 200));
  if (p.title) sp.set("title", p.title.slice(0, 120));
  if (p.from) sp.set("from", p.from);
  if (p.to) sp.set("to", p.to);
  if (p.ids.length) sp.set("ids", p.ids.slice(0, MAX_PDF_EVENTS).join(","));
  return `${origin}/api/agenda.pdf?${sp.toString()}`;
}

// One specific sentence per event from its own signals: format, host, investor terms, audience, topics, price.
const FORMATS: [string, RegExp][] = [
  ["pitch night", /\bpitch(es|ing)?\b/i],
  ["demo night", /\bdemo (night|day)\b/i],
  ["hackathon", /\b(hack|build)athon\b/i],
  ["breakfast", /\b(breakfast|brunch)\b/i],
  ["dinner", /\bdinner\b/i],
  ["happy hour", /\bhappy hour\b/i],
  ["fireside chat", /\bfireside\b/i],
  ["panel", /\bpanel\b/i],
  ["workshop", /\bworkshop\b/i],
  ["summit", /\b(summit|conference)\b/i],
  ["mixer", /\b(mixer|networking)\b/i],
  ["meetup", /\bmeetup\b/i],
];

function whyFor(e: GxEvent, reasons: string[], rank: number): string {
  const sig = (key: string) => {
    const r = reasons.find((x) => x.startsWith(`${key}:`) || x.startsWith(`${key} `));
    return r ? r.slice(key.length).replace(/^:?\s*/, "").split(/,\s*/).filter(Boolean) : [];
  };
  const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : (xs[0] ?? ""));
  const inv = sig("investor signals").slice(0, 2);
  const aud = sig("audience").slice(0, 2);
  const topics = sig("topics match").slice(0, 2);
  const format =
    FORMATS.find(([, re]) => re.test(e.title))?.[0] ?? FORMATS.find(([, re]) => re.test(e.description.slice(0, 600)))?.[0] ?? "event";
  const host = /see event page|^tba$|unknown/i.test(e.host) ? "" : e.host.split(/,|\s&\s|\sx\s/i)[0].trim().split(/\s+/).slice(0, 4).join(" ");
  const lead = `${format.charAt(0).toUpperCase()}${format.slice(1)}${host ? ` by ${host}` : ""}`;
  const v = rank % 3;
  const hook = inv.length
    ? [`with ${and(inv)} on the agenda`, `expect ${and(inv)} in the room`, `strong investor presence (${and(inv)})`][v]
    : aud.length
      ? [`a room of ${and(aud)}`, `mostly ${and(aud)} attend`, `built for ${and(aud)}`][v] + (topics.length ? `, on ${and(topics)}` : "")
      : topics.length
        ? [`focused on ${and(topics)}`, `deep on ${and(topics)}`, `all about ${and(topics)}`][v]
        : "a close match for your goal";
  const price = /free/i.test(e.price) ? "free" : e.price ? `${e.price} ticket` : "";
  const words = `${lead}: ${hook}${price ? `; ${price}` : ""}`.split(/\s+/);
  return `${words.slice(0, 20).join(" ").replace(/[;,:]$/, "")}.`;
}

// og:image from the Luma page (URL for HTML, bytes for PDF), cached per warm instance; any failure -> no image.
const coverCache = new Map<string, string | null>();
const imageCache = new Map<string, AgendaItem["image"] | null>();

async function fetchWithTimeout(url: string, ms: number, accept: string) {
  return fetch(url, { headers: { accept, "user-agent": "Mozilla/5.0 (GrowthX agenda)" }, signal: AbortSignal.timeout(ms) });
}

async function coverUrl(pageUrl: string): Promise<string | undefined> {
  if (!/^https?:\/\//.test(pageUrl)) return undefined;
  if (coverCache.has(pageUrl)) return coverCache.get(pageUrl) ?? undefined;
  let src: string | null = null;
  try {
    const html = await (await fetchWithTimeout(pageUrl, 3000, "text/html")).text();
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const u = m?.[1].replace(/&amp;/g, "&").replace(/format=auto/, "format=jpg");
    // Safe to embed in CSS url('...') and HTML attributes.
    if (u && /^https:\/\/[^\s'"()<>\\]+$/.test(u)) src = u;
  } catch {
    src = null;
  }
  coverCache.set(pageUrl, src);
  return src ?? undefined;
}

async function coverImage(src: string | undefined): Promise<AgendaItem["image"]> {
  if (!src) return undefined;
  if (imageCache.has(src)) return imageCache.get(src) ?? undefined;
  let img: AgendaItem["image"] | null = null;
  try {
    const res = await fetchWithTimeout(src, 4000, "image/jpeg,image/png");
    const type = res.headers.get("content-type") ?? "";
    const format = /png/.test(type) ? "png" : /jpe?g/.test(type) ? "jpg" : null;
    if (res.ok && format) img = { data: Buffer.from(await res.arrayBuffer()), format };
  } catch {
    img = null;
  }
  imageCache.set(src, img);
  return img ?? undefined;
}

const INVESTOR = /\b(investor|vc|venture|capital|angel|general partner|managing partner|gp|fund)\b/i;

/** Investors attending and sponsors, from intel data; undefined when there's nothing to show. */
function peopleOf(e: GxEvent): string | undefined {
  const inv = e.attendees
    .filter((a) => a.name && INVESTOR.test(`${a.role} ${a.company}`))
    .slice(0, 3)
    .map((a) => (a.company ? `${a.name} (${a.company})` : a.name));
  const sp = [...(e.sponsors ?? [])].slice(0, 3);
  const parts = [inv.length ? `Investors: ${inv.join(", ")}` : "", sp.length ? `Sponsors: ${sp.join(", ")}` : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

export async function buildAgenda(q: AgendaQuery, opts: { imageBytes?: boolean } = { imageBytes: true }): Promise<Agenda> {
  const today = laDate(new Date().toISOString());
  let from = q.from ?? today;
  let to = q.to ?? addDays(from, 6);
  if (to < from) to = from;

  let picked: GxEvent[];
  if (q.ids) {
    picked = (await Promise.all(q.ids.map((id) => getEventById(id)))).filter((e): e is GxEvent => Boolean(e));
    if (!q.from && !q.to && picked.length) {
      const days = picked.map((e) => laDate(e.start)).sort();
      from = days[0];
      to = days[days.length - 1];
    }
  } else {
    let ids: string[];
    if (q.tool === "search") {
      ids = (await searchEvents({ query: q.goal, date_from: from, date_to: to, limit: q.limit })).results.map((r) => r.id);
    } else if (q.tool === "recommend") {
      ids = (await recommendEvents({ goal: q.goal ?? "meet founders", limit: q.limit, date_from: from, date_to: to })).recommendations.map((r) => r.id);
    } else {
      const plan = await planMyWeek({ goal: q.goal ?? "meet founders", date_from: from, date_to: to, max_events: q.limit });
      ids = [...plan.agenda].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).map((r) => r.id);
    }
    picked = (await Promise.all(ids.map((id) => getEventById(id)))).filter((e): e is GxEvent => Boolean(e));
  }
  picked = picked.filter((e) => laDate(e.start) >= from && laDate(e.start) <= to).slice(0, MAX_PDF_EVENTS);

  const reasons = q.goal ? await reasonsFor(q.goal, picked) : new Map<string, string[]>();
  const covers = await Promise.all(picked.map((e) => coverUrl(e.url)));
  const images = opts.imageBytes ? await Promise.all(covers.map((c) => coverImage(c))) : [];
  const items = picked
    .map((e, i) => ({ rank: i + 1, e, why: whyFor(e, reasons.get(e.id) ?? [], i + 1), cover: covers[i], image: images[i] }))
    .sort((a, b) => new Date(a.e.start).getTime() - new Date(b.e.start).getTime());
  const ms = (iso: string) => new Date(iso).getTime();
  const BUF = 30 * 60_000;
  for (const it of items) {
    const clash = items
      .filter((o) => o.rank < it.rank && ms(o.e.start) < ms(it.e.end) + BUF && ms(it.e.start) < ms(o.e.end) + BUF)
      .sort((a, b) => a.rank - b.rank)[0];
    if (clash) Object.assign(it, { overlapsWith: clash.rank });
    Object.assign(it, { people: peopleOf(it.e) });
  }
  const total = (await getEvents()).filter((e) => laDate(e.start) >= from && laDate(e.start) <= to).length;
  return { title: q.title ?? q.goal ?? "Your week in SF tech", from, to, total, items };
}
