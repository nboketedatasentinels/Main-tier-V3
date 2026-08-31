import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import { format } from 'date-fns'
import type {
 JourneyReportLearnerRow,
 PartnerJourneyReportData,
} from '@/services/partnerJourneyReportService'

const COLORS = {
 plum: '#27062e',
 gold: '#eab130',
 softGold: '#f9db59',
 white: '#FFFFFF',
 gray50: '#f8fafc',
 gray100: '#f1f5f9',
 gray200: '#e2e8f0',
 gray400: '#94a3b8',
 gray500: '#64748b',
 gray700: '#334155',
 purpleSoft: '#f3eef8',
 green: '#15803d',
 greenBg: '#f0fdf4',
}

const styles = StyleSheet.create({
 page: {
 fontFamily: 'Helvetica',
 fontSize: 10,
 color: COLORS.plum,
 backgroundColor: COLORS.white,
 paddingTop: 32,
 paddingBottom: 44,
 paddingHorizontal: 32,
 },
 cover: {
 backgroundColor: COLORS.plum,
 padding: 36,
 minHeight: '100%',
 },
 brand: {
 fontSize: 9,
 letterSpacing: 1.2,
 textTransform: 'uppercase',
 color: 'rgba(255,255,255,0.45)',
 marginBottom: 6,
 },
 coverEyebrow: {
 fontSize: 12,
 fontWeight: 'bold',
 color: COLORS.gold,
 marginBottom: 12,
 },
 coverTitle: {
 fontSize: 28,
 fontWeight: 'bold',
 color: COLORS.white,
 lineHeight: 1.15,
 marginBottom: 8,
 },
 coverSub: {
 fontSize: 11,
 color: 'rgba(255,255,255,0.7)',
 lineHeight: 1.5,
 maxWidth: 430,
 marginBottom: 28,
 },
 coverMetaRow: { flexDirection: 'row', flexWrap: 'wrap' },
 coverChip: {
 backgroundColor: 'rgba(255,255,255,0.08)',
 borderWidth: 1,
 borderColor: 'rgba(255,255,255,0.15)',
 borderRadius: 8,
 paddingVertical: 8,
 paddingHorizontal: 12,
 marginRight: 8,
 marginBottom: 8,
 },
 coverChipLabel: {
 fontSize: 8,
 color: 'rgba(255,255,255,0.5)',
 marginBottom: 2,
 textTransform: 'uppercase',
 letterSpacing: 0.6,
 },
 coverChipValue: {
 fontSize: 11,
 fontWeight: 'bold',
 color: COLORS.white,
 },
 sectionTitle: {
 fontSize: 14,
 fontWeight: 'bold',
 color: COLORS.plum,
 marginBottom: 8,
 marginTop: 2,
 },
 sectionHint: {
 fontSize: 9,
 color: COLORS.gray500,
 marginBottom: 10,
 },
 statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 },
 statCard: {
 width: '31%',
 marginRight: '2%',
 marginBottom: 8,
 backgroundColor: COLORS.gray50,
 borderWidth: 1,
 borderColor: COLORS.gray200,
 borderRadius: 8,
 padding: 10,
 },
 statLabel: {
 fontSize: 8,
 color: COLORS.gray500,
 textTransform: 'uppercase',
 letterSpacing: 0.5,
 marginBottom: 4,
 },
 statValue: { fontSize: 15, fontWeight: 'bold', color: COLORS.plum },
 highlight: {
 backgroundColor: COLORS.greenBg,
 borderWidth: 1,
 borderColor: '#bbf7d0',
 borderRadius: 8,
 padding: 12,
 marginBottom: 14,
 },
 highlightTitle: {
 fontSize: 8,
 color: COLORS.green,
 textTransform: 'uppercase',
 letterSpacing: 0.6,
 marginBottom: 4,
 },
 highlightName: { fontSize: 13, fontWeight: 'bold', color: COLORS.plum },
 highlightMeta: { fontSize: 9, color: COLORS.gray700, marginTop: 2 },
 tableHeader: {
 flexDirection: 'row',
 backgroundColor: COLORS.plum,
 borderTopLeftRadius: 6,
 borderTopRightRadius: 6,
 paddingVertical: 6,
 paddingHorizontal: 6,
 },
 tableHeaderCell: { color: COLORS.white, fontSize: 8, fontWeight: 'bold' },
 tableRow: {
 flexDirection: 'row',
 borderBottomWidth: 1,
 borderBottomColor: COLORS.gray200,
 paddingVertical: 5,
 paddingHorizontal: 6,
 },
 tableRowAlt: { backgroundColor: COLORS.gray50 },
 tableCell: { fontSize: 8, color: COLORS.gray700 },
 bucketRow: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 paddingVertical: 4,
 borderBottomWidth: 1,
 borderBottomColor: COLORS.gray100,
 },
 footer: {
 position: 'absolute',
 bottom: 18,
 left: 32,
 right: 32,
 fontSize: 8,
 color: COLORS.gray500,
 },
 // Learner profile card
 profileCard: {
 borderWidth: 1,
 borderColor: COLORS.gray200,
 borderRadius: 12,
 padding: 14,
 marginBottom: 12,
 backgroundColor: COLORS.white,
 },
 profileTop: {
 flexDirection: 'row',
 alignItems: 'center',
 marginBottom: 10,
 },
 avatar: {
 width: 42,
 height: 42,
 borderRadius: 21,
 backgroundColor: COLORS.plum,
 borderWidth: 2,
 borderColor: COLORS.gold,
 alignItems: 'center',
 justifyContent: 'center',
 marginRight: 10,
 },
 avatarText: { color: COLORS.white, fontSize: 12, fontWeight: 'bold' },
 profileMain: { flex: 1 },
 profileName: { fontSize: 14, fontWeight: 'bold', color: COLORS.plum, marginBottom: 2 },
 profileMeta: { fontSize: 9, color: COLORS.gray500 },
 rankBadge: {
 backgroundColor: COLORS.gold,
 borderRadius: 8,
 paddingVertical: 5,
 paddingHorizontal: 8,
 },
 rankBadgeText: { fontSize: 8, fontWeight: 'bold', color: COLORS.white },
 valuesRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
 valuePill: {
 backgroundColor: COLORS.purpleSoft,
 borderRadius: 999,
 paddingVertical: 3,
 paddingHorizontal: 8,
 marginRight: 5,
 marginBottom: 5,
 },
 valuePillText: { fontSize: 8, color: COLORS.plum },
 engagementTitle: {
 fontSize: 11,
 fontWeight: 'bold',
 color: COLORS.plum,
 marginBottom: 8,
 },
 progressWrap: { marginBottom: 10 },
 progressLabels: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 marginBottom: 4,
 },
 progressLabel: { fontSize: 8, color: COLORS.gray500 },
 progressTrack: {
 height: 10,
 borderRadius: 5,
 backgroundColor: COLORS.gray100,
 overflow: 'hidden',
 position: 'relative',
 },
 progressFill: {
 height: 10,
 borderRadius: 5,
 backgroundColor: COLORS.plum,
 },
 progressPassMark: {
 position: 'absolute',
 top: 0,
 bottom: 0,
 width: 1.5,
 backgroundColor: COLORS.gold,
 },
 activityHeader: {
 flexDirection: 'row',
 backgroundColor: COLORS.plum,
 borderTopLeftRadius: 6,
 borderTopRightRadius: 6,
 paddingVertical: 5,
 paddingHorizontal: 8,
 },
 activityRow: {
 flexDirection: 'row',
 borderBottomWidth: 1,
 borderBottomColor: COLORS.gray200,
 paddingVertical: 5,
 paddingHorizontal: 8,
 },
})

