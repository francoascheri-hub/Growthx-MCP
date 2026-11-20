// PDF agenda: warm brand (moss page, butter type, olive-soft body), Inter Tight + Geist Mono, one terracotta dot. Rendered on the fly with @react-pdf/renderer.
// One landscape page: header, week strip, then at most 2 rows of cards (3 per row, 4 when there are 7-8 events).
import path from "node:path";
import { Defs, Document, Font, Image, LinearGradient, Link, Page, Rect, Stop, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Agenda, AgendaItem } from "./agenda";
import { initialOf } from "./agendaHtml";
import { cleanTitle, fmt, realHost, sentenceCase, short, time } from "./format";
import { laDate } from "./time";

const fontDir = path.join(process.cwd(), "data", "fonts");
Font.register({
  family: "InterTight",
  fonts: [
    { src: path.join(fontDir, "intertight-400.ttf"), fontWeight: 400 },
    { src: path.join(fontDir, "intertight-500.ttf"), fontWeight: 500 },
    { src: path.join(fontDir, "intertight-600.ttf"), fontWeight: 600 },
  ],
});
Font.register({ family: "GeistMono", fonts: [{ src: path.join(fontDir, "geistmono-400.ttf"), fontWeight: 400 }] });
Font.registerHyphenationCallback((w) => [w]);

// Palette shared with the widget (lib/agendaHtml.ts).
const BG = "#1B1C13"; // moss
const SURFACE = "#272819"; // moss-2
const BORDER = "#383A27"; // line-dark
const TEXT = "#F3E47A"; // butter: titles, headlines
const MUTED = "#A6A97A"; // olive-soft: body, secondary
const ACCENT = "#F3E47A"; // butter: labels, ranks, best pick
const INK = "#1B1C13"; // moss text on butter fills
const OLIVE = "#545A2A";
const TERRACOTTA = "#D4532A"; // once per page, graphic only
const MONO = "GeistMono";

const s = StyleSheet.create({
  page: { backgroundColor: BG, color: TEXT, fontFamily: "InterTight", fontWeight: 400, paddingTop: 28, paddingHorizontal: 32, paddingBottom: 38 },
  kicker: { fontFamily: MONO, fontSize: 7, color: ACCENT, letterSpacing: 1.6, textTransform: "uppercase" },
  title: { fontSize: 22, fontWeight: 500, letterSpacing: -0.5, marginTop: 6, lineHeight: 1.1 },
  subRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 5 },
  subtitle: { fontSize: 9.5, fontWeight: 400, color: MUTED },
  cal: { fontSize: 7.5, fontWeight: 500, color: INK, backgroundColor: ACCENT, borderRadius: 5, paddingVertical: 3, paddingHorizontal: 9, textDecoration: "none" },
  sum: { marginTop: 9, paddingVertical: 1, paddingLeft: 9, borderLeft: `2pt solid ${ACCENT}`, color: MUTED, fontSize: 7.5, fontWeight: 400, lineHeight: 1.4 },
  strip: { flexDirection: "row", marginTop: 9, borderTop: `0.5pt solid ${BORDER}`, borderBottom: `0.5pt solid ${BORDER}` },
  day: { flex: 1, paddingVertical: 6, paddingHorizontal: 8, borderRight: `0.5pt solid ${BORDER}` },
  dayLast: { borderRight: "none" },
  dayName: { fontFamily: MONO, fontSize: 6.5, color: ACCENT, letterSpacing: 1.4, textTransform: "uppercase" },
  dayNum: { fontSize: 11.5, fontWeight: 500, letterSpacing: -0.2, marginTop: 1, marginBottom: 3 },
  dayLine: { fontSize: 7, fontWeight: 400, color: MUTED, marginBottom: 2.5, lineHeight: 1.25 },
  dayTime: { fontFamily: MONO, fontSize: 6.5, color: MUTED },
  rankInline: { fontFamily: MONO, fontSize: 6.5, color: ACCENT },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 9, marginHorizontal: -5 },
  cardWrap: { paddingHorizontal: 5, marginBottom: 8 },
  card: { flexGrow: 1, backgroundColor: SURFACE, border: `1pt solid ${BORDER}`, borderRadius: 10, overflow: "hidden" },
  cardBest: { borderColor: ACCENT },
  coverBox: { position: "relative" },
  cover: { width: "100%", objectFit: "cover" },
  ph: { position: "relative", overflow: "hidden" },
  phText: { position: "absolute", left: 0, right: 0, textAlign: "center", color: ACCENT, fontWeight: 500, textDecoration: "none" },
  chip: { position: "absolute", top: 5, left: 5, fontFamily: MONO, fontSize: 6.5, color: TEXT, backgroundColor: "rgba(27,28,19,0.78)", border: "0.5pt solid rgba(243,228,122,0.18)", borderRadius: 4, paddingVertical: 1.5, paddingHorizontal: 4 },
  body: { flexGrow: 1, paddingHorizontal: 9, paddingTop: 7, paddingBottom: 8 },
  spacer: { flexGrow: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pill: { fontFamily: MONO, fontSize: 6.5, color: INK, backgroundColor: ACCENT, borderRadius: 4, paddingVertical: 1.5, paddingHorizontal: 5 },
  bestRow: { flexDirection: "row", alignItems: "center" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: TERRACOTTA, marginRight: 3 },
  best: { fontFamily: MONO, fontSize: 5.8, color: ACCENT, letterSpacing: 1, textTransform: "uppercase" },
  cardTitle: { fontSize: 10, fontWeight: 500, color: TEXT, letterSpacing: -0.2, marginTop: 6, lineHeight: 1.2 },
  meta: { fontSize: 6.8, fontWeight: 400, color: MUTED, marginTop: 3 },
  ov: { fontFamily: MONO, fontSize: 6, color: MUTED, border: `0.5pt solid ${MUTED}`, borderRadius: 4, paddingVertical: 1, paddingHorizontal: 4, marginTop: 4, alignSelf: "flex-start" },
  why: { fontSize: 7.3, fontWeight: 400, color: MUTED, marginTop: 4, lineHeight: 1.3 },
  people: { fontSize: 6.8, fontWeight: 400, color: MUTED, marginTop: 3 },
  foot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 5, borderTop: `0.5pt solid ${BORDER}` },
  tags: { flexDirection: "row", flexWrap: "wrap", flex: 1 },
  tag: { fontFamily: MONO, fontSize: 5.6, color: MUTED, border: `0.5pt solid ${BORDER}`, borderRadius: 3, paddingVertical: 1, paddingHorizontal: 3, marginRight: 3 },
  register: { fontSize: 7.3, fontWeight: 500, color: ACCENT, textDecoration: "none" },
  footer: { position: "absolute", bottom: 16, left: 32, right: 32, fontFamily: MONO, fontSize: 6.5, color: MUTED, flexDirection: "row", justifyContent: "space-between" },
  empty: { fontSize: 14, color: MUTED, marginTop: 30 },
});

