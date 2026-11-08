// Topic relevance for interests: whole-word synonyms (EN/ES) scored ONLY on an event's title and description,
// with host / sponsor / community names removed first (so "Harmonic Security" hosting a golf outing doesn't count).
import type { GxEvent } from "./types";

/** Topic -> whole-word / phrase aliases. A goal mentioning any alias asks for that topic. */
const TOPICS: Record<string, string[]> = {
  security: [
    "security", "cybersecurity", "cyber security", "infosec", "appsec", "application security", "ai security",
    "devsecops", "pentest", "pentesting", "red team", "red teaming", "zero trust", "soc 2", "ciso", "cisos",
    "seguridad", "ciberseguridad",
  ],
  hackathon: ["hackathon", "hackathons", "buildathon", "hack night", "hack day"],
  agents: ["agent", "agents", "agentic", "ai agents", "agentes"],
  robotics: ["robot", "robots", "robotics", "humanoid", "humanoids", "robótica"],
  crypto: ["crypto", "web3", "blockchain", "onchain", "ethereum", "solana"],
  investors: [
    "investor", "investors", "vc", "vcs", "venture capital", "angel investor", "angel investors", "angels",
    "fundraising", "fundraise", "raise", "raising", "pre-seed", "seed round", "pitch", "inversores", "inversión",
  ],
  climate: ["climate", "climate tech", "climatetech", "energy", "carbon", "sustainability"],
  healthtech: ["healthtech", "health tech", "biotech", "digital health", "medtech"],
  fintech: ["fintech", "payments", "banking"],
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (aliases: string[], flags = "i") =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${aliases.map(esc).join("|")})(?![\\p{L}\\p{N}])`, `u${flags}`);
const TOPIC_RE = Object.fromEntries(Object.entries(TOPICS).map(([k, v]) => [k, wordRe(v)]));
const TOPIC_RE_G = Object.fromEntries(Object.entries(TOPICS).map(([k, v]) => [k, wordRe(v, "gi")]));

/** Topics a goal / interest text asks for (whole-word). */
export function topicsOf(text: string): string[] {
  return Object.keys(TOPICS).filter((k) => TOPIC_RE[k].test(text));
}

/** Description without the names of the event's organizers, sponsors and communities. */
export function cleanDescription(e: GxEvent): string {
  const names = [
    ...e.host.split(/,\s*/),
    ...(e.sponsors ?? []),
    ...(e.community_sponsors ?? []),
    ...(e.communities ?? []),
  ]
    .map((n) => n.trim())
    .filter((n) => n.length > 2 && n !== "See event page")
    .flatMap((n) => [n, n.replace(/\s+(events?|inc\.?|llc|team|community|hq)$/i, "")]);
  let d = e.description;
  for (const n of [...new Set(names)].sort((a, b) => b.length - a.length)) d = d.replace(new RegExp(esc(n), "gi"), " ");
  return d;
}

/** 3 if the title matches, plus one per description mention (max 3). */
export function topicRelevance(e: GxEvent, topic: string): number {
  const inTitle = TOPIC_RE[topic].test(cleanTitleText(e)) ? 3 : 0;
  const inDesc = Math.min((cleanDescription(e).match(TOPIC_RE_G[topic]) ?? []).length, 3);
  return inTitle + inDesc;
}

// Titles can embed the organizer too ("… by Harmonic Security"); strip host names there as well.
function cleanTitleText(e: GxEvent) {
  let t = e.title;
  for (const n of e.host.split(/,\s*/).map((s) => s.trim()).filter((s) => s.length > 2)) t = t.replace(new RegExp(esc(n), "gi"), " ");
  return t;
}

/** Minimum relevance to count as a match: a title mention, or at least 3 mentions in the description
 *  (one passing mention in a multi-track list is not enough). */
export const MIN_RELEVANCE = 3;

/** Best relevance across the requested topics, with the matching topic. */
export function bestTopic(e: GxEvent, topics: string[]): { topic: string; score: number } | null {
  let best: { topic: string; score: number } | null = null;
  for (const t of topics) {
    const score = topicRelevance(e, t);
    if (!best || score > best.score) best = { topic: t, score };
  }
  return best;
}
