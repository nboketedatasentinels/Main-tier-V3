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
  Collapse,
  Flex,
  Heading,
  HStack,
  Icon,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Progress,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import { Info } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import {
  CLAIM_JOURNEY_STEPS,
  DEFAULT_IMPACT_RATES,
  IMPACT_CATS,
  IMPACT_GROWTH,
  IMPACT_WASTES,
  bandNeedsFinance,
  claimInputsFromRecord,
  formatMoney,
  formatMoneyK,
  gradeFromBaseline,
  valuation,
  type ImpactEntryKind,
  type ImpactFamilyKey,
  type ImpactRateCard,
} from '@/config/impactValueEngine'
import type { ImpactHelpKey } from '@/config/impactHelp'
import { CLAIM_FLOW_GROWTH, CLAIM_FLOW_WASTES } from '@/config/impactClaimFlowV4'
import {
  createImpactLog,
  getMyImpactLogLifetimeCount,
  listAllImpactLogs,
  listCompanyImpactLogs,
  listMyImpactLogs,
  type ImpactLogRecord,
} from '@/services/impactLogService'
import { FREE_IMPACT_LOG_LIFETIME_LIMIT, isFreeImpactLogLimitReached } from '@/utils/membership'
import { ImpactUpgradePromptModal } from '@/components/impact/UpgradePromptModal'
import { listImpactValueRates, getShowRatesToLearners } from '@/services/impactRatesService'
import { removeUndefinedFields } from '@/utils/firestore'
import { ImpactHelpButton, ImpactHelpModal } from '@/components/impact/ImpactHelpModal'
import { ImpactClaimDrawer } from '@/components/impact/ImpactClaimDrawer'
import {
  ImpactClaimWizardV4,
  draftFromImpactRecord,
  type ClaimWizardDraft,
  type ClaimWizardSubmitPayload,
} from '@/components/impact/ImpactClaimWizardV4'
import { ImpactValueDashboard } from '@/components/impact/ImpactValueDashboard'
import { ImpactRegisterPanel } from '@/components/impact/ImpactRegisterPanel'
import { ImpactRatesAdmin } from '@/components/impact/ImpactRatesAdmin'
import { ImpactRatesViewer } from '@/components/impact/ImpactRatesViewer'
import { ImpactExportPanel } from '@/components/impact/ImpactExportPanel'
import { ImpactSectorRollup } from '@/components/impact/ImpactSectorRollup'
import { requestClaimConfirmations } from '@/services/impactClaimConfirmationService'
import { LegacyEsgLogForm } from '@/components/impact/LegacyEsgLogForm'

type ViewTab = 'log' | 'dash' | 'register' | 'claims' | 'sector' | 'export'

