import { Document, Page, Text, View, StyleSheet, pdf, Svg, Path, G, Circle } from '@react-pdf/renderer'
import { format } from 'date-fns'
import type { ImpactLogEntry } from '@/pages/impact/ImpactLogPage'
import type { ExportFilters } from '@/pages/impact/ImpactLogPage'

// ============================================
// PROFESSIONAL IMPACT REPORT PDF
// Design adapted from T4L-Ambassadors
// ============================================

// Color palette matching T4L-Ambassadors design
const COLORS = {
  primaryDark: '#271b48',
  primary: '#681fa5',
  gold: '#D4A017',
  white: '#FFFFFF',
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
  gray200: '#e2e8f0',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1e293b',
  // Verification colors
  tier1Red: '#dc2626',
  tier1Bg: '#fef2f2',
  tier2Blue: '#2563eb',
  tier2Bg: '#eff6ff',
  tier3Green: '#16a34a',
  tier3Bg: '#f0fdf4',
  // ESG colors
  envBlue: '#1d4ed8',
  envBg: '#eff6ff',
  socCyan: '#0891b2',
  socBg: '#ecfeff',
  govPurple: '#681fa5',
  govBg: '#faf5ff',
}

const styles = StyleSheet.create({
  // Page styles
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLORS.primaryDark,
    backgroundColor: COLORS.white,
  },

  // ============ COVER PAGE ============
  coverPage: {
    backgroundColor: COLORS.primaryDark,
    padding: 28,
    minHeight: '100%',
  },
  coverTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  coverBrand: {
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 3,
  },
  coverType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  coverBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  coverBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.primary,
    marginRight: 5,
  },
  coverBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  coverHeadline: {
    marginTop: 20,
  },
  coverTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
    lineHeight: 1.1,
  },
  coverTitleAccent: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    lineHeight: 1.1,
  },
  coverSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    maxWidth: 380,
    lineHeight: 1.5,
    marginTop: 8,
  },
  orgStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  orgAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgInitials: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  orgInfo: {
    marginLeft: 14,
    flex: 1,
  },
  orgName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  orgRole: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
  },
  orgMeta: {
    flexDirection: 'row',
    gap: 18,
  },
  orgMetaItem: {
    marginLeft: 12,
  },
  orgMetaLabel: {
    fontSize: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 2,
  },
  orgMetaValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.85)',
  },
  orgMetaValueGold: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.gold,
  },

  // ============ CONTENT PAGES ============
  contentPage: {
    padding: 32,
  },

  // Section styles
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.primary,
    backgroundColor: '#f5f3ff',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
    marginBottom: 12,
  },
  sectionIntro: {
    fontSize: 10,
    color: COLORS.gray500,
    maxWidth: 500,
    marginBottom: 14,
    lineHeight: 1.5,
  },

  // Narrative box
  narrative: {
    backgroundColor: '#f5f3ff',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    borderRadius: 4,
    padding: 12,
    marginBottom: 14,
  },
  narrativeText: {
    fontSize: 11,
    fontWeight: 'medium',
    color: COLORS.primaryDark,
    lineHeight: 1.55,
  },
  narrativeSub: {
    fontSize: 9,
    color: COLORS.gray500,
    marginTop: 4,
  },

  // Hero stats grid
  heroStats: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 14,
  },
  heroStat: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.gray200,
    backgroundColor: COLORS.white,
  },
  heroStatPrimary: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.gray200,
    backgroundColor: COLORS.primaryDark,
  },
  heroStatLast: {
    borderRightWidth: 0,
  },
  heroStatLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.gray500,
    marginBottom: 4,
    textAlign: 'center',
  },
  heroStatLabelLight: {
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
    textAlign: 'center',
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
    textAlign: 'center',
  },
  heroStatValueLight: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
    textAlign: 'center',
  },
  heroStatValuePurple: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
  },
  heroStatSub: {
    fontSize: 8,
    color: COLORS.gray400,
    marginTop: 2,
    textAlign: 'center',
  },
  heroStatSubLight: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    textAlign: 'center',
  },

  // Verification box
  verBox: {
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  verBoxTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.primary,
    marginBottom: 10,
  },
  verRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  verRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  verBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  verBadgeL1: {
    backgroundColor: COLORS.tier1Bg,
  },
  verBadgeL2: {
    backgroundColor: COLORS.tier2Bg,
  },
  verBadgeL3: {
    backgroundColor: COLORS.tier3Bg,
  },
  verBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  verInfo: {
    flex: 1,
  },
  verName: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 1,
  },
  verDesc: {
    fontSize: 9,
    color: COLORS.gray500,
  },
  verCount: {
    fontSize: 12,
    fontWeight: 'bold',
    minWidth: 30,
    textAlign: 'right',
  },

  // ESG Grid
  esgGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  esgCard: {
    flex: 1,
    borderRadius: 10,
    padding: 14,
    position: 'relative',
  },
  esgCardEnv: {
    backgroundColor: COLORS.envBg,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  esgCardSoc: {
    backgroundColor: COLORS.socBg,
    borderWidth: 1,
    borderColor: '#a5f3fc',
  },
  esgCardGov: {
    backgroundColor: COLORS.govBg,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  esgType: {
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  esgValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  esgCount: {
    fontSize: 9,
    opacity: 0.7,
  },

  // Dark header
  darkHeader: {
    backgroundColor: COLORS.primaryDark,
    padding: 18,
    marginHorizontal: -32,
    marginTop: -32,
    marginBottom: 16,
  },
  darkHeaderLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.gold,
    marginBottom: 4,
  },
  darkHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 6,
  },
  darkHeaderSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    maxWidth: 420,
  },

  // Summary grid for business
  bizSummaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  bizSummaryCard: {
    flex: 1,
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  bizSummaryCardHighlight: {
    flex: 1,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  bizSummaryLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.gray600,
    marginBottom: 4,
    textAlign: 'center',
  },
  bizSummaryLabelLight: {
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
    textAlign: 'center',
  },
  bizSummaryValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
    textAlign: 'center',
  },
  bizSummaryValueLight: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.white,
    textAlign: 'center',
  },
  bizSummarySub: {
    fontSize: 9,
    color: COLORS.gray500,
    marginTop: 2,
    textAlign: 'center',
  },
  bizSummarySubLight: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    textAlign: 'center',
  },

  // Pie chart container
  pieChartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    gap: 24,
  },
  pieLegend: {
    flexDirection: 'column',
    gap: 8,
  },
  pieLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pieLegendColor: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  pieLegendText: {
    fontSize: 9,
    color: COLORS.gray600,
  },
  pieLegendValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
    marginLeft: 'auto',
  },
  pieLegendPct: {
    fontSize: 8,
    color: COLORS.gray500,
    marginLeft: 4,
  },

  // Top outcomes
  topOutcome: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 8,
    marginBottom: 8,
  },
  outcomeRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outcomeRankText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  outcomeContent: {
    flex: 1,
  },
  outcomeTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
    marginBottom: 3,
  },
  outcomeStatement: {
    fontSize: 10,
    color: COLORS.gray600,
    fontStyle: 'italic',
    marginBottom: 6,
    lineHeight: 1.4,
  },
  outcomeMeta: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  outcomeValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  outcomeWaste: {
    fontSize: 8,
    fontWeight: 'bold',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 100,
    backgroundColor: '#f5f3ff',
    color: COLORS.primary,
  },

  // Verification pill
  verPill: {
    fontSize: 8,
    fontWeight: 'bold',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 100,
  },
  verPillL1: {
    backgroundColor: COLORS.tier1Bg,
    color: COLORS.tier1Red,
  },
  verPillL2: {
    backgroundColor: COLORS.tier2Bg,
    color: COLORS.tier2Blue,
  },
  verPillL3: {
    backgroundColor: COLORS.tier3Bg,
    color: COLORS.tier3Green,
  },

  // Activity table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primaryDark,
    padding: 10,
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: COLORS.white,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    padding: 10,
    backgroundColor: COLORS.white,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    padding: 10,
    backgroundColor: COLORS.gray50,
  },
  tableCell: {
    fontSize: 9,
    color: COLORS.gray600,
  },
  tableCellValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'right',
  },

  // Footer
  footer: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 10,
    padding: 16,
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerBrand: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 2,
  },
  footerTagline: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  footerMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  footerMetaItem: {
    alignItems: 'flex-end',
  },
  footerMetaLabel: {
    fontSize: 7,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 1,
  },
  footerMetaValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  footerMetaValueGold: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.gold,
  },

  // Integrity note
  integrity: {
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    borderRadius: 4,
    padding: 12,
    marginTop: 14,
  },
  integrityTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.primary,
    marginBottom: 6,
  },
  integrityText: {
    fontSize: 9,
    color: COLORS.gray600,
    lineHeight: 1.55,
  },

  // Page number footer
  pageFooter: {
    position: 'absolute',
    bottom: 20,
    left: 32,
    right: 32,
    textAlign: 'center',
    fontSize: 8,
    color: COLORS.gray500,
  },
})

