/**
 * T4L Impact Log PDF export - Template 1: Improvement value report
 * Layout and conventions from T4L_PDF_Export_Templates.pdf (build pack).
 */
import { Document, Page, Text, View, StyleSheet, pdf, Svg, Rect, Circle, Line, Path } from '@react-pdf/renderer'
import { format, parseISO, isValid } from 'date-fns'
import type { ImpactLogRecord } from '@/services/impactLogService'
import {
 IMPACT_CATS,
 IMPACT_GROWTH,
 IMPACT_WASTES,
 claimInputsFromRecord,
 valuation,
 type ImpactRateCard,
} from '@/config/impactValueEngine'

const C = {
 plum: '#1A1726',
 plum2: '#3F1D5A',
 ink: '#241F33',
 grey: '#6B6472',
 mute: '#948EA0',
 line: '#E7E3DE',
 cream: '#FDF6EC',
 paper: '#FFFFFF',
 gold: '#D4A017',
 goldInk: '#8F6408',
 green: '#1B6E55',
 blue: '#254A9A',
 purple: '#6B2D8B',
 red: '#A4272A',
 light: '#EFECE7',
}

const styles = StyleSheet.create({
 page: {
 fontFamily: 'Helvetica',
 fontSize: 9,
 color: C.ink,
 backgroundColor: C.paper,
 paddingTop: 74,
 paddingBottom: 52,
 paddingHorizontal: 42,
 },
 header: {
 position: 'absolute',
 top: 18,
 left: 42,
 right: 42,
 flexDirection: 'row',
 justifyContent: 'space-between',
 alignItems: 'flex-start',
 },
 brandRow: { flexDirection: 'row', alignItems: 'center' },
 mark: {
 width: 22,
 height: 22,
 backgroundColor: C.plum2,
 justifyContent: 'center',
 alignItems: 'center',
 marginRight: 8,
 },
 markText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.paper },
 brandTitle: { fontFamily: 'Times-Bold', fontSize: 11, color: C.plum },
 brandSub: { fontSize: 8, color: C.grey, marginTop: 1 },
 headerRight: { alignItems: 'flex-end' },
 headerTag: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.goldInk, letterSpacing: 0.6 },
 headerNote: { fontSize: 7, color: C.mute, marginTop: 2 },
 goldRule: {
 position: 'absolute',
 top: 48,
 left: 42,
 right: 42,
 height: 1.4,
 backgroundColor: C.gold,
 },
 footer: {
 position: 'absolute',
 bottom: 18,
 left: 42,
 right: 42,
 borderTopWidth: 0.5,
 borderTopColor: C.line,
 paddingTop: 6,
 flexDirection: 'row',
 justifyContent: 'space-between',
 alignItems: 'center',
 },
 footerText: { fontSize: 7, color: C.mute, maxWidth: '78%' },
 title: { fontFamily: 'Times-Bold', fontSize: 22, color: C.plum2, marginBottom: 4 },
 subtitle: { fontSize: 9, color: C.grey, marginBottom: 10, maxWidth: '92%', lineHeight: 1.4 },
 metaBar: {
 backgroundColor: C.cream,
 borderRadius: 4,
 paddingVertical: 8,
 paddingHorizontal: 10,
 flexDirection: 'row',
 justifyContent: 'space-between',
 marginBottom: 14,
 },
 metaLeft: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink, maxWidth: '58%' },
 metaRight: { fontSize: 8, color: C.grey, textAlign: 'right', maxWidth: '40%' },
 kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
 kpi: { flex: 1 },
 kpiLabel: {
 fontSize: 7.5,
 fontFamily: 'Helvetica-Bold',
 color: C.goldInk,
 letterSpacing: 0.8,
 textTransform: 'uppercase',
 marginBottom: 3,
 },
 kpiValue: { fontFamily: 'Times-Bold', fontSize: 20, color: C.plum2 },
 kpiNote: { fontSize: 7.5, color: C.grey, marginTop: 2, lineHeight: 1.35 },
 sectionLabel: {
 fontSize: 8,
 fontFamily: 'Helvetica-Bold',
 color: C.goldInk,
 marginBottom: 6,
 },
 shareTrack: {
 height: 14,
 backgroundColor: C.light,
 borderRadius: 2,
 flexDirection: 'row',
 overflow: 'hidden',
 marginBottom: 6,
 },
 shareLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
 legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
 swatch: { width: 8, height: 8, borderRadius: 1 },
 legendText: { fontSize: 8, color: C.ink },
 chartsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
 chartBox: {
 flex: 1,
 borderWidth: 1,
 borderColor: C.line,
 borderRadius: 4,
 padding: 8,
 minHeight: 110,
 },
 chartTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 6 },
 claimRow: {
 flexDirection: 'row',
 alignItems: 'center',
 marginBottom: 5,
 gap: 6,
 },
 claimMeta: { width: '42%' },
 claimTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink },
 claimSub: { fontSize: 7, color: C.mute, marginTop: 1 },
 claimBarWrap: { flex: 1, height: 8, backgroundColor: C.light, borderRadius: 2 },
 claimBar: { height: 8, backgroundColor: C.purple, borderRadius: 2 },
 claimValue: { width: 58, textAlign: 'right', fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.plum2 },
 basis: { marginTop: 8, marginBottom: 8 },
 basisTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.goldInk, marginBottom: 4 },
 basisBody: { fontSize: 8, color: C.grey, lineHeight: 1.45 },
 noteRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
 noteCard: { flex: 1 },
 noteLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 2 },
 noteBody: { fontSize: 7.5, color: C.grey, lineHeight: 1.35 },
 flag: {
 marginTop: 8,
 backgroundColor: C.cream,
 borderLeftWidth: 3,
 borderLeftColor: C.gold,
 paddingVertical: 6,
 paddingHorizontal: 8,
 },
 flagText: { fontSize: 8, color: C.ink, lineHeight: 1.4 },
 draft: {
 position: 'absolute',
 top: '42%',
 left: '18%',
 fontSize: 64,
 color: C.mute,
 opacity: 0.08,
 transform: 'rotate(-32deg)',
 fontFamily: 'Helvetica-Bold',
 },
})