const fmtPoints = (value: number): string => value.toLocaleString('en-US')
const fmtDate = (value: Date | null): string => (value ? format(value, 'd MMM yyyy') : '-')
const pct = (value: number, max: number): number => {
 if (max <= 0) return 0
 return Math.max(0, Math.min(100, (value / max) * 100))
}

const Stat = ({ label, value }: { label: string; value: string }) => (
 <View style={styles.statCard}>
 <Text style={styles.statLabel}>{label}</Text>
 <Text style={styles.statValue}>{value}</Text>
 </View>
)

const BucketColumn = ({
 title,
 buckets,
}: {
 title: string
 buckets: { label: string; count: number; percent: number }[]
}) => (
 <View style={{ width: '48%' }}>
 <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 6 }}>{title}</Text>
 {buckets.slice(0, 8).map((bucket) => (
 <View key={`${title}-${bucket.label}`} style={styles.bucketRow}>
 <Text style={styles.tableCell}>{bucket.label}</Text>
 <Text style={styles.tableCell}>
 {bucket.count} ({bucket.percent}%)
 </Text>
 </View>
 ))}
 </View>
)

const LearnerProfileCard = ({ learner }: { learner: JourneyReportLearnerRow }) => {
 const maxPoints = Math.max(learner.maxPoints, learner.passMark, learner.totalPoints, 1)
 const fillWidth = `${pct(learner.totalPoints, maxPoints)}%`
 const passLeft = `${pct(learner.passMark, maxPoints)}%`
 const groupedTail = learner.engagement.filter((m) =>
 ['webinar_workbook', 'impact_log', 'capstone', 'peer_to_peer'].includes(m.id),
 )
 const primaryMetrics = learner.engagement.filter((m) =>
 ['weekly_session', 'lift_module'].includes(m.id),
 )

 return (
 <View style={styles.profileCard} wrap={false}>
 <View style={styles.profileTop}>
 <View style={styles.avatar}>
 <Text style={styles.avatarText}>{learner.initials}</Text>
 </View>
 <View style={styles.profileMain}>
 <Text style={styles.profileName}>{learner.name}</Text>
 <Text style={styles.profileMeta}>
 {learner.role} · {learner.ageRange} · {learner.personalityLabel}
 </Text>
 </View>
 <View style={styles.rankBadge}>
 <Text style={styles.rankBadgeText}>Growth rank #{learner.growthRank}</Text>
 </View>
 </View>

 {learner.coreValues.length > 0 ? (
 <View style={styles.valuesRow}>
 {learner.coreValues.map((value) => (
 <View key={`${learner.id}-${value}`} style={styles.valuePill}>
 <Text style={styles.valuePillText}>{value}</Text>
 </View>
 ))}
 </View>
 ) : (
 <Text style={[styles.sectionHint, { marginBottom: 8 }]}>Core values not completed</Text>
 )}

 <Text style={styles.engagementTitle}>Engagement</Text>
 <View style={styles.progressWrap}>
 <View style={styles.progressLabels}>
 <Text style={styles.progressLabel}>0</Text>
 <Text style={styles.progressLabel}>{fmtPoints(learner.totalPoints)} pts</Text>
 <Text style={styles.progressLabel}>
 Pass {fmtPoints(learner.passMark)} · {fmtPoints(learner.maxPoints)} max
 </Text>
 </View>
 <View style={styles.progressTrack}>
 <View style={[styles.progressFill, { width: fillWidth }]} />
 {learner.passMark > 0 && (
 <View style={[styles.progressPassMark, { left: passLeft }]} />
 )}
 </View>
 </View>

 <View style={styles.activityHeader}>
 <Text style={[styles.tableHeaderCell, { width: '70%' }]}>ACTIVITY</Text>
 <Text style={[styles.tableHeaderCell, { width: '30%', textAlign: 'right' }]}>DONE</Text>
 </View>
 {primaryMetrics.map((metric) => (
 <View key={`${learner.id}-${metric.id}`} style={styles.activityRow}>
 <Text style={[styles.tableCell, { width: '70%' }]}>{metric.label}</Text>
 <Text style={[styles.tableCell, { width: '30%', textAlign: 'right' }]}>
 {metric.max > 0 ? `${metric.done} of ${metric.max}` : String(metric.done)}
 </Text>
 </View>
 ))}
 {groupedTail.length > 0 && (
 <View style={styles.activityRow}>
 <Text style={[styles.tableCell, { width: '70%' }]}>
 {groupedTail.map((m) => m.label).join(' · ')}
 </Text>
 <Text style={[styles.tableCell, { width: '30%', textAlign: 'right' }]}>
 {groupedTail.map((m) => String(m.done)).join(' · ')}
 </Text>
 </View>
 )}
 </View>
 )
}