// Pie chart colors
const PIE_COLORS = [COLORS.primary, COLORS.primaryDark, COLORS.gold, '#2563eb', '#16a34a', '#dc2626', '#0891b2', '#7c3aed']

// Generate SVG path for pie slice
const generatePieSlicePath = (
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string => {
  const startRad = (startAngle - 90) * (Math.PI / 180)
  const endRad = (endAngle - 90) * (Math.PI / 180)
  const x1 = centerX + radius * Math.cos(startRad)
  const y1 = centerY + radius * Math.sin(startRad)
  const x2 = centerX + radius * Math.cos(endRad)
  const y2 = centerY + radius * Math.sin(endRad)
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0
  return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`
}

interface PieChartData {
  label: string
  value: number
  color: string
}

// Simple Pie Chart
const PieChart = ({ data, size = 100 }: { data: PieChartData[]; size?: number }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return null

  const centerX = size / 2
  const centerY = size / 2
  const radius = size / 2 - 5

  let currentAngle = 0
  const slices = data.map((item, index) => {
    const sliceAngle = (item.value / total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + sliceAngle
    currentAngle = endAngle

    if (sliceAngle >= 359.99) {
      return <Circle key={index} cx={centerX} cy={centerY} r={radius} fill={item.color} />
    }
    return <Path key={index} d={generatePieSlicePath(centerX, centerY, radius, startAngle, endAngle)} fill={item.color} />
  })

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G>{slices}</G>
    </Svg>
  )
}

// Pie Legend
const PieLegend = ({ data }: { data: PieChartData[] }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  return (
    <View style={styles.pieLegend}>
      {data.map((item, index) => (
        <View key={index} style={styles.pieLegendItem}>
          <View style={[styles.pieLegendColor, { backgroundColor: item.color }]} />
          <Text style={styles.pieLegendText}>{item.label}</Text>
          <Text style={styles.pieLegendValue}>${item.value.toLocaleString()}</Text>
          <Text style={styles.pieLegendPct}>({total > 0 ? Math.round((item.value / total) * 100) : 0}%)</Text>
        </View>
      ))}
    </View>
  )
}

// Helper functions
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

const getVerLabel = (tier: string) => tier === 'tier_3' ? 'L3 · Externally Audited' : tier === 'tier_2' ? 'L2 · Manager Verified' : 'L1 · Self-Reported'
const getVerShort = (tier: string) => tier === 'tier_3' ? 'Audited' : tier === 'tier_2' ? 'Verified' : 'Self'
const fmtUsd = (n: number) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtNum = (n: number) => (n || 0).toLocaleString('en-US')

const getTopOutcomes = (entries: ImpactLogEntry[], limit: number) => {
  return entries
    .filter((e: any) => e.outcomeStatement && e.usdValue)
    .map((e: any) => ({
      title: e.title || 'Business Outcome',
      outcome: e.outcomeStatement,
      value: e.usdValue || 0,
      verification: e.verificationTier || 'tier_1',
      waste: e.wastePrimary,
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
  const orgInitials = orgName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'TL'

  const tier1 = (filteredEntries as any[]).filter((e) => (e.verificationTier || 'tier_1') === 'tier_1').length
  const tier2 = (filteredEntries as any[]).filter((e) => e.verificationTier === 'tier_2').length
  const tier3 = (filteredEntries as any[]).filter((e) => e.verificationTier === 'tier_3').length

  const environmental = esgEntries.filter((e: any) => e.esgCategory === 'environmental')
  const social = esgEntries.filter((e: any) => e.esgCategory === 'social')
  const governance = esgEntries.filter((e: any) => e.esgCategory === 'governance')

  const envValue = environmental.reduce((s, e) => s + (e.usdValue || 0), 0)
  const socValue = social.reduce((s, e) => s + (e.usdValue || 0), 0)
  const govValue = governance.reduce((s, e) => s + (e.usdValue || 0), 0)

  // Waste breakdown
  const wasteBreakdown: Record<string, number> = {}
  businessEntries.forEach((entry: any) => {
    const waste = entry.wastePrimary || entry.businessActivity || 'Unknown'
    wasteBreakdown[waste] = (wasteBreakdown[waste] || 0) + (entry.usdValue || 0)
  })

  const wasteChartData: PieChartData[] = Object.entries(wasteBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([waste, value], index) => ({
      label: getWasteLabel(waste),
      value: Number(value),
      color: PIE_COLORS[index % PIE_COLORS.length],
    }))

  const topOutcomes = getTopOutcomes(businessEntries, 5)
  const reportPeriod = format(filters.dateRange.start, 'MMMM yyyy')
  const generatedDate = format(new Date(), 'MMMM d, yyyy')
  const reportId = `T4L-${orgInitials}-${format(new Date(), 'yyyyMM')}-001`

  const doc = (
    <Document>
      {/* ============ COVER PAGE ============ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverPage}>
          <View style={styles.coverTop}>
            <View>
              <Text style={styles.coverBrand}>Transformation Leader</Text>
              <Text style={styles.coverType}>Impact Report</Text>
            </View>
            <View style={styles.coverBadge}>
              <View style={styles.coverBadgeDot} />
              <Text style={styles.coverBadgeText}>Board-Ready Report</Text>
            </View>
          </View>

          <View style={styles.coverHeadline}>
            <Text style={styles.coverTitle}>Business & ESG</Text>
            <Text style={styles.coverTitleAccent}>Impact Report</Text>
            <Text style={styles.coverSub}>
              A comprehensive record of operational business outcomes and ESG social impact — structured for board reporting, ESG disclosures, and stakeholder communication.
            </Text>
          </View>

          <View style={styles.orgStrip}>
            <View style={styles.orgAvatar}>
              <Text style={styles.orgInitials}>{orgInitials}</Text>
            </View>
            <View style={styles.orgInfo}>
              <Text style={styles.orgName}>{orgName}</Text>
              <Text style={styles.orgRole}>T4L Platform User</Text>
            </View>
            <View style={styles.orgMeta}>
              <View style={styles.orgMetaItem}>
                <Text style={styles.orgMetaLabel}>Report Period</Text>
                <Text style={styles.orgMetaValue}>{reportPeriod}</Text>
              </View>
              <View style={styles.orgMetaItem}>
                <Text style={styles.orgMetaLabel}>Generated</Text>
                <Text style={styles.orgMetaValue}>{generatedDate}</Text>
              </View>
              <View style={styles.orgMetaItem}>
                <Text style={styles.orgMetaLabel}>Report ID</Text>
                <Text style={styles.orgMetaValueGold}>{reportId}</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>

      {/* ============ EXECUTIVE SUMMARY PAGE ============ */}
      <Page size="A4" style={[styles.page, styles.contentPage]}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Executive Summary</Text>
          <Text style={styles.sectionTitle}>Period at a Glance</Text>

          <View style={styles.narrative}>
            <Text style={styles.narrativeText}>
              In {reportPeriod}, {orgName} delivered {fmtUsd(totalCombined)} in total impact value — comprising {fmtUsd(totalBusinessValue)} in verified business outcomes and {fmtUsd(totalEsgValue)} in ESG social value across {filteredEntries.length} logged activities.
            </Text>
            <Text style={styles.narrativeSub}>
              {tier3} externally audited (Level 3) · {tier2} manager verified (Level 2) · {tier1} self-reported (Level 1).
            </Text>
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStatPrimary}>
              <Text style={styles.heroStatLabelLight}>Total Impact Value</Text>
              <Text style={styles.heroStatValueLight}>{fmtUsd(totalCombined)}</Text>
              <Text style={styles.heroStatSubLight}>Business + ESG</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Business Outcomes</Text>
              <Text style={styles.heroStatValuePurple}>{fmtUsd(totalBusinessValue)}</Text>
              <Text style={styles.heroStatSub}>Operational savings</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>ESG Social Value</Text>
              <Text style={styles.heroStatValue}>{fmtUsd(totalEsgValue)}</Text>
              <Text style={styles.heroStatSub}>Benchmark-rated</Text>
            </View>
            <View style={[styles.heroStat, styles.heroStatLast]}>
              <Text style={styles.heroStatLabel}>People Reached</Text>
              <Text style={styles.heroStatValue}>{fmtNum(totalPeople)}</Text>
              <Text style={styles.heroStatSub}>{fmtNum(totalHours)} hours</Text>
            </View>
          </View>

          <View style={styles.verBox}>
            <Text style={styles.verBoxTitle}>Verification Framework</Text>
            <View style={styles.verRow}>
              <View style={[styles.verBadge, styles.verBadgeL1]}>
                <Text style={[styles.verBadgeText, { color: COLORS.tier1Red }]}>L1</Text>
              </View>
              <View style={styles.verInfo}>
                <Text style={styles.verName}>Self-Reported</Text>
                <Text style={styles.verDesc}>Logged via T4L Platform. Suitable for internal monitoring.</Text>
              </View>
              <Text style={[styles.verCount, { color: COLORS.tier1Red }]}>{tier1}</Text>
            </View>
            <View style={styles.verRow}>
              <View style={[styles.verBadge, styles.verBadgeL2]}>
                <Text style={[styles.verBadgeText, { color: COLORS.tier2Blue }]}>L2</Text>
              </View>
              <View style={styles.verInfo}>
                <Text style={styles.verName}>Manager Verified</Text>
                <Text style={styles.verDesc}>Verified by internal manager or finance contact.</Text>
              </View>
              <Text style={[styles.verCount, { color: COLORS.tier2Blue }]}>{tier2}</Text>
            </View>
            <View style={[styles.verRow, styles.verRowLast]}>
              <View style={[styles.verBadge, styles.verBadgeL3]}>
                <Text style={[styles.verBadgeText, { color: COLORS.tier3Green }]}>L3</Text>
              </View>
              <View style={styles.verInfo}>
                <Text style={styles.verName}>Externally Audited</Text>
                <Text style={styles.verDesc}>Independent third-party verification. Required for ESG disclosures.</Text>
              </View>
              <Text style={[styles.verCount, { color: COLORS.tier3Green }]}>{tier3}</Text>
            </View>
          </View>

          {/* ESG Breakdown Grid */}
          {esgEntries.length > 0 && (
            <View style={styles.esgGrid}>
              <View style={[styles.esgCard, styles.esgCardEnv]}>
                <Text style={[styles.esgType, { color: COLORS.envBlue }]}>Environmental</Text>
                <Text style={[styles.esgValue, { color: COLORS.envBlue }]}>{fmtUsd(envValue)}</Text>
                <Text style={[styles.esgCount, { color: COLORS.envBlue }]}>{environmental.length} activities</Text>
              </View>
              <View style={[styles.esgCard, styles.esgCardSoc]}>
                <Text style={[styles.esgType, { color: COLORS.socCyan }]}>Social</Text>
                <Text style={[styles.esgValue, { color: COLORS.socCyan }]}>{fmtUsd(socValue)}</Text>
                <Text style={[styles.esgCount, { color: COLORS.socCyan }]}>{social.length} activities</Text>
              </View>
              <View style={[styles.esgCard, styles.esgCardGov]}>
                <Text style={[styles.esgType, { color: COLORS.govPurple }]}>Governance</Text>
                <Text style={[styles.esgValue, { color: COLORS.govPurple }]}>{fmtUsd(govValue)}</Text>
                <Text style={[styles.esgCount, { color: COLORS.govPurple }]}>{governance.length} activities</Text>
              </View>
            </View>
          )}
        </View>

        <Text style={styles.pageFooter} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages} · ${orgName} · Generated from Tier Platform`} fixed />
      </Page>

      {/* ============ BUSINESS OUTCOMES PAGE ============ */}
      {businessEntries.length > 0 && (
        <Page size="A4" style={[styles.page, styles.contentPage]}>
          <View style={styles.darkHeader}>
            <Text style={styles.darkHeaderLabel}>Business Outcomes</Text>
            <Text style={styles.darkHeaderTitle}>8 Wastes Elimination · Operational Value Created</Text>
            <Text style={styles.darkHeaderSub}>Verified operational savings and revenue outcomes — {reportPeriod}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.bizSummaryGrid}>
              <View style={styles.bizSummaryCardHighlight}>
                <Text style={styles.bizSummaryLabelLight}>Total Operational Savings</Text>
                <Text style={styles.bizSummaryValueLight}>{fmtUsd(totalBusinessValue)}</Text>
                <Text style={styles.bizSummarySubLight}>Verified value created</Text>
              </View>
              <View style={styles.bizSummaryCard}>
                <Text style={styles.bizSummaryLabel}>Number of Improvements</Text>
                <Text style={styles.bizSummaryValue}>{businessEntries.length}</Text>
                <Text style={styles.bizSummarySub}>Logged outcomes</Text>
              </View>
              <View style={styles.bizSummaryCard}>
                <Text style={styles.bizSummaryLabel}>Average per Outcome</Text>
                <Text style={styles.bizSummaryValue}>{businessEntries.length > 0 ? fmtUsd(totalBusinessValue / businessEntries.length) : '$0'}</Text>
                <Text style={styles.bizSummarySub}>Mean savings value</Text>
              </View>
            </View>

            {wasteChartData.length > 0 && (
              <View style={styles.pieChartContainer}>
                <PieChart data={wasteChartData} size={100} />
                <PieLegend data={wasteChartData} />
              </View>
            )}

            {topOutcomes.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 16, marginBottom: 12 }]}>Top Business Outcomes</Text>
                {topOutcomes.map((outcome, idx) => (
                  <View key={idx} style={styles.topOutcome} wrap={false}>
                    <View style={styles.outcomeRank}>
                      <Text style={styles.outcomeRankText}>#{idx + 1}</Text>
                    </View>
                    <View style={styles.outcomeContent}>
                      <Text style={styles.outcomeTitle}>{outcome.title}</Text>
                      <Text style={styles.outcomeStatement}>"{outcome.outcome}"</Text>
                      <View style={styles.outcomeMeta}>
                        <Text style={styles.outcomeValue}>{fmtUsd(outcome.value)}</Text>
                        <Text style={[styles.verPill, outcome.verification === 'tier_3' ? styles.verPillL3 : outcome.verification === 'tier_2' ? styles.verPillL2 : styles.verPillL1]}>
                          {getVerLabel(outcome.verification)}
                        </Text>
                        {outcome.waste && <Text style={styles.outcomeWaste}>{getWasteLabel(outcome.waste)}</Text>}
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>

          <Text style={styles.pageFooter} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages} · ${orgName} · Generated from Tier Platform`} fixed />
        </Page>
      )}

      {/* ============ ACTIVITY DETAIL PAGE ============ */}
      <Page size="A4" style={[styles.page, styles.contentPage]} wrap>
        <Text style={styles.sectionLabel}>Activity Detail</Text>
        <Text style={styles.sectionTitle}>All Logged Activities ({filteredEntries.length})</Text>

        {esgEntries.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 12, marginBottom: 8 }]}>ESG Impact Activities ({esgEntries.length})</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: '25%' }]}>Activity</Text>
              <Text style={[styles.tableHeaderText, { width: '15%' }]}>Category</Text>
              <Text style={[styles.tableHeaderText, { width: '12%' }]}>Date</Text>
              <Text style={[styles.tableHeaderText, { width: '10%' }]}>Hours</Text>
              <Text style={[styles.tableHeaderText, { width: '12%' }]}>People</Text>
              <Text style={[styles.tableHeaderText, { width: '13%', textAlign: 'right' }]}>Value</Text>
              <Text style={[styles.tableHeaderText, { width: '13%', textAlign: 'right' }]}>Tier</Text>
            </View>
            {esgEntries.map((entry, index) => (
              <View key={entry.id || index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt} wrap={false}>
                <Text style={[styles.tableCell, { width: '25%' }]}>{(entry.title || 'Untitled').slice(0, 35)}{(entry.title || '').length > 35 ? '...' : ''}</Text>
                <Text style={[styles.tableCell, { width: '15%', textTransform: 'capitalize' }]}>{(entry as any).esgCategory || 'N/A'}</Text>
                <Text style={[styles.tableCell, { width: '12%' }]}>{entry.date ? format(new Date(entry.date), 'MMM d') : 'N/A'}</Text>
                <Text style={[styles.tableCell, { width: '10%' }]}>{entry.hours || 0}</Text>
                <Text style={[styles.tableCell, { width: '12%' }]}>{(entry.peopleImpacted || 0).toLocaleString()}</Text>
                <Text style={[styles.tableCellValue, { width: '13%' }]}>{fmtUsd(entry.usdValue || 0)}</Text>
                <Text style={[styles.tableCell, { width: '13%', textAlign: 'right' }]}>{(entry as any).verificationTier === 'tier_3' ? 'T3' : (entry as any).verificationTier === 'tier_2' ? 'T2' : 'T1'}</Text>
              </View>
            ))}
          </>
        )}

        {businessEntries.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 16, marginBottom: 8 }]}>Business Outcomes ({businessEntries.length})</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: '30%' }]}>Outcome</Text>
              <Text style={[styles.tableHeaderText, { width: '18%' }]}>Waste Type</Text>
              <Text style={[styles.tableHeaderText, { width: '12%' }]}>Date</Text>
              <Text style={[styles.tableHeaderText, { width: '12%' }]}>Hours</Text>
              <Text style={[styles.tableHeaderText, { width: '15%', textAlign: 'right' }]}>Value</Text>
              <Text style={[styles.tableHeaderText, { width: '13%', textAlign: 'right' }]}>Tier</Text>
            </View>
            {businessEntries.map((entry, index) => (
              <View key={entry.id || index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt} wrap={false}>
                <Text style={[styles.tableCell, { width: '30%' }]}>{((entry as any).outcomeStatement || entry.title || 'Untitled').slice(0, 40)}...</Text>
                <Text style={[styles.tableCell, { width: '18%' }]}>{getWasteLabel((entry as any).wastePrimary || 'N/A')}</Text>
                <Text style={[styles.tableCell, { width: '12%' }]}>{entry.date ? format(new Date(entry.date), 'MMM d') : 'N/A'}</Text>
                <Text style={[styles.tableCell, { width: '12%' }]}>{entry.hours || 0}</Text>
                <Text style={[styles.tableCellValue, { width: '15%' }]}>{fmtUsd(entry.usdValue || 0)}</Text>
                <Text style={[styles.tableCell, { width: '13%', textAlign: 'right' }]}>{getVerShort((entry as any).verificationTier)}</Text>
              </View>
            ))}
          </>
        )}

        <View style={styles.integrity}>
          <Text style={styles.integrityTitle}>Methodology & Assurance Notes</Text>
          <Text style={styles.integrityText}>
            USD social value figures are calculated using published benchmark rates. Impact-based values use sector-specific cost proxies (e.g. training costs from ATD, social cost of carbon from US EPA). Business Outcome values represent actual operational savings verified by managers or external auditors. Framework aligns with SASB and IFRS ISSB standards.
          </Text>
        </View>

        <View style={styles.footer}>
          <View>
            <Text style={styles.footerBrand}>Transformation Leader</Text>
            <Text style={styles.footerTagline}>Powered by Tier Platform</Text>
          </View>
          <View style={styles.footerMeta}>
            <View style={styles.footerMetaItem}>
              <Text style={styles.footerMetaLabel}>Total Value</Text>
              <Text style={styles.footerMetaValue}>{fmtUsd(totalCombined)}</Text>
            </View>
            <View style={styles.footerMetaItem}>
              <Text style={styles.footerMetaLabel}>Report ID</Text>
              <Text style={styles.footerMetaValueGold}>{reportId}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.pageFooter} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages} · ${orgName} · Generated from Tier Platform`} fixed />
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
