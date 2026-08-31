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
  IMPACT_ESG_PILLARS,
  IMPACT_GROWTH,
  IMPACT_WASTES,
  bandNeedsFinance,
  formatMoney,
  gradeFromBaseline,
  type ImpactEntryKind,
  type ImpactFamilyKey,
  type ImpactRateCard,
} from '@/config/impactValueEngine'
import type { ImpactHelpKey } from '@/config/impactHelp'
import { CLAIM_FLOW_GROWTH, CLAIM_FLOW_WASTES } from '@/config/impactClaimFlowV4'
import { computeEsgUsdValue, resolveEsgRate, VOLUNTEER_HOURLY_RATE } from '@/config/esgImpactRates'
import {
  createImpactLog,
  listAllImpactLogs,
  listCompanyImpactLogs,
  listMyImpactLogs,
  type ImpactLogRecord,
} from '@/services/impactLogService'
import { listImpactValueRates, getShowRatesToLearners } from '@/services/impactRatesService'
import { removeUndefinedFields } from '@/utils/firestore'
import { ImpactHelpButton, ImpactHelpModal } from '@/components/impact/ImpactHelpModal'
import { ImpactClaimDrawer } from '@/components/impact/ImpactClaimDrawer'
import {
  ImpactClaimWizardV4,
  type ClaimWizardSubmitPayload,
} from '@/components/impact/ImpactClaimWizardV4'
import { ImpactValueDashboard } from '@/components/impact/ImpactValueDashboard'
import { ImpactWastePanel } from '@/components/impact/ImpactWastePanel'
import { ImpactRegisterPanel } from '@/components/impact/ImpactRegisterPanel'
import { ImpactRatesAdmin } from '@/components/impact/ImpactRatesAdmin'
import { ImpactRatesViewer } from '@/components/impact/ImpactRatesViewer'
import { ImpactExportPanel } from '@/components/impact/ImpactExportPanel'
import { ImpactSectorRollup } from '@/components/impact/ImpactSectorRollup'
import { requestClaimConfirmations } from '@/services/impactClaimConfirmationService'

type ViewTab = 'log' | 'dash' | 'waste' | 'register' | 'claims' | 'sector' | 'export'

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
  const [showJourney, setShowJourney] = useState(false)
  const [showRatesToLearners, setShowRatesToLearnersState] = useState(false)

  // ESG draft
  const [ePillar, setEPillar] = useState<'env' | 'soc' | 'gov'>('env')
  const [eMetric, setEMetric] = useState(IMPACT_ESG_PILLARS[0].items[0])
  const [eQty, setEQty] = useState('')
  const [eNote, setENote] = useState('')
  const [eDate, setEDate] = useState(format(new Date(), 'yyyy-MM-dd'))


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

  const submitClaim = async (payload: ClaimWizardSubmitPayload) => {
    if (!user?.uid) return
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
          evidenceLink: payload.evidenceRef || undefined,
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
            net: Math.round(payload.calc.net),
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
          <ImpactClaimWizardV4
            rates={rates}
            submitting={submitting}
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
