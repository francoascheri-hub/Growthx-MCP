import { Pool } from "pg";
import type { Attendee, GxEvent } from "./types";

// Read-only adapter for the GrowthX intel knowledge graph (schema `intel`).
// Every query runs inside BEGIN READ ONLY ... ROLLBACK; only SELECT statements exist in this file.

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.INTEL_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    });
  }
  return pool;
}

async function readOnly<T>(fn: (q: <R>(sql: string, params?: unknown[]) => Promise<R[]>) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '15s'");
    return await fn(async <R,>(sql: string, params?: unknown[]) => (await client.query(sql, params)).rows as R[]);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
  }
}

type Row = { id: string; f: Record<string, unknown> };
type Rel = { id: string; predicate: string; name: string; neighborhood: string | null };

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : typeof v === "string" && v ? [v] : []);

const KEYWORDS: Record<string, RegExp> = {
  ai: /\b(ai|a\.i\.|artificial intelligence|genai|gen ai)\b/i,
  agents: /\bagent(s|ic)?\b/i,
  llm: /\b(llm|gpt|claude|gemini|language model|rag)\b/i,
  mcp: /\bmcp\b|model context protocol/i,
  evals: /\beval(s|uation)?\b/i,
  voice: /\bvoice\b/i,
  devtools: /\b(dev ?tools?|developer|devrel|sdk|api|coding|hackathon|code)\b/i,
  infra: /\b(infra|infrastructure|gpu|inference|kubernetes|cloud|database|data)\b/i,
  "open-source": /open[- ]source|\boss\b/i,
  fundraising: /\b(fundrais|vc|investor|pitch|demo day|seed|series a|angel)/i,
  founders: /\bfounder/i,
  growth: /\b(growth|marketing|gtm|go-to-market|sales)\b/i,
  design: /\b(design|ux|ui)\b/i,
  climate: /\b(climate|energy|carbon|sustainab)/i,
  healthtech: /\b(health|bio|medical|clinical)/i,
  fintech: /\b(fintech|finance|payments|banking)\b/i,
  crypto: /\b(crypto|web3|blockchain|ethereum|solana|onchain)\b/i,
  robotics: /\b(robot|robotics|hardware|embodied)/i,
  hiring: /\b(hiring|recruit|career|job)/i,
  community: /\b(community|networking|happy hour|mixer|social|meetup)\b/i,
  security:
    /\b(cyber ?security|infosec|appsec|application security|ai security|devsecops|pentest(ing)?|red team(ing)?|zero trust|soc ?2|cisos?|security (engineer|team|leader|research)s?|ciberseguridad)\b/i,
};

const TAG_SYNONYMS: Record<string, string> = {
  "developer tools": "devtools", "developer-tools": "devtools", hackathons: "hackathon", "artificial intelligence": "ai",
  "machine learning": "ai", "open source": "open-source", infosec: "security", cybersecurity: "security",
  "cyber security": "security", cyber: "security", appsec: "security", seguridad: "security", startups: "founders", startup: "founders", networking: "community",
};

function normalizeTag(t: string): string {
  const s = t.trim().toLowerCase();
  return TAG_SYNONYMS[s] ?? s.replace(/\s+/g, "-");
}

export function deriveTags(text: string, base: string[] = []): string[] {
  const tags = new Set(base.map(normalizeTag).filter(Boolean));
  for (const [tag, re] of Object.entries(KEYWORDS)) if (re.test(text)) tags.add(tag);
  return [...tags].slice(0, 8);
}

function deriveAudience(text: string): string[] {
  const out = new Set<string>();
  if (/founder|startup|ceo/i.test(text)) out.add("founders");
  if (/engineer|developer|builder|hacker|code/i.test(text)) out.add("engineers");
  if (/investor|vc|angel|lp\b/i.test(text)) out.add("investors");
  if (/design/i.test(text)) out.add("designers");
  if (/product manager|\bpm\b|product/i.test(text)) out.add("pms");
  if (/research/i.test(text)) out.add("researchers");
  if (/operator|gtm|growth|marketing|sales/i.test(text)) out.add("operators");
  if (/student|university/i.test(text)) out.add("students");
  if (!out.size) out.add("builders");
  return [...out];
}

function price(f: Record<string, unknown>): string {
  const offers = Array.isArray(f.offers) ? (f.offers as { price?: number; currency?: string }[]) : [];
  const paid = offers.map((o) => Number(o.price ?? 0)).filter((p) => p > 0);
  if (offers.length) return paid.length ? `$${Math.min(...paid)}` : "Free";
  const note = (f.ticket as { price_note?: string } | undefined)?.price_note;
  return note || "See listing";
}