export const generatePartnerJourneyPdfReport = async (
 report: PartnerJourneyReportData,
): Promise<void> => {
 const learnerPages: JourneyReportLearnerRow[][] = []
 for (let i = 0; i < report.learners.length; i += 2) {
 learnerPages.push(report.learners.slice(i, i + 2))
 }

 const doc = (
 <Document>
 <Page size="A4" style={styles.cover}>
 <Text style={styles.brand}>Transformation Leader</Text>
 <Text style={styles.coverEyebrow}>
 {report.isCalendarComplete ? 'End-of-journey report' : 'Journey progress report'}
 </Text>
 <Text style={styles.coverTitle}>{report.orgName}</Text>
 <Text style={styles.coverSub}>
 Organisation summary plus individual learner profiles: role, age, personality, values,
 growth rank, points progress, and activity engagement.
 </Text>
 <View style={styles.coverMetaRow}>
 <View style={styles.coverChip}>
 <Text style={styles.coverChipLabel}>Journey</Text>
 <Text style={styles.coverChipValue}>{report.journeyLabel}</Text>
 </View>
 <View style={styles.coverChip}>
 <Text style={styles.coverChipLabel}>Cohort</Text>
 <Text style={styles.coverChipValue}>
 {fmtDate(report.cohortStartDate)} - {fmtDate(report.cohortEndDate)}
 </Text>
 </View>
 <View style={styles.coverChip}>
 <Text style={styles.coverChipLabel}>Generated</Text>
 <Text style={styles.coverChipValue}>
 {format(report.generatedAt, 'd MMM yyyy HH:mm')}
 </Text>
 </View>
 <View style={styles.coverChip}>
 <Text style={styles.coverChipLabel}>Pass mark</Text>
 <Text style={styles.coverChipValue}>
 {report.passMark > 0 ? fmtPoints(report.passMark) : '-'} pts
 </Text>
 </View>
 </View>
 </Page>

 <Page size="A4" style={styles.page}>
 <Text style={styles.sectionTitle}>Organisation overview</Text>
 <View style={styles.statsGrid}>
 <Stat label="Learners" value={String(report.totals.learners)} />
 <Stat
 label="Completed"
 value={`${report.totals.completed} (${report.totals.completionRate}%)`}
 />
 <Stat label="Incomplete" value={String(report.totals.incomplete)} />
 <Stat label="Avg points" value={fmtPoints(report.totals.avgPoints)} />
 <Stat label="Median points" value={fmtPoints(report.totals.medianPoints)} />
 <Stat label="Highest score" value={fmtPoints(report.totals.maxPoints)} />
 </View>

 {report.topScorer && (
 <View style={styles.highlight}>
 <Text style={styles.highlightTitle}>Highest scorer</Text>
 <Text style={styles.highlightName}>{report.topScorer.name}</Text>
 <Text style={styles.highlightMeta}>
 Growth rank #{report.topScorer.growthRank} · {fmtPoints(report.topScorer.totalPoints)}{' '}
 pts · {report.topScorer.role} · {report.topScorer.ageRange} ·{' '}
 {report.topScorer.personalityLabel}
 </Text>
 </View>
 )}

 <Text style={styles.sectionTitle}>Engagement across the cohort</Text>
 <Text style={styles.sectionHint}>
 Totals of completed activities vs journey targets for all learners.
 </Text>
 <View style={styles.tableHeader}>
 <Text style={[styles.tableHeaderCell, { width: '34%' }]}>Activity</Text>
 <Text style={[styles.tableHeaderCell, { width: '22%' }]}>Done</Text>
 <Text style={[styles.tableHeaderCell, { width: '22%' }]}>Target</Text>
 <Text style={[styles.tableHeaderCell, { width: '22%' }]}>Learners active</Text>
 </View>
 {report.engagementSummary.map((row, index) => (
 <View
 key={row.id}
 style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
 >
 <Text style={[styles.tableCell, { width: '34%' }]}>{row.label}</Text>
 <Text style={[styles.tableCell, { width: '22%' }]}>{row.totalDone}</Text>
 <Text style={[styles.tableCell, { width: '22%' }]}>
 {row.totalMax > 0 ? row.totalMax : '-'}
 </Text>
 <Text style={[styles.tableCell, { width: '22%' }]}>{row.learnersWithAny}</Text>
 </View>
 ))}

 <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Demographics & assessments</Text>
 <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
 <BucketColumn title="Role" buckets={report.roleBreakdown} />
 <BucketColumn title="Age range" buckets={report.ageBreakdown} />
 </View>
 <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
 <BucketColumn title="Gender" buckets={report.genderBreakdown} />
 <BucketColumn title="Personality" buckets={report.personalityBreakdown} />
 </View>

 <Text
 style={styles.footer}
 render={({ pageNumber, totalPages }) =>
 `${report.orgName} · Page ${pageNumber} of ${totalPages}`
 }
 fixed
 />
 </Page>

 <Page size="A4" style={styles.page}>
 <Text style={styles.sectionTitle}>Top performers</Text>
 <View style={styles.tableHeader}>
 <Text style={[styles.tableHeaderCell, { width: '7%' }]}>#</Text>
 <Text style={[styles.tableHeaderCell, { width: '24%' }]}>Name</Text>
 <Text style={[styles.tableHeaderCell, { width: '14%' }]}>Points</Text>
 <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Role</Text>
 <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Age</Text>
 <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Personality</Text>
 </View>
 {report.topScorers.map((row, index) => (
 <View
 key={row.id}
 style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
 >
 <Text style={[styles.tableCell, { width: '7%' }]}>{row.growthRank}</Text>
 <Text style={[styles.tableCell, { width: '24%' }]}>{row.name}</Text>
 <Text style={[styles.tableCell, { width: '14%' }]}>{fmtPoints(row.totalPoints)}</Text>
 <Text style={[styles.tableCell, { width: '20%' }]}>{row.role}</Text>
 <Text style={[styles.tableCell, { width: '15%' }]}>{row.ageRange}</Text>
 <Text style={[styles.tableCell, { width: '20%' }]}>
 {row.personalityType || '-'}
 </Text>
 </View>
 ))}

 <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Full learner roster</Text>
 <View style={styles.tableHeader}>
 <Text style={[styles.tableHeaderCell, { width: '6%' }]}>#</Text>
 <Text style={[styles.tableHeaderCell, { width: '22%' }]}>Name</Text>
 <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Points</Text>
 <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Done</Text>
 <Text style={[styles.tableHeaderCell, { width: '18%' }]}>Role</Text>
 <Text style={[styles.tableHeaderCell, { width: '14%' }]}>Age</Text>
 <Text style={[styles.tableHeaderCell, { width: '16%' }]}>Personality</Text>
 </View>
 {report.learners.map((row, index) => (
 <View
 key={row.id}
 style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
 wrap={false}
 >
 <Text style={[styles.tableCell, { width: '6%' }]}>{row.growthRank}</Text>
 <Text style={[styles.tableCell, { width: '22%' }]}>{row.name}</Text>
 <Text style={[styles.tableCell, { width: '12%' }]}>{fmtPoints(row.totalPoints)}</Text>
 <Text style={[styles.tableCell, { width: '12%' }]}>{row.completed ? 'Yes' : 'No'}</Text>
 <Text style={[styles.tableCell, { width: '18%' }]}>{row.role}</Text>
 <Text style={[styles.tableCell, { width: '14%' }]}>{row.ageRange}</Text>
 <Text style={[styles.tableCell, { width: '16%' }]}>
 {row.personalityType || '-'}
 </Text>
 </View>
 ))}
 {!report.learners.length && (
 <Text style={[styles.tableCell, { marginTop: 12 }]}>No learners in this organisation.</Text>
 )}

 <Text
 style={styles.footer}
 render={({ pageNumber, totalPages }) =>
 `${report.orgName} · Page ${pageNumber} of ${totalPages}`
 }
 fixed
 />
 </Page>

 {learnerPages.map((pageLearners, pageIndex) => (
 <Page key={`learners-${pageIndex}`} size="A4" style={styles.page}>
 {pageIndex === 0 && (
 <>
 <Text style={styles.sectionTitle}>Individual learner profiles</Text>
 <Text style={styles.sectionHint}>
 Profile card, values, points progress, and activity engagement for each learner.
 </Text>
 </>
 )}
 {pageLearners.map((learner) => (
 <LearnerProfileCard key={learner.id} learner={learner} />
 ))}
 <Text
 style={styles.footer}
 render={({ pageNumber, totalPages }) =>
 `${report.orgName} · Page ${pageNumber} of ${totalPages}`
 }
 fixed
 />
 </Page>
 ))}
 </Document>
 )

 const blob = await pdf(doc).toBlob()
 const url = URL.createObjectURL(blob)
 const link = document.createElement('a')
 link.href = url
 const slug = (report.orgCode || report.orgName || 'org')
 .toLowerCase()
 .replace(/[^a-z0-9]+/g, '-')
 .replace(/^-|-$/g, '')
 link.download = `journey-report-${slug}-${format(report.generatedAt, 'yyyy-MM-dd')}.pdf`
 link.click()
 URL.revokeObjectURL(url)
}