type Props = {
 entries: ImpactLogRecord[]
 rates: ImpactRateCard[]
 orgName: string
 preparedOn?: Date
}

function money0(n: number): string {
 if (!n) return ' - '
 const abs = Math.abs(Math.round(n))
 const s = `$${abs.toLocaleString('en-US')}`
 return n < 0 ? `(${s})` : s
}

function pct0(n: number): string {
 return `${Math.round(n)}%`
}

function isValidatedTier3(e: ImpactLogRecord, rates: ImpactRateCard[]): boolean {
 const status = e.claimStatus || e.verificationStatus || ''
 const recognized =
 status === 'Recognized' || status === 'approved' || e.verificationStatus === 'approved'
 if (!recognized) return false
 const inputs = claimInputsFromRecord(e)
 const tier = inputs ? valuation(inputs, rates).tier : Number(e.claim?.tier ?? 0)
 // Prefer Tier 3; if claim has no valuation inputs, include approved claims with usdValue
 if (inputs) return tier >= 3
 return Number(e.usdValue || 0) > 0
}

function bucketOf(e: ImpactLogRecord): 'cash' | 'avoidance' | 'capacity' | 'other' {
 const b = String(e.claim?.bucket || '').toLowerCase()
 if (b === 'cash' || b === 'avoidance' || b === 'capacity') return b
 if (Number(e.hours || 0) > 0 && !(Number(e.usdValue || 0) > 0)) return 'capacity'
 return 'cash'
}

function claimLabel(e: ImpactLogRecord): string {
 const cat = IMPACT_CATS.find((c) => c.k === e.claim?.cat)?.n || e.businessCategory || 'Improvement'
 const sub =
 e.claim?.cat === 'rev'
 ? IMPACT_GROWTH.find((g) => g.k === e.claim?.growth)?.n
 : IMPACT_WASTES.find((w) => w.k === e.claim?.waste)?.n
 return [cat, sub].filter(Boolean).join(' · ')
}

function monthKey(dateStr: string): string | null {
 try {
 const d = parseISO(dateStr)
 if (!isValid(d)) return null
 return format(d, 'yyyy-MM')
 } catch {
 return null
 }
}

