/**
 * Impact Log v3: learner experience (hero, 3 entry types, claim wizard).
 * Uses Chakra + existing impact_logs service. Points stay on the journey dashboard.
 */
import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Checkbox,
  Collapse,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Progress,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Textarea,
  Tooltip,
  useToast,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import { Info, Plus } from 'lucide-react'
import { format, addWeeks, parseISO, isValid } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { ESGCategory } from '@/types'
import {
  CLAIM_JOURNEY_STEPS,
  DEFAULT_IMPACT_RATES,
  IMPACT_ACTIVITY_TYPES,
  IMPACT_CATS,
  IMPACT_ESG_PILLARS,
  IMPACT_EVIDENCE_TYPES,
  IMPACT_GROWTH,
  IMPACT_LIFT_PILLARS,
  IMPACT_METRIC_FAMILIES,
  IMPACT_REASONS,
  IMPACT_RECURRENCE,
  IMPACT_SOURCES,
  IMPACT_WASTES,
  bandNeedsFinance,
  formatMoney,
  gradeFromBaseline,
  valuation,
  type ImpactCatKey,
  type ImpactClaimInputs,
  type ImpactEntryKind,
  type ImpactFamilyKey,
  type ImpactGrowthKey,
  type ImpactRateCard,
  type ImpactWasteKey,
} from '@/config/impactValueEngine'
import type { ImpactHelpKey } from '@/config/impactHelp'
import { computeEsgUsdValue, resolveEsgRate, VOLUNTEER_HOURLY_RATE } from '@/config/esgImpactRates'
import {
  createImpactLog,
  listCompanyImpactLogs,
  listMyImpactLogs,
  type ImpactLogRecord,
} from '@/services/impactLogService'
import { listImpactValueRates, getShowRatesToLearners } from '@/services/impactRatesService'
import { removeUndefinedFields } from '@/utils/firestore'
import { ImpactHelpButton, ImpactHelpModal } from '@/components/impact/ImpactHelpModal'
import { ImpactClaimDrawer } from '@/components/impact/ImpactClaimDrawer'
import { ImpactValueDashboard } from '@/components/impact/ImpactValueDashboard'
import { ImpactWastePanel } from '@/components/impact/ImpactWastePanel'
import { ImpactRegisterPanel } from '@/components/impact/ImpactRegisterPanel'
import { ImpactRatesAdmin } from '@/components/impact/ImpactRatesAdmin'
import { ImpactRatesViewer } from '@/components/impact/ImpactRatesViewer'
import { ImpactExportPanel } from '@/components/impact/ImpactExportPanel'
import { requestClaimConfirmations } from '@/services/impactClaimConfirmationService'

type ViewTab = 'log' | 'dash' | 'waste' | 'register' | 'claims' | 'export'

type ClaimDraft = {
  step: number
  pillar: string
  activity: string
  cat: ImpactCatKey
  waste: ImpactWasteKey
  growth: ImpactGrowthKey
  measure: string
  family: ImpactFamilyKey
  unit: string
  formula: string
  source: string
  scopeType: string
  scopeValue: string
  months: number
  /** What the baseline measures: hours, dollars, or people. */
  baselineType: 'hours' | 'dollars' | 'people'
  obs: number
  base: string
  lockedBefore: boolean
  locked: boolean
  bRef: string
  direction: 'Decrease' | 'Increase'
  target: string
  targetDate: string
  intervention: string
  intStart: string
  wStart: string
  wEnd: string
  windowP: number
  post: string
  occ: number
  sustained: boolean
  evidence: string
  evidenceRef: string
  rateId: string
  attribution: number
  attrReason: string
  realization: number
  implCost: number
  recurrence: string
  ownerV: string
  ownerEmail: string
  financeV: string
  financeEmail: string
  attest: boolean
}

const blankClaim = (): ClaimDraft => ({
  step: 1,
  pillar: IMPACT_LIFT_PILLARS[3],
  activity: 'Automation',
  cat: 'eff',
  waste: 'waiting',
  growth: 'acquire',
  measure: 'Waiting',
  family: 'time',
  unit: 'hours',
  formula: '',
  source: 'SAP ERP',
  scopeType: 'Process',
  scopeValue: '',
  months: 12,
  baselineType: 'hours',
  obs: 12,
  base: '',
  lockedBefore: true,
  locked: false,
  bRef: '',
  direction: 'Increase',
  target: '',
  targetDate: minTargetDateIso(),
  intervention: '',
  intStart: format(new Date(), 'yyyy-MM-dd'),
  wStart: format(new Date(), 'yyyy-MM-dd'),
  wEnd: format(new Date(), 'yyyy-MM-dd'),
  windowP: 3,
  post: '',
  occ: 1,
  sustained: true,
  evidence: IMPACT_EVIDENCE_TYPES[0],
  evidenceRef: '',
  rateId: 'R2',
  attribution: 100,
  attrReason: IMPACT_REASONS[0],
  realization: 0.5,
  implCost: 0,
  recurrence: IMPACT_RECURRENCE[0],
  ownerV: '',
  ownerEmail: '',
  financeV: '',
  financeEmail: '',
  attest: false,
})

/** Map claim category → default metric family / unit. */
function familyForCat(cat: ImpactCatKey): { family: ImpactFamilyKey; unit: string } {
  if (cat === 'rev') return { family: 'revenue', unit: 'USD' }
  if (cat === 'cost') return { family: 'cost', unit: 'USD' }
  return { family: 'time', unit: 'hours' }
}

function applyBaselineType(
  type: ClaimDraft['baselineType'],
  cat: ImpactCatKey,
): Pick<ClaimDraft, 'baselineType' | 'family' | 'unit'> {
  if (type === 'hours') return { baselineType: type, family: 'time', unit: 'hours' }
  if (type === 'people') return { baselineType: type, family: 'volume', unit: 'people' }
  if (cat === 'rev') return { baselineType: type, family: 'revenue', unit: 'USD' }
  return { baselineType: type, family: 'cost', unit: 'USD' }
}

function minTargetDateIso(): string {
  return format(addWeeks(new Date(), 6), 'yyyy-MM-dd')
}

function unitLabel(unit: string, baselineType: ClaimDraft['baselineType']): string {
  if (baselineType === 'people' || unit === 'people') return 'people'
  if (baselineType === 'dollars' || unit === 'USD' || unit === 'BWP' || unit === 'GHS' || unit === 'KES')
    return unit === 'USD' ? 'dollars (USD)' : unit
  if (baselineType === 'hours' || unit === 'hours' || unit === 'days' || unit === 'minutes') return unit
  return unit
}

function applyCategoryPick(
  d: ClaimDraft,
  patch: Partial<Pick<ClaimDraft, 'cat' | 'waste' | 'growth'>>,
): ClaimDraft {
  const cat = patch.cat ?? d.cat
  const waste = patch.waste ?? d.waste
  const growth = patch.growth ?? d.growth
  const label =
    cat === 'rev'
      ? IMPACT_GROWTH.find((g) => g.k === growth)?.n || ''
      : IMPACT_WASTES.find((w) => w.k === waste)?.n || ''
  const fam = familyForCat(cat)
  const measure =
    !d.measure.trim() ||
    IMPACT_WASTES.some((w) => w.n === d.measure) ||
    IMPACT_GROWTH.some((g) => g.n === d.measure)
      ? label
      : d.measure
  return {
    ...d,
    ...patch,
    cat,
    waste,
    growth,
    measure,
    family: fam.family,
    unit: fam.unit,
    baselineType: fam.family === 'time' ? 'hours' : fam.family === 'revenue' || fam.family === 'cost' ? 'dollars' : d.baselineType,
  }
}

const CLAIM_STEPS = ['Category', 'Measure', 'Baseline', 'Target', 'Result', 'Value', 'Verify']

