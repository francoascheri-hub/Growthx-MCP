import { dataStatus, getEventById, getEvents } from "./data";
import { deriveTags } from "./intel";
import { completeJSON, completeText, llmProvider } from "./llm";
import { laDate, laLabel } from "./time";
import type { GxEvent } from "./types";

// Tool logic, independent of MCP transport. Deterministic by default; LLM only enriches when a key is set.

type Filters = { tags: string[]; audience: string[]; keywords: string[] };

const STOP = new Set(
  "i im i'm a an the and or to of in on for at with my me we our is are be want looking find meet some this next week sf san francisco events event people who that it as".split(" "),
);

export function summarize(e: GxEvent) {
  return {
    id: e.id,
    title: e.title,
    when: laLabel(e.start),
    start: e.start,
    end: e.end,
    venue: e.venue,
    neighborhood: e.neighborhood || undefined,
    host: e.host,
    tags: e.tags,
    price: e.price,
    url: e.url,
  };
}

async function requireEvent(id: string): Promise<GxEvent> {
  const e = await getEventById(id);
  if (!e) throw new Error(`Unknown event_id "${id}". Use search_events to find valid ids.`);
  return e;
}

function keywordsOf(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9+-]+/).filter((w) => w.length > 2 && !STOP.has(w)))];
}

function audienceOf(text: string): string[] {
  const out: string[] = [];
  if (/founder|startup|ceo|raising|fundrais/i.test(text)) out.push("founders");
  if (/invest|vc|angel/i.test(text)) out.push("investors");
  if (/engineer|developer|hire|hiring|cto|technical/i.test(text)) out.push("engineers");
  if (/design/i.test(text)) out.push("designers");
  if (/product|pm\b/i.test(text)) out.push("pms");
  if (/research/i.test(text)) out.push("researchers");
  return out;
}

const GOAL_EXPANSIONS: [RegExp, string[]][] = [
  [/rais|fundrais|investor|vc|seed|pre-seed|angel/i, ["fundraising", "founders"]],
  [/hire|hiring|recruit|engineer/i, ["hiring", "engineers"]],
  [/cofounder|co-founder/i, ["founders", "community"]],
  [/customer|sell|sales|gtm|design partner/i, ["gtm", "growth", "b2b-saas"]],
  [/agent/i, ["agents", "ai"]],
];

export async function goalToFilters(goal: string): Promise<Filters & { via: "llm" | "rules" }> {
  const tags = new Set(deriveTags(goal));
  for (const [re, extra] of GOAL_EXPANSIONS) if (re.test(goal)) extra.forEach((t) => tags.add(t));
  const base: Filters = { tags: [...tags], audience: audienceOf(goal), keywords: keywordsOf(goal) };
  if (!llmProvider()) return { ...base, via: "rules" };
  const llm = await completeJSON<Partial<Filters>>(
    "You turn a professional's networking goal into event search filters for SF tech events. Tags are lowercase single words or kebab-case (e.g. ai, agents, fundraising, devtools, climate, hiring, gtm).",
    `Goal: ${goal}\nReturn {"tags": string[], "audience": string[], "keywords": string[]} (max 8 each).`,
  );
  if (!llm) return { ...base, via: "rules" };
  return {
    tags: [...new Set([...base.tags, ...(llm.tags ?? []).map((t) => t.toLowerCase())])],
    audience: [...new Set([...base.audience, ...(llm.audience ?? [])])],
    keywords: [...new Set([...base.keywords, ...(llm.keywords ?? []).map((k) => k.toLowerCase())])],
    via: "llm",
  };
}

