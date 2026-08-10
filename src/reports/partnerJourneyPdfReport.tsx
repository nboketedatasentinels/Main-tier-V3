import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import { format } from 'date-fns'
import type { PartnerJourneyReportData } from '@/services/partnerJourneyReportService'

const COLORS = {
  plum: '#27062e',
  gold: '#eab130',
  softGold: '#f9db59',
  white: '#FFFFFF',
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
  gray200: '#e2e8f0',
  gray500: '#64748b',
  gray700: '#334155',
  green: '#15803d',
  greenBg: '#f0fdf4',
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLORS.plum,
    backgroundColor: COLORS.white,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
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
    maxWidth: 420,
    marginBottom: 28,
  },
  coverMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
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
    marginBottom: 10,
    marginTop: 4,
  },
  sectionHint: {
    fontSize: 9,
    color: COLORS.gray500,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  statCard: {
    width: '31%',
    marginRight: '2%',
    marginBottom: 10,
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
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.plum,
  },
  highlight: {
    backgroundColor: COLORS.greenBg,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 18,
  },
  highlightTitle: {
    fontSize: 9,
    color: COLORS.green,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  highlightName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.plum,
  },
  highlightMeta: {
    fontSize: 10,
    color: COLORS.gray700,
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.plum,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableRowAlt: {
    backgroundColor: COLORS.gray50,
  },
  tableCell: {
    fontSize: 8,
    color: COLORS.gray700,
  },
  bucketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: COLORS.gray500,
  },
})

const fmtPoints = (value: number): string => value.toLocaleString('en-US')

const fmtDate = (value: Date | null): string =>
  value ? format(value, 'd MMM yyyy') : '—'

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.statCard}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
)

export const generatePartnerJourneyPdfReport = async (
  report: PartnerJourneyReportData,
): Promise<void> => {
  const doc = (
    <Document>
      <Page size="A4" style={styles.cover}>
        <Text style={styles.brand}>Transformation Leader</Text>
        <Text style={styles.coverEyebrow}>
          {report.isCalendarComplete ? 'End-of-journey report' : 'Journey progress report'}
        </Text>
        <Text style={styles.coverTitle}>{report.orgName}</Text>
        <Text style={styles.coverSub}>
          Organisation cohort summary for partners: completion, top performers, demographics where
          available, and the full learner roster.
        </Text>
        <View style={styles.coverMetaRow}>
          <View style={styles.coverChip}>
            <Text style={styles.coverChipLabel}>Journey</Text>
            <Text style={styles.coverChipValue}>{report.journeyLabel}</Text>
          </View>
          <View style={styles.coverChip}>
            <Text style={styles.coverChipLabel}>Cohort</Text>
            <Text style={styles.coverChipValue}>
              {fmtDate(report.cohortStartDate)} – {fmtDate(report.cohortEndDate)}
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
              {report.passMark > 0 ? fmtPoints(report.passMark) : '—'} pts
            </Text>
          </View>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Cohort overview</Text>
        <View style={styles.statsGrid}>
          <Stat label="Learners" value={String(report.totals.learners)} />
          <Stat label="Completed" value={`${report.totals.completed} (${report.totals.completionRate}%)`} />
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
              {fmtPoints(report.topScorer.totalPoints)} pts · {report.topScorer.ageRange} ·{' '}
              {report.topScorer.gender} · {report.topScorer.role}
              {report.topScorer.email !== '-' ? ` · ${report.topScorer.email}` : ''}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Top performers</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: '8%' }]}>#</Text>
          <Text style={[styles.tableHeaderCell, { width: '28%' }]}>Name</Text>
          <Text style={[styles.tableHeaderCell, { width: '18%' }]}>Points</Text>
          <Text style={[styles.tableHeaderCell, { width: '16%' }]}>Age</Text>
          <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Gender</Text>
          <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Status</Text>
        </View>
        {report.topScorers.map((row, index) => (
          <View
            key={row.id}
            style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
          >
            <Text style={[styles.tableCell, { width: '8%' }]}>{index + 1}</Text>
            <Text style={[styles.tableCell, { width: '28%' }]}>{row.name}</Text>
            <Text style={[styles.tableCell, { width: '18%' }]}>{fmtPoints(row.totalPoints)}</Text>
            <Text style={[styles.tableCell, { width: '16%' }]}>{row.ageRange}</Text>
            <Text style={[styles.tableCell, { width: '15%' }]}>{row.gender}</Text>
            <Text style={[styles.tableCell, { width: '15%' }]}>
              {row.completed ? 'Completed' : row.status}
            </Text>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Demographics</Text>
        <Text style={styles.sectionHint}>
          Age range and gender come from signup where available. Older accounts may show as Unknown.
        </Text>
        <View style={{ flexDirection: 'row', gap: 24 }}>
          <View style={{ width: '48%' }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 6 }}>Age range</Text>
            {report.ageBreakdown.map((bucket) => (
              <View key={`age-${bucket.label}`} style={styles.bucketRow}>
                <Text style={styles.tableCell}>{bucket.label}</Text>
                <Text style={styles.tableCell}>
                  {bucket.count} ({bucket.percent}%)
                </Text>
              </View>
            ))}
          </View>
          <View style={{ width: '48%' }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 6 }}>Gender</Text>
            {report.genderBreakdown.map((bucket) => (
              <View key={`gender-${bucket.label}`} style={styles.bucketRow}>
                <Text style={styles.tableCell}>{bucket.label}</Text>
                <Text style={styles.tableCell}>
                  {bucket.count} ({bucket.percent}%)
                </Text>
              </View>
            ))}
          </View>
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
        <Text style={styles.sectionTitle}>Full learner roster</Text>
        <Text style={styles.sectionHint}>
          Sorted by points. Completion uses the journey pass mark
          {report.passMark > 0 ? ` (${fmtPoints(report.passMark)} pts)` : ''}.
        </Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: '22%' }]}>Name</Text>
          <Text style={[styles.tableHeaderCell, { width: '14%' }]}>Points</Text>
          <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Done</Text>
          <Text style={[styles.tableHeaderCell, { width: '14%' }]}>Age</Text>
          <Text style={[styles.tableHeaderCell, { width: '14%' }]}>Gender</Text>
          <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Tier</Text>
          <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Status</Text>
        </View>
        {report.learners.map((row, index) => (
          <View
            key={row.id}
            style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
            wrap={false}
          >
            <Text style={[styles.tableCell, { width: '22%' }]}>{row.name}</Text>
            <Text style={[styles.tableCell, { width: '14%' }]}>{fmtPoints(row.totalPoints)}</Text>
            <Text style={[styles.tableCell, { width: '12%' }]}>{row.completed ? 'Yes' : 'No'}</Text>
            <Text style={[styles.tableCell, { width: '14%' }]}>{row.ageRange}</Text>
            <Text style={[styles.tableCell, { width: '14%' }]}>{row.gender}</Text>
            <Text style={[styles.tableCell, { width: '12%' }]}>{row.membershipTier}</Text>
            <Text style={[styles.tableCell, { width: '12%' }]}>{row.status}</Text>
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