function Card({ it, width, dense }: { it: AgendaItem; width: string; dense: boolean }) {
  const e = it.e;
  const host = realHost(e.host);
  const meta = [e.venue, host && `by ${host}`, e.price].filter(Boolean).join(" · ");
  const url = /^https?:\/\//.test(e.url) ? e.url : undefined;
  const h = dense ? 40 : 48;
  const isBest = it.rank === 1;
  // Generic GrowthX cover (butter initial on moss→olive gradient) when there's no usable image.
  const placeholder = (
    <View style={[s.ph, { height: h }]}>
      <Svg width={320} height={h} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`g${it.rank}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={BG} />
            <Stop offset="0.55" stopColor={SURFACE} />
            <Stop offset="1" stopColor={OLIVE} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#g${it.rank})`} />
      </Svg>
      <Text style={[s.phText, { top: h * 0.18, fontSize: h * 0.55 }]}>{initialOf(e.title)}</Text>
    </View>
  );
  // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
  const cover = it.image ? <Image style={[s.cover, { height: h }]} src={it.image} /> : placeholder;
  return (
    <View style={[s.cardWrap, { width }]} wrap={false}>
      <View style={isBest ? [s.card, s.cardBest] : s.card}>
        <View style={s.coverBox}>
          {url ? <Link src={url}>{cover}</Link> : cover}
          <Text style={s.chip}>{`#${it.rank}`}</Text>
        </View>
        <View style={s.body}>
          <View style={s.row}>
            <Text style={s.pill}>{`${fmt(e.start, { weekday: "short", month: "short", day: "numeric" })} · ${time(e.start)} PT`}</Text>
            {isBest ? (
              <View style={s.bestRow}>
                <View style={s.dot} />
                <Text style={s.best}>[ BEST PICK ]</Text>
              </View>
            ) : null}
          </View>
          <Text style={s.cardTitle}>{short(cleanTitle(e.title), dense ? 44 : 52)}</Text>
          {meta ? <Text style={s.meta}>{short(meta, dense ? 40 : 52)}</Text> : null}
          {it.overlapsWith ? <Text style={s.ov}>{`Overlaps with #${it.overlapsWith}`}</Text> : null}
          <Text style={s.why}>{it.why}</Text>
          {it.people ? <Text style={s.people}>{short(it.people, dense ? 44 : 70)}</Text> : null}
          <View style={s.spacer} />
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

function AgendaDoc({ a, icsUrl }: { a: Agenda; icsUrl?: string }) {
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
        <Text style={s.kicker}>[ GrowthX · San Francisco ]</Text>
        <Text style={s.title}>{short(sentenceCase(a.title), 80)}</Text>
        <View style={s.subRow}>
          <Text style={s.subtitle}>{`Your ${n} best room${n === 1 ? "" : "s"}, ranked from ${a.total} SF event${a.total === 1 ? "" : "s"}`}</Text>
          {icsUrl && n ? (
            <Link src={icsUrl} style={s.cal}>
              Add whole week to calendar (.ics)
            </Link>
          ) : null}
        </View>
        <Text style={s.sum}>{a.summary}</Text>
        {n ? (
          <>
            <View style={s.strip} wrap={false}>
              {days.map((d, i) => (
                <View key={d.key} style={i === days.length - 1 ? [s.day, s.dayLast] : s.day}>
                  <Text style={s.dayName}>{`[ ${fmt(d.items[0].e.start, { weekday: "short" })} ]`}</Text>
                  <Text style={s.dayNum}>{fmt(d.items[0].e.start, { month: "short", day: "numeric" })}</Text>
                  {d.items.map((it) => (
                    <Text key={it.e.id} style={s.dayLine}>
                      <Text style={s.dayTime}>{`${time(it.e.start)}  `}</Text>
                      {`${short(cleanTitle(it.e.title).replace(/\s*\([^)]*\)/g, ""), 24)}  `}
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

export function renderAgendaPdf(a: Agenda, icsUrl?: string): Promise<Buffer> {
  return renderToBuffer(<AgendaDoc a={a} icsUrl={icsUrl} />);
}
