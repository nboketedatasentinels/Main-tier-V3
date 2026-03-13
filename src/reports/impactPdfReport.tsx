import React from 'react'
import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer'
import { format } from 'date-fns'
import type { ImpactLogEntry } from '@/pages/impact/ImpactLogPage'
import type { ExportFilters } from '@/pages/impact/ImpactLogPage'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  coverPage: { padding: 40, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoSmall: {
    width: 60,
    height: 24,
    objectFit: 'contain',
  },
  logoCover: {
    width: 120,
    height: 48,
    objectFit: 'contain',
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#3B0F7A',
  },
  headerSubtitle: {
    fontSize: 8,
    color: '#777',
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#3B0F7A', marginBottom: 12 },
  subtitle: { fontSize: 14, color: '#555', marginBottom: 4 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: '#F3F0FF',
    padding: 6,
    marginTop: 20,
    marginBottom: 8,
    borderRadius: 4,
  },
  summaryBox: {
    backgroundColor: '#FAFAFF',
    padding: 10,
    marginBottom: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E0FF',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  label: { fontSize: 10, color: '#555' },
  value: { fontSize: 10, fontWeight: 'bold' },
  methodologyNote: { fontSize: 8, color: '#555', marginTop: 16, lineHeight: 1.4 },
  footer: {
    fontSize: 8,
    color: '#999',
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: 'center',
  },
})

const getWasteLabel = (wasteCode: string): string => {
  const wasteMap: Record<string, string> = {
    DEF: 'Defects',
    OVR: 'Overproduction',
    WAI: 'Waiting',
    NUT: 'Non-utilised Talent',
    TRA: 'Transportation',
    INV: 'Inventory',
    MOT: 'Motion',
    EXP: 'Extra Processing',
  }
  return wasteMap[wasteCode] || wasteCode
}

const getTopActivities = (entries: ImpactLogEntry[], limit: number) => {
  return entries
    .filter((e) => e.title && e.usdValue)
    .map((e) => ({ title: e.title, value: e.usdValue || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

const getTopOutcomes = (entries: ImpactLogEntry[], limit: number) => {
  return entries
    .filter((e: any) => e.outcomeStatement && e.usdValue)
    .map((e: any) => ({
      outcome: e.outcomeStatement,
      value: e.usdValue || 0,
      verification:
        e.verificationTier === 'tier_1'
          ? 'Self-Reported'
          : e.verificationTier === 'tier_2'
          ? 'Partner/Manager Verified'
          : 'Externally Audited',
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

export const generateImpactPdfReport = async (
  entries: ImpactLogEntry[],
  filters: ExportFilters,
  user: any,
  profile: any,
  applyFilters: (entries: ImpactLogEntry[], filters: ExportFilters) => ImpactLogEntry[],
) => {
  const filteredEntries = applyFilters(entries, filters)
  if (!filteredEntries.length) {
    throw new Error('No entries to include in report for selected filters.')
  }

  const esgEntries = filteredEntries.filter((e) => e.categoryGroup === 'esg')
  const businessEntries = filteredEntries.filter((e) => e.categoryGroup === 'business')

  const totalPeople = esgEntries.reduce((sum, e) => sum + (e.peopleImpacted || 0), 0)
  const totalHours = filteredEntries.reduce((sum, e) => sum + (e.hours || 0), 0)
  const totalEsgValue = esgEntries.reduce((sum, e) => sum + (e.usdValue || 0), 0)
  const totalBusinessValue = businessEntries.reduce((sum, e) => sum + (e.usdValue || 0), 0)
  const totalCombined = totalEsgValue + totalBusinessValue

  const orgName = profile?.companyName || user?.displayName || 'Individual'
  // Logo resolution: prefer profile-level logo, then user avatar, then static public asset
  const DEFAULT_LOGO_SRC = '/company-logo.png'
  const logoSrc =
    profile?.companyLogoUrl ||
    profile?.logoUrl ||
    user?.photoURL ||
    DEFAULT_LOGO_SRC

  const tier1 = (filteredEntries as any[]).filter((e) => e.verificationTier === 'tier_1').length
  const tier2 = (filteredEntries as any[]).filter((e) => e.verificationTier === 'tier_2').length
  const tier3 = (filteredEntries as any[]).filter((e) => e.verificationTier === 'tier_3').length
  const total = filteredEntries.length || 1

  const environmental = esgEntries.filter((e: any) => e.esgCategory === 'environmental')
  const social = esgEntries.filter((e: any) => e.esgCategory === 'social')
  const governance = esgEntries.filter((e: any) => e.esgCategory === 'governance')

  const wasteBreakdown: Record<string, number> = {}
  businessEntries.forEach((entry: any) => {
    const waste = entry.wastePrimary || entry.businessActivity || 'Unknown'
    wasteBreakdown[waste] = (wasteBreakdown[waste] || 0) + (entry.usdValue || 0)
  })

  const topActivities = getTopActivities(esgEntries, 5)
  const topOutcomes = getTopOutcomes(businessEntries, 5)

  const doc = (
    <Document>
      <Page size="A4" style={styles.coverPage}>
        {logoSrc && (
          <View style={{ position: 'absolute', top: 40, left: 40 }}>
            <Image src={logoSrc} style={styles.logoCover} />
          </View>
        )}
        <Text style={styles.title}>Impact Report</Text>
        <Text style={styles.subtitle}>{orgName}</Text>
        <Text style={styles.subtitle}>
          {format(filters.dateRange.start, 'MMMM yyyy')} - {format(filters.dateRange.end, 'MMMM yyyy')}
        </Text>
        <Text style={{ marginTop: 24, fontSize: 11, color: '#999' }}>
          Generated on {format(new Date(), 'MMMM d, yyyy')}
        </Text>
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages} • ${orgName} • Generated from Tier Platform`
          }
          fixed
        />
      </Page>

      <Page size="A4" style={styles.page}>
        {logoSrc && (
          <View style={styles.header}>
            <Image src={logoSrc} style={styles.logoSmall} />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.headerTitle}>Impact Report</Text>
              <Text style={styles.headerSubtitle}>{orgName}</Text>
            </View>
          </View>
        )}
        <Text style={styles.sectionTitle}>Executive Summary</Text>
        <View style={styles.summaryBox}>
          <View style={styles.row}>
            <Text style={styles.label}>Total People Impacted:</Text>
            <Text style={styles.value}>{totalPeople.toLocaleString()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total Hours Contributed:</Text>
            <Text style={styles.value}>{totalHours.toLocaleString()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>ESG Social Value (estimated):</Text>
            <Text style={styles.value}>${totalEsgValue.toLocaleString()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Business Outcomes (verified savings):</Text>
            <Text style={styles.value}>${totalBusinessValue.toLocaleString()}</Text>
          </View>
          <View
            style={[
              styles.row,
              { marginTop: 8, borderTopWidth: 1, borderTopColor: '#CCC', paddingTop: 6 },
            ]}
          >
            <Text style={[styles.label, { fontWeight: 'bold' }]}>Total Combined Impact Value:</Text>
            <Text style={[styles.value, { fontSize: 12, color: '#3B0F7A' }]}>
              ${totalCombined.toLocaleString()}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Verification Summary</Text>
        <View style={styles.summaryBox}>
          <View style={styles.row}>
            <Text style={styles.label}>Tier 1 (Self-Reported):</Text>
            <Text style={styles.value}>
              {tier1} ({Math.round((tier1 / total) * 100)}%)
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tier 2 (Partner/Manager Verified):</Text>
            <Text style={styles.value}>
              {tier2} ({Math.round((tier2 / total) * 100)}%)
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tier 3 (Externally Audited):</Text>
            <Text style={styles.value}>
              {tier3} ({Math.round((tier3 / total) * 100)}%)
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>ESG Impact Breakdown</Text>
        <View style={styles.summaryBox}>
          <View style={styles.row}>
            <Text style={styles.label}>Environmental:</Text>
            <Text style={styles.value}>
              {environmental.length} activities | $
              {environmental.reduce((s, e) => s + (e.usdValue || 0), 0).toLocaleString()}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Social:</Text>
            <Text style={styles.value}>
              {social.length} activities | ${social.reduce((s, e) => s + (e.usdValue || 0), 0).toLocaleString()}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Governance:</Text>
            <Text style={styles.value}>
              {governance.length} activities | $
              {governance.reduce((s, e) => s + (e.usdValue || 0), 0).toLocaleString()}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Top ESG Activities by Impact</Text>
        <View style={styles.summaryBox}>
          {topActivities.length === 0 ? (
            <Text style={styles.label}>No ESG activities in this period.</Text>
          ) : (
            topActivities.map((activity, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.label}>
                  {i + 1}. {activity.title}
                </Text>
                <Text style={styles.value}>${activity.value.toLocaleString()}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Business Outcomes Breakdown</Text>
        <View style={styles.summaryBox}>
          <View style={styles.row}>
            <Text style={styles.label}>Total Operational Savings:</Text>
            <Text style={styles.value}>${totalBusinessValue.toLocaleString()}</Text>
          </View>
          <Text style={{ fontSize: 10, fontWeight: 'bold', marginTop: 6, marginBottom: 4 }}>
            By Waste Category:
          </Text>
          {Object.keys(wasteBreakdown).length === 0 ? (
            <Text style={styles.label}>No business outcome entries in this period.</Text>
          ) : (
            Object.entries(wasteBreakdown).map(([waste, value]) => (
              <View key={waste} style={styles.row}>
                <Text style={styles.label}>{getWasteLabel(waste)}:</Text>
                <Text style={styles.value}>${Number(value).toLocaleString()}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Top Business Outcomes</Text>
        <View style={styles.summaryBox}>
          {topOutcomes.length === 0 ? (
            <Text style={styles.label}>No business outcome entries in this period.</Text>
          ) : (
            topOutcomes.map((outcome, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                <View style={styles.row}>
                  <Text style={[styles.label, { flex: 1 }]}>
                    {i + 1}. {outcome.outcome}
                  </Text>
                  <Text style={styles.value}>${outcome.value.toLocaleString()}</Text>
                </View>
                <Text style={{ fontSize: 8, color: '#777', marginLeft: 14 }}>
                  Verification: {outcome.verification}
                </Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Total Impact Value</Text>
        <View style={[styles.summaryBox, { backgroundColor: '#EEF9F7', borderColor: '#B6E2DA' }]}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#2A9D8F', marginBottom: 4 }}>
            Total impact value: ${totalCombined.toLocaleString()}
          </Text>
          <Text style={{ fontSize: 9 }}>
            (of which ${totalEsgValue.toLocaleString()} is estimated social value and $
            {totalBusinessValue.toLocaleString()} is verified operational savings)
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Methodology & Assurance Notes</Text>
        <Text style={styles.methodologyNote}>
          Methodology Note: USD Social Value Calculation{'\n\n'}
          USD social value figures in this report are calculated using published benchmark rates applied to verified
          impact quantities. Impact-based values use sector-specific cost proxies (e.g. training cost per participant
          from ATD, social cost of carbon from US EPA IWG, tree planting costs from One Tree Planted). Volunteer time is
          valued at the Independent Sector&apos;s nationally recognised rate ($33.49/hour, 2024).{'\n\n'}
          All rates are reviewed annually and stored at the time of entry for audit purposes. These figures represent
          estimated social value created or costs avoided. They do not represent cash transactions, revenue, or audited
          financial outcomes. Verification tiers indicate the level of external validation applied to the underlying
          activity data.{'\n\n'}
          Business Outcome values are entered directly by users and represent actual operational savings or revenue
          created. Where a manager or finance contact has verified the figure, this is noted in the verification
          status.{'\n\n'}
          Framework Alignment & Assurance: This report maps to SASB (Sustainability Accounting Standards Board) topics
          and IFRS ISSB standards. Figures are designed for use in board reporting, ESG disclosures, and funder
          updates, but should be read alongside management commentary and underlying data where material decisions are
          being made.
        </Text>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages} • ${orgName} • Transformation Leader | Generated from Tier Platform`
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
  link.download = `impact-report-${format(new Date(), 'yyyy-MM')}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}