function buildModel(entries: ImpactLogRecord[], rates: ImpactRateCard[], orgName: string, preparedOn: Date) {
 const validated = entries.filter((e) => isValidatedTier3(e, rates))
 const draftish = entries.some((e) => {
 const inputs = claimInputsFromRecord(e)
 const tier = inputs ? valuation(inputs, rates).tier : Number(e.claim?.tier ?? 0)
 return tier === 2
 })

 const cash = validated
 .filter((e) => bucketOf(e) === 'cash')
 .reduce((s, e) => s + Number(e.usdValue || e.claim?.net || 0), 0)
 const avoidance = validated
 .filter((e) => bucketOf(e) === 'avoidance')
 .reduce((s, e) => s + Number(e.usdValue || e.claim?.net || 0), 0)
 const capacityEntries = validated.filter((e) => bucketOf(e) === 'capacity')
 const capacityHours = capacityEntries.reduce((s, e) => s + Number(e.hours || 0), 0)
 const capacityIndicative = capacityEntries.reduce(
 (s, e) => s + Number(e.usdValue || e.claim?.net || 0),
 0,
 )

 const headline = cash + avoidance
 const shareCash = headline > 0 ? cash / headline : cash > 0 ? 1 : 0
 const shareAvoid = headline > 0 ? avoidance / headline : 0
 // Capacity never in the share of validated $ headline; show separately in legend note

 const ranked = [...validated]
 .map((e) => ({
 id: e.id.slice(0, 8).toUpperCase(),
 title: e.title,
 sub: claimLabel(e),
 value: Number(e.usdValue || e.claim?.net || 0),
 bucket: bucketOf(e),
 }))
 .filter((r) => r.value > 0 || r.bucket === 'capacity')
 .sort((a, b) => b.value - a.value)
 .slice(0, 6)

 const maxRank = Math.max(...ranked.map((r) => r.value), 1)

 const byMonth = new Map<string, number>()
 validated.forEach((e) => {
 const k = monthKey(e.date)
 if (!k) return
 byMonth.set(k, (byMonth.get(k) || 0) + Number(e.usdValue || e.claim?.net || 0))
 })
 const months = [...byMonth.keys()].sort().slice(-6)
 const monthValues = months.map((m) => byMonth.get(m) || 0)
 const monthMax = Math.max(...monthValues, 1)
 let running = 0
 const cumulative = monthValues.map((v) => {
 running += v
 return running
 })
 const cumMax = Math.max(...cumulative, 1)

 const recurring = validated.filter((e) => {
 const rec = String(e.claim?.recurrence || '')
 const sustain = String(e.claim?.sustain90 || e.claim?.sustained || '')
 return /recurr|holding|true/i.test(`${rec} ${sustain}`) || Number(e.usdValue || 0) > 0
 })
 const annualized = recurring.reduce((s, e) => {
 const sustain = String(e.claim?.sustain90 || '')
 if (sustain && !/holding/i.test(sustain)) return s
 return s + Number(e.usdValue || e.claim?.net || 0) * 12
 }, 0)

 const reversed = entries.filter((e) => /revers/i.test(String(e.claimStatus || ''))).length
 const sentBack = entries.filter((e) => /return|sent back|revision/i.test(String(e.claimStatus || ''))).length

 const top = ranked[0]
 const concentration = headline > 0 && top ? top.value / headline : 0

 // Realization: share of validated with finance-confirmed status if present; else N/A style 100 for recognized
 const realizationRate = validated.length
 ? Math.round(
 (validated.filter((e) =>
 /Recognized|Finance Validated|approved/i.test(String(e.claimStatus || e.verificationStatus || '')),
 ).length /
 validated.length) *
 100,
 )
 : 0

 const periodLabel =
 months.length >= 2
 ? `period to ${format(parseISO(`${months[months.length - 1]}-01`), 'd MMMM yyyy')}`
 : format(preparedOn, 'MMMM yyyy')

 const slug = orgName
 .toLowerCase()
 .replace(/[^a-z0-9]+/g, '_')
 .replace(/^_|_$/g, '')
 .slice(0, 40) || 'org'

 return {
 orgName,
 periodLabel,
 preparedLabel: format(preparedOn, 'd MMMM yyyy'),
 cash,
 avoidance,
 capacityHours,
 capacityIndicative,
 shareCash,
 shareAvoid,
 shareCapacityNote: capacityIndicative,
 ranked,
 maxRank,
 months,
 monthValues,
 monthMax,
 cumulative,
 cumMax,
 annualized,
 reversed,
 sentBack,
 concentration,
 realizationRate,
 draftish,
 validatedCount: validated.length,
 fileName: `t4l_improvement_value_report_${slug}_${format(preparedOn, 'yyyyMM')}_${format(preparedOn, 'yyyyMMdd')}.pdf`,
 }
}