function scoreEvent(e: GxEvent, f: Filters): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const tagHits = e.tags.filter((t) => f.tags.includes(t));
  if (tagHits.length) {
    score += tagHits.length * 3;
    reasons.push(`topics match: ${tagHits.join(", ")}`);
  }
  const hay = `${e.title} ${e.description} ${e.host}`.toLowerCase();
  const kwHits = f.keywords.filter((k) => hay.includes(k));
  if (kwHits.length) {
    score += kwHits.length * 2;
    reasons.push(`mentions ${kwHits.slice(0, 4).join(", ")}`);
  }
  const audHits = e.audience.filter((a) => f.audience.includes(a));
  if (audHits.length) {
    score += audHits.length * 2;
    reasons.push(`audience: ${audHits.join(", ")}`);
  }
  const people = e.attendees.filter((a) =>
    f.keywords.some((k) => `${a.role} ${a.looking_for ?? ""} ${a.interests.join(" ")}`.toLowerCase().includes(k)),
  );
  if (people.length) {
    score += Math.min(people.length, 3);
    reasons.push(`${people.length} relevant attendee(s), e.g. ${people[0].name}`);
  }
  if (e.sponsors?.length) score += 0.5;
  if ((e.registered ?? 0) > 100) score += 0.5;
  return { score, reasons };
}

async function rank(goal: string, pool?: GxEvent[]) {
  const filters = await goalToFilters(goal);
  const events = pool ?? (await getEvents());
  const ranked = events
    .map((e) => ({ e, ...scoreEvent(e, filters) }))
    .sort((a, b) => b.score - a.score || a.e.start.localeCompare(b.e.start));
  return { filters, ranked };
}

// ---------- tools ----------

export async function searchEvents(args: {
  query?: string; tags?: string[]; date_from?: string; date_to?: string; neighborhood?: string; free_only?: boolean; limit?: number;
}) {
  const events = await getEvents();
  const kws = args.query ? keywordsOf(args.query) : [];
  const tags = (args.tags ?? []).map((t) => t.toLowerCase());
  const results = events
    .filter((e) => !args.date_from || laDate(e.start) >= args.date_from)
    .filter((e) => !args.date_to || laDate(e.start) <= args.date_to)
    .filter((e) => !args.neighborhood || `${e.neighborhood} ${e.venue}`.toLowerCase().includes(args.neighborhood.toLowerCase()))
    .filter((e) => !args.free_only || /free/i.test(e.price))
    .filter((e) => !tags.length || tags.some((t) => e.tags.includes(t)))
    .map((e) => {
      const hay = `${e.title} ${e.description} ${e.host} ${e.tags.join(" ")}`.toLowerCase();
      return { e, hits: kws.filter((k) => hay.includes(k)).length };
    })
    .filter((x) => !kws.length || x.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.e.start.localeCompare(b.e.start))
    .slice(0, args.limit ?? 10)
    .map((x) => summarize(x.e));
  return { ...(await dataStatus()), count: results.length, results };
}

export async function getEvent(args: { event_id: string }) {
  const e = await requireEvent(args.event_id);
  return { ...e, when: laLabel(e.start) };
}

export async function recommendEvents(args: { goal: string; limit?: number }) {
  const { filters, ranked } = await rank(args.goal);
  const top = ranked.slice(0, args.limit ?? 3);
  let why = top.map((r) =>
    r.reasons.length ? `Good fit because ${r.reasons.join("; ")}.` : "Closest upcoming match; few explicit signals.",
  );
  if (llmProvider()) {
    const llm = await completeJSON<string[]>(
      "You explain in one punchy sentence each why an SF tech event fits a person's goal. Be concrete, no hype.",
      `Goal: ${args.goal}\nEvents:\n${top.map((r, i) => `${i + 1}. ${r.e.title} — ${r.e.description.slice(0, 300)} (signals: ${r.reasons.join("; ")})`).join("\n")}\nReturn a JSON array of ${top.length} strings.`,
    );
    if (llm?.length === top.length) why = llm;
  }
  return {
    goal: args.goal,
    filters_used: filters,
    recommendations: top.map((r, i) => ({ ...summarize(r.e), score: Number(r.score.toFixed(1)), why: why[i] })),
  };
}

type Contact = { name: string; kind: "attendee" | "host" | "sponsor" | "community"; role: string; reason: string; score: number };

