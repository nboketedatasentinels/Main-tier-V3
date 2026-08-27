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
import { format } from 'date-fns'
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
  financeV: string
  attest: boolean
}

const blankClaim = (): ClaimDraft => ({
  step: 1,
  pillar: IMPACT_LIFT_PILLARS[3],
  activity: 'Automation',
  cat: 'eff',
  waste: 'waiting',
  growth: 'acquire',
  measure: '',
  family: 'time',
  unit: 'hours',
  formula: '',
  source: 'SAP ERP',
  scopeType: 'Process',
  scopeValue: '',
  months: 12,
  obs: 0,
  base: '',
  lockedBefore: true,
  locked: false,
  bRef: '',
  direction: 'Decrease',
  target: '',
  targetDate: format(new Date(), 'yyyy-MM-dd'),
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
  financeV: '',
  attest: false,
})

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
    obs: Number(d.obs) || 0,
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

  // Activity draft
  const [aTitle, setATitle] = useState('')
  const [aDate, setADate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [aPillar, setAPillar] = useState<string>(IMPACT_LIFT_PILLARS[2])
  const [aType, setAType] = useState<string>(IMPACT_ACTIVITY_TYPES[4])
  const [aDesc, setADesc] = useState('')
  const [aPeople, setAPeople] = useState(1)
  const [aHours, setAHours] = useState(1)

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
    const hours = validated
      .filter((e) => (e.claim?.bucket as string) === 'capacity')
      .reduce((s, e) => s + Number(e.hours || 0), 0)
    return {
      money,
      hours,
      validated: validated.length,
      acts: list.filter((e) => entryKindOf(e) === 'activity').length,
      esg: list.filter((e) => entryKindOf(e) === 'esg').length,
      people: new Set(list.map((e) => e.userId)).size,
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
    setATitle('')
    setADesc('')
    setAPeople(1)
    setAHours(1)
    setEQty('')
    setENote('')
    setClaim(blankClaim())
  }

  const saveActivity = async () => {
    if (!user?.uid) return
    if (!aTitle.trim() || !aDesc.trim()) {
      toast({ status: 'warning', title: 'Add a title and what you did' })
      return
    }
    setSubmitting(true)
    try {
      await createImpactLog(
        removeUndefinedFields({
          userId: user.uid,
          companyId: profile?.companyId,
          sourcePlatform: 'transformation_tier',
          title: aTitle.trim(),
          description: aDesc.trim(),
          categoryGroup: 'business',
          entryKind: 'activity',
          activityType: aType,
          liftPillars: [aPillar],
          date: aDate,
          hours: Number(aHours) || 0,
          peopleImpacted: Number(aPeople) || 0,
          usdValue: 0,
          verificationLevel: 'Tier 1: Self-Reported',
          verificationStatus: 'pending',
          claimStatus: 'Awaiting partner confirmation',
          points: 0,
          impactValue: 0,
          scp: 0,
          verificationMultiplier: 1,
        }) as Parameters<typeof createImpactLog>[0],
      )
      toast({
        status: 'success',
        title: 'Activity submitted',
        description: 'Goes to your cohort partner for confirmation. No currency value.',
      })
      resetEntry()
      await reload()
    } catch (err) {
      toast({
        status: 'error',
        title: 'Could not save activity',
        description: err instanceof Error ? err.message : 'Try again',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const saveEsg = async () => {
    if (!user?.uid) return
    if (!eQty || !eNote.trim()) {
      toast({ status: 'warning', title: 'Add quantity and what changed' })
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
      await createImpactLog(
        removeUndefinedFields({
          userId: user.uid,
          companyId: profile?.companyId,
          sourcePlatform: 'transformation_tier',
          title: eMetric,
          description: eNote.trim(),
          categoryGroup: 'esg',
          entryKind: 'esg',
          esgCategory: esgMap[ePillar],
          esgMetric: eMetric,
          esgQty: Number(eQty) || 0,
          liftPillars: pillar ? [pillar.n] : [],
          date: eDate,
          hours: 0,
          peopleImpacted: ePillar === 'soc' ? Number(eQty) || 0 : 0,
          usdValue: 0,
          verificationLevel: 'Tier 1: Self-Reported',
          verificationStatus: 'pending',
          claimStatus: 'Sent to ESG team',
          points: 0,
          impactValue: 0,
          scp: 0,
          verificationMultiplier: 1,
        }) as Parameters<typeof createImpactLog>[0],
      )
      toast({
        status: 'success',
        title: 'ESG contribution sent',
        description: 'Routed to the ESG reporting set. Not valued in the finance register.',
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
    if (claim.step === 2 && !claim.measure.trim()) return 'Name the measure before you continue.'
    if (claim.step === 3 && (claim.base === '' || claim.base === null))
      return 'Enter the baseline value.'
    if (claim.step === 3 && !claim.locked) return 'Lock the baseline before you continue.'
    if (claim.step === 4 && claim.target === '') return 'Enter the target value.'
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
    const inputs = toClaimInputs(claim)
    const v = valuation(inputs, rates)
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
      await createImpactLog(
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
          usdValue: v.tier === 1 ? 0 : Math.round(v.net),
          usdValueSource: 'auto',
          verificationLevel:
            v.tier === 3
              ? 'Tier 3: Verified'
              : v.tier === 2
                ? 'Tier 2: Partner Verified'
                : 'Tier 1: Self-Reported',
          verificationStatus: 'pending',
          claimStatus: 'Submitted',
          verifierName: claim.ownerV,
          verifierEmail: '',
          evidenceLink: claim.evidenceRef || undefined,
          claim: {
            ...inputs,
            tier: v.tier,
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
            window: `${claim.wStart} to ${claim.wEnd}`,
            attrReason: claim.attrReason,
            intervention: claim.intervention,
            direction: claim.direction,
            target: claim.target,
            evidenceType: claim.evidence,
          },
          points: 0,
          impactValue: Math.round(v.net),
          scp: 0,
          verificationMultiplier: v.conf || 1,
        }) as Parameters<typeof createImpactLog>[0],
      )
      toast({
        status: 'success',
        title: `Claim submitted at Tier ${v.tier}`,
        description:
          v.tier === 1
            ? 'No currency value will be reported until evidence strengthens.'
            : `Net ${formatMoney(v.net)} per period. Routed for verification.`,
      })
      resetEntry()
      setTab('register')
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
        {navBtn('register', 'Value register')}
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
              <Text fontSize="2xl" fontWeight="bold" color="brand.accent" lineHeight="1.15" my={1}>
                {formatMoney(meStats.money)}
              </Text>
              <Text fontSize="sm" color="text.secondary">
                {meStats.validated} validated · {meStats.acts} activities · {meStats.esg} ESG
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
              <Text fontSize="2xl" fontWeight="bold" lineHeight="1.15" my={1}>
                {formatMoney(orgStats.money)}
              </Text>
              <Text fontSize="sm" color="text.secondary">
                {orgStats.validated} validated · {orgStats.people} contributing ·{' '}
                {orgStats.hours.toLocaleString(undefined, { maximumFractionDigits: 1 })} hrs released
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
          <Stack spacing={5}>
            <Box p={5} border="1px solid" borderColor="border.subtle" rounded="xl" bg="surface.default">
              <Text
                fontSize="xs"
                letterSpacing="0.12em"
                textTransform="uppercase"
                color="brand.accent"
                fontWeight="bold"
                mb={1}
              >
                Three kinds of entry
              </Text>
              <Heading size="md" mb={1}>
                Log your impact
              </Heading>
              <Text fontSize="sm" color="text.secondary" mb={4}>
                Pick the one that matches what you have. They are reported separately and never mixed.
              </Text>
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                {[
                  {
                    k: 'activity' as const,
                    title: 'Activity log',
                    body: 'Workshops, coaching, training. People reached and hours. No currency value.',
                  },
                  {
                    k: 'claim' as const,
                    title: 'Improvement claim',
                    body: 'Measured improvement with baseline and evidence. You never type the money.',
                  },
                  {
                    k: 'esg' as const,
                    title: 'ESG contribution',
                    body: 'Env / social / governance in their own units. Goes to the ESG team, not finance.',
                  },
                ].map((card) => (
                  <Box
                    key={card.k}
                    p={4}
                    border="1.5px solid"
                    borderColor={card.k === 'claim' ? 'brand.primary' : 'border.subtle'}
                    rounded="xl"
                    bg={card.k === 'claim' ? 'tint.brandPrimary' : 'surface.default'}
                  >
                    <Text fontWeight="bold" mb={1}>
                      {card.title}
                    </Text>
                    <Text fontSize="sm" color="text.secondary" mb={4}>
                      {card.body}
                    </Text>
                    <Button
                      size="sm"
                      colorScheme={card.k === 'claim' ? 'primary' : undefined}
                      variant={card.k === 'claim' ? 'solid' : 'outline'}
                      onClick={() => startEntry(card.k)}
                    >
                      {card.k === 'claim' ? 'Start a claim' : card.k === 'esg' ? 'Log ESG' : 'Log an activity'}
                    </Button>
                  </Box>
                ))}
              </SimpleGrid>
            </Box>

            <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl" bg="surface.default">
              <Flex align="center" justify="space-between" gap={3} flexWrap="wrap">
                <Box>
                  <Text
                    fontSize="xs"
                    letterSpacing="0.12em"
                    textTransform="uppercase"
                    color="brand.accent"
                    fontWeight="bold"
                    mb={1}
                  >
                    The claim journey
                  </Text>
                  <Heading size="sm">
                    How a claim moves once you submit it
                  </Heading>
                </Box>
                <Button
                  size="sm"
                  variant="outline"
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
                    <Box key={num} p={3} border="1px solid" borderColor="border.subtle" rounded="lg">
                      <Text fontSize="xs" color="text.muted" fontWeight="bold">
                        {num}
                      </Text>
                      <Text fontWeight="semibold" fontSize="sm">
                        {title}
                      </Text>
                      <Text fontSize="xs" color="text.secondary">
                        {desc}
                      </Text>
                    </Box>
                  ))}
                </SimpleGrid>
              </Collapse>
            </Box>

            <Box p={5} border="1px solid" borderColor="border.subtle" rounded="xl" bg="surface.default">
              <Text
                fontSize="xs"
                letterSpacing="0.12em"
                textTransform="uppercase"
                color="brand.accent"
                fontWeight="bold"
                mb={3}
              >
                Your entries
              </Text>
              {entries.length === 0 ? (
                <Text fontSize="sm" color="text.secondary">
                  Nothing logged yet. Start with an activity, ESG contribution, or improvement claim.
                </Text>
              ) : (
                <Stack spacing={2}>
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
                        p={3}
                        border="1px solid"
                        borderColor="border.subtle"
                        rounded="md"
                        flexWrap="wrap"
                        _hover={{ bg: 'orange.50' }}
                        onClick={() => setOpenClaim(e)}
                      >
                        <Box>
                          <HStack spacing={2} mb={0.5}>
                            <Text fontWeight="semibold">{e.title}</Text>
                            <Badge>{kind}</Badge>
                            {kind === 'claim' && e.claim?.tier != null && (
                              <Badge colorScheme="purple">Tier {String(e.claim.tier)}</Badge>
                            )}
                          </HStack>
                          <Text fontSize="xs" color="text.muted">
                            {e.date} · {e.claimStatus || e.verificationStatus || 'pending'}
                          </Text>
                        </Box>
                        <Text fontFamily="mono" fontSize="sm">
                          {kind === 'claim' && Number(e.usdValue)
                            ? formatMoney(Number(e.usdValue))
                            : kind === 'esg'
                              ? 'not valued'
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

        {tab === 'log' && entry === 'activity' && (
          <Box p={5} border="1px solid" borderColor="border.subtle" rounded="xl" bg="surface.default">
            <Heading size="md" mb={1}>
              What did you do
            </Heading>
            <Text fontSize="sm" color="text.secondary" mb={4}>
              Builds your portfolio. No currency value; turning hours into money needs a claim.
            </Text>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <FormControl isRequired>
                <FormLabel>Activity title</FormLabel>
                <Input value={aTitle} onChange={(e) => setATitle(e.target.value)} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Date</FormLabel>
                <Input type="date" value={aDate} onChange={(e) => setADate(e.target.value)} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>LIFT pillar</FormLabel>
                <Select value={aPillar} onChange={(e) => setAPillar(e.target.value)}>
                  {IMPACT_LIFT_PILLARS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Activity type</FormLabel>
                <Select value={aType} onChange={(e) => setAType(e.target.value)}>
                  {IMPACT_ACTIVITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </SimpleGrid>
            <FormControl isRequired mt={4}>
              <FormLabel>What you did and the result</FormLabel>
              <Textarea value={aDesc} onChange={(e) => setADesc(e.target.value)} rows={3} />
            </FormControl>
            <SimpleGrid columns={2} spacing={4} mt={4}>
              <FormControl>
                <FormLabel>People reached</FormLabel>
                <Input
                  type="number"
                  min={0}
                  value={aPeople}
                  onChange={(e) => setAPeople(Number(e.target.value))}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Hours contributed</FormLabel>
                <Input
                  type="number"
                  step={0.25}
                  min={0}
                  value={aHours}
                  onChange={(e) => setAHours(Number(e.target.value))}
                />
              </FormControl>
            </SimpleGrid>
            <Flex mt={6} gap={3} justify="flex-end">
              <Button variant="ghost" onClick={resetEntry} isDisabled={submitting}>
                Cancel
              </Button>
              <Button colorScheme="primary" onClick={() => void saveActivity()} isLoading={submitting}>
                Submit activity
              </Button>
            </Flex>
          </Box>
        )}

        {tab === 'log' && entry === 'esg' && (
          <Box p={5} border="1px solid" borderColor="border.subtle" rounded="xl" bg="surface.default">
            <Heading size="md" mb={1}>
              ESG contribution
            </Heading>
            <Text fontSize="sm" color="text.secondary" mb={4}>
              Recorded in its own units. Never touches the finance register.
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
                <FormLabel>How much</FormLabel>
                <Input type="number" value={eQty} onChange={(e) => setEQty(e.target.value)} />
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
                Send to ESG team
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
                      onClick={() => setClaim((d) => ({ ...d, cat: c.k }))}
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
                              claim.cat === 'rev'
                                ? { ...d, growth: w.k as ImpactGrowthKey }
                                : { ...d, waste: w.k as ImpactWasteKey },
                            )
                          }
                        >
                          {w.n}
                        </Button>
                      </WrapItem>
                    ))}
                  </Wrap>
                </FormControl>
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
                <FormControl isRequired>
                  <FormLabel>Measure name</FormLabel>
                  <Input
                    value={claim.measure}
                    placeholder="e.g. Supplier invoice cycle time, Accounts Payable"
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
                        const units = IMPACT_METRIC_FAMILIES.find((f) => f.k === fam)?.units || ['hours']
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
                    is best. Lock it before continuing.
                  </AlertDescription>
                </Alert>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Months of data</FormLabel>
                    <Select
                      value={String(claim.months)}
                      onChange={(e) => setClaim((d) => ({ ...d, months: Number(e.target.value) }))}
                    >
                      {[0, 1, 2, 3, 6, 9, 12, 18, 24].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Observations</FormLabel>
                    <Input
                      type="number"
                      value={claim.obs}
                      onChange={(e) => setClaim((d) => ({ ...d, obs: Number(e.target.value) }))}
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Baseline value ({claim.unit})</FormLabel>
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
                      claim.obs,
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
                      <option value="Decrease">Decrease</option>
                      <option value="Increase">Increase</option>
                    </Select>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Target value ({claim.unit})</FormLabel>
                    <Input
                      type="number"
                      value={claim.target}
                      onChange={(e) => setClaim((d) => ({ ...d, target: e.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Target date</FormLabel>
                    <Input
                      type="date"
                      value={claim.targetDate}
                      onChange={(e) => setClaim((d) => ({ ...d, targetDate: e.target.value }))}
                    />
                  </FormControl>
                </SimpleGrid>
                <FormControl isRequired>
                  <FormLabel>What you are changing</FormLabel>
                  <Textarea
                    value={claim.intervention}
                    onChange={(e) => setClaim((d) => ({ ...d, intervention: e.target.value }))}
                    rows={3}
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
                <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Window start</FormLabel>
                    <Input
                      type="date"
                      value={claim.wStart}
                      onChange={(e) => setClaim((d) => ({ ...d, wStart: e.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Window end</FormLabel>
                    <Input
                      type="date"
                      value={claim.wEnd}
                      onChange={(e) => setClaim((d) => ({ ...d, wEnd: e.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Complete periods</FormLabel>
                    <Select
                      value={String(claim.windowP)}
                      onChange={(e) => setClaim((d) => ({ ...d, windowP: Number(e.target.value) }))}
                    >
                      {[1, 2, 3, 4, 5, 6, 12].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Select>
                    <FormHelperText>
                      {claim.windowP < 3 ? 'Tier 3 needs 3 or more.' : 'Meets Tier 3 window rule.'}
                    </FormHelperText>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Result ({claim.unit})</FormLabel>
                    <Input
                      type="number"
                      value={claim.post}
                      onChange={(e) => setClaim((d) => ({ ...d, post: e.target.value }))}
                    />
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
                      {live.tier === 1 ? 'No currency value' : formatMoney(live.net)} · Tier {live.tier}
                    </AlertTitle>
                    <AlertDescription fontSize="sm">
                      After submit: measure owner confirms, then finance if the band requires it.
                    </AlertDescription>
                  </Box>
                </Alert>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Who confirms the number</FormLabel>
                    <Input
                      value={claim.ownerV}
                      onChange={(e) => setClaim((d) => ({ ...d, ownerV: e.target.value }))}
                      placeholder="Name of measure owner"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Finance validator (optional)</FormLabel>
                    <Input
                      value={claim.financeV}
                      onChange={(e) => setClaim((d) => ({ ...d, financeV: e.target.value }))}
                      placeholder="Name of finance reviewer"
                    />
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
          <ImpactRegisterPanel
            entries={isAdmin && orgEntries.length ? orgEntries : entries}
            rates={rates}
            onHelp={setHelpKey}
            onOpenClaim={setOpenClaim}
          />
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
            <MenuItem onClick={() => startEntry('claim')}>Claim an improvement</MenuItem>
            <MenuItem onClick={() => startEntry('activity')}>Log an activity</MenuItem>
            <MenuItem onClick={() => startEntry('esg')}>Log an ESG contribution</MenuItem>
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