function ShareBar({ cash, avoid }: { cash: number; avoid: number }) {
 const total = cash + avoid
 if (total <= 0) {
 return (
 <View style={styles.shareTrack}>
 <View style={{ flex: 1, backgroundColor: C.light }} />
 </View>
 )
 }
 return (
 <View style={styles.shareTrack}>
 {cash > 0 && <View style={{ flex: cash, backgroundColor: C.green }} />}
 {avoid > 0 && <View style={{ flex: avoid, backgroundColor: C.blue }} />}
 </View>
 )
}

function MonthChart({
 months,
 values,
 cumulative,
 maxV,
 maxC,
}: {
 months: string[]
 values: number[]
 cumulative: number[]
 maxV: number
 maxC: number
}) {
 const W = 220
 const H = 70
 const pad = 8
 const n = Math.max(months.length, 1)
 const gap = 6
 const barW = Math.max(8, (W - pad * 2 - gap * (n - 1)) / n)

 const points = cumulative.map((v, i) => {
 const x = pad + i * (barW + gap) + barW / 2
 const y = H - pad - (v / maxC) * (H - pad * 2)
 return { x, y }
 })
 const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

 return (
 <Svg width={W} height={H}>
 {[0.25, 0.5, 0.75].map((t) => (
 <Line
 key={t}
 x1={pad}
 x2={W - pad}
 y1={H - pad - t * (H - pad * 2)}
 y2={H - pad - t * (H - pad * 2)}
 stroke={C.line}
 strokeWidth={0.5}
 />
 ))}
 {values.map((v, i) => {
 const h = (v / maxV) * (H - pad * 2)
 const x = pad + i * (barW + gap)
 return <Rect key={months[i] || i} x={x} y={H - pad - h} width={barW} height={Math.max(h, 0)} fill={C.gold} />
 })}
 {points.length > 1 && (
 <Path d={linePath} stroke={C.purple} strokeWidth={1.5} fill="none" />
 )}
 {points.map((p, i) => (
 <Circle key={`c${i}`} cx={p.x} cy={p.y} r={2.2} stroke={C.purple} strokeWidth={1} fill={C.paper} />
 ))}
 </Svg>
 )
}

function RealizationDonut({ rate }: { rate: number }) {
 const r = 28
 const cx = 40
 const cy = 40
 const pct = Math.min(100, Math.max(0, rate)) / 100
 // Arc from top, clockwise-ish via SVG polar
 const start = -Math.PI / 2
 const end = start + pct * Math.PI * 2
 const x1 = cx + r * Math.cos(start)
 const y1 = cy + r * Math.sin(start)
 const x2 = cx + r * Math.cos(end)
 const y2 = cy + r * Math.sin(end)
 const large = pct > 0.5 ? 1 : 0
 const arc =
 pct <= 0
 ? ''
 : pct >= 0.999
 ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`
 : `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
 return (
 <View style={{ alignItems: 'center' }}>
 <Svg width={80} height={80}>
 <Circle cx={cx} cy={cy} r={r} stroke={C.light} strokeWidth={8} fill="none" />
 {arc ? <Path d={arc} stroke={C.green} strokeWidth={8} fill="none" /> : null}
 </Svg>
 <Text style={{ marginTop: -52, marginBottom: 28, fontFamily: 'Times-Bold', fontSize: 16, color: C.plum2 }}>
 {pct0(rate)}
 </Text>
 <Text style={{ fontSize: 7.5, color: C.grey }}>confirmed in the accounts</Text>
 </View>
 )
}

