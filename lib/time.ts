export const TZ = "America/Los_Angeles";

/** Any ISO instant -> ISO string with the America/Los_Angeles offset, e.g. 2026-11-10T18:00:00-08:00. */
export function toLA(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "longOffset",
    }).formatToParts(d).map((p) => [p.type, p.value]),
  );
  const offset = (parts.timeZoneName as string).replace("GMT", "") || "+00:00";
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}

/** YYYY-MM-DD of an instant in LA time. */
export function laDate(iso: string): string {
  return toLA(iso).slice(0, 10);
}

/** Human label like "Tue Nov 10, 6:00 PM". */
export function laLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}
