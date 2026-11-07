import { buildAgenda, parseQuery } from "@/lib/agenda";
import { renderAgendaPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/agenda.pdf?tool=plan|recommend|search&goal=&from=YYYY-MM-DD&to=YYYY-MM-DD&limit<=8[&ids=a,b,c]
export async function GET(req: Request) {
  try {
    const pdf = await renderAgendaPdf(await buildAgenda(parseQuery(new URL(req.url).searchParams)));
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="growthx-agenda.pdf"',
        "cache-control": "public, max-age=0, s-maxage=300",
      },
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