export function ImprovementValueReportDocument({ entries, rates, orgName, preparedOn = new Date() }: Props) {
 const m = buildModel(entries, rates, orgName, preparedOn)

 return (
 <Document
 title={`Improvement value report · ${orgName}`}
 author="Transformation Leader"
 subject="Validated Tier 3 improvement value"
 >
 <Page size="A4" style={styles.page}>
 <View style={styles.header} fixed>
 <View style={styles.brandRow}>
 <View style={styles.mark}>
 <Text style={styles.markText}>T4L</Text>
 </View>
 <View>
 <Text style={styles.brandTitle}>Transformation Leader</Text>
 <Text style={styles.brandSub}>Improvement value report</Text>
 </View>
 </View>
 <View style={styles.headerRight}>
 <Text style={styles.headerTag}>TEMPLATE 1</Text>
 <Text style={styles.headerNote}>Validated claims only</Text>
 </View>
 </View>
 <View style={styles.goldRule} fixed />

 {m.draftish ? <Text style={styles.draft}>DRAFT</Text> : null}

 <Text style={styles.title}>Improvement value report</Text>
 <Text style={styles.subtitle}>
 Quarterly, per organisation. The document a sponsor takes into a board meeting. One page,
 and every figure on it is a validated claim.
 </Text>

 <View style={styles.metaBar}>
 <Text style={styles.metaLeft}>
 {m.orgName} · {m.periodLabel}
 </Text>
 <Text style={styles.metaRight}>
 Prepared {m.preparedLabel} · {m.validatedCount} validated claim
 {m.validatedCount === 1 ? '' : 's'}
 </Text>
 </View>

 <View style={styles.kpiRow}>
 <View style={styles.kpi}>
 <Text style={styles.kpiLabel}>Cash impact per period</Text>
 <Text style={styles.kpiValue}>{money0(m.cash)}</Text>
 <Text style={styles.kpiNote}>Traceable to a P&L or budget line</Text>
 </View>
 <View style={styles.kpi}>
 <Text style={styles.kpiLabel}>Cost avoidance per period</Text>
 <Text style={styles.kpiValue}>{money0(m.avoidance)}</Text>
 <Text style={styles.kpiNote}>Spend that would have happened and did not</Text>
 </View>
 <View style={styles.kpi}>
 <Text style={styles.kpiLabel}>Capacity released</Text>
 <Text style={styles.kpiValue}>
 {m.capacityHours ? `${Math.round(m.capacityHours)} hrs` : ' - '}
 </Text>
 <Text style={styles.kpiNote}>
 Indicative equivalent {money0(m.capacityIndicative)}. Not added to the figures at left.
 </Text>
 </View>
 </View>

 <Text style={styles.sectionLabel}>
 Share of validated value, shown as separate buckets and never as one total
 </Text>
 <ShareBar cash={m.cash} avoid={m.avoidance} />
 <View style={styles.shareLegend}>
 <View style={styles.legendItem}>
 <View style={[styles.swatch, { backgroundColor: C.green }]} />
 <Text style={styles.legendText}>Cash impact {money0(m.cash)}</Text>
 </View>
 <View style={styles.legendItem}>
 <View style={[styles.swatch, { backgroundColor: C.blue }]} />
 <Text style={styles.legendText}>Cost avoidance {money0(m.avoidance)}</Text>
 </View>
 <View style={styles.legendItem}>
 <View style={[styles.swatch, { backgroundColor: C.purple }]} />
 <Text style={styles.legendText}>
 Capacity released, indicative {money0(m.capacityIndicative)}
 </Text>
 </View>
 </View>

 <View style={styles.chartsRow}>
 <View style={styles.chartBox}>
 <Text style={styles.chartTitle}>Validated value recognized by month</Text>
 {m.months.length ? (
 <MonthChart
 months={m.months}
 values={m.monthValues}
 cumulative={m.cumulative}
 maxV={m.monthMax}
 maxC={m.cumMax}
 />
 ) : (
 <Text style={{ fontSize: 8, color: C.mute }}>No monthly series yet.</Text>
 )}
 <Text style={{ fontSize: 7, color: C.mute, marginTop: 4 }}>
 Bars: recognized in month · line: cumulative
 </Text>
 </View>
 <View style={[styles.chartBox, { flex: 0.55, alignItems: 'center' }]}>
 <Text style={styles.chartTitle}>Realization rate</Text>
 <RealizationDonut rate={m.realizationRate} />
 </View>
 </View>

 {m.ranked.map((r) => (
 <View key={r.id} style={styles.claimRow} wrap={false}>
 <View style={styles.claimMeta}>
 <Text style={styles.claimTitle}>
 {r.id} · {r.title}
 </Text>
 <Text style={styles.claimSub}>{r.sub}</Text>
 </View>
 <View style={styles.claimBarWrap}>
 <View style={[styles.claimBar, { width: `${Math.max(4, (r.value / m.maxRank) * 100)}%` }]} />
 </View>
 <Text style={styles.claimValue}>{money0(r.value)}</Text>
 </View>
 ))}
 {!m.ranked.length && (
 <Text style={{ fontSize: 8, color: C.mute, marginBottom: 8 }}>
 No validated Tier 3 claims yet. Figures appear here once claims are recognized.
 </Text>
 )}

 <View style={styles.basis}>
 <Text style={styles.basisTitle}>Basis of preparation</Text>
 <Text style={styles.basisBody}>
 Every figure comes from a claim with a baseline drawn from a named system, locked before
 the change began where recorded, and valued from organisation rate cards returned by
 finance. Value is reduced for attribution, capacity realisation and evidence confidence,
 and net of delivery cost where supplied. Cash impact, cost avoidance and capacity
 released are never summed. Figures are per measurement period. The annualized run rate
 applies only to recurring claims and is not added to the figures above.
 </Text>
 </View>

 <View style={styles.noteRow}>
 <View style={styles.noteCard}>
 <Text style={styles.noteLabel}>Annualized run rate</Text>
 <Text style={styles.noteBody}>
 {money0(m.annualized)} on recurring claims. Capped at twelve months. Not added to the
 figures above.
 </Text>
 </View>
 <View style={styles.noteCard}>
 <Text style={styles.noteLabel}>Reversals and send-backs</Text>
 <Text style={styles.noteBody}>
 {m.reversed} claim{m.reversed === 1 ? '' : 's'} reversed. {m.sentBack} returned for
 revision. Both remain on the register with the reason recorded.
 </Text>
 </View>
 <View style={styles.noteCard}>
 <Text style={styles.noteLabel}>Realization rate</Text>
 <Text style={styles.noteBody}>
 {pct0(m.realizationRate)} of validated claims confirmed in status at export.
 </Text>
 </View>
 </View>

 {m.concentration > 0.25 && m.ranked[0] ? (
 <View style={styles.flag}>
 <Text style={styles.flagText}>
 Concentration flag. One claim carries {pct0(m.concentration * 100)} of the headline
 figure ({m.ranked[0].title}). It is shown separately above so the reader can see the
 total does not yet rest on a broad base.
 </Text>
 </View>
 ) : null}

 <View style={styles.footer} fixed>
 <Text style={styles.footerText}>
 Positive Impact. Sustainable Change. | Every figure drills to a claim record with its
 baseline extract, result extract and approval trail.
 </Text>
 <Text
 style={{ fontSize: 7, color: C.mute }}
 render={({ pageNumber }) => `Page ${pageNumber}`}
 />
 </View>
 </Page>
 </Document>
 )
}

/* Download helper kept beside the document for a single import site. */
// eslint-disable-next-line react-refresh/only-export-components -- paired download API
export async function downloadImprovementValueReportPdf(params: {
 entries: ImpactLogRecord[]
 rates: ImpactRateCard[]
 orgName?: string | null
}): Promise<string> {
 const orgName = params.orgName?.trim() || 'Organisation'
 const preparedOn = new Date()
 const model = buildModel(params.entries, params.rates, orgName, preparedOn)
 if (!params.entries.length) {
 throw new Error('Nothing to include yet. Log an activity, claim, or ESG entry first.')
 }

 const doc = (
 <ImprovementValueReportDocument
 entries={params.entries}
 rates={params.rates}
 orgName={orgName}
 preparedOn={preparedOn}
 />
 )
 const blob = await pdf(doc).toBlob()
 const url = URL.createObjectURL(blob)
 const link = document.createElement('a')
 link.href = url
 link.download = model.fileName
 link.click()
 URL.revokeObjectURL(url)
 return model.fileName
}