function contactsFor(e: GxEvent, goal: string): Contact[] {
  const kws = keywordsOf(goal);
  const filters = audienceOf(goal);
  const out: Contact[] = e.attendees
    .filter((a) => a.name)
    .map((a) => {
      const hay = `${a.role} ${a.company} ${a.looking_for ?? ""} ${a.interests.join(" ")}`.toLowerCase();
      const hits = kws.filter((k) => hay.includes(k));
      let score = hits.length * 2;
      if (filters.includes("founders") && /invest|vc|partner|angel/i.test(a.role)) score += 3;
      if (/hire|hiring|recruit/i.test(goal) && /engineer|developer/i.test(a.role)) score += 2;
      if (/customer|sell|design partner/i.test(goal) && /(head|vp|director|cto|lead)/i.test(a.role)) score += 2;
      const reason = hits.length
        ? `${a.role}${a.company ? ` at ${a.company}` : ""}; overlaps on ${hits.slice(0, 3).join(", ")}`
        : `${a.role}${a.company ? ` at ${a.company}` : ""}`;
      return { name: a.name, kind: "attendee" as const, role: a.role, reason: a.looking_for ? `${reason}; looking for ${a.looking_for}` : reason, score };
    });
  for (const h of e.host.split(",").map((s) => s.trim()).filter((s) => s && s !== "See event page")) {
    out.push({ name: h, kind: "host", role: "Host / organizer", reason: "Hosts know who is in the room and can make warm intros.", score: 1.5 });
  }
  for (const s of e.sponsors ?? []) {
    out.push({ name: s, kind: "sponsor", role: "Sponsor", reason: "Sponsors attend to meet builders; good for partnerships or customer conversations.", score: 1 });
  }
  const seen = new Set<string>();
  return out.filter((c) => !seen.has(c.name) && seen.add(c.name)).sort((a, b) => b.score - a.score);
}

export async function whoToMeet(args: { event_id: string; goal: string }) {
  const e = await requireEvent(args.event_id);
  const people = contactsFor(e, args.goal).slice(0, 6);
  return {
    event: summarize(e),
    goal: args.goal,
    who_to_meet: people.map(({ name, kind, role, reason }) => ({ name, kind, role, reason })),
    note: e.attendees.length
      ? "Names come from the public event listing (featured guests/hosts)."
      : "No public guest list; start with the hosts and sponsors.",
  };
}

export async function draftIntro(args: { event_id: string; goal: string; target?: string }) {
  const e = await requireEvent(args.event_id);
  const target = args.target ?? contactsFor(e, args.goal)[0]?.name ?? e.host;
  const fallback = `Hi ${target.split(" ")[0]}, I'm coming to ${e.title} on ${laLabel(e.start)}. ${args.goal.replace(/\.$/, "")}, and given your work${
    e.tags.length ? ` around ${e.tags.slice(0, 2).join(" and ")}` : ""
  } I'd love 10 minutes at the event to compare notes. Happy to share what we're building too. See you there?`;
  let message = fallback;
  let via: "llm" | "template" = "template";
  if (llmProvider()) {
    const llm = await completeText(
      "Write a short, specific, warm intro DM (max 80 words) to send before an SF tech event. No emojis, no flattery, one clear ask.",
      `Sender goal: ${args.goal}\nRecipient: ${target}\nEvent: ${e.title} on ${laLabel(e.start)} at ${e.venue}\nEvent summary: ${e.description.slice(0, 500)}`,
    );
    if (llm) {
      message = llm.trim();
      via = "llm";
    }
  }
  return { event: summarize(e), to: target, via, message };
}

function overlaps(a: GxEvent, b: GxEvent, bufferMin = 30) {
  const buf = bufferMin * 60_000;
  return new Date(a.start).getTime() < new Date(b.end).getTime() + buf && new Date(b.start).getTime() < new Date(a.end).getTime() + buf;
}

