// PDF agenda: black, thin white type, #95bf47 accent. Rendered on the fly with @react-pdf/renderer.
// One landscape page: header, week strip, then at most 2 rows of cards (3 per row, 4 when there are 7-8 events).
import path from "node:path";
import { Document, Font, Image, Link, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Agenda, AgendaItem } from "./agenda";
import { TZ, laDate } from "./time";

const fontDir = path.join(process.cwd(), "data", "fonts");
Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(fontDir, "inter-200.ttf"), fontWeight: 200 },
    { src: path.join(fontDir, "inter-300.ttf"), fontWeight: 300 },
    { src: path.join(fontDir, "inter-500.ttf"), fontWeight: 500 },
  ],
});
Font.registerHyphenationCallback((w) => [w]);

const ACCENT = "#95bf47";
const s = StyleSheet.create({
  page: { backgroundColor: "#000", color: "#fff", fontFamily: "Inter", fontWeight: 300, paddingTop: 28, paddingHorizontal: 32, paddingBottom: 38 },
  kicker: { fontSize: 8, fontWeight: 500, color: ACCENT, letterSpacing: 2, textTransform: "uppercase" },
  title: { fontSize: 26, fontWeight: 200, marginTop: 5, lineHeight: 1.1 },
  subtitle: { fontSize: 10.5, color: "#bdbdbd", marginTop: 5 },
  strip: { flexDirection: "row", marginTop: 14, borderTop: "1pt solid #333", borderBottom: "1pt solid #333" },
  day: { flex: 1, paddingVertical: 7, paddingHorizontal: 6, borderRight: "1pt solid #222" },
  dayName: { fontSize: 7, fontWeight: 500, color: ACCENT, letterSpacing: 1.5, textTransform: "uppercase" },
  dayNum: { fontSize: 14, fontWeight: 200, marginTop: 1, marginBottom: 4 },
  dayLine: { fontSize: 7, color: "#d8d8d8", marginBottom: 3, lineHeight: 1.25 },
  rankInline: { color: ACCENT, fontWeight: 500 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, marginHorizontal: -5 },
  cardWrap: { paddingHorizontal: 5, marginBottom: 10 },
  card: { backgroundColor: "#0e0e0e", border: "1pt solid #262626", borderRadius: 7, overflow: "hidden" },
  cover: { width: "100%", height: 58, objectFit: "cover" },
  coverEmpty: { height: 5, backgroundColor: ACCENT },
  body: { paddingHorizontal: 9, paddingVertical: 7 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pill: { fontSize: 7, fontWeight: 500, color: "#000", backgroundColor: ACCENT, borderRadius: 7, paddingVertical: 1.5, paddingHorizontal: 6 },
  badge: { fontSize: 8, fontWeight: 500, color: ACCENT, border: `1pt solid ${ACCENT}`, borderRadius: 7, paddingVertical: 1, paddingHorizontal: 5 },
  cardTitle: { fontSize: 10.5, fontWeight: 300, marginTop: 5, lineHeight: 1.2 },
  meta: { fontSize: 7, color: "#9a9a9a", marginTop: 3 },
  why: { fontSize: 7.5, color: "#e6e6e6", marginTop: 4, lineHeight: 1.3 },
  foot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 5 },
  tags: { flexDirection: "row", flexWrap: "wrap", flex: 1 },
  tag: { fontSize: 6, color: ACCENT, border: "0.5pt solid #3a4a20", borderRadius: 5, paddingVertical: 1, paddingHorizontal: 4, marginRight: 3 },
  register: { fontSize: 7.5, fontWeight: 500, color: ACCENT, textDecoration: "none" },
  footer: { position: "absolute", bottom: 16, left: 32, right: 32, fontSize: 7, color: "#666", flexDirection: "row", justifyContent: "space-between" },
  empty: { fontSize: 14, color: "#bdbdbd", marginTop: 30 },
});

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

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("en-US", { timeZone: TZ, ...o });
const time = (iso: string) => fmt(iso, { hour: "numeric", minute: "2-digit" });
/** Cut at a word boundary, drop dangling punctuation/brackets, single ellipsis. */
const short = (t: string, n: number) => {
  if (t.length <= n) return t;
  const cut = t.slice(0, n).replace(/\s+\S*$/, "").replace(/[\s([{\-–—·,:;@&|/]+$/, "");
  return `${cut || t.slice(0, n)}…`;
};
const sentenceCase = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function Card({ it, width, dense }: { it: AgendaItem; width: string; dense: boolean }) {
  const e = it.e;
  const host = /see event page|^tba$|unknown/i.test(e.host) ? "" : e.host;
  const meta = [e.venue, host && `by ${host}`, e.price].filter(Boolean).join(" · ");
  const url = /^https?:\/\//.test(e.url) ? e.url : undefined;
  // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
  const cover = it.image ? <Image style={dense ? [s.cover, { height: 44 }] : s.cover} src={it.image} /> : <View style={s.coverEmpty} />;
  return (
    <View style={[s.cardWrap, { width }]} wrap={false}>
      <View style={s.card}>
        {url && it.image ? <Link src={url}>{cover}</Link> : cover}
        <View style={s.body}>
          <View style={s.row}>
            <Text style={s.pill}>{`${fmt(e.start, { weekday: "short", month: "short", day: "numeric" })} · ${time(e.start)} PT`}</Text>
            <Text style={s.badge}>{`#${it.rank}`}</Text>
          </View>
          <Text style={s.cardTitle}>{short(cleanTitle(e.title), dense ? 44 : 52)}</Text>
          {meta ? <Text style={s.meta}>{short(meta, dense ? 40 : 52)}</Text> : null}
          <Text style={s.why}>{it.why}</Text>
          <View style={s.foot}>
            <View style={s.tags}>
              {e.tags.slice(0, dense ? 2 : 3).map((t) => (
                <Text key={t} style={s.tag}>{`#${t}`}</Text>
              ))}
            </View>
            {url ? (
              <Link src={url} style={s.register}>
                Register on Luma ›
              </Link>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function AgendaDoc({ a }: { a: Agenda }) {
  const days: { key: string; items: AgendaItem[] }[] = [];
  for (const it of a.items) {
    const key = laDate(it.e.start);
    const d = days.find((x) => x.key === key);
    if (d) d.items.push(it);
    else days.push({ key, items: [it] });
  }
  const n = a.items.length;
  const width = n > 6 ? "25%" : "33.333%";
  return (
    <Document title="GrowthX agenda" author="GrowthX">
      <Page size="LETTER" orientation="landscape" style={s.page}>
        <Text style={s.kicker}>GrowthX · San Francisco</Text>
        <Text style={s.title}>{short(sentenceCase(a.title), 80)}</Text>
        <Text style={s.subtitle}>{`Your ${n} best room${n === 1 ? "" : "s"}, ranked from ${a.total} SF event${a.total === 1 ? "" : "s"}`}</Text>
        {n ? (
          <>
            <View style={s.strip} wrap={false}>
              {days.map((d) => (
                <View key={d.key} style={s.day}>
                  <Text style={s.dayName}>{fmt(d.items[0].e.start, { weekday: "short" })}</Text>
                  <Text style={s.dayNum}>{fmt(d.items[0].e.start, { month: "short", day: "numeric" })}</Text>
                  {d.items.map((it) => (
                    <Text key={it.e.id} style={s.dayLine}>
                      {`${time(it.e.start)} · ${short(cleanTitle(it.e.title).replace(/\s*\([^)]*\)/g, ""), 24)} · `}
                      <Text style={s.rankInline}>{`#${it.rank}`}</Text>
                    </Text>
                  ))}
                </View>
              ))}
            </View>
            <View style={s.grid}>
              {a.items.map((it) => (
                <Card key={it.e.id} it={it} width={width} dense={n > 6} />
              ))}
            </View>
          </>
        ) : (
          <Text style={s.empty}>No matching events in this window. Try a broader goal or dates.</Text>
        )}
        <View style={s.footer} fixed>
          <Text>{`growthx-mcp.vercel.app · ${a.from} – ${a.to} · times in PT`}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export function renderAgendaPdf(a: Agenda): Promise<Buffer> {
  return renderToBuffer(<AgendaDoc a={a} />);
}