function toEvent(row: Row, rels: Rel[], cityName: string): GxEvent {
  const f = row.f;
  const title = str(f.title || f.name) || "Untitled event";
  const description = str(f.description).slice(0, 1200);
  const communities = rels.filter((r) => r.predicate === "community").map((r) => r.name);
  const sponsors = rels.filter((r) => r.predicate === "sponsored").map((r) => r.name);
  const venueRel = rels.find((r) => r.predicate === "held_at");
  const hosts = [...strs(f.hosts).filter((h) => !/^\d+ others?$/.test(h)), ...communities];
  const text = `${title} ${description} ${strs(f.event_format).join(" ")} ${str(f.type)}`;
  const tags = deriveTags(text, strs(f.tags));
  const guests = Array.isArray(f.featured_guests) ? (f.featured_guests as { name?: string; title_or_bio_short?: string | null }[]) : [];
  const attendees: Attendee[] = guests.slice(0, 8).map((g) => ({
    name: str(g.name),
    role: str(g.title_or_bio_short).slice(0, 140) || "Featured guest",
    company: "",
    interests: g.title_or_bio_short ? deriveTags(str(g.title_or_bio_short)) : [],
  }));
  const communitySponsors = rels.filter((r) => r.predicate === "community_sponsor").map((r) => r.name);
  const cap = f.capacity as { total?: number | null } | undefined;
  const reg = f.registered_count as { count?: number } | undefined;
  const start = str(f.start_at);
  const address = str(f.address || f.location);
  return {
    id: row.id,
    title,
    description: description || `${title}. Details on the event page.`,
    start,
    end: str(f.end_at) || start,
    venue: venueRel?.name || str(f.venue_name) || address || "See event page",
    neighborhood: venueRel?.neighborhood || "",
    city: cityName,
    url: str(f.url),
    host: [...new Set(hosts)].slice(0, 3).join(", ") || "See event page",
    tags,
    audience: deriveAudience(`${text} ${str(f.audience)}`),
    capacity: Number(cap?.total ?? 0) || 0,
    price: price(f),
    attendees,
    sponsors_wanted: sponsors.length > 0 || communitySponsors.length > 0,
    sponsors,
    community_sponsors: communitySponsors.length ? [...new Set(communitySponsors)].slice(0, 10) : undefined,
    communities,
    registered: reg?.count,
    source: "growthx-intel",
  };
}

/** Upcoming events in a city from the intel graph. SELECT-only. */
export async function loadIntelEvents(opts: { city?: string; days?: number; limit?: number } = {}): Promise<GxEvent[]> {
  const city = opts.city || process.env.INTEL_CITY || "San Francisco";
  const from = new Date(Date.now() - 6 * 3600_000).toISOString();
  const to = new Date(Date.now() + (opts.days ?? 60) * 86400_000).toISOString();
  const limit = opts.limit ?? 400;

  return readOnly(async (q) => {
    const ids = await q<{ id: string }>(
      `with city as (
         select distinct o.entity_id id from intel.observations o
         join intel.entities e on e.id = o.entity_id and e.kind = 'city'
         where o.field = 'name' and o.value #>> '{}' ilike $1),
       ev as (select r.subject_id id from intel.relations r join city on r.object_id = city.id where r.predicate = 'in_city'),
       st as (select distinct on (o.entity_id) o.entity_id id, o.value #>> '{}' s
              from intel.observations o join ev on ev.id = o.entity_id
              where o.field = 'start_at'
              order by o.entity_id, o.confidence desc, o.retrieved_at desc, o.id desc)
       select id from st where s >= $2 and s < $3 order by s limit $4`,
      [city, from, to, limit],
    );
    const idList = ids.map((r) => r.id);
    if (!idList.length) return [];

    const fields = await q<{ entity_id: string; field: string; value: unknown }>(
      `select distinct on (entity_id, field) entity_id, field, value from intel.observations
       where entity_id = any($1::uuid[])
       order by entity_id, field, confidence desc, retrieved_at desc, id desc`,
      [idList],
    );
    const rels = await q<{ event_id: string; predicate: string; name: string; neighborhood: string | null }>(
      `with r as (
         select r.object_id event_id, case when r.predicate in ('hosts','lists') then 'community' else r.predicate end predicate, r.subject_id other
         from intel.relations r where r.object_id = any($1::uuid[]) and r.predicate in ('hosts','lists','sponsored')
         union all
         select r.subject_id, r.predicate, r.object_id from intel.relations r
         where r.subject_id = any($1::uuid[]) and r.predicate = 'held_at'
         union all
         select c.object_id, 'community_sponsor', s.subject_id
         from intel.relations c join intel.relations s on s.object_id = c.subject_id and s.predicate = 'sponsored'
         where c.object_id = any($1::uuid[]) and c.predicate in ('hosts','lists')),
       names as (
         select distinct on (o.entity_id, o.field) o.entity_id, o.field, o.value #>> '{}' v from intel.observations o
         where o.entity_id in (select other from r) and o.field in ('name','neighborhood')
         order by o.entity_id, o.field, o.confidence desc, o.retrieved_at desc, o.id desc)
       select r.event_id, r.predicate, n.v name, nb.v neighborhood
       from r join names n on n.entity_id = r.other and n.field = 'name'
       left join names nb on nb.entity_id = r.other and nb.field = 'neighborhood'`,
      [idList],
    );

    const byId = new Map<string, Row>(idList.map((id) => [id, { id, f: {} }]));
    for (const r of fields) byId.get(r.entity_id)!.f[r.field] = r.value;
    const relsBy = new Map<string, Rel[]>();
    for (const r of rels) {
      const list = relsBy.get(r.event_id) ?? [];
      if (!list.some((x) => x.predicate === r.predicate && x.name === r.name)) list.push({ id: r.event_id, ...r });
      relsBy.set(r.event_id, list);
    }
    return idList
      .map((id) => toEvent(byId.get(id)!, relsBy.get(id) ?? [], city))
      .filter((e) => e.start && e.url);
  });
}