function mondayOf(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export async function planMyWeek(args: { goal: string; week_start?: string; max_per_day?: number; max_events?: number }) {
  const events = await getEvents();
  const today = laDate(new Date().toISOString());
  const firstUpcoming = events.find((e) => laDate(e.start) >= today) ?? events[0];
  const start = mondayOf(args.week_start ?? (firstUpcoming ? laDate(firstUpcoming.start) : today));
  const endD = new Date(`${start}T12:00:00Z`);
  endD.setUTCDate(endD.getUTCDate() + 6);
  const end = endD.toISOString().slice(0, 10);
  const pool = events.filter((e) => laDate(e.start) >= start && laDate(e.start) <= end);
  const { ranked } = await rank(args.goal, pool);
  const perDay = args.max_per_day ?? 2;
  const maxEvents = args.max_events ?? 6;
  const chosen: typeof ranked = [];
  const skipped: { title: string; reason: string }[] = [];
  for (const r of ranked) {
    if (chosen.length >= maxEvents) break;
    if (r.score <= 0) continue;
    const clash = chosen.find((c) => overlaps(c.e, r.e));
    if (clash) {
      skipped.push({ title: r.e.title, reason: `conflicts with ${clash.e.title}` });
      continue;
    }
    if (chosen.filter((c) => laDate(c.e.start) === laDate(r.e.start)).length >= perDay) continue;
    chosen.push(r);
  }
  chosen.sort((a, b) => a.e.start.localeCompare(b.e.start));
  return {
    goal: args.goal,
    week: { start, end },
    agenda: chosen.map((r) => ({
      day: laLabel(r.e.start).split(",")[0],
      ...summarize(r.e),
      why: r.reasons.join("; ") || "general fit",
      calendar: googleCalendarUrl(r.e),
    })),
    skipped_conflicts: skipped.slice(0, 5),
    candidates_considered: pool.length,
  };
}

export async function eventBrief(args: { event_id: string }) {
  const e = await requireEvent(args.event_id);
  const firstSentence = e.description.split(/(?<=[.!?])\s/)[0]?.slice(0, 280) ?? "";
  return {
    event: summarize(e),
    tldr: firstSentence,
    logistics: {
      when: `${laLabel(e.start)} – ${new Date(e.end).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" })} PT`,
      where: [e.venue, e.neighborhood, e.city].filter(Boolean).join(", "),
      price: e.price,
      capacity: e.capacity || undefined,
      registered: e.registered,
      register: e.url,
    },
    hosts: e.host,
    communities: e.communities?.length ? e.communities : undefined,
    sponsors: e.sponsors?.length ? e.sponsors : undefined,
    featured_people: e.attendees.slice(0, 6).map((a) => `${a.name} (${a.role}${a.company ? `, ${a.company}` : ""})`),
    talking_points: e.tags.slice(0, 4).map((t) => `What's working (and not) in ${t} right now`),
    prep: ["Register early (capacity is limited)", "Have a 1-line intro ready", "Pick 2 people from featured_people/hosts to find", "Follow up within 24h"],
  };
}

export async function registerEvent(args: { event_id: string }) {
  const e = await requireEvent(args.event_id);
  return {
    event: summarize(e),
    register_url: e.url,
    instructions: "Open the link to RSVP on the event page (Luma or similar). GrowthX never registers on your behalf.",
  };
}

function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function googleCalendarUrl(e: GxEvent) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${icsDate(e.start)}/${icsDate(e.end)}`,
    details: `${e.description.slice(0, 400)}\n\nRegister: ${e.url}`,
    location: [e.venue, e.city].filter(Boolean).join(", "),
    ctz: "America/Los_Angeles",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export async function addToCalendar(args: { event_id: string }) {
  const e = await requireEvent(args.event_id);
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GrowthX//MCP//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${e.id}@growthx-mcp`, `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(e.start)}`, `DTEND:${icsDate(e.end)}`,
    `SUMMARY:${icsEscape(e.title)}`, `LOCATION:${icsEscape([e.venue, e.city].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${icsEscape(`${e.description.slice(0, 500)}\n\nRegister: ${e.url}`)}`, `URL:${e.url}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return { event: summarize(e), google_calendar_url: googleCalendarUrl(e), ics_filename: `${e.id.slice(0, 40)}.ics`, ics };
}

export async function sponsorMatch(args: { audience: string; budget?: number; limit?: number }) {
  const { ranked } = await rank(args.audience);
  const matches = ranked
    .filter((r) => r.score > 0)
    .map((r) => {
      const tiers = (r.e.sponsor_tiers ?? []).filter((t) => args.budget == null || t.price_usd <= args.budget);
      return {
        ...summarize(r.e),
        fit: r.reasons.join("; "),
        reach: r.e.registered ?? (r.e.capacity || undefined),
        past_sponsors: r.e.sponsors?.length ? r.e.sponsors : undefined,
        open_to_sponsors: r.e.sponsors_wanted || Boolean(r.e.sponsors?.length),
        tiers_in_budget: tiers.length ? tiers : undefined,
        next_step: tiers.length ? `Contact ${r.e.host} for the ${tiers[0].name} tier.` : `Ask ${r.e.host} about sponsorship options.`,
        _rank: r.score + (r.e.sponsors_wanted || r.e.sponsors?.length ? 2 : 0) + (tiers.length ? 1 : 0),
      };
    })
    .filter((m) => args.budget == null || m.tiers_in_budget || !m.open_to_sponsors || m.past_sponsors)
    .sort((a, b) => b._rank - a._rank)
    .slice(0, args.limit ?? 5)
    .map(({ _rank, ...m }) => ({ ...m, score: Number(_rank.toFixed(1)) }));
  return { audience: args.audience, budget_usd: args.budget, matches };
}

export async function trendingTopics(args: { days?: number; limit?: number }) {
  const events = await getEvents();
  const now = Date.now();
  const horizon = now + (args.days ?? 14) * 86400_000;
  const window = events.filter((e) => {
    const t = new Date(e.start).getTime();
    return t >= now - 86400_000 && t <= horizon;
  });
  const pool = window.length ? window : events;
  const counts = new Map<string, { n: number; examples: string[] }>();
  for (const e of pool)
    for (const t of e.tags) {
      const c = counts.get(t) ?? { n: 0, examples: [] };
      c.n++;
      if (c.examples.length < 3) c.examples.push(e.title);
      counts.set(t, c);
    }
  const hostCounts = new Map<string, number>();
  for (const e of pool) for (const c of e.communities?.length ? e.communities : [e.host]) hostCounts.set(c, (hostCounts.get(c) ?? 0) + 1);
  return {
    window: window.length ? `next ${args.days ?? 14} days` : "all loaded events",
    events_considered: pool.length,
    topics: [...counts.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, args.limit ?? 10)
      .map(([topic, c]) => ({ topic, events: c.n, examples: c.examples })),
    most_active_hosts: [...hostCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, events]) => ({ name, events })),
  };
}

export async function similarEvents(args: { event_id: string; limit?: number }) {
  const base = await requireEvent(args.event_id);
  const events = await getEvents();
  const words = new Set(keywordsOf(base.title));
  const results = events
    .filter((e) => e.id !== base.id)
    .map((e) => {
      const inter = e.tags.filter((t) => base.tags.includes(t)).length;
      const union = new Set([...e.tags, ...base.tags]).size || 1;
      const sameHost = e.host === base.host || (e.communities ?? []).some((c) => base.communities?.includes(c));
      const titleHits = keywordsOf(e.title).filter((w) => words.has(w)).length;
      return { e, score: inter / union + (sameHost ? 0.3 : 0) + titleHits * 0.1, sameHost, shared: e.tags.filter((t) => base.tags.includes(t)) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, args.limit ?? 5)
    .map((x) => ({ ...summarize(x.e), similarity: Number(x.score.toFixed(2)), shared_tags: x.shared, same_host: x.sameHost }));
  return { event: summarize(base), similar: results };
}