function toClaimInputs(d: ClaimDraft): ImpactClaimInputs {
  return {
    family: d.family,
    unit: d.unit,
    base: Number(d.base) || 0,
    post: Number(d.post) || 0,
    occ: Number(d.occ) || 1,
    rateId: d.rateId,
    attribution: Number(d.attribution) || 100,
    realization: Number(d.realization) || 1,
    implCost: Number(d.implCost) || 0,
    months: Number(d.months) || 0,
    obs: Number(d.obs) || Number(d.months) || 0,
    lockedBefore: d.lockedBefore,
    source: d.source,
    evidence: d.evidenceRef ? d.evidence : '',
    owner: d.ownerV,
    finance: d.financeV,
    windowP: Number(d.windowP) || 0,
    recurrence: d.recurrence,
    sustain90: d.sustained ? 'Holding' : 'Not yet due',
  }
}

function entryKindOf(e: ImpactLogRecord): ImpactEntryKind {
  if (e.entryKind) return e.entryKind
  if (e.categoryGroup === 'esg') return 'esg'
  return 'claim'
}

function isValidatedClaim(e: ImpactLogRecord): boolean {
  if (entryKindOf(e) !== 'claim') return false
  const status = e.claimStatus || e.verificationStatus
  if (status === 'Recognized' || status === 'approved') return true
  const tier = Number(e.claim?.tier ?? 0)
  return tier === 3 && (e.verificationStatus === 'approved' || e.claimStatus === 'Recognized')
}

