import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadIntelEvents } from "./intel";
import { toLA } from "./time";
import type { GxEvent } from "./types";

// Read-only data layer.
// DATA_SOURCE=intel (GrowthX intel graph, needs INTEL_DATABASE_URL) | fixtures (default, example data).
// If intel fails, we fall back to fixtures and report it in `dataStatus()`.

export type Backend = "intel" | "fixtures";

export function configuredBackend(): Backend {
  if (process.env.USE_FIXTURES === "1") return "fixtures";
  return process.env.DATA_SOURCE === "intel" && process.env.INTEL_DATABASE_URL ? "intel" : "fixtures";
}

const TTL_MS = 5 * 60_000;
let cache: { at: number; events: GxEvent[]; backend: Backend; error?: string } | null = null;
let fixtureCache: GxEvent[] | null = null;

async function loadFixtures(): Promise<GxEvent[]> {
  if (fixtureCache) return fixtureCache;
  const file = path.join(process.cwd(), "data", "events.json");
  const parsed = JSON.parse(await readFile(file, "utf8")) as { events: Omit<GxEvent, "source">[] };
  fixtureCache = parsed.events.map((e) => ({ ...e, source: "fixtures" as const }));
  return fixtureCache;
}

async function load(): Promise<NonNullable<typeof cache>> {
  if (configuredBackend() === "intel") {
    try {
      const events = await loadIntelEvents();
      if (events.length) return { at: Date.now(), events, backend: "intel" };
      throw new Error("intel returned 0 upcoming events");
    } catch (err) {
      console.warn("[data] intel failed, falling back to fixtures:", (err as Error).message);
      return { at: Date.now(), events: await loadFixtures(), backend: "fixtures", error: (err as Error).message };
    }
  }
  return { at: Date.now(), events: await loadFixtures(), backend: "fixtures" };
}

export async function getEvents(): Promise<GxEvent[]> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const next = await load();
    next.events = next.events
      .map((e) => ({ ...e, start: toLA(e.start), end: toLA(e.end) }))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    cache = next;
  }
  return cache.events;
}

export async function getEventById(id: string): Promise<GxEvent | undefined> {
  return (await getEvents()).find((e) => e.id === id);
}

export async function dataStatus() {
  await getEvents();
  return {
    backend: cache!.backend,
    example_data: cache!.backend === "fixtures",
    events: cache!.events.length,
    ...(cache!.error ? { fallback_reason: "intel backend unavailable" } : {}),
  };
}
