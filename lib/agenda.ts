// Data for the downloadable PDF agenda (/api/agenda.pdf). Same events as the tool that linked to it.
import { getEventById, getEvents } from "./data";
import { laDate } from "./time";
import { planMyWeek, reasonsFor, recommendEvents, searchEvents } from "./tools";
import type { GxEvent } from "./types";

export type AgendaQuery = {
  tool: "plan" | "recommend" | "search";
  goal?: string;
  from?: string;
  to?: string;
  limit: number;
  ids?: string[];
};

export type AgendaItem = { rank: number; e: GxEvent; why: string; image?: { data: Buffer; format: "jpg" | "png" } };
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
    from: date("from"),
    to: date("to"),
    limit: Math.min(MAX_PDF_EVENTS, Math.max(1, Number(sp.get("limit")) || 6)),
    ids: ids?.length ? ids : undefined,
  };
}

/** Absolute PDF link for a tool result: pins the exact events (ids, in rank order) and the date window. */
export function agendaUrl(origin: string, p: { tool?: string; goal?: string; ids: string[]; from?: string; to?: string }) {
  const sp = new URLSearchParams();
  if (p.tool) sp.set("tool", p.tool);
  if (p.goal) sp.set("goal", p.goal.slice(0, 200));
  if (p.from) sp.set("from", p.from);
  if (p.to) sp.set("to", p.to);
  if (p.ids.length) sp.set("ids", p.ids.slice(0, MAX_PDF_EVENTS).join(","));
  return `${origin}/api/agenda.pdf?${sp.toString()}`;
}

// Raw ranking signals ("topics match: ai, founders; audience: investors") -> one human sentence.
function humanWhy(reasons: string[]): string {
  const list = (s: string) => {
    const xs = s.split(/,\s*/).filter(Boolean).slice(0, 3);
    return xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : (xs[0] ?? "");
  };
  const parts: string[] = [];
  let mentions = "";
  for (const r of reasons) {
    const [k, v = ""] = r.split(/:\s*/, 2);
    if (k === "topics match") parts.push(`it's squarely about ${list(v)}`);
    else if (k === "audience") parts.push(`the room skews ${list(v)}`);
    else if (k === "investor signals") parts.push(`there are real investor signals (${list(v)})`);
    else if (r.startsWith("mentions ")) mentions = r.slice(9);
    else if (/relevant attendee/.test(r)) parts.push(`people you'd want to meet are going, like ${r.split("e.g. ")[1] ?? "several founders"}`);
  }
  if (!parts.length && mentions) parts.push(`it touches on ${list(mentions)}`);
  if (!parts.length) return "One of the closest upcoming matches for what you're after.";
  const s = parts.length > 1 ? `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}` : parts[0];
  return `Worth it because ${s}.`;
}

// og:image from the Luma page, cached per warm instance; any failure -> no image.
const imageCache = new Map<string, AgendaItem["image"] | null>();

async function fetchWithTimeout(url: string, ms: number, accept: string) {
  return fetch(url, { headers: { accept, "user-agent": "Mozilla/5.0 (GrowthX agenda)" }, signal: AbortSignal.timeout(ms) });
}

async function coverImage(pageUrl: string): Promise<AgendaItem["image"]> {
  if (!/^https?:\/\//.test(pageUrl)) return undefined;
  if (imageCache.has(pageUrl)) return imageCache.get(pageUrl) ?? undefined;
  let img: AgendaItem["image"] | null = null;
  try {
    const html = await (await fetchWithTimeout(pageUrl, 3000, "text/html")).text();
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (m) {
      const src = m[1].replace(/&amp;/g, "&").replace(/format=auto/, "format=jpg");
      const res = await fetchWithTimeout(src, 4000, "image/jpeg,image/png");
      const type = res.headers.get("content-type") ?? "";
      const format = /png/.test(type) ? "png" : /jpe?g/.test(type) ? "jpg" : null;
      if (res.ok && format) img = { data: Buffer.from(await res.arrayBuffer()), format };
    }
  } catch {
    img = null;
  }
  imageCache.set(pageUrl, img);
  return img ?? undefined;
}

export async function buildAgenda(q: AgendaQuery): Promise<Agenda> {
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
  const images = await Promise.all(picked.map((e) => coverImage(e.url)));
  const items = picked
    .map((e, i) => ({ rank: i + 1, e, why: humanWhy(reasons.get(e.id) ?? []), image: images[i] }))
    .sort((a, b) => new Date(a.e.start).getTime() - new Date(b.e.start).getTime());
  const total = (await getEvents()).filter((e) => laDate(e.start) >= from && laDate(e.start) <= to).length;
  return { title: q.goal ?? "Your week in SF tech", from, to, total, items };
}
