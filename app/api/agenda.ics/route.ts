import { buildAgenda, parseQuery } from "@/lib/agenda";
import { icsCalendar } from "@/lib/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/agenda.ics — same query as /api/agenda.pdf; the whole agenda as one importable calendar.
export async function GET(req: Request) {
  try {
    const a = await buildAgenda(parseQuery(new URL(req.url).searchParams), { imageBytes: false });
    return new Response(icsCalendar(a.items.map((it) => it.e), `GrowthX · ${a.title}`.slice(0, 80)), {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="growthx-agenda.ics"',
        "cache-control": "public, max-age=0, s-maxage=300",
      },
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