function familyFromClaimFam(fam: ClaimWizardSubmitPayload['calc']['fam']): ImpactFamilyKey {
  if (fam === 'time') return 'time'
  if (fam === 'people') return 'volume'
  if (fam === 'money') return 'cost'
  if (fam === 'items') return 'quality'
  if (fam === 'revenue') return 'revenue'
  return 'time'
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
  const { user, profile, isAdmin, isSuperAdmin } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<ViewTab>('log')
  const [entries, setEntries] = useState<ImpactLogRecord[]>([])
  const [orgEntries, setOrgEntries] = useState<ImpactLogRecord[]>([])
  const [platformEntries, setPlatformEntries] = useState<ImpactLogRecord[]>([])
  const [rates, setRates] = useState<ImpactRateCard[]>(DEFAULT_IMPACT_RATES)
  const [loading, setLoading] = useState(true)
  const [entry, setEntry] = useState<ImpactEntryKind | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [helpKey, setHelpKey] = useState<ImpactHelpKey | null>(null)
  const [openClaim, setOpenClaim] = useState<ImpactLogRecord | null>(null)
  const [claimDraft, setClaimDraft] = useState<ClaimWizardDraft | null>(null)
  const [showJourney, setShowJourney] = useState(false)
  const [showRatesToLearners, setShowRatesToLearnersState] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [lifetimeCount, setLifetimeCount] = useState(0)

  const displayName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ||
    profile?.email?.split('@')[0] ||
    'You'

  const impactGateReached = isFreeImpactLogLimitReached(profile, lifetimeCount)

  const assertCanCreateImpactLog = async (): Promise<boolean> => {
    if (!user?.uid) return false
    // Always read live count — stale local state was letting free users open the form.
    let live = lifetimeCount
    try {
      live = await getMyImpactLogLifetimeCount(user.uid)
      setLifetimeCount(live)
    } catch (err) {
      console.warn('[ImpactLogV2] lifetime count check failed', err)
      setUpgradeOpen(true)
      return false
    }
    if (isFreeImpactLogLimitReached(profile, live)) {
      setUpgradeOpen(true)
      return false
    }
    return true
  }

  const reload = async () => {
    if (!user?.uid) return
    setLoading(true)
    try {
      const [mine, rateRows, lifetime] = await Promise.all([
        listMyImpactLogs(user.uid),
        listImpactValueRates(profile?.companyId),
        getMyImpactLogLifetimeCount(user.uid),
      ])
      setEntries(mine)
      setRates(rateRows)
      setLifetimeCount(lifetime)
      if (profile?.companyId) {
        const org = await listCompanyImpactLogs(profile.companyId)
        setOrgEntries(org)
      } else {
        setOrgEntries([])
      }
      if (isSuperAdmin) {
        try {
          setPlatformEntries(await listAllImpactLogs())
        } catch (err) {
          console.warn('[ImpactLogV2] platform rollup load failed', err)
          setPlatformEntries([])
        }
      } else {
        setPlatformEntries([])
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

  // If they already burned the free allowance, open the upgrade prompt once loaded.
  useEffect(() => {
    if (!loading && impactGateReached && tab === 'log' && !entry) {
      setUpgradeOpen(true)
    }
    // Only when gate flips true / first load — not every tab change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, impactGateReached])

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
  const orgByCat = useMemo(() => {
    const pool = (orgEntries.length ? orgEntries : entries).filter(isValidatedClaim)
    return IMPACT_CATS.map((c) => {
      const v = pool
        .filter((e) => e.claim?.cat === c.k && (e.claim?.bucket as string) !== 'capacity')
        .reduce((s, e) => {
          const inputs = claimInputsFromRecord(e)
          return s + (inputs ? valuation(inputs, rates).net : Number(e.usdValue || 0))
        }, 0)
      return { ...c, v }
    })
  }, [orgEntries, entries, rates])
  const orgCatMax = Math.max(1, ...orgByCat.map((c) => c.v))
  const cohortMoney = orgStats.money
  const pctMe = cohortMoney ? (meStats.money / cohortMoney) * 100 : 0

  const resetEntry = () => {
    setEntry(null)
    setClaimDraft(null)
  }

  const startEntry = async (kind: ImpactEntryKind) => {
    if (!(await assertCanCreateImpactLog())) return
    setClaimDraft(null)
    setEntry(kind)
    setTab('log')
  }

  const duplicateClaim = async (record: ImpactLogRecord) => {
    if (!(await assertCanCreateImpactLog())) return
    setOpenClaim(null)
    setClaimDraft(draftFromImpactRecord(record))
    setEntry('claim')
    setTab('log')
  }

  const submitClaim = async (payload: ClaimWizardSubmitPayload) => {
    if (!user?.uid) return
    if (!(await assertCanCreateImpactLog())) return
    const ownerEmail = payload.ownerEmail.trim().toLowerCase()
    const financeEmail = payload.financeEmail.trim().toLowerCase()
    const needsFinance = bandNeedsFinance(payload.calc.net)
    const wasteOrGrowth =
      payload.cat === 'rev'
        ? CLAIM_FLOW_GROWTH.find((g) => g.k === payload.growth)?.n ||
          IMPACT_GROWTH.find((g) => g.k === payload.growth)?.n
        : CLAIM_FLOW_WASTES.find((w) => w.k === payload.waste)?.n ||
          IMPACT_WASTES.find((w) => w.k === payload.waste)?.n
    const businessCategory =
      payload.cat === 'cost'
        ? 'Cost Savings'
        : payload.cat === 'eff'
          ? 'Efficiency Gains'
          : 'Revenue Growth'
    const family = familyFromClaimFam(payload.calc.fam)
    const grade = gradeFromBaseline(
      payload.months,
      payload.months,
      payload.lockedBefore,
      payload.evidence,
    )
    const industry = profile?.companyName?.trim() || 'Unassigned sector'

    setSubmitting(true)
    try {
      const created = await createImpactLog(
        removeUndefinedFields({
          userId: user.uid,
          companyId: profile?.companyId,
          sourcePlatform: 'transformation_tier',
          title: payload.measureName.trim(),
          description: payload.intervention || payload.measureName,
          categoryGroup: 'business',
          entryKind: 'claim',
          businessCategory,
          businessActivity: wasteOrGrowth,
          activityType: payload.presetId || 'Custom',
          liftPillars: [],
          date: payload.windowTo || format(new Date(), 'yyyy-MM-dd'),
          hours:
            family === 'time'
              ? Math.abs(payload.before - payload.after) * (payload.count || 1)
              : 0,
          peopleImpacted: family === 'volume' ? Math.abs(payload.before - payload.after) : 0,
          usdValue: 0,
          usdValueSource: 'auto',
          verificationLevel: 'Tier 1: Self-Reported',
          verificationStatus: 'pending',
          claimStatus: 'Submitted',
          verifierName: payload.ownerName.trim(),
          verifierEmail: ownerEmail,
          evidenceLink: payload.valueEvidenceLink || payload.evidenceRef || undefined,
          needsFinance,
          ownerEmail,
          financeName: payload.financeName.trim() || undefined,
          financeEmail: needsFinance ? financeEmail : undefined,
          claim: {
            family,
            unit: payload.unit,
            base: payload.before,
            post: payload.after,
            occ: payload.count || 1,
            rateId: rates[0]?.id,
            attribution: 100,
            realization: payload.realized ? 1 : 0.5,
            implCost: 0,
            months: payload.months,
            obs: payload.months,
            lockedBefore: payload.lockedBefore,
            source: payload.evidence,
            evidence: payload.evidenceRef ? payload.evidence : '',
            owner: payload.ownerName.trim(),
            finance: payload.financeName.trim() || undefined,
            windowP: payload.periods,
            recurrence: 'Ongoing',
            sustain90: payload.sustained ? 'Holding' : 'Not yet due',
            tier: 1,
            indicativeTier: 2,
            grade,
            gross: Math.round(payload.calc.gross),
            net: Math.round(payload.moneyGained || payload.calc.net),
            bucket: payload.calc.bucket,
            conf: payload.realized ? 1 : 0.5,
            cat: payload.cat,
            waste: payload.waste,
            growth: payload.growth,
            measure: payload.measureName,
            formula: payload.calc.basis,
            scope: payload.where || 'unnamed',
            window: payload.windowLabel,
            intervention: payload.intervention,
            target: payload.target,
            goalDir: payload.goalDir,
            moneyGained: payload.moneyGained,
            valueEvidenceLink: payload.valueEvidenceLink || undefined,
            evidenceType: payload.evidence,
            presetId: payload.presetId,
            industry,
            locked: payload.locked,
          },
          points: 0,
          impactValue: 0,
          scp: 0,
          verificationMultiplier: payload.realized ? 1 : 0.5,
          auditTrail: [
            `${new Date().toISOString().slice(0, 16)} · submitted · confirmation emailed to measure owner`,
          ],
        }) as Parameters<typeof createImpactLog>[0],
      )

      const confirm = await requestClaimConfirmations({
        impactLogId: created.id,
        measureTitle: payload.measureName.trim(),
        net: payload.calc.net,
        tier: 2,
        bucket: payload.calc.bucket,
        ownerName: payload.ownerName.trim(),
        ownerEmail,
        financeName: payload.financeName.trim() || undefined,
        financeEmail: needsFinance ? financeEmail : undefined,
        learnerName: displayName,
        learnerEmail: profile?.email || user.email || null,
        organizationName: profile?.companyName || null,
        evidenceRef: payload.evidenceRef || undefined,
        valueEvidenceLink: payload.valueEvidenceLink || undefined,
        source: payload.evidence || undefined,
        window: payload.windowLabel,
      })

      toast({
        status: confirm.ownerEmailed ? 'success' : 'warning',
        title: confirm.ownerEmailed
          ? 'Claim submitted - confirmation email sent'
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
      const message = err instanceof Error ? err.message : 'Try again'
      if (message.includes('impact_log_free_limit_reached')) {
        setUpgradeOpen(true)
        toast({
          status: 'warning',
          title: 'Your free Impact Log is full',
          description:
            "Two entries is your free chapter. Upgrade to Impact Log Pro (~$5/mo) so the story doesn't stop here.",
        })
      } else {
        toast({
          status: 'error',
          title: 'Could not submit claim',
          description: message,
        })
      }
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

  return (
    <Box>
      <Box
        position="sticky"
        top={0}
        zIndex={20}
        bg="surface.default"
        boxShadow="sm"
      >
        <Flex
          gap={1}
          overflowX="auto"
          borderBottom="1px solid"
          borderColor="border.subtle"
          bg="surface.default"
          px={2}
          mb={0}
        >
          {navBtn('log', 'Log impact')}
          {navBtn('dash', 'Your savings')}
          {isAdmin && navBtn('register', 'Value register')}
          {navBtn('claims', 'Claims ledger')}
          {isSuperAdmin && navBtn('sector', 'By sector')}
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
              py={{ base: 3, md: 4 }}
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
              <HStack spacing={2} mb={1} position="relative">
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
              <Heading size="sm" mb={0} color="white" fontWeight="semibold" position="relative">
                Log what changed, and what it added up to
              </Heading>
            </Box>

            {/* Primary actions — outlined cards (label · title · short body) */}
            <Box
              px={{ base: 3, md: 4 }}
              py={3}
              borderBottom="1px solid"
              borderColor="border.subtle"
              bg="surface.default"
            >
              <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                <Box
                  as="button"
                  type="button"
                  textAlign="left"
                  p={{ base: 4, md: 5 }}
                  rounded="xl"
                  bg="white"
                  border="2px solid"
                  borderColor="#350e6f"
                  boxShadow="none"
                  transition="transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease"
                  _hover={{ transform: 'translateY(-1px)', boxShadow: 'sm', bg: 'purple.50' }}
                  _active={{ transform: 'translateY(0)' }}
                  onClick={() => {
                    void startEntry('claim')
                  }}
                >
                  <Text
                    fontSize="10px"
                    fontWeight="bold"
                    textTransform="uppercase"
                    letterSpacing="0.1em"
                    color="#350e6f"
                    mb={1}
                  >
                    Improvement claim
                  </Text>
                  <Text
                    fontSize={{ base: 'lg', md: 'xl' }}
                    fontWeight="800"
                    letterSpacing="-0.02em"
                    color="#27062e"
                  >
                    {impactGateReached ? 'Upgrade · Log improvement' : 'Log improvement'}
                  </Text>
                  <Text fontSize="sm" color="gray.600" mt={2} lineHeight="1.45" maxW="36ch">
                    Before / after with evidence. Measure owner confirms before approved $.
                  </Text>
                </Box>

                <Box
                  as="button"
                  type="button"
                  textAlign="left"
                  p={{ base: 4, md: 5 }}
                  rounded="xl"
                  bg="white"
                  border="2px solid"
                  borderColor="#f4540c"
                  boxShadow="none"
                  transition="transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease"
                  _hover={{ transform: 'translateY(-1px)', boxShadow: 'sm', bg: 'orange.50' }}
                  _active={{ transform: 'translateY(0)' }}
                  onClick={() => {
                    void startEntry('esg')
                  }}
                >
                  <Text
                    fontSize="10px"
                    fontWeight="bold"
                    textTransform="uppercase"
                    letterSpacing="0.1em"
                    color="#f4540c"
                    mb={1}
                  >
                    ESG contribution
                  </Text>
                  <Text
                    fontSize={{ base: 'lg', md: 'xl' }}
                    fontWeight="800"
                    letterSpacing="-0.02em"
                    color="#27062e"
                  >
                    {impactGateReached ? 'Upgrade · Log ESG' : 'Log ESG'}
                  </Text>
                  <Text fontSize="sm" color="gray.600" mt={2} lineHeight="1.45" maxW="36ch">
                    Env / social / governance in its own bucket — separate from dollar claims.
                  </Text>
                </Box>
              </SimpleGrid>

              <Flex justify="flex-end" mt={2}>
                <Button
                  size="sm"
                  variant="ghost"
                  color="gray.600"
                  leftIcon={<Icon as={Info} boxSize={3.5} />}
                  onClick={() => setShowJourney((v) => !v)}
                  aria-expanded={showJourney}
                >
                  {showJourney ? 'Hide steps' : 'How a claim moves'}
                </Button>
              </Flex>
            </Box>

            <Collapse in={showJourney} animateOpacity>
              <SimpleGrid
                columns={{ base: 1, sm: 2, md: 3 }}
                spacing={2}
                px={{ base: 3, md: 4 }}
                py={3}
                bg="surface.subtle"
                borderBottom="1px solid"
                borderColor="border.subtle"
              >
                {CLAIM_JOURNEY_STEPS.map(([num, title, desc]) => (
                  <Box key={num} p={2.5} rounded="md" bg="surface.default">
                    <Text fontSize="xs" color="brand.accent" fontWeight="bold" mb={0.5}>
                      {num}
                    </Text>
                    <Text fontWeight="semibold" fontSize="sm" mb={0.5}>
                      {title}
                    </Text>
                    <Text fontSize="xs" color="text.secondary" lineHeight="1.4">
                      {desc}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>
            </Collapse>

            {impactGateReached && (
              <Alert status="warning" borderRadius={0} py={2}>
                <AlertIcon />
                <Box flex="1">
                  <AlertTitle fontSize="sm">Free chapter complete</AlertTitle>
                  <AlertDescription fontSize="xs">
                    Both free entries used. Upgrade to Impact Log Pro (~$5/mo) to keep logging.
                  </AlertDescription>
                </Box>
                <Button size="sm" colorScheme="orange" onClick={() => setUpgradeOpen(true)}>
                  Upgrade
                </Button>
              </Alert>
            )}

            <SimpleGrid
              columns={{ base: 1, md: 3 }}
              spacing={0}
              borderBottom="1px solid"
              borderColor="border.subtle"
              bg="surface.default"
            >
              {(() => {
                const pipelineEntries = entries.filter(
                  (e) => entryKindOf(e) === 'claim' && Number(e.claim?.tier) === 2,
                )
                const pipelineMoney = pipelineEntries.reduce(
                  (s, e) => s + Number(e.usdValue || 0),
                  0,
                )
                const pipelineHours = pipelineEntries.reduce((s, e) => s + Number(e.hours || 0), 0)
                const pipelinePeople = pipelineEntries.reduce(
                  (s, e) => s + Number(e.peopleImpacted || 0),
                  0,
                )
                const Metric = ({
                  value,
                  label,
                  muted,
                  accent,
                }: {
                  value: string
                  label: string
                  muted?: boolean
                  accent?: boolean
                }) => (
                  <Box minW={0}>
                    <Text
                      fontSize={{ base: 'lg', md: 'xl' }}
                      fontWeight="800"
                      color={accent ? 'brand.primary' : muted ? 'gray.400' : '#27062e'}
                      lineHeight="1.1"
                      letterSpacing="-0.02em"
                      noOfLines={1}
                    >
                      {value}
                    </Text>
                    <Text
                      fontSize="xs"
                      fontWeight="600"
                      color={accent ? 'purple.700' : 'gray.500'}
                      mt={0.5}
                    >
                      {label}
                    </Text>
                  </Box>
                )
                return (
                  <>
                    <Box
                      p={{ base: 3, md: 4 }}
                      borderRight={{ md: '1px solid' }}
                      borderColor="border.subtle"
                    >
                      <Text
                        fontSize="xs"
                        textTransform="uppercase"
                        color="text.muted"
                        fontWeight="bold"
                        letterSpacing="0.06em"
                      >
                        You · {displayName.split(' ')[0]}
                      </Text>
                      <SimpleGrid columns={3} spacing={2} mt={2}>
                        <Metric
                          value={meStats.hours.toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })}
                          label="hrs"
                        />
                        <Metric value={meStats.peopleReached.toLocaleString()} label="people" />
                        <Metric
                          value={formatMoney(meStats.money)}
                          label="value"
                          muted={meStats.money <= 0}
                        />
                      </SimpleGrid>
                      <Text fontSize="xs" color="gray.600" mt={2}>
                        {meStats.claims} claim{meStats.claims === 1 ? '' : 's'}
                        {meStats.esg ? ` · ${meStats.esg} ESG` : ''}
                        {pctMe > 0 ? ` · ${pctMe.toFixed(0)}% of org` : ''}
                      </Text>
                    </Box>

                    <Popover trigger="hover" placement="bottom" openDelay={200} gutter={8}>
                      <PopoverTrigger>
                        <Box
                          as="button"
                          type="button"
                          textAlign="left"
                          w="100%"
                          p={{ base: 3, md: 4 }}
                          borderRight={{ md: '1px solid' }}
                          borderColor="border.subtle"
                          cursor="pointer"
                          _hover={{ bg: 'orange.50' }}
                          transition="background 0.15s ease"
                        >
                          <Flex justify="space-between" align="center">
                            <Text
                              fontSize="xs"
                              textTransform="uppercase"
                              color="text.muted"
                              fontWeight="bold"
                              letterSpacing="0.06em"
                            >
                              Organisation
                            </Text>
                            <Text fontSize="10px" color="brand.accent" fontWeight="semibold">
                              Hover for chart
                            </Text>
                          </Flex>
                          <SimpleGrid columns={3} spacing={2} mt={2}>
                            <Metric
                              value={orgStats.hours.toLocaleString(undefined, {
                                maximumFractionDigits: 1,
                              })}
                              label="hrs"
                            />
                            <Metric
                              value={orgStats.peopleReached.toLocaleString()}
                              label="people"
                            />
                            <Metric
                              value={formatMoney(orgStats.money)}
                              label="value"
                              muted={orgStats.money <= 0}
                            />
                          </SimpleGrid>
                          <Text fontSize="xs" color="gray.600" mt={2}>
                            {orgStats.claims} claim{orgStats.claims === 1 ? '' : 's'}
                            {orgStats.esg ? ` · ${orgStats.esg} ESG` : ''}
                            {orgStats.people ? ` · ${orgStats.people} people` : ''}
                          </Text>
                        </Box>
                      </PopoverTrigger>
                      <PopoverContent
                        w="280px"
                        borderColor="border.subtle"
                        boxShadow="lg"
                        _focus={{ outline: 'none' }}
                      >
                        <PopoverArrow />
                        <PopoverHeader fontSize="xs" fontWeight="bold" border="0" pb={1}>
                          Org value by category
                        </PopoverHeader>
                        <PopoverBody pt={1} pb={3}>
                          {orgByCat.every((c) => c.v <= 0) ? (
                            <Text fontSize="sm" color="text.secondary">
                              No approved org value yet.
                            </Text>
                          ) : (
                            <Stack spacing={2.5}>
                              {orgByCat.map((c) => (
                                <Box key={c.k}>
                                  <Flex justify="space-between" fontSize="xs" mb={1}>
                                    <Text fontWeight="medium">{c.n}</Text>
                                    <Text fontFamily="mono">{formatMoneyK(c.v)}</Text>
                                  </Flex>
                                  <Progress
                                    value={(c.v / orgCatMax) * 100}
                                    size="sm"
                                    colorScheme="purple"
                                    rounded="full"
                                  />
                                </Box>
                              ))}
                            </Stack>
                          )}
                        </PopoverBody>
                      </PopoverContent>
                    </Popover>

                    <Box p={{ base: 3, md: 4 }} bg="tint.brandPrimary">
                      <Text
                        fontSize="xs"
                        textTransform="uppercase"
                        color="brand.primary"
                        fontWeight="bold"
                        letterSpacing="0.06em"
                      >
                        Pipeline
                      </Text>
                      <SimpleGrid columns={3} spacing={2} mt={2}>
                        <Metric
                          value={pipelineHours.toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })}
                          label="hrs"
                          accent
                        />
                        <Metric value={pipelinePeople.toLocaleString()} label="people" accent />
                        <Metric
                          value={formatMoney(pipelineMoney)}
                          label="indicative"
                          accent
                          muted={pipelineMoney <= 0}
                        />
                      </SimpleGrid>
                      <Text fontSize="xs" color="purple.800" mt={2}>
                        Indicative only · awaiting approval
                      </Text>
                    </Box>
                  </>
                )
              })()}
            </SimpleGrid>
          </>
        )}
      </Box>

      <Box
        maxW="1140px"
        mx="auto"
        px={{ base: 4, md: 5 }}
        py={tab === 'log' && !entry ? 0 : 4}
      >
        {loading && (
          <Flex align="center" gap={3} py={8}>
            <Spinner size="sm" />
            <Text color="text.secondary">Loading impact log…</Text>
          </Flex>
        )}

        {tab === 'log' && entry === 'esg' && (
          <LegacyEsgLogForm
            onCancel={resetEntry}
            onFreeLimitReached={() => {
              resetEntry()
              setUpgradeOpen(true)
            }}
            onSaved={async () => {
              resetEntry()
              await reload()
            }}
          />
        )}

        {tab === 'log' && entry === 'claim' && (
          <ImpactClaimWizardV4
            rates={rates}
            submitting={submitting}
            initialDraft={claimDraft}
            onCancel={resetEntry}
            onSubmit={submitClaim}
          />
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
                    your organisation also get an email confirm link - both paths update the same
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

        {tab === 'sector' && isSuperAdmin && (
          <ImpactSectorRollup
            entries={
              platformEntries.length
                ? platformEntries
                : orgEntries.length
                  ? orgEntries
                  : entries
            }
            onHelp={setHelpKey}
          />
        )}

        {tab === 'export' && (
          <ImpactExportPanel
            entries={isAdmin && orgEntries.length ? orgEntries : entries}
            rates={rates}
            user={user}
            profile={profile}
            exportLocked={impactGateReached && lifetimeCount >= FREE_IMPACT_LOG_LIFETIME_LIMIT}
            onRequestUpgrade={() => setUpgradeOpen(true)}
          />
        )}
      </Box>

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
      <ImpactUpgradePromptModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature="Impact Log Pro"
        title="Your free chapter ends here. The story doesn't have to."
        benefits={[
          'Unlimited Impact Log entries from here on',
          'PDF and CSV export for stakeholders',
          'Verifier workflow without the free-tier wall',
          'Cancel anytime. Your past logs stay yours',
        ]}
        ctaText="Continue with Impact Log Pro"
      />
      <ImpactClaimDrawer
        entry={openClaim}
        rates={rates}
        canModerate={Boolean(isAdmin)}
        onClose={() => setOpenClaim(null)}
        onChanged={() => {
          void reload()
          setOpenClaim(null)
        }}
        onDuplicate={(record) => {
          void duplicateClaim(record)
        }}
      />
    </Box>
  )
}

export default ImpactLogV2
