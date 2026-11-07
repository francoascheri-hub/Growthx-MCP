// PDF agenda: black, thin white type, #95bf47 accent. Rendered on the fly with @react-pdf/renderer.
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
  page: { backgroundColor: "#000", color: "#fff", fontFamily: "Inter", fontWeight: 300, padding: 36, paddingBottom: 44 },
  kicker: { fontSize: 9, fontWeight: 500, color: ACCENT, letterSpacing: 2, textTransform: "uppercase" },
  title: { fontSize: 34, fontWeight: 200, marginTop: 10, lineHeight: 1.1 },
  subtitle: { fontSize: 12, color: "#bdbdbd", marginTop: 8 },
  strip: { flexDirection: "row", marginTop: 22, borderTop: "1pt solid #333", borderBottom: "1pt solid #333" },
  day: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, borderRight: "1pt solid #222" },
  dayName: { fontSize: 8, fontWeight: 500, color: ACCENT, letterSpacing: 1.5, textTransform: "uppercase" },
  dayNum: { fontSize: 18, fontWeight: 200, marginTop: 2, marginBottom: 6 },
  dayLine: { fontSize: 7.5, color: "#d8d8d8", marginBottom: 4, lineHeight: 1.3 },
  rankInline: { color: ACCENT, fontWeight: 500 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 22, marginHorizontal: -6 },
  cardWrap: { width: "33.333%", paddingHorizontal: 6, marginBottom: 12 },
  card: { backgroundColor: "#0e0e0e", border: "1pt solid #262626", borderRadius: 8, overflow: "hidden" },
  cover: { width: "100%", height: 96, objectFit: "cover" },
  coverEmpty: { height: 6, backgroundColor: ACCENT },
  body: { padding: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pill: { fontSize: 7.5, fontWeight: 500, color: "#000", backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 2, paddingHorizontal: 7 },
  badge: { fontSize: 9, fontWeight: 500, color: ACCENT, border: `1pt solid ${ACCENT}`, borderRadius: 8, paddingVertical: 1, paddingHorizontal: 6 },
  cardTitle: { fontSize: 12, fontWeight: 300, marginTop: 8, lineHeight: 1.25 },
  meta: { fontSize: 7.5, color: "#9a9a9a", marginTop: 4, lineHeight: 1.3 },
  why: { fontSize: 8, color: "#e6e6e6", marginTop: 6, lineHeight: 1.35 },
  tags: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  tag: { fontSize: 6.5, color: ACCENT, border: "0.5pt solid #3a4a20", borderRadius: 6, paddingVertical: 1, paddingHorizontal: 5, marginRight: 4, marginBottom: 3 },
  register: { fontSize: 8.5, fontWeight: 500, color: ACCENT, marginTop: 8, textDecoration: "none" },
  footer: { position: "absolute", bottom: 18, left: 36, right: 36, fontSize: 7, color: "#666", flexDirection: "row", justifyContent: "space-between" },
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
const short = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

function Card({ it }: { it: AgendaItem }) {
  const e = it.e;
  const meta = [e.venue, e.neighborhood, e.host && `by ${e.host}`, e.price].filter(Boolean).join(" · ");
  return (
    <View style={s.cardWrap} wrap={false}>
      <View style={s.card}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
        {it.image ? <Image style={s.cover} src={it.image} /> : <View style={s.coverEmpty} />}
        <View style={s.body}>
          <View style={s.row}>
            <Text style={s.pill}>{`${fmt(e.start, { weekday: "short", month: "short", day: "numeric" })} · ${time(e.start)} PT`}</Text>
            <Text style={s.badge}>{`#${it.rank}`}</Text>
          </View>
          <Text style={s.cardTitle}>{short(cleanTitle(e.title), 80)}</Text>
          {meta ? <Text style={s.meta}>{short(meta, 120)}</Text> : null}
          <Text style={s.why}>{it.why}</Text>
          {e.tags.length ? (
            <View style={s.tags}>
              {e.tags.slice(0, 3).map((t) => (
                <Text key={t} style={s.tag}>{`#${t}`}</Text>
              ))}
            </View>
          ) : null}
          {/^https?:\/\//.test(e.url) ? (
            <Link src={e.url} style={s.register}>
              Register on Luma ›
            </Link>
          ) : null}
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
  return (
    <Document title="GrowthX agenda" author="GrowthX">
      <Page size="LETTER" orientation="landscape" style={s.page}>
        <Text style={s.kicker}>GrowthX · San Francisco</Text>
        <Text style={s.title}>{short(a.title, 90)}</Text>
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
                      {`${time(it.e.start)} · ${short(cleanTitle(it.e.title), 34)} · `}
                      <Text style={s.rankInline}>{`#${it.rank}`}</Text>
                    </Text>
                  ))}
                </View>
              ))}
            </View>
            <View style={s.grid}>
              {a.items.map((it) => (
                <Card key={it.e.id} it={it} />
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
