// Shared text helpers for the PDF and HTML agenda.
import { TZ } from "./time";

/** Strip emoji / leading symbols; cut series suffixes after " — " or " | ". */
export function cleanTitle(t: string) {
  const base = t
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .split(/ [—|] /)[0]
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
  return base || t.trim();
}

export const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("en-US", { timeZone: TZ, ...o });
export const time = (iso: string) => fmt(iso, { hour: "numeric", minute: "2-digit" });

/** Cut at a word boundary, drop dangling punctuation/brackets, single ellipsis. */
export const short = (t: string, n: number) => {
  if (t.length <= n) return t;
  const cut = t.slice(0, n).replace(/\s+\S*$/, "").replace(/[\s([{\-–—·,:;@&|/]+$/, "");
  return `${cut || t.slice(0, n)}…`;
};

export const sentenceCase = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Placeholder hosts that shouldn't be shown. */
export const realHost = (h: string) => (/see event page|^tba$|unknown/i.test(h) ? "" : h);