export const ImpactLogV2: React.FC = () => {
  const { user, profile, isAdmin } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<ViewTab>('log')
  const [entries, setEntries] = useState<ImpactLogRecord[]>([])
  const [orgEntries, setOrgEntries] = useState<ImpactLogRecord[]>([])
  const [rates, setRates] = useState<ImpactRateCard[]>(DEFAULT_IMPACT_RATES)
  const [loading, setLoading] = useState(true)
  const [entry, setEntry] = useState<ImpactEntryKind | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [helpKey, setHelpKey] = useState<ImpactHelpKey | null>(null)
  const [openClaim, setOpenClaim] = useState<ImpactLogRecord | null>(null)
  const [showJourney, setShowJourney] = useState(false)
  const [showRatesToLearners, setShowRatesToLearnersState] = useState(false)

  // ESG draft
  const [ePillar, setEPillar] = useState<'env' | 'soc' | 'gov'>('env')
  const [eMetric, setEMetric] = useState(IMPACT_ESG_PILLARS[0].items[0])
  const [eQty, setEQty] = useState('')
  const [eNote, setENote] = useState('')
  const [eDate, setEDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const [claim, setClaim] = useState<ClaimDraft>(blankClaim)

  const displayName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ||
    profile?.email?.split('@')[0] ||
    'You'

  const reload = async () => {
    if (!user?.uid) return
    setLoading(true)
    try {
      const [mine, rateRows] = await Promise.all([
        listMyImpactLogs(user.uid),
        listImpactValueRates(profile?.companyId),
      ])
      setEntries(mine)
      setRates(rateRows)
      if (profile?.companyId) {
        const org = await listCompanyImpactLogs(profile.companyId)
        setOrgEntries(org)
      } else {
        setOrgEntries([])
      }
    } catch (err) {
      console.error('[ImpactLogV2] load failed', err)
      toast({ status: 'error', title: 'Could not load impact entries' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, profile?.companyId])

  useEffect(() => {
    let cancelled = false
    void getShowRatesToLearners(profile?.companyId).then((v) => {
      if (!cancelled) setShowRatesToLearnersState(v)
    })
    return () => {
      cancelled = true
    }
  }, [profile?.companyId, tab])

  useEffect(() => {
    if (tab === 'register' && !isAdmin) setTab('log')
  }, [tab, isAdmin])

  const startEntry = (kind: ImpactEntryKind) => {
    if (kind === 'claim') setClaim(blankClaim())
    setEntry(kind)
    setTab('log')
  }

  const statsFor = (list: ImpactLogRecord[]) => {
    const claims = list.filter((e) => entryKindOf(e) === 'claim')
    const validated = claims.filter(isValidatedClaim)
    const money = validated
      .filter((e) => (e.claim?.bucket as string) !== 'capacity')
      .reduce((s, e) => s + Number(e.usdValue || e.claim?.net || 0), 0)
    const capacityHours = validated
      .filter((e) => (e.claim?.bucket as string) === 'capacity')
      .reduce((s, e) => s + Number(e.hours || 0), 0)
    const hours = list.reduce((s, e) => s + Number(e.hours || 0), 0)
    const peopleReached = list.reduce((s, e) => s + Number(e.peopleImpacted || 0), 0)
    const acts = list.filter((e) => entryKindOf(e) === 'activity').length
    const esg = list.filter((e) => entryKindOf(e) === 'esg').length
    const claimCount = claims.length
    return {
      money,
      hours: hours || capacityHours,
      peopleReached,
      validated: validated.length,
      claims: claimCount,
      acts,
      esg,
      people: new Set(list.map((e) => e.userId).filter(Boolean)).size,
    }
  }

  const meStats = useMemo(() => statsFor(entries), [entries])
  const orgStats = useMemo(
    () => statsFor(orgEntries.length ? orgEntries : entries),
    [orgEntries, entries],
  )
  const cohortMoney = orgStats.money
  const pctMe = cohortMoney ? (meStats.money / cohortMoney) * 100 : 0

  const resetEntry = () => {
    setEntry(null)
    setEQty('')
    setENote('')
    setClaim(blankClaim())
  }

  const saveEsg = async () => {
    if (!user?.uid) return
    if (!eQty || !eNote.trim()) {
      toast({ status: 'warning', title: 'Add how many and what changed' })
      return
    }
    setSubmitting(true)
    try {
      const pillar = IMPACT_ESG_PILLARS.find((p) => p.k === ePillar)
      const esgMap = {
        env: ESGCategory.ENVIRONMENTAL,
        soc: ESGCategory.SOCIAL,
        gov: ESGCategory.GOVERNANCE,
      }
      const esgCategory = esgMap[ePillar]
      const qty = Number(eQty) || 0
      const rateInfo = resolveEsgRate({ esgCategory, metricLabel: eMetric })
      const usd = computeEsgUsdValue({
        esgCategory,
        metricLabel: eMetric,
        quantity: qty,
        hours: 0,
      })
      await createImpactLog(
        removeUndefinedFields({
          userId: user.uid,
          companyId: profile?.companyId,
          sourcePlatform: 'transformation_tier',
          title: eMetric,
          description: eNote.trim(),
          categoryGroup: 'esg',
          entryKind: 'esg',
          esgCategory,
          activityType: rateInfo.activityType,
          esgMetric: eMetric,
          esgQty: qty,
          liftPillars: pillar ? [pillar.n] : [],
          date: eDate,
          hours: 0,
          peopleImpacted: qty,
          usdValue: Math.round(usd * 100) / 100,
          usdValueSource: 'auto',
          unitRateApplied: rateInfo.unitRate,
          volHourRateApplied: VOLUNTEER_HOURLY_RATE,
          sasbTopic: rateInfo.sasbTopic,
          verificationLevel: 'Tier 1: Self-Reported',
          verificationStatus: 'pending',
          claimStatus: 'Sent to ESG team',
          points: 0,
          impactValue: Math.round(usd),
          scp: 0,
          verificationMultiplier: 1,
        }) as Parameters<typeof createImpactLog>[0],
      )
      toast({
        status: 'success',
        title: 'ESG contribution logged',
        description: `Estimated ${formatMoney(usd)} using the standard ESG rate card.`,
      })
      resetEntry()
      await reload()
    } catch (err) {
      toast({
        status: 'error',
        title: 'Could not save ESG entry',
        description: err instanceof Error ? err.message : 'Try again',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const guardClaimStep = (): string | null => {
    if (claim.step === 1 && !claim.measure.trim()) return 'Name the measure (KPI) before you continue.'
    if (claim.step === 2 && !claim.measure.trim()) return 'Name the measure before you continue.'
    if (claim.step === 3 && claim.months < 3) return 'Baseline needs at least 3 months of data.'
    if (claim.step === 3 && (claim.base === '' || claim.base === null))
      return 'Enter the baseline value.'
    if (claim.step === 3 && !claim.locked) return 'Lock the baseline before you continue.'
    if (claim.step === 4 && claim.target === '') return 'Enter the target value.'
    if (claim.step === 4) {
      const minIso = minTargetDateIso()
      const td = claim.targetDate
      const parsed = td ? parseISO(td) : null
      if (!parsed || !isValid(parsed) || td < minIso) {
        return 'Target date must be at least 6 weeks out (shortest improvement cycle).'
      }
    }
    if (claim.step === 5 && claim.post === '') return 'Enter the result for your measurement window.'
    return null
  }

  const nextClaim = () => {
    const g = guardClaimStep()
    if (g) {
      toast({ status: 'warning', title: g })
      return
    }
    setClaim((c) => ({ ...c, step: Math.min(7, c.step + 1) }))
  }

  const submitClaim = async () => {
    if (!user?.uid) return
    if (!claim.attest) {
      toast({ status: 'warning', title: 'Tick the attestation before you submit.' })
      return
    }
    if (!claim.ownerV.trim()) {
      toast({ status: 'warning', title: 'Nominate who confirms the number.' })
      return
    }
    const ownerEmail = claim.ownerEmail.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(ownerEmail)) {
      toast({ status: 'warning', title: 'Add a valid work email for the measure owner.' })
      return
    }
    const inputs = toClaimInputs(claim)
    const v = valuation(inputs, rates)
    const needsFinance = bandNeedsFinance(v.net)
    const financeEmail = claim.financeEmail.trim().toLowerCase()
    if (needsFinance) {
      if (!claim.financeV.trim()) {
        toast({ status: 'warning', title: 'This value band needs a finance validator name.' })
        return
      }
      if (!/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(financeEmail)) {
        toast({
          status: 'warning',
          title: 'Add a valid finance email. This band requires finance validation.',
        })
        return
      }
    }
    setSubmitting(true)
    try {
      const wasteOrGrowth =
        claim.cat === 'rev'
          ? IMPACT_GROWTH.find((g) => g.k === claim.growth)?.n
          : IMPACT_WASTES.find((w) => w.k === claim.waste)?.n
      const businessCategory =
        claim.cat === 'cost'
          ? 'Cost Savings'
          : claim.cat === 'eff'
            ? 'Efficiency Gains'
            : 'Revenue Growth'
      const windowLabel = `${claim.wStart} to ${claim.wEnd}`
      // Submitted claims stay Tier 1 / $0 on the headline until email confirmation advances them.
      const created = await createImpactLog(
        removeUndefinedFields({
          userId: user.uid,
          companyId: profile?.companyId,
          sourcePlatform: 'transformation_tier',
          title: claim.measure.trim(),
          description: claim.intervention || claim.formula || claim.measure,
          categoryGroup: 'business',
          entryKind: 'claim',
          businessCategory,
          businessActivity: wasteOrGrowth,
          activityType: claim.activity,
          liftPillars: [claim.pillar],
          date: claim.wEnd || format(new Date(), 'yyyy-MM-dd'),
          hours:
            inputs.family === 'time'
              ? Math.abs(Number(claim.base) - Number(claim.post)) * Number(claim.occ || 1)
              : 0,
          peopleImpacted: 0,
          usdValue: 0,
          usdValueSource: 'auto',
          verificationLevel: 'Tier 1: Self-Reported',
          verificationStatus: 'pending',
          claimStatus: 'Submitted',
          verifierName: claim.ownerV.trim(),
          verifierEmail: ownerEmail,
          evidenceLink: claim.evidenceRef || undefined,
          needsFinance,
          ownerEmail,
          financeName: claim.financeV.trim() || undefined,
          financeEmail: needsFinance ? financeEmail : undefined,
          claim: {
            ...inputs,
            tier: 1,
            indicativeTier: v.tier,
            grade: v.grade,
            gross: Math.round(v.gross),
            net: Math.round(v.net),
            bucket: v.bucket,
            conf: v.conf,
            cat: claim.cat,
            waste: claim.waste,
            growth: claim.growth,
            measure: claim.measure,
            formula: claim.formula,
            scope: `${claim.scopeType} · ${claim.scopeValue || 'unnamed'}`,
            window: windowLabel,
            attrReason: claim.attrReason,
            intervention: claim.intervention,
            direction: claim.direction,
            target: claim.target,
            evidenceType: claim.evidence,
            finance: claim.financeV.trim() || undefined,
          },
          points: 0,
          impactValue: 0,
          scp: 0,
          verificationMultiplier: v.conf || 1,
          auditTrail: [
            `${new Date().toISOString().slice(0, 16)} · submitted · confirmation emailed to measure owner`,
          ],
        }) as Parameters<typeof createImpactLog>[0],
      )

      const confirm = await requestClaimConfirmations({
        impactLogId: created.id,
        measureTitle: claim.measure.trim(),
        net: v.net,
        tier: v.tier,
        bucket: v.bucket,
        ownerName: claim.ownerV.trim(),
        ownerEmail,
        financeName: claim.financeV.trim() || undefined,
        financeEmail: needsFinance ? financeEmail : undefined,
        learnerName: displayName,
        learnerEmail: profile?.email || user.email || null,
        organizationName: profile?.companyName || null,
        evidenceRef: claim.evidenceRef || undefined,
        source: claim.source || undefined,
        window: windowLabel,
      })

      toast({
        status: confirm.ownerEmailed ? 'success' : 'warning',
        title: confirm.ownerEmailed
          ? 'Claim submitted — confirmation email sent'
          : 'Claim saved, email not sent',
        description:
          confirm.warning ||
          (confirm.needsFinance
            ? `Sent to ${ownerEmail}. After they confirm, finance (${financeEmail}) will be emailed before headline value.`
            : `Sent to ${ownerEmail}. Once they confirm, the value can appear on your dashboard.`),
      })
      resetEntry()
      setTab('claims')
      await reload()
    } catch (err) {
      toast({
        status: 'error',
        title: 'Could not submit claim',
        description: err instanceof Error ? err.message : 'Try again',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const navBtn = (id: ViewTab, label: string) => (
    <Button
      key={id}
      size="sm"
      variant="ghost"
      color={tab === id ? 'brand.primary' : 'text.secondary'}
      borderBottom="2px solid"
      borderColor={tab === id ? 'brand.accent' : 'transparent'}
      borderRadius={0}
      fontWeight={tab === id ? 'semibold' : 'medium'}
      onClick={() => setTab(id)}
    >
      {label}
    </Button>
  )

  const live = valuation(toClaimInputs(claim), rates)

  return (
    <Box>
      <Flex
        gap={1}
        overflowX="auto"
        borderBottom="1px solid"
        borderColor="border.subtle"
        bg="surface.default"
        px={2}
        mb={0}
        position="sticky"
        top={0}
        zIndex={10}
      >
        {navBtn('log', 'Log impact')}
        {navBtn('dash', 'Value dashboard')}
        {navBtn('waste', 'Where value comes from')}
        {isAdmin && navBtn('register', 'Value register')}
        {navBtn('claims', 'Claims ledger')}
        {navBtn('export', 'Export')}
      </Flex>

      {tab === 'log' && !entry && (
        <>
          <Box
            position="relative"
            overflow="hidden"
            bgGradient="linear(to-r, #350e6f, #8b5a3c)"
            color="white"
            px={{ base: 4, md: 6 }}
            py={{ base: 4, md: 5 }}
          >
            <Box
              position="absolute"
              top="-40%"
              right="-8%"
              w="280px"
              h="280px"
              borderRadius="full"
              bg="whiteAlpha.100"
              filter="blur(50px)"
              pointerEvents="none"
            />
            <HStack spacing={2} mb={2} position="relative">
              <Badge
                bg="whiteAlpha.200"
                color="white"
                px={2.5}
                py={0.5}
                borderRadius="full"
                fontSize="xs"
                fontWeight="semibold"
                textTransform="uppercase"
                letterSpacing="wide"
              >
                Impact log
              </Badge>
              <ImpactHelpButton k="howvalued" onOpen={setHelpKey} />
            </HStack>
            <Heading size="md" mb={1} color="white" fontWeight="semibold" position="relative">
              Log what changed, and what it added up to
            </Heading>
            <Text fontSize="sm" color="whiteAlpha.800" maxW="48ch" position="relative">
              Organisation totals and your pipeline first. Points stay on your journey dashboard.
            </Text>
          </Box>

          <SimpleGrid
            columns={{ base: 1, md: 3 }}
            spacing={0}
            borderBottom="1px solid"
            borderColor="border.subtle"
            bg="surface.default"
          >
            <Box p={{ base: 4, md: 5 }} borderRight={{ md: '1px solid' }} borderColor="border.subtle">
              <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                You · {displayName.split(' ')[0]}
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="black" lineHeight="1.15" my={1}>
                {formatMoney(meStats.money)}
              </Text>
              <Text fontSize="sm" color="text.secondary">
                {meStats.claims} improvement claim{meStats.claims === 1 ? '' : 's'} · {meStats.esg}{' '}
                ESG · {meStats.acts > 0 ? `${meStats.acts} activit${meStats.acts === 1 ? 'y' : 'ies'}` : `${meStats.validated} validated`}
              </Text>
              <Text fontSize="sm" color="text.secondary" mt={1}>
                {meStats.hours.toLocaleString(undefined, { maximumFractionDigits: 1 })} hrs ·{' '}
                {meStats.peopleReached.toLocaleString()} people reached
              </Text>
              <Progress
                value={pctMe}
                size="sm"
                colorScheme="yellow"
                mt={3}
                borderRadius="full"
                bg="blackAlpha.100"
              />
              <Text fontSize="xs" color="text.muted" mt={1}>
                {pctMe.toFixed(0)}% of organisation validated value
              </Text>
            </Box>
            <Box p={{ base: 4, md: 5 }} borderRight={{ md: '1px solid' }} borderColor="border.subtle">
              <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                Organisation
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="black" lineHeight="1.15" my={1}>
                {formatMoney(orgStats.money)}
              </Text>
              <Text fontSize="sm" color="text.secondary">
                {orgStats.validated} validated · {orgStats.people} contributing ·{' '}
                {orgStats.hours.toLocaleString(undefined, { maximumFractionDigits: 1 })} hrs
              </Text>
              <Text fontSize="sm" color="text.secondary" mt={1}>
                {orgStats.claims} claims · {orgStats.esg} ESG ·{' '}
                {orgStats.peopleReached.toLocaleString()} people reached
              </Text>
            </Box>
            <Box p={{ base: 4, md: 5 }} bg="tint.brandPrimary">
              <Text fontSize="xs" textTransform="uppercase" color="brand.primary" fontWeight="bold">
                Pipeline (Tier 2)
              </Text>
              <Text fontSize="2xl" fontWeight="bold" lineHeight="1.15" my={1} color="brand.primary">
                {formatMoney(
                  entries
                    .filter((e) => entryKindOf(e) === 'claim' && Number(e.claim?.tier) === 2)
                    .reduce((s, e) => s + Number(e.usdValue || 0), 0),
                )}
              </Text>
              <Text fontSize="sm" color="text.secondary">
                Indicative only, never inside the headline.
              </Text>
            </Box>
          </SimpleGrid>
        </>
      )}

      <Box maxW="1140px" mx="auto" px={{ base: 4, md: 5 }} py={5}>
        {loading && (
          <Flex align="center" gap={3} py={8}>
            <Spinner size="sm" />
            <Text color="text.secondary">Loading impact log…</Text>
          </Flex>
        )}

        {tab === 'log' && !entry && !loading && (
          <Stack spacing={6}>
            <Box
              p={{ base: 5, md: 6 }}
              rounded="2xl"
              bg="surface.default"
              boxShadow="card"
            >
              <Text
                fontSize="xs"
                letterSpacing="0.14em"
                textTransform="uppercase"
                color="brand.accent"
                fontWeight="bold"
                mb={1}
              >
                Two kinds of entry
              </Text>
              <Heading size="md" mb={1} letterSpacing="-0.02em">
                Log your impact
              </Heading>
              <Text fontSize="sm" color="text.secondary" mb={5} maxW="54ch">
                Improvement claims put verified dollars on the organisation register. ESG uses the same
                auto-rates as before. They stay in separate buckets.
              </Text>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                {[
                  {
                    k: 'claim' as const,
                    title: 'Log improvement',
                    body: 'Measured before/after with baseline and evidence. Measure owner confirms by email before headline $.',
                  },
                  {
                    k: 'esg' as const,
                    title: 'Log ESG',
                    body: 'Env / social / governance with the standard auto-calculated USD estimate.',
                  },
                ].map((card) => {
                  const featured = card.k === 'claim'
                  return (
                    <Box
                      key={card.k}
                      p={5}
                      rounded="2xl"
                      bg={featured ? 'tint.brandPrimary' : 'surface.subtle'}
                      boxShadow={featured ? 'md' : 'sm'}
                      transition="box-shadow 0.2s ease, transform 0.2s ease"
                      _hover={{
                        boxShadow: featured ? 'card-elevated' : 'md',
                        transform: 'translateY(-2px)',
                      }}
                    >
                      <Text fontWeight="bold" mb={1.5} color="text.primary">
                        {card.title}
                      </Text>
                      <Text fontSize="sm" color="text.secondary" mb={5} lineHeight="1.5">
                        {card.body}
                      </Text>
                      <Button
                        size="sm"
                        colorScheme={featured ? 'primary' : undefined}
                        variant={featured ? 'solid' : 'ghost'}
                        bg={featured ? undefined : 'white'}
                        boxShadow={featured ? undefined : 'sm'}
                        onClick={() => startEntry(card.k)}
                      >
                        {card.k === 'claim' ? 'Start a claim' : 'Log ESG'}
                      </Button>
                    </Box>
                  )
                })}
              </SimpleGrid>
            </Box>

            <Box
              px={{ base: 4, md: 5 }}
              py={4}
              rounded="2xl"
              bg="surface.default"
              boxShadow="sm"
            >
              <Flex align="center" justify="space-between" gap={3} flexWrap="wrap">
                <Box>
                  <Text
                    fontSize="xs"
                    letterSpacing="0.14em"
                    textTransform="uppercase"
                    color="brand.accent"
                    fontWeight="bold"
                    mb={1}
                  >
                    The claim journey
                  </Text>
                  <Heading size="sm" letterSpacing="-0.01em">
                    How a claim moves once you submit it
                  </Heading>
                </Box>
                <Button
                  size="sm"
                  variant="ghost"
                  bg="surface.subtle"
                  leftIcon={<Icon as={Info} boxSize={3.5} />}
                  onClick={() => setShowJourney((v) => !v)}
                  aria-expanded={showJourney}
                >
                  {showJourney ? 'Hide info' : 'Info'}
                </Button>
              </Flex>
              <Collapse in={showJourney} animateOpacity>
                <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={3} mt={4}>
                  {CLAIM_JOURNEY_STEPS.map(([num, title, desc]) => (
                    <Box
                      key={num}
                      p={3.5}
                      rounded="xl"
                      bg="surface.subtle"
                      boxShadow="xs"
                    >
                      <Text fontSize="xs" color="brand.accent" fontWeight="bold" mb={0.5}>
                        {num}
                      </Text>
                      <Text fontWeight="semibold" fontSize="sm" mb={1}>
                        {title}
                      </Text>
                      <Text fontSize="xs" color="text.secondary" lineHeight="1.45">
                        {desc}
                      </Text>
                    </Box>
                  ))}
                </SimpleGrid>
              </Collapse>
            </Box>

            <Box
              p={{ base: 5, md: 6 }}
              rounded="2xl"
              bg="surface.default"
              boxShadow="sm"
            >
              <Text
                fontSize="xs"
                letterSpacing="0.14em"
                textTransform="uppercase"
                color="brand.accent"
                fontWeight="bold"
                mb={3}
              >
                Your entries
              </Text>
              {entries.length === 0 ? (
                <Text fontSize="sm" color="text.secondary">
                  Nothing logged yet. Start with an improvement claim or ESG contribution.
                </Text>
              ) : (
                <Stack spacing={2.5}>
                  {entries.slice(0, 12).map((e) => {
                    const kind = entryKindOf(e)
                    return (
                      <Flex
                        key={e.id}
                        as="button"
                        w="100%"
                        textAlign="left"
                        justify="space-between"
                        gap={3}
                        p={3.5}
                        rounded="xl"
                        bg="surface.subtle"
                        boxShadow="xs"
                        flexWrap="wrap"
                        transition="background 0.15s ease, box-shadow 0.15s ease"
                        _hover={{ bg: 'orange.50', boxShadow: 'sm' }}
                        onClick={() => setOpenClaim(e)}
                      >
                        <Box>
                          <HStack spacing={2} mb={0.5}>
                            <Text fontWeight="semibold">{e.title}</Text>
                            <Badge>{kind === 'claim' ? 'improvement' : kind}</Badge>
                            {kind === 'claim' && e.claim?.tier != null && (
                              <Badge colorScheme="purple">Tier {String(e.claim.tier)}</Badge>
                            )}
                            {kind === 'claim' && e.claimStatus === 'Submitted' && (
                              <Badge colorScheme="blue">Awaiting confirmation</Badge>
                            )}
                          </HStack>
                          <Text fontSize="xs" color="text.muted">
                            {e.date} · {e.claimStatus || e.verificationStatus || 'pending'}
                            {kind === 'esg' && e.esgQty != null
                              ? ` · ${e.esgQty} ${e.esgMetric || 'units'}`
                              : ''}
                          </Text>
                        </Box>
                        <Text fontFamily="mono" fontSize="sm" color="black">
                          {Number(e.usdValue)
                            ? formatMoney(Number(e.usdValue))
                            : kind === 'claim'
                              ? '$0'
                              : '-'}
                        </Text>
                      </Flex>
                    )
                  })}
                </Stack>
              )}
            </Box>
          </Stack>
        )}

        {tab === 'log' && entry === 'esg' && (
          <Box p={5} border="1px solid" borderColor="border.subtle" rounded="xl" bg="surface.default">
            <Heading size="md" mb={1}>
              Log ESG
            </Heading>
            <Text fontSize="sm" color="text.secondary" mb={4}>
              Same auto-calculation as before: quantity × standard unit rate
              {eQty
                ? ` · estimate ${formatMoney(
                    computeEsgUsdValue({
                      esgCategory:
                        ePillar === 'env'
                          ? ESGCategory.ENVIRONMENTAL
                          : ePillar === 'soc'
                            ? ESGCategory.SOCIAL
                            : ESGCategory.GOVERNANCE,
                      metricLabel: eMetric,
                      quantity: Number(eQty) || 0,
                    }),
                  )}`
                : ''}
              .
            </Text>
            <Wrap mb={4}>
              {IMPACT_ESG_PILLARS.map((p) => (
                <WrapItem key={p.k}>
                  <Button
                    size="sm"
                    variant={ePillar === p.k ? 'solid' : 'outline'}
                    colorScheme={ePillar === p.k ? 'green' : undefined}
                    onClick={() => {
                      setEPillar(p.k)
                      setEMetric(p.items[0])
                    }}
                  >
                    {p.n}
                  </Button>
                </WrapItem>
              ))}
            </Wrap>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <FormControl isRequired>
                <FormLabel>What are you counting</FormLabel>
                <Select value={eMetric} onChange={(e) => setEMetric(e.target.value)}>
                  {(IMPACT_ESG_PILLARS.find((p) => p.k === ePillar)?.items || []).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl isRequired>
                <FormLabel>
                  How many (
                  {
                    resolveEsgRate({
                      esgCategory:
                        ePillar === 'env'
                          ? ESGCategory.ENVIRONMENTAL
                          : ePillar === 'soc'
                            ? ESGCategory.SOCIAL
                            : ESGCategory.GOVERNANCE,
                      metricLabel: eMetric,
                    }).unitLabel
                  }
                  )
                </FormLabel>
                <Input type="number" value={eQty} onChange={(e) => setEQty(e.target.value)} />
                <FormHelperText>
                  Rate{' '}
                  {formatMoney(
                    resolveEsgRate({
                      esgCategory:
                        ePillar === 'env'
                          ? ESGCategory.ENVIRONMENTAL
                          : ePillar === 'soc'
                            ? ESGCategory.SOCIAL
                            : ESGCategory.GOVERNANCE,
                      metricLabel: eMetric,
                    }).unitRate,
                  )}{' '}
                  per unit
                </FormHelperText>
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Date</FormLabel>
                <Input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} />
              </FormControl>
            </SimpleGrid>
            <FormControl isRequired mt={4}>
              <FormLabel>What changed</FormLabel>
              <Textarea value={eNote} onChange={(e) => setENote(e.target.value)} rows={3} />
            </FormControl>
            <Flex mt={6} gap={3} justify="flex-end">
              <Button variant="ghost" onClick={resetEntry} isDisabled={submitting}>
                Cancel
              </Button>
              <Button colorScheme="primary" onClick={() => void saveEsg()} isLoading={submitting}>
                Log ESG
              </Button>
            </Flex>
          </Box>
        )}

        {tab === 'log' && entry === 'claim' && (
          <Box p={5} border="1px solid" borderColor="border.subtle" rounded="xl" bg="surface.default">
            <Text fontSize="xs" color="brand.accent" fontWeight="bold" textTransform="uppercase" mb={2}>
              Improvement claim · step {claim.step} of 7
            </Text>
            <Wrap mb={3}>
              {CLAIM_STEPS.map((label, i) => (
                <WrapItem key={label}>
                  <Badge
                    colorScheme={i + 1 === claim.step ? 'purple' : i + 1 < claim.step ? 'green' : 'gray'}
                  >
                    {i + 1}. {label}
                  </Badge>
                </WrapItem>
              ))}
            </Wrap>
            <Progress value={(claim.step / 7) * 100} size="sm" colorScheme="yellow" mb={4} rounded="full" />

            {claim.step > 2 && (
              <Alert status="info" rounded="lg" mb={4}>
                <AlertIcon />
                <Box>
                  <AlertTitle>
                    Tier {live.tier} · Baseline grade {live.grade}
                  </AlertTitle>
                  <AlertDescription fontSize="sm">
                    {live.tier === 1
                      ? 'No currency value at Tier 1.'
                      : `Net per period on current inputs: ${formatMoney(live.net)}`}
                  </AlertDescription>
                </Box>
              </Alert>
            )}

            {claim.step === 1 && (
              <Stack spacing={4}>
                <Heading size="sm">
                  What kind of value is this
                  <ImpactHelpButton k="waste" onOpen={setHelpKey} />
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                  {IMPACT_CATS.map((c) => (
                    <Box
                      key={c.k}
                      as="button"
                      textAlign="left"
                      p={4}
                      border="1.5px solid"
                      borderColor={claim.cat === c.k ? 'brand.primary' : 'border.subtle'}
                      rounded="xl"
                      bg={claim.cat === c.k ? 'tint.brandPrimary' : 'surface.default'}
                      onClick={() => setClaim((d) => applyCategoryPick(d, { cat: c.k }))}
                    >
                      <Text fontWeight="bold">{c.n}</Text>
                      <Text fontSize="xs" color="text.secondary" mt={1}>
                        {c.d}
                      </Text>
                    </Box>
                  ))}
                </SimpleGrid>
                <FormControl>
                  <FormLabel>
                    {claim.cat === 'rev' ? 'Type of revenue growth' : 'Which of the 8 wastes'}
                  </FormLabel>
                  <Wrap>
                    {(claim.cat === 'rev' ? IMPACT_GROWTH : IMPACT_WASTES).map((w) => (
                      <WrapItem key={w.k}>
                        <Button
                          size="sm"
                          variant={
                            (claim.cat === 'rev' ? claim.growth : claim.waste) === w.k
                              ? 'solid'
                              : 'outline'
                          }
                          colorScheme={
                            (claim.cat === 'rev' ? claim.growth : claim.waste) === w.k
                              ? 'primary'
                              : undefined
                          }
                          onClick={() =>
                            setClaim((d) =>
                              applyCategoryPick(
                                d,
                                claim.cat === 'rev'
                                  ? { growth: w.k as ImpactGrowthKey }
                                  : { waste: w.k as ImpactWasteKey },
                              ),
                            )
                          }
                        >
                          {w.n}
                        </Button>
                      </WrapItem>
                    ))}
                  </Wrap>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Measure name (KPI)</FormLabel>
                  <Input
                    value={claim.measure}
                    placeholder="e.g. AI governance revenue growth, invoice cycle time"
                    onChange={(e) => setClaim((d) => ({ ...d, measure: e.target.value }))}
                  />
                  <FormHelperText>
                    What you are measuring. Prefills from the type above — edit to make it specific.
                  </FormHelperText>
                </FormControl>
                <Alert status="info" rounded="md" py={2}>
                  <AlertIcon />
                  <AlertDescription fontSize="sm">
                    Metric family on the next step is set from this category (
                    {IMPACT_METRIC_FAMILIES.find((f) => f.k === claim.family)?.n || claim.family} ·{' '}
                    {claim.unit}).
                  </AlertDescription>
                </Alert>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>LIFT pillar</FormLabel>
                    <Select
                      value={claim.pillar}
                      onChange={(e) => setClaim((d) => ({ ...d, pillar: e.target.value }))}
                    >
                      {IMPACT_LIFT_PILLARS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>What you changed</FormLabel>
                    <Select
                      value={claim.activity}
                      onChange={(e) => setClaim((d) => ({ ...d, activity: e.target.value }))}
                    >
                      {IMPACT_ACTIVITY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </SimpleGrid>
              </Stack>
            )}

            {claim.step === 2 && (
              <Stack spacing={4}>
                <Alert status="success" rounded="md" py={2}>
                  <AlertIcon />
                  <AlertDescription fontSize="sm">
                    Measure: <strong>{claim.measure || '—'}</strong> · family{' '}
                    <strong>
                      {IMPACT_METRIC_FAMILIES.find((f) => f.k === claim.family)?.n} ({claim.unit})
                    </strong>{' '}
                    from your category. Adjust only if needed.
                  </AlertDescription>
                </Alert>
                <FormControl isRequired>
                  <FormLabel>Measure name</FormLabel>
                  <Input
                    value={claim.measure}
                    placeholder="e.g. Retention and churn — enterprise SaaS"
                    onChange={(e) => setClaim((d) => ({ ...d, measure: e.target.value }))}
                  />
                </FormControl>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Metric family</FormLabel>
                    <Select
                      value={claim.family}
                      onChange={(e) => {
                        const fam = e.target.value as ImpactFamilyKey
                        const units =
                          IMPACT_METRIC_FAMILIES.find((f) => f.k === fam)?.units || ['hours']
                        setClaim((d) => ({ ...d, family: fam, unit: units[0] }))
                      }}
                    >
                      {IMPACT_METRIC_FAMILIES.map((f) => (
                        <option key={f.k} value={f.k}>
                          {f.n}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Unit</FormLabel>
                    <Select
                      value={claim.unit}
                      onChange={(e) => setClaim((d) => ({ ...d, unit: e.target.value }))}
                    >
                      {(IMPACT_METRIC_FAMILIES.find((f) => f.k === claim.family)?.units || []).map(
                        (u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ),
                      )}
                    </Select>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Source system</FormLabel>
                    <Select
                      value={claim.source}
                      onChange={(e) => setClaim((d) => ({ ...d, source: e.target.value }))}
                    >
                      {IMPACT_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                    <FormHelperText>
                      {claim.source === 'Practitioner recall (no system)'
                        ? 'Recall only caps this at Tier 1.'
                        : 'Approved source supports Tier 3.'}
                    </FormHelperText>
                  </FormControl>
                </SimpleGrid>
                <FormControl>
                  <FormLabel>How the number is calculated</FormLabel>
                  <Input
                    value={claim.formula}
                    onChange={(e) => setClaim((d) => ({ ...d, formula: e.target.value }))}
                    placeholder="e.g. Median days from invoice receipt to payment"
                  />
                </FormControl>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Scope type</FormLabel>
                    <Select
                      value={claim.scopeType}
                      onChange={(e) => setClaim((d) => ({ ...d, scopeType: e.target.value }))}
                    >
                      {['Department', 'Process', 'Site / plant', 'Team', 'Product line', 'Customer segment'].map(
                        (s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ),
                      )}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Scope name</FormLabel>
                    <Input
                      value={claim.scopeValue}
                      onChange={(e) => setClaim((d) => ({ ...d, scopeValue: e.target.value }))}
                      placeholder="e.g. AP invoice intake"
                    />
                  </FormControl>
                </SimpleGrid>
              </Stack>
            )}

            {claim.step === 3 && (
              <Stack spacing={4}>
                <Alert status="warning" rounded="lg">
                  <AlertIcon />
                  <AlertDescription fontSize="sm">
                    A baseline is what the number looked like before you changed anything. Twelve months
                    is best; minimum three months.
                  </AlertDescription>
                </Alert>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Months of data</FormLabel>
                    <Select
                      value={String(claim.months)}
                      onChange={(e) => {
                        const months = Number(e.target.value)
                        setClaim((d) => ({ ...d, months, obs: months }))
                      }}
                    >
                      {[3, 6, 9, 12, 18, 24].map((m) => (
                        <option key={m} value={m}>
                          {m === 12 ? '12 (recommended)' : m}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Baseline type</FormLabel>
                    <Select
                      value={claim.baselineType}
                      onChange={(e) => {
                        const baselineType = e.target.value as ClaimDraft['baselineType']
                        setClaim((d) => ({
                          ...d,
                          ...applyBaselineType(baselineType, d.cat),
                        }))
                      }}
                    >
                      <option value="hours">Hours</option>
                      <option value="dollars">Dollars</option>
                      <option value="people">People</option>
                    </Select>
                    <FormHelperText>
                      What you observed over those months — sets unit to {claim.unit}.
                    </FormHelperText>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>
                      Baseline value ({unitLabel(claim.unit, claim.baselineType)})
                    </FormLabel>
                    <Input
                      type="number"
                      value={claim.base}
                      onChange={(e) => setClaim((d) => ({ ...d, base: e.target.value }))}
                    />
                  </FormControl>
                </SimpleGrid>
                <Checkbox
                  isChecked={claim.lockedBefore}
                  onChange={(e) => setClaim((d) => ({ ...d, lockedBefore: e.target.checked }))}
                >
                  This baseline was pulled before the change started.
                </Checkbox>
                <FormControl>
                  <FormLabel>Extract reference</FormLabel>
                  <Input
                    value={claim.bRef}
                    onChange={(e) => setClaim((d) => ({ ...d, bRef: e.target.value }))}
                    placeholder="e.g. SAP extract, run 28 Jun 2026"
                  />
                </FormControl>
                <HStack>
                  <Badge colorScheme="purple" fontSize="md" px={3} py={1}>
                    Grade{' '}
                    {gradeFromBaseline(
                      claim.months,
                      claim.obs || claim.months,
                      claim.lockedBefore,
                      claim.source,
                    )}
                  </Badge>
                  <Checkbox
                    isChecked={claim.locked}
                    onChange={(e) => setClaim((d) => ({ ...d, locked: e.target.checked }))}
                  >
                    Lock this baseline
                  </Checkbox>
                </HStack>
              </Stack>
            )}

            {claim.step === 4 && (
              <Stack spacing={4}>
                <Alert status="info" rounded="lg">
                  <AlertIcon />
                  <AlertDescription fontSize="sm">
                    Example: baseline 20 people on a webinar, target 100 people → direction is{' '}
                    <strong>Increase</strong>. Target uses the same unit as your baseline (
                    {unitLabel(claim.unit, claim.baselineType)}).
                  </AlertDescription>
                </Alert>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Direction</FormLabel>
                    <Select
                      value={claim.direction}
                      onChange={(e) =>
                        setClaim((d) => ({
                          ...d,
                          direction: e.target.value as 'Decrease' | 'Increase',
                        }))
                      }
                    >
                      <option value="Increase">Increase</option>
                      <option value="Decrease">Decrease</option>
                    </Select>
                    <FormHelperText>
                      Are you trying to grow the number or reduce it?
                    </FormHelperText>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>
                      Target value ({unitLabel(claim.unit, claim.baselineType)})
                    </FormLabel>
                    <Input
                      type="number"
                      value={claim.target}
                      onChange={(e) => setClaim((d) => ({ ...d, target: e.target.value }))}
                    />
                    <FormHelperText>
                      Same unit as baseline — not always hours.
                    </FormHelperText>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Target date</FormLabel>
                    <Input
                      type="date"
                      min={minTargetDateIso()}
                      value={claim.targetDate}
                      onChange={(e) => setClaim((d) => ({ ...d, targetDate: e.target.value }))}
                    />
                    <FormHelperText>Minimum 6 weeks out (shortest improvement cycle).</FormHelperText>
                  </FormControl>
                </SimpleGrid>
                <FormControl isRequired>
                  <FormLabel>What you are changing</FormLabel>
                  <Textarea
                    value={claim.intervention}
                    onChange={(e) => setClaim((d) => ({ ...d, intervention: e.target.value }))}
                    rows={3}
                    placeholder="What process, tool, or behaviour are you changing to hit the target?"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Change start date</FormLabel>
                  <Input
                    type="date"
                    value={claim.intStart}
                    onChange={(e) => setClaim((d) => ({ ...d, intStart: e.target.value }))}
                  />
                </FormControl>
              </Stack>
            )}

            {claim.step === 5 && (
              <Stack spacing={4}>
                <Alert status="info" rounded="lg">
                  <AlertIcon />
                  <AlertDescription fontSize="sm">
                    Result uses your baseline unit ({unitLabel(claim.unit, claim.baselineType)}) — people,
                    hours, or money, matching what you measured.
                  </AlertDescription>
                </Alert>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Measurement window start</FormLabel>
                    <Input
                      type="date"
                      value={claim.wStart}
                      onChange={(e) => setClaim((d) => ({ ...d, wStart: e.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Measurement window end</FormLabel>
                    <Input
                      type="date"
                      value={claim.wEnd}
                      onChange={(e) => setClaim((d) => ({ ...d, wEnd: e.target.value }))}
                    />
                  </FormControl>
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>How many full cycles did you measure?</FormLabel>
                    <Select
                      value={String(claim.windowP)}
                      onChange={(e) => setClaim((d) => ({ ...d, windowP: Number(e.target.value) }))}
                    >
                      {[1, 2, 3, 4, 5, 6, 12].map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? 'cycle' : 'cycles'}
                        </option>
                      ))}
                    </Select>
                    <FormHelperText>
                      Example: if you track monthly webinar attendance for 3 months, choose 3. Three or
                      more supports stronger evidence (Tier 3 window rule).
                    </FormHelperText>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>
                      Result after the change ({unitLabel(claim.unit, claim.baselineType)})
                    </FormLabel>
                    <Input
                      type="number"
                      value={claim.post}
                      onChange={(e) => setClaim((d) => ({ ...d, post: e.target.value }))}
                    />
                    <FormHelperText>
                      Same unit as baseline and target — not always hours.
                    </FormHelperText>
                  </FormControl>
                </SimpleGrid>
                {(claim.family === 'time' ||
                  claim.family === 'volume' ||
                  claim.family === 'quality') && (
                  <FormControl>
                    <FormLabel>
                      {claim.family === 'time'
                        ? 'How many times this task runs in a period'
                        : 'Volume in a period'}
                    </FormLabel>
                    <Input
                      type="number"
                      value={claim.occ}
                      onChange={(e) => setClaim((d) => ({ ...d, occ: Number(e.target.value) }))}
                    />
                  </FormControl>
                )}
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Evidence type</FormLabel>
                    <Select
                      value={claim.evidence}
                      onChange={(e) => setClaim((d) => ({ ...d, evidence: e.target.value }))}
                    >
                      {IMPACT_EVIDENCE_TYPES.map((ev) => (
                        <option key={ev} value={ev}>
                          {ev}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Evidence reference</FormLabel>
                    <Input
                      value={claim.evidenceRef}
                      onChange={(e) => setClaim((d) => ({ ...d, evidenceRef: e.target.value }))}
                    />
                  </FormControl>
                </SimpleGrid>
                <Checkbox
                  isChecked={claim.sustained}
                  onChange={(e) => setClaim((d) => ({ ...d, sustained: e.target.checked }))}
                >
                  The improvement is still holding today.
                </Checkbox>
              </Stack>
            )}

            {claim.step === 6 && (
              <Stack spacing={4}>
                <Alert status="success" rounded="lg">
                  <AlertIcon />
                  <AlertDescription fontSize="sm">
                    You do not enter the money. The platform works it out from your baseline, result,
                    and organisation rates, then applies attribution, realisation, and confidence.
                  </AlertDescription>
                </Alert>
                <FormControl>
                  <FormLabel>Rate set</FormLabel>
                  <Select
                    value={claim.rateId}
                    onChange={(e) => setClaim((d) => ({ ...d, rateId: e.target.value }))}
                  >
                    {rates.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.country} · {r.grade} ({r.scope})
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Attribution %</FormLabel>
                    <Select
                      value={String(claim.attribution)}
                      onChange={(e) =>
                        setClaim((d) => ({ ...d, attribution: Number(e.target.value) }))
                      }
                    >
                      {[100, 90, 75, 70, 60, 50, 40, 25].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Why that share</FormLabel>
                    <Select
                      value={claim.attrReason}
                      onChange={(e) => setClaim((d) => ({ ...d, attrReason: e.target.value }))}
                    >
                      {IMPACT_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Does it repeat</FormLabel>
                    <Select
                      value={claim.recurrence}
                      onChange={(e) => setClaim((d) => ({ ...d, recurrence: e.target.value }))}
                    >
                      {IMPACT_RECURRENCE.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </SimpleGrid>
                {claim.family === 'time' && (
                  <Checkbox
                    isChecked={claim.realization === 1}
                    onChange={(e) =>
                      setClaim((d) => ({ ...d, realization: e.target.checked ? 1 : 0.5 }))
                    }
                  >
                    Released hours turned into cash (headcount / overtime / contractor evidence).
                  </Checkbox>
                )}
                <FormControl>
                  <FormLabel>What it cost to do</FormLabel>
                  <Input
                    type="number"
                    value={claim.implCost}
                    onChange={(e) => setClaim((d) => ({ ...d, implCost: Number(e.target.value) }))}
                  />
                </FormControl>
                <SimpleGrid columns={3} spacing={3}>
                  <Box p={3} border="1px solid" borderColor="border.subtle" rounded="lg">
                    <Text fontSize="xs" color="text.muted">
                      Bucket
                    </Text>
                    <Text fontWeight="bold">{live.bucket}</Text>
                  </Box>
                  <Box p={3} border="1px solid" borderColor="border.subtle" rounded="lg">
                    <Text fontSize="xs" color="text.muted">
                      Net per period
                    </Text>
                    <Text fontWeight="bold">
                      {live.tier === 1 ? 'no value' : formatMoney(live.net)}
                    </Text>
                  </Box>
                  <Box p={3} border="1px solid" borderColor="border.subtle" rounded="lg" bg="tint.brandPrimary">
                    <Text fontSize="xs" color="text.muted">
                      Gross → net
                    </Text>
                    <Text fontSize="sm">
                      {formatMoney(live.gross)} → {formatMoney(live.net)}
                    </Text>
                  </Box>
                </SimpleGrid>
              </Stack>
            )}

            {claim.step === 7 && (
              <Stack spacing={4}>
                <Alert status="info" rounded="lg">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>
                      Submitted as Tier 1 · no headline $ yet
                      {live.tier > 1 ? ` · indicative ${formatMoney(live.net)} / period` : ''}
                    </AlertTitle>
                    <AlertDescription fontSize="sm">
                      Self-submitted claims stay Tier 1 until someone independent confirms. That is
                      expected — even with a full rate set, currency only lands after review.
                    </AlertDescription>
                  </Box>
                </Alert>
                <Box p={4} rounded="lg" bg="surface.subtle" border="1px solid" borderColor="border.subtle">
                  <Text fontSize="sm" fontWeight="bold" mb={2}>
                    How you reach Tier 2 and Tier 3
                  </Text>
                  <Stack spacing={2} fontSize="sm" color="text.secondary">
                    <Text>
                      <strong>Tier 1 · Self-reported</strong> — you submit. Dashboard headline stays $0.
                    </Text>
                    <Text>
                      <strong>Tier 2 · Measure owner confirmed</strong> — the owner below confirms via
                      email (or a partner advances in Claims ledger). Value can show in the pipeline.
                    </Text>
                    <Text>
                      <strong>Tier 3 · Recognised</strong> — finance confirms when the band needs it
                      (about $1,000+), or owner alone for smaller bands. Headline organisation $ updates.
                    </Text>
                  </Stack>
                </Box>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Measure owner name</FormLabel>
                    <Input
                      value={claim.ownerV}
                      onChange={(e) => setClaim((d) => ({ ...d, ownerV: e.target.value }))}
                      placeholder="Who owns this measure"
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Measure owner email</FormLabel>
                    <Input
                      type="email"
                      value={claim.ownerEmail}
                      onChange={(e) => setClaim((d) => ({ ...d, ownerEmail: e.target.value }))}
                      placeholder="name@company.com"
                    />
                    <FormHelperText>
                      Prefer someone in your organisation. They get a one-click confirm link (no login).
                    </FormHelperText>
                  </FormControl>
                  <FormControl isRequired={bandNeedsFinance(live.net)}>
                    <FormLabel>
                      Finance validator
                      {bandNeedsFinance(live.net) ? '' : ' (optional)'}
                    </FormLabel>
                    <Input
                      value={claim.financeV}
                      onChange={(e) => setClaim((d) => ({ ...d, financeV: e.target.value }))}
                      placeholder="Finance reviewer name"
                    />
                  </FormControl>
                  <FormControl isRequired={bandNeedsFinance(live.net)}>
                    <FormLabel>
                      Finance email
                      {bandNeedsFinance(live.net) ? '' : ' (optional)'}
                    </FormLabel>
                    <Input
                      type="email"
                      value={claim.financeEmail}
                      onChange={(e) => setClaim((d) => ({ ...d, financeEmail: e.target.value }))}
                      placeholder="finance@company.com"
                    />
                    <FormHelperText>
                      {bandNeedsFinance(live.net)
                        ? 'Required for this value band — emailed after the measure owner confirms.'
                        : 'Optional second sign-off for smaller bands.'}
                    </FormHelperText>
                  </FormControl>
                </SimpleGrid>
                <Checkbox
                  isChecked={claim.attest}
                  onChange={(e) => setClaim((d) => ({ ...d, attest: e.target.checked }))}
                >
                  The data behind this claim comes from the source I named, and I have not claimed this
                  improvement anywhere else.
                </Checkbox>
              </Stack>
            )}

            <Flex mt={6} gap={3} justify="flex-end" align="center" flexWrap="wrap">
              <Text fontSize="sm" color="text.secondary" mr="auto">
                {claim.step >= 3 && live.tier > 1
                  ? `Net per period · ${formatMoney(live.net)}`
                  : claim.step >= 3
                    ? 'No currency value at Tier 1'
                    : ''}
              </Text>
              {claim.step > 1 ? (
                <Button variant="outline" onClick={() => setClaim((d) => ({ ...d, step: d.step - 1 }))}>
                  Back
                </Button>
              ) : (
                <Button variant="ghost" onClick={resetEntry}>
                  Cancel
                </Button>
              )}
              {claim.step < 7 ? (
                <Button colorScheme="primary" onClick={nextClaim}>
                  Next
                </Button>
              ) : (
                <Button colorScheme="yellow" onClick={() => void submitClaim()} isLoading={submitting}>
                  Submit claim
                </Button>
              )}
            </Flex>
          </Box>
        )}

        {tab === 'dash' && (
          <ImpactValueDashboard
            entries={entries}
            orgEntries={orgEntries}
            rates={rates}
            onHelp={setHelpKey}
            onOpenClaim={setOpenClaim}
          />
        )}

        {tab === 'waste' && (
          <ImpactWastePanel
            entries={orgEntries.length ? orgEntries : entries}
            rates={rates}
            onHelp={setHelpKey}
            onOpenClaim={setOpenClaim}
          />
        )}

        {tab === 'register' &&
          (isAdmin ? (
            <ImpactRatesAdmin
              companyId={profile?.companyId}
              userId={user?.uid}
              onHelp={setHelpKey}
              onRatesChanged={setRates}
            />
          ) : (
            <ImpactRatesViewer
              rates={rates}
              showFigures={showRatesToLearners}
              onHelp={setHelpKey}
            />
          ))}

        {tab === 'claims' && (
          <>
            {isAdmin && (
              <Alert status="info" rounded="lg" mb={4}>
                <AlertIcon />
                <Box>
                  <AlertTitle>Partner review</AlertTitle>
                  <AlertDescription fontSize="sm">
                    Open any Submitted claim to review answers and advance status. Measure owners in
                    your organisation also get an email confirm link — both paths update the same
                    journey.
                  </AlertDescription>
                </Box>
              </Alert>
            )}
            <ImpactRegisterPanel
              entries={isAdmin && orgEntries.length ? orgEntries : entries}
              rates={rates}
              onHelp={setHelpKey}
              onOpenClaim={setOpenClaim}
            />
          </>
        )}

        {tab === 'export' && (
          <ImpactExportPanel
            entries={isAdmin && orgEntries.length ? orgEntries : entries}
            rates={rates}
            user={user}
            profile={profile}
          />
        )}
      </Box>

      {tab === 'log' && !entry && (
        <Menu placement="top-end">
          <Tooltip label="Quick actions" hasArrow>
            <MenuButton
              as={IconButton}
              aria-label="Quick actions"
              icon={<Icon as={Plus} boxSize={6} />}
              colorScheme="primary"
              rounded="full"
              size="lg"
              position="fixed"
              bottom={{ base: 6, md: 8 }}
              right={{ base: 5, md: 8 }}
              zIndex={20}
              boxShadow="lg"
            />
          </Tooltip>
          <MenuList zIndex={21}>
            <MenuItem onClick={() => startEntry('claim')}>Log improvement</MenuItem>
            <MenuItem onClick={() => startEntry('esg')}>Log ESG</MenuItem>
          </MenuList>
        </Menu>
      )}

      <Box
        borderTop="1px solid"
        borderColor="border.subtle"
        bg="surface.default"
        px={{ base: 4, md: 6 }}
        py={5}
        mt={4}
      >
        <Flex
          maxW="1140px"
          mx="auto"
          gap={4}
          flexWrap="wrap"
          align="center"
          fontSize="sm"
          color="text.muted"
        >
          <Text>Transformation Leader · Positive Impact. Sustainable Change.</Text>
          <HStack spacing={4} ml="auto" flexWrap="wrap">
            {(
              [
                ['rules', 'Aggregation rules'],
                ['howvalued', 'How value is calculated'],
                ['integrity', 'Points and integrity'],
                ['scope', 'What this does not cover'],
              ] as const
            ).map(([k, label]) => (
              <Button
                key={k}
                variant="link"
                size="sm"
                color="text.secondary"
                onClick={() => setHelpKey(k)}
              >
                {label}
              </Button>
            ))}
          </HStack>
        </Flex>
      </Box>

      <ImpactHelpModal helpKey={helpKey} onClose={() => setHelpKey(null)} />
      <ImpactClaimDrawer
        entry={openClaim}
        rates={rates}
        canModerate={Boolean(isAdmin)}
        onClose={() => setOpenClaim(null)}
        onChanged={() => {
          void reload()
          setOpenClaim(null)
        }}
      />
    </Box>
  )
}

export default ImpactLogV2
