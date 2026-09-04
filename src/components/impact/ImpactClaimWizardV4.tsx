/**
 * Impact claim wizard v4 - Chakra port of Desktop/T4L_Claim_Flow_v4.html.
 */
import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Textarea,
  useToast,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import { format, subMonths } from 'date-fns'
import type { ImpactRateCard } from '@/config/impactValueEngine'
import {
  CLAIM_FLOW_CATS,
  CLAIM_FLOW_GROWTH,
  CLAIM_FLOW_HELP,
  CLAIM_FLOW_STEPS,
  CLAIM_FLOW_UNITS,
  CLAIM_FLOW_WASTES,
  calcClaimFlow,
  formatMoneyFlow,
  goalSuggestion,
  isAfterInGoalDirection,
  presetOf,
  presetsFor,
  resolveGoalDirection,
  suggestedGoal,
  type ClaimFlowCat,
  type ClaimFlowFam,
  type ClaimFlowHelpKey,
  type GoalDirection,
  type ClaimPreset,
} from '@/config/impactClaimFlowV4'
import { listOrgPeers } from '@/services/supabasePeerService'
import { getDisplayName } from '@/utils/displayName'
import { normalizeEmail } from '@/utils/email'
import { useAuth } from '@/hooks/useAuth'

const PURPLE = '#350e6f'
const EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/
const MONTH_OPTS = [
  { value: 12, label: '12 months' },
  { value: 8, label: '6 to 11 months' },
  { value: 4, label: '3 to 5 months' },
  { value: 2, label: 'Less than 3 months' },
  { value: 0, label: 'Just my memory' },
]
const PERIOD_OPTS = [1, 2, 3, 4, 6, 12]

export type ClaimWizardDraft = {
  step: number
  cat: ClaimFlowCat
  waste: string
  growth: string
  preset: string | null
  name: string
  where: string
  unit: string
  fam: ClaimFlowFam
  before: string
  after: string
  count: string
  months: number
  lockedBefore: boolean
  locked: boolean
  evidenceRef: string
  evidence: string
  /** Learner estimate of USD gained/saved per month from this change. */
  moneyGained: string
  /** Optional link to how they worked the money figure out. */
  valueEvidenceLink: string
  target: string
  /** Desired movement from baseline: increase (up) or decrease (down). */
  goalDir: GoalDirection | null
  intervention: string
  periods: number
  ownerName: string
  ownerEmail: string
  financeName: string
  financeEmail: string
  realized: boolean
  attest: boolean
  sustained: boolean
}

export type ClaimWizardSubmitPayload = {
  cat: ClaimFlowCat
  waste: string
  growth: string
  presetId: string | null
  measureName: string
  where: string
  unit: string
  before: number
  after: number
  count: number
  months: number
  periods: number
  lockedBefore: boolean
  locked: boolean
  evidenceRef: string
  evidence: string
  moneyGained: number
  valueEvidenceLink: string
  target: number
  goalDir: GoalDirection
  intervention: string
  ownerName: string
  ownerEmail: string
  financeName: string
  financeEmail: string
  realized: boolean
  attest: boolean
  sustained: boolean
  calc: {
    net: number
    gross: number
    bucket: 'cash' | 'avoidance' | 'capacity'
    basis: string
    fam: ClaimFlowFam | null
  }
  windowFrom: string
  windowTo: string
  windowLabel: string
}

type Props = {
  rates: ImpactRateCard[]
  submitting: boolean
  onCancel: () => void
  onSubmit: (payload: ClaimWizardSubmitPayload) => Promise<void>
  /** Prefill from an existing claim (duplicate for new impact). */
  initialDraft?: ClaimWizardDraft | null
}

const nn = (v: string | number | null | undefined) => {
  const x = Number(String(v ?? '').replace(/[, ]/g, ''))
  return Number.isFinite(x) ? x : 0
}
const f1 = (v: string | number) =>
  Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })

// eslint-disable-next-line react-refresh/only-export-components -- blank draft helper for parents
export function blankClaimWizardDraft(): ClaimWizardDraft {
  return {
    step: 1,
    cat: 'eff',
    waste: 'waiting',
    growth: 'retain',
    preset: null,
    name: '',
    where: '',
    unit: '',
    fam: 'time',
    before: '',
    after: '',
    count: '',
    months: 12,
    lockedBefore: true,
    locked: false,
    evidenceRef: '',
    evidence: '',
    moneyGained: '',
    valueEvidenceLink: '',
    target: '',
    goalDir: null,
    intervention: '',
    periods: 3,
    ownerName: '',
    ownerEmail: '',
    financeName: '',
    financeEmail: '',
    realized: false,
    attest: false,
    sustained: true,
  }
}

/** Build a wizard draft from a saved claim so the learner can duplicate and tweak. */
// eslint-disable-next-line react-refresh/only-export-components -- helper for Impact Log parent
export function draftFromImpactRecord(entry: {
  title?: string
  description?: string
  evidenceLink?: string
  claim?: Record<string, unknown> | null
}): ClaimWizardDraft {
  const c = entry.claim || {}
  const cat = (c.cat as ClaimFlowCat) || 'eff'
  const storedFamily = String(c.family || '')
  const fam: ClaimFlowFam =
    storedFamily === 'volume' || storedFamily === 'people'
      ? 'people'
      : storedFamily === 'cost' || storedFamily === 'money'
        ? 'money'
        : storedFamily === 'quality' || storedFamily === 'items'
          ? 'items'
          : storedFamily === 'revenue'
            ? 'revenue'
            : storedFamily === 'time'
              ? 'time'
              : 'time'
  const goalRaw = c.goalDir
  const goalDir: GoalDirection | null =
    goalRaw === 'up' || goalRaw === 'down'
      ? goalRaw
      : goalRaw === 'increase'
        ? 'up'
        : goalRaw === 'decrease'
          ? 'down'
          : null
  const presetId = typeof c.presetId === 'string' && c.presetId ? c.presetId : 'CUSTOM'

  return {
    ...blankClaimWizardDraft(),
    step: 2,
    cat,
    waste: String(c.waste || 'waiting'),
    growth: String(c.growth || 'retain'),
    preset: presetId,
    name: String(entry.title || c.measure || '').trim(),
    where: String(c.scope || ''),
    unit: String(c.unit || ''),
    fam,
    before: c.base != null ? String(c.base) : '',
    after: c.post != null ? String(c.post) : '',
    count: c.occ != null ? String(c.occ) : '',
    months: Number(c.months || 12) || 12,
    lockedBefore: c.lockedBefore !== false,
    locked: Boolean(c.locked),
    evidenceRef: String(c.evidence || entry.evidenceLink || ''),
    evidence: String(c.source || c.evidenceType || ''),
    moneyGained: c.moneyGained != null && Number(c.moneyGained) ? String(c.moneyGained) : '',
    valueEvidenceLink: String(c.valueEvidenceLink || entry.evidenceLink || ''),
    target: c.target != null ? String(c.target) : '',
    goalDir,
    intervention: String(c.intervention || entry.description || ''),
    periods: Number(c.windowP || 3) || 3,
    // Fresh confirmation contacts for the new claim
    ownerName: '',
    ownerEmail: '',
    financeName: '',
    financeEmail: '',
    realized: false,
    attest: false,
    sustained: true,
  }
}

function HelpBtn({ k, onOpen }: { k: ClaimFlowHelpKey; onOpen: (k: ClaimFlowHelpKey) => void }) {
  return (
    <Button
      aria-label="Help"
      size="xs"
      minW="17px"
      h="17px"
      p={0}
      ml={1}
      borderRadius="full"
      bg={PURPLE}
      color="white"
      fontSize="10px"
      fontWeight="700"
      _hover={{ transform: 'scale(1.1)', bg: '#4a148c' }}
      onClick={() => onOpen(k)}
    >
      ?
    </Button>
  )
}

function Note({
  variant = 'gold',
  title,
  children,
}: {
  variant?: 'gold' | 'good' | 'info' | 'warn' | 'bad'
  title: string
  children: React.ReactNode
}) {
  const map = {
    gold: { border: 'brand.gold', bg: 'orange.50' },
    good: { border: 'green.500', bg: 'green.50' },
    info: { border: 'blue.500', bg: 'blue.50' },
    warn: { border: 'yellow.500', bg: 'yellow.50' },
    bad: { border: 'red.500', bg: 'red.50' },
  }[variant]
  return (
    <Box borderLeft="3px solid" borderColor={map.border} bg={map.bg} px={3} py={2} roundedRight="md" fontSize="sm" mb={3}>
      <Text fontWeight="semibold" mb={1}>
        {title}
      </Text>
      <Text color="text.secondary">{children}</Text>
    </Box>
  )
}

function Chip({
  on,
  onClick,
  children,
}: {
  on?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      borderRadius="full"
      h="auto"
      py={2}
      px={3.5}
      whiteSpace="normal"
      textAlign="left"
      fontWeight="600"
      bg={on ? PURPLE : 'white'}
      color={on ? 'white' : 'black'}
      borderWidth="1px"
      borderColor={on ? PURPLE : 'gray.300'}
      _hover={{
        borderColor: PURPLE,
        color: on ? 'white' : 'black',
        bg: on ? '#4a148c' : 'purple.50',
      }}
      sx={{
        '& *': { color: 'inherit !important' },
      }}
    >
      {children}
    </Button>
  )
}

function Bold({ children, purple }: { children: React.ReactNode; purple?: boolean }) {
  return (
    <Text as="span" fontWeight="700" color={purple ? PURPLE : 'black'}>
      {children}
    </Text>
  )
}

function CardPick({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Box
      as="button"
      type="button"
      w="100%"
      textAlign="left"
      p={3}
      rounded="lg"
      borderWidth="1.5px"
      borderColor={on ? PURPLE : 'gray.200'}
      bg={on ? 'purple.50' : 'white'}
      boxShadow={on ? '0 0 0 3px rgba(39,6,46,.08)' : undefined}
      onClick={onClick}
      _hover={{ borderColor: on ? PURPLE : 'gray.400' }}
      transition="all 0.15s"
    >
      {children}
    </Box>
  )
}

type OrgMemberOption = {
  id: string
  name: string
  email: string
}

export const ImpactClaimWizardV4: React.FC<Props> = ({
  rates,
  submitting,
  onCancel,
  onSubmit,
  initialDraft = null,
}) => {
  const toast = useToast()
  const { user } = useAuth()
  const [draft, setDraft] = useState<ClaimWizardDraft>(() =>
    initialDraft ? { ...initialDraft } : blankClaimWizardDraft(),
  )
  const [helpKey, setHelpKey] = useState<ClaimFlowHelpKey | null>(null)
  const [orgMembers, setOrgMembers] = useState<OrgMemberOption[]>([])
  const [orgMembersLoading, setOrgMembersLoading] = useState(true)
  const [orgMembersError, setOrgMembersError] = useState<string | null>(null)
  const patch = (partial: Partial<ClaimWizardDraft>) => setDraft((d) => ({ ...d, ...partial }))

  useEffect(() => {
    if (initialDraft) setDraft({ ...initialDraft })
  }, [initialDraft])

  useEffect(() => {
    let cancelled = false
    setOrgMembersLoading(true)
    setOrgMembersError(null)
    void (async () => {
      try {
        const peers = await listOrgPeers({ includeSelf: false })
        if (cancelled) return
        const myEmail = normalizeEmail(user?.email || '')
        const options = peers
          .map((peer) => {
            const email = normalizeEmail(String(peer.email || ''))
            if (!email || (myEmail && email === myEmail)) return null
            return {
              id: String(peer.id || email),
              name: getDisplayName(
                {
                  fullName: peer.fullName as string | undefined,
                  full_name: peer.full_name as string | undefined,
                  firstName: peer.firstName as string | undefined,
                  lastName: peer.lastName as string | undefined,
                  email,
                },
                email,
              ),
              email,
            }
          })
          .filter((row): row is OrgMemberOption => Boolean(row))
          .sort((a, b) => a.name.localeCompare(b.name))
        setOrgMembers(options)
      } catch (err) {
        if (cancelled) return
        console.warn('[ImpactClaimWizard] failed to load org members', err)
        setOrgMembers([])
        setOrgMembersError('Could not load people from your organisation. Ask your admin to check membership.')
      } finally {
        if (!cancelled) setOrgMembersLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.email])

  const orgEmailSet = useMemo(
    () => new Set(orgMembers.map((m) => m.email)),
    [orgMembers],
  )

  const selectOrgMember = (
    email: string,
    fields: { nameKey: 'ownerName' | 'financeName'; emailKey: 'ownerEmail' | 'financeEmail' },
  ) => {
    const member = orgMembers.find((m) => m.email === email)
    if (!member) {
      patch({ [fields.nameKey]: '', [fields.emailKey]: '' })
      return
    }
    patch({ [fields.nameKey]: member.name, [fields.emailKey]: member.email })
  }

  const preset: ClaimPreset | null = useMemo(() => presetOf(draft.preset), [draft.preset])
  const isCustom = draft.preset === 'CUSTOM'
  const fam: ClaimFlowFam = preset?.fam ?? draft.fam
  const unitOpts = CLAIM_FLOW_UNITS[fam]?.opts ?? CLAIM_FLOW_UNITS.time.opts
  const calc = useMemo(
    () =>
      calcClaimFlow(
        {
          preset: isCustom ? null : draft.preset,
          unit: draft.unit,
          before: draft.before,
          after: draft.after,
          count: draft.count,
          realized: draft.realized,
        },
        rates,
      ),
    [draft, isCustom, rates],
  )

  const tip = useMemo(() => {
    if (draft.step === 1) return 'Pick the closest fit. You can change it later.'
    if (draft.step === 2)
      return preset ? `Measure: ${preset.name}` : isCustom ? 'Custom measure' : 'Select a measure to continue.'
    if (draft.step === 3)
      return nn(draft.before) ? `Before: ${f1(draft.before)} ${draft.unit}` : 'Enter the before number.'
    if (draft.step === 4) {
      if (!draft.goalDir) return 'Say whether you were trying to increase or decrease from baseline.'
      return nn(draft.target) ? `Goal: ${f1(draft.target)} ${draft.unit}` : 'Set the goal you aimed for.'
    }
    if (draft.step === 5) {
      if (!nn(draft.after)) return 'Enter the after number.'
      if (nn(draft.moneyGained))
        return `After: ${f1(draft.after)} ${draft.unit} · ~${formatMoneyFlow(nn(draft.moneyGained))}/mo`
      return `After: ${f1(draft.after)} ${draft.unit}`
    }
    return `~${formatMoneyFlow(nn(draft.moneyGained) || calc.net)} / month after checking.`
  }, [calc.net, draft, isCustom, preset])

  const guard = (): string | null => {
    if (draft.step === 2 && !draft.preset) return 'Choose what you are measuring.'
    if (draft.step === 2 && !draft.name.trim()) return 'Give it a short name so you recognise it later.'
    if (draft.step === 3 && !nn(draft.before)) return 'Enter the before number.'
    if (draft.step === 3 && !draft.locked)
      return 'Tick the box to lock the before number. Locking is what makes it believable later.'
    if (draft.step === 4 && !draft.goalDir)
      return 'Choose whether your goal was to increase or decrease from the baseline.'
    if (draft.step === 5 && !nn(draft.after)) return 'Enter the after number.'
    if (draft.step === 5 && preset && preset.count !== 'none' && !nn(draft.count))
      return preset.countQ || 'Enter how often, or how many people.'
    return null
  }

  const goNext = () => {
    const g = guard()
    if (g) {
      toast({ status: 'warning', title: g })
      return
    }
    patch({ step: Math.min(6, draft.step + 1) })
  }

  const pickPreset = (id: string) => {
    const p = presetOf(id)
    if (p) {
      // Do not auto-pick direction — Nana: suggestions only make sense after
      // the learner says increase vs decrease from baseline.
      patch({
        preset: id,
        unit: p.unit,
        fam: p.fam,
        goalDir: null,
        target: '',
      })
    } else {
      patch({
        preset: 'CUSTOM',
        unit: draft.unit || CLAIM_FLOW_UNITS[draft.fam].opts[0],
        goalDir: null,
        target: '',
      })
    }
  }

  const buildPayload = (): ClaimWizardSubmitPayload => {
    const periods = Math.max(1, nn(draft.periods) || 3)
    const windowTo = format(new Date(), 'yyyy-MM-dd')
    const windowFrom = format(subMonths(new Date(), periods), 'yyyy-MM-dd')
    const windowLabel = `${format(new Date(windowFrom), 'MMM yyyy')} to ${format(new Date(windowTo), 'MMM yyyy')}`
    const goalDir = resolveGoalDirection(draft.goalDir, preset)
    const claimedNet = nn(draft.moneyGained) || Math.round(calc.net)
    return {
      cat: draft.cat,
      waste: draft.waste,
      growth: draft.growth,
      presetId: isCustom ? 'CUSTOM' : draft.preset,
      measureName: draft.name.trim() || preset?.name || 'Custom measure',
      where: draft.where.trim(),
      unit: draft.unit,
      before: nn(draft.before),
      after: nn(draft.after),
      count: nn(draft.count) || 1,
      months: nn(draft.months),
      periods,
      lockedBefore: draft.lockedBefore,
      locked: draft.locked,
      evidenceRef: draft.evidenceRef.trim(),
      evidence: draft.evidence.trim(),
      moneyGained: claimedNet,
      valueEvidenceLink: draft.valueEvidenceLink.trim(),
      target: nn(draft.target),
      goalDir,
      intervention: draft.intervention.trim(),
      ownerName: draft.ownerName.trim(),
      ownerEmail: draft.ownerEmail.trim().toLowerCase(),
      financeName: draft.financeName.trim(),
      financeEmail: draft.financeEmail.trim().toLowerCase(),
      realized: draft.realized,
      attest: draft.attest,
      sustained: draft.sustained,
      calc: {
        net: claimedNet,
        gross: Math.max(claimedNet, Math.round(calc.gross)),
        bucket: calc.bucket,
        basis: calc.basis,
        fam: calc.fam,
      },
      windowFrom,
      windowTo,
      windowLabel,
    }
  }

  const handleSubmit = async () => {
    if (!draft.attest) {
      toast({ status: 'warning', title: 'Tick the last box to confirm where the numbers came from.' })
      return
    }
    if (!draft.ownerName.trim() || !EMAIL_RE.test(draft.ownerEmail.trim())) {
      toast({
        status: 'warning',
        title: 'Pick who confirms this from your organisation (name and email).',
      })
      return
    }
    if (!orgEmailSet.has(normalizeEmail(draft.ownerEmail))) {
      toast({
        status: 'warning',
        title: 'Measure owner must be someone in your organisation.',
      })
      return
    }
    const claimUsd = nn(draft.moneyGained) || calc.net
    if (claimUsd >= 1000) {
      if (!draft.financeName.trim() || !EMAIL_RE.test(draft.financeEmail.trim())) {
        toast({
          status: 'warning',
          title: 'Pick a finance validator from your organisation (name and email).',
        })
        return
      }
      if (!orgEmailSet.has(normalizeEmail(draft.financeEmail))) {
        toast({
          status: 'warning',
          title: 'Finance validator must be someone in your organisation.',
        })
        return
      }
    }
    await onSubmit(buildPayload())
  }

  const help = helpKey ? CLAIM_FLOW_HELP[helpKey] : null
  const shown = presetsFor(draft.cat, draft.waste, draft.growth)
  const rev = draft.cat === 'rev'
  const chipList = rev ? CLAIM_FLOW_GROWTH : CLAIM_FLOW_WASTES
  const chipSel = rev ? draft.growth : draft.waste
  const goalDir = draft.goalDir
  const sug = suggestedGoal(preset, nn(draft.before), goalDir)
  const dirGood =
    !nn(draft.after) || !nn(draft.before) || !goalDir
      ? true
      : isAfterInGoalDirection(nn(draft.before), nn(draft.after), goalDir)
  const claimUsd = nn(draft.moneyGained) || calc.net
  const m = nn(draft.months)

  return (
    <Box bg="white" borderWidth="1px" borderColor="border.subtle" rounded="xl" p={{ base: 4, md: 6 }} shadow="sm">
      <Text fontSize="10px" letterSpacing="0.14em" textTransform="uppercase" color="brand.gold" fontWeight="700" mb={2}>
        Log an improvement · step {draft.step} of 6
      </Text>
      <Wrap spacing={1} mb={4}>
        {CLAIM_FLOW_STEPS.map((label, i) => {
          const n = i + 1
          const on = n === draft.step
          const done = n < draft.step
          return (
            <WrapItem key={label}>
              <Box
                px={2.5}
                py={1}
                rounded="md"
                fontSize="xs"
                fontWeight="600"
                bg={on ? PURPLE : done ? 'orange.50' : 'gray.100'}
                color={on ? 'white' : done ? '#8a6a12' : 'gray.500'}
                borderWidth={done && !on ? '1px' : '0'}
                borderColor={done && !on ? 'brand.gold' : 'transparent'}
              >
                {n}. {label}
              </Box>
            </WrapItem>
          )
        })}
      </Wrap>
      <Box mb={5} h="6px" bg="gray.100" borderRadius="full" overflow="hidden" aria-hidden>
        <Box
          h="100%"
          borderRadius="full"
          bg="linear-gradient(90deg, #eab130, #f9db59)"
          width={`${(draft.step / CLAIM_FLOW_STEPS.length) * 100}%`}
          transition="width 0.35s ease"
        />
      </Box>

      {draft.step === 1 && (
        <Stack spacing={4}>
          <Heading size="md">
            What kind of improvement is it
            <HelpBtn k="kind" onOpen={setHelpKey} />
          </Heading>
          <Text color="text.secondary" fontSize="sm">
            Three plain choices. This decides what we ask you next, so pick the closest one.
          </Text>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap={3}>
            {CLAIM_FLOW_CATS.map((c) => (
              <CardPick
                key={c.k}
                on={draft.cat === c.k}
                onClick={() => patch({ cat: c.k, preset: null, unit: '', goalDir: null })}
              >
                <Text fontWeight="600" mb={1}>
                  {c.n}
                </Text>
                <Text fontSize="sm" color="text.secondary">
                  {c.d}
                </Text>
              </CardPick>
            ))}
          </SimpleGrid>
          <Box>
            <Text fontSize="sm" fontWeight="600" mb={2}>
              {rev ? 'Where did the revenue come from' : 'What was getting in the way'}
              <HelpBtn k="waste" onOpen={setHelpKey} />
            </Text>
            <Wrap spacing={2}>
              {chipList.map((w) => (
                <WrapItem key={w.k}>
                  <Chip
                    on={chipSel === w.k}
                    onClick={() =>
                      patch(
                        rev
                          ? { growth: w.k, preset: null, unit: '', goalDir: null }
                          : { waste: w.k, preset: null, unit: '', goalDir: null },
                      )
                    }
                  >
                    {w.n}
                  </Chip>
                </WrapItem>
              ))}
            </Wrap>
          </Box>
        </Stack>
      )}

      {draft.step === 2 && (
        <Stack spacing={4}>
          <Box>
            <Heading size="md">
              What are you measuring
              <HelpBtn k="measure" onOpen={setHelpKey} />
            </Heading>
            <Text color="text.secondary" fontSize="sm" mt={1}>
              Pick the closest standard measure.
            </Text>
          </Box>

          <Stack spacing={2}>
            {shown.map((x) => (
              <CardPick key={x.id} on={draft.preset === x.id} onClick={() => pickPreset(x.id)}>
                <Flex align="center" justify="space-between" gap={3} flexWrap="wrap">
                  <Box minW={0} flex="1">
                    <Text fontWeight="600" fontSize="sm">
                      {x.name}
                    </Text>
                    <Text fontSize="xs" color="text.muted" noOfLines={1} mt={0.5}>
                      e.g. {x.eg}
                    </Text>
                  </Box>
                  <Box
                    as="span"
                    fontSize="xs"
                    fontWeight="600"
                    px={2}
                    py={0.5}
                    rounded="md"
                    bg={draft.preset === x.id ? 'white' : 'gray.100'}
                    color="gray.700"
                    flexShrink={0}
                  >
                    {x.unit}
                  </Box>
                </Flex>
              </CardPick>
            ))}
            <CardPick on={isCustom} onClick={() => pickPreset('CUSTOM')}>
              <Text fontWeight="600" fontSize="sm">
                Custom measure
              </Text>
              <Text fontSize="xs" color="text.muted" mt={0.5}>
                Won’t roll up with standard measures across clients.
              </Text>
            </CardPick>
          </Stack>

          {(preset || isCustom) && (
            <Stack
              spacing={3}
              pt={3}
              borderTopWidth="1px"
              borderColor="border.subtle"
            >
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                <FormControl isRequired>
                  <FormLabel fontSize="sm" mb={1}>
                    Name
                  </FormLabel>
                  <Input
                    size="sm"
                    value={draft.name}
                    placeholder={preset ? `${preset.name} · team` : 'Short label for your list'}
                    bg={!draft.name ? 'yellow.50' : undefined}
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm" mb={1}>
                    Where
                  </FormLabel>
                  <Input
                    size="sm"
                    value={draft.where}
                    placeholder="Team, site or process"
                    onChange={(e) => patch({ where: e.target.value })}
                  />
                </FormControl>
              </SimpleGrid>
              <Flex
                direction={{ base: 'column', md: 'row' }}
                gap={3}
                align={{ base: 'stretch', md: 'flex-end' }}
                maxW={{ md: isCustom ? '100%' : '240px' }}
              >
                {isCustom && (
                  <FormControl flex="1" minW={0}>
                    <FormLabel fontSize="sm" mb={1} display="flex" alignItems="center" minH="20px">
                      Type
                    </FormLabel>
                    <Select
                      size="sm"
                      h="32px"
                      value={draft.fam}
                      onChange={(e) => {
                        const next = e.target.value as ClaimFlowFam
                        patch({ fam: next, unit: CLAIM_FLOW_UNITS[next].opts[0] })
                      }}
                    >
                      {(Object.keys(CLAIM_FLOW_UNITS) as ClaimFlowFam[]).map((k) => (
                        <option key={k} value={k}>
                          {CLAIM_FLOW_UNITS[k].label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                )}
                <FormControl flex="1" minW={0}>
                  <FormLabel fontSize="sm" mb={1} display="flex" alignItems="center" gap={0} minH="20px">
                    Unit
                    <HelpBtn k="unit" onOpen={setHelpKey} />
                  </FormLabel>
                  <Select
                    size="sm"
                    h="32px"
                    value={draft.unit}
                    onChange={(e) => patch({ unit: e.target.value })}
                  >
                    {unitOpts.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </Flex>
              {preset && (
                <Text fontSize="xs" color="text.muted">
                  Valuation: {preset.valueRule}
                </Text>
              )}
            </Stack>
          )}
        </Stack>
      )}

      {draft.step === 3 && (
        <Stack spacing={4}>
          <Box>
            <Heading size="md">
              Before
              <HelpBtn k="before" onOpen={setHelpKey} />
            </Heading>
            <Text color="text.secondary" fontSize="sm" mt={1}>
              {preset?.ask || 'What it was before you changed anything.'}
            </Text>
          </Box>

          <Stack spacing={4}>
            <Flex
              direction={{ base: 'column', md: 'row' }}
              gap={4}
              align={{ base: 'stretch', md: 'flex-end' }}
            >
              <FormControl isRequired flex="1" minW={0}>
                <FormLabel
                  fontSize="sm"
                  mb={1}
                  display="flex"
                  alignItems="center"
                  minH="20px"
                  sx={{ '& > span:last-of-type': { ml: 0.5 } }}
                >
                  Before value
                </FormLabel>
                <Flex>
                  <Input
                    size="sm"
                    h="32px"
                    borderRightRadius={0}
                    inputMode="decimal"
                    value={draft.before}
                    placeholder="e.g. 6.5"
                    bg={!nn(draft.before) ? 'yellow.50' : undefined}
                    onChange={(e) => patch({ before: e.target.value })}
                  />
                  <Select
                    size="sm"
                    h="32px"
                    borderLeftRadius={0}
                    maxW="130px"
                    value={draft.unit}
                    onChange={(e) => patch({ unit: e.target.value })}
                  >
                    {unitOpts.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Select>
                </Flex>
              </FormControl>

              <FormControl flex="1" minW={0}>
                <FormLabel fontSize="sm" mb={1} display="flex" alignItems="center" gap={0} minH="20px">
                  How far back
                  <HelpBtn k="months" onOpen={setHelpKey} />
                </FormLabel>
                <Select
                  size="sm"
                  h="32px"
                  value={draft.months}
                  onChange={(e) => patch({ months: Number(e.target.value) })}
                >
                  {MONTH_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </Flex>

            <FormControl>
              <FormLabel fontSize="sm" mb={1}>
                Source
              </FormLabel>
              <Input
                size="sm"
                value={draft.evidenceRef}
                placeholder="System or record · e.g. SAP report 28 June"
                onChange={(e) => patch({ evidenceRef: e.target.value })}
              />
            </FormControl>
          </Stack>

          <Stack
            spacing={3}
            pt={3}
            borderTopWidth="1px"
            borderColor="border.subtle"
          >
            <Checkbox
              size="sm"
              isChecked={draft.lockedBefore}
              onChange={(e) => patch({ lockedBefore: e.target.checked })}
              colorScheme="primary"
              alignItems="flex-start"
            >
              <Text fontSize="sm" color="black" lineHeight="1.4">
                Taken from a system or record before the change
              </Text>
            </Checkbox>
            <Checkbox
              size="sm"
              isChecked={draft.locked}
              onChange={(e) => patch({ locked: e.target.checked })}
              colorScheme="primary"
              alignItems="flex-start"
            >
              <Text fontSize="sm" color="black" lineHeight="1.4">
                Lock this before number
                <HelpBtn k="lock" onOpen={setHelpKey} />
              </Text>
            </Checkbox>
          </Stack>

          <Text fontSize="xs" color="text.muted">
            {!draft.lockedBefore || m < 3
              ? 'Marked as an estimate until it comes from a locked system record covering at least 3 months.'
              : m >= 12
                ? draft.locked
                  ? 'Strong baseline - 12 months from a system, locked.'
                  : 'Strong period - lock the number to finish this step.'
                : draft.locked
                  ? 'Solid baseline - locked, under 12 months so seasonality is noted.'
                  : 'Lock the number to finish this step.'}
          </Text>
        </Stack>
      )}

      {draft.step === 4 && (
        <Stack spacing={3}>
          <Heading size="md">
            What were you aiming for
            <HelpBtn k="goal" onOpen={setHelpKey} />
          </Heading>
          <Text color="text.secondary" fontSize="sm">
            Modest / typical / ambitious only work after you say whether the goal was to{' '}
            <Bold>increase</Bold> or <Bold>decrease</Bold> from your baseline.
          </Text>
          <FormControl isRequired>
            <FormLabel fontSize="sm">From the baseline, my goal was to</FormLabel>
            <SimpleGrid columns={2} gap={2} maxW="420px">
              <Chip
                on={goalDir === 'up'}
                onClick={() =>
                  patch({
                    goalDir: 'up',
                    target: '',
                  })
                }
              >
                <Box>
                  <Text fontSize="sm" fontWeight="700">
                    Increase it
                  </Text>
                  <Text fontSize="11px" opacity={0.8}>
                    Aim above baseline
                  </Text>
                </Box>
              </Chip>
              <Chip
                on={goalDir === 'down'}
                onClick={() =>
                  patch({
                    goalDir: 'down',
                    target: '',
                  })
                }
              >
                <Box>
                  <Text fontSize="sm" fontWeight="700">
                    Decrease it
                  </Text>
                  <Text fontSize="11px" opacity={0.8}>
                    Aim below baseline
                  </Text>
                </Box>
              </Chip>
            </SimpleGrid>
            <FormHelperText>
              {!goalDir
                ? 'Pick one first — then the suggestion chips will fill the right way.'
                : goalDir === 'up'
                  ? 'Chips will suggest numbers above your before number.'
                  : 'Chips will suggest numbers below your before number.'}
            </FormHelperText>
          </FormControl>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
            <FormControl>
              <FormLabel fontSize="sm">My goal was to get it to</FormLabel>
              <Flex>
                <Input
                  borderRightRadius={0}
                  inputMode="decimal"
                  value={draft.target}
                  placeholder={sug != null ? f1(sug) : ''}
                  onChange={(e) => patch({ target: e.target.value })}
                  isDisabled={!goalDir}
                />
                <Input borderLeftRadius={0} maxW="110px" textAlign="center" value={draft.unit} isReadOnly bg="gray.50" />
              </Flex>
              <FormHelperText>Same unit as your before number, so the two can be compared.</FormHelperText>
            </FormControl>
            <Box>
              <Text fontSize="sm" fontWeight="600" mb={2} color="black">
                Not sure? Use a typical one
              </Text>
              <Wrap spacing={2}>
                {(
                  [
                    ['Modest', 'modest'],
                    ['Typical', 'typical'],
                    ['Ambitious', 'ambitious'],
                  ] as const
                ).map(([lab, level]) => {
                  const before = nn(draft.before)
                  const v =
                    before > 0 && goalDir
                      ? goalSuggestion(before, goalDir, level, preset?.typical || 30)
                      : 0
                  return (
                    <WrapItem key={lab}>
                      <Chip
                        onClick={() => before > 0 && goalDir && patch({ target: v.toFixed(2) })}
                      >
                        <Box color="black">
                          <Text fontSize="xs" fontWeight="700" color="black">
                            {lab}
                          </Text>
                          <Text fontWeight="500" fontSize="11px" color="black" opacity={0.75}>
                            {!goalDir
                              ? 'Pick direction first'
                              : before > 0
                                ? `${f1(v)} ${draft.unit}`
                                : 'Enter before first'}
                          </Text>
                        </Box>
                      </Chip>
                    </WrapItem>
                  )
                })}
              </Wrap>
              <Text fontSize="xs" color="gray.500" mt={2}>
                Typical {goalDir === 'up' ? 'increase' : goalDir === 'down' ? 'reduction' : 'change'} for this measure
                is about {preset?.typical || 30}%. Click a chip to fill the goal.
              </Text>
            </Box>
          </SimpleGrid>
          <FormControl>
            <FormLabel fontSize="sm">What did you actually change</FormLabel>
            <Textarea
              rows={2}
              value={draft.intervention}
              placeholder="e.g. Replaced the manual three way match with an agent that reads the PO, the delivery note and the invoice, and only sends me the exceptions."
              onChange={(e) => patch({ intervention: e.target.value })}
            />
            <FormHelperText>One or two sentences. Whoever checks this reads it first.</FormHelperText>
          </FormControl>
          <Note variant="info" title="Why the goal matters">
            Setting it before you measure the result is the difference between an improvement and a story told
            afterwards. We record the date you set it. Nothing is blocked if you set it late, but your reviewer sees that.
          </Note>
        </Stack>
      )}

      {draft.step === 5 && (
        <Stack spacing={3}>
          <Heading size="md">
            The after number
            <HelpBtn k="after" onOpen={setHelpKey} />
          </Heading>
          <Text color="text.secondary" fontSize="sm">
            What it is now, measured the same way as the before number.
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
            <FormControl>
              <FormLabel fontSize="sm">It is now</FormLabel>
              <Flex>
                <Input
                  borderRightRadius={0}
                  inputMode="decimal"
                  value={draft.after}
                  placeholder="e.g. 2.4"
                  bg={!nn(draft.after) ? 'yellow.50' : undefined}
                  onChange={(e) => patch({ after: e.target.value })}
                />
                <Input borderLeftRadius={0} maxW="110px" textAlign="center" value={draft.unit} isReadOnly bg="gray.50" />
              </Flex>
              <FormHelperText>Same unit, same way of counting.</FormHelperText>
            </FormControl>
            {preset && preset.count !== 'none' ? (
              <FormControl>
                <FormLabel fontSize="sm">
                  {preset.countQ}
                  <HelpBtn k="count" onOpen={setHelpKey} />
                </FormLabel>
                <Input
                  inputMode="numeric"
                  value={draft.count}
                  placeholder={preset.countEg}
                  bg={!nn(draft.count) ? 'yellow.50' : undefined}
                  onChange={(e) => patch({ count: e.target.value })}
                />
                <FormHelperText>
                  {preset.count === 'people'
                    ? 'The number of people who do this work, not the number of times it happens.'
                    : 'How often this happens, not how many people are involved.'}
                </FormHelperText>
              </FormControl>
            ) : (
              <Note variant="gold" title="Nothing more to count">
                Your before and after numbers already cover a whole month, so we do not need to ask how often.
              </Note>
            )}
          </SimpleGrid>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
            <FormControl>
              <FormLabel fontSize="sm">
                Over what period did you watch it
                <HelpBtn k="periods" onOpen={setHelpKey} />
              </FormLabel>
              <Select value={draft.periods} onChange={(e) => patch({ periods: Number(e.target.value) })}>
                {PERIOD_OPTS.map((x) => (
                  <option key={x} value={x}>
                    {x} month{x > 1 ? 's' : ''}
                  </option>
                ))}
              </Select>
              <FormHelperText>
                {nn(draft.periods) < 3
                  ? 'Under three months, so this stays an estimate. One good month can be luck.'
                  : 'Three months or more, so it can be fully verified.'}
              </FormHelperText>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Where can someone check the after number</FormLabel>
              <Input
                value={draft.evidence}
                placeholder="e.g. same SAP report, run 1 August"
                onChange={(e) => patch({ evidence: e.target.value })}
              />
              <FormHelperText>Ideally the same place the before number came from.</FormHelperText>
            </FormControl>
          </SimpleGrid>
          {nn(draft.after) && !dirGood && (
            <Note variant="bad" title="That went the wrong way">
              You aimed to {goalDir === 'up' ? 'increase' : 'decrease'} from a before of {f1(draft.before)}, but your
              after is {f1(draft.after)}. You can still send it. An honest result that did not work is worth more to the
              programme than a number that was massaged.
            </Note>
          )}

          <Box borderWidth="1px" borderColor="border.subtle" rounded="lg" p={4} bg="gray.50">
            <Heading size="sm" mb={1}>
              How much money do you think you&apos;ve{' '}
              {goalDir === 'up' ? 'gained' : goalDir === 'down' ? 'saved' : 'gained or saved'}
            </Heading>
            <Text fontSize="sm" color="text.secondary" mb={3}>
              So your reviewer can verify the value of this change
              {goalDir === 'up'
                ? ' (increase from baseline).'
                : goalDir === 'down'
                  ? ' (decrease from baseline).'
                  : '.'}{' '}
              Per month, in USD.
            </Text>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
              <FormControl>
                <FormLabel fontSize="sm">
                  {goalDir === 'up'
                    ? 'Money gained / month'
                    : goalDir === 'down'
                      ? 'Money saved / month'
                      : 'Money gained or saved / month'}
                </FormLabel>
                <Flex>
                  <Input
                    borderRightRadius={0}
                    maxW="48px"
                    textAlign="center"
                    value="$"
                    isReadOnly
                    bg="white"
                  />
                  <Input
                    borderLeftRadius={0}
                    inputMode="decimal"
                    value={draft.moneyGained}
                    placeholder={calc.net > 0 ? String(Math.round(calc.net)) : 'e.g. 500'}
                    bg={!nn(draft.moneyGained) ? 'yellow.50' : 'white'}
                    onChange={(e) => patch({ moneyGained: e.target.value })}
                    onFocus={() => {
                      if (!draft.moneyGained && calc.net > 0) {
                        patch({ moneyGained: String(Math.round(calc.net)) })
                      }
                    }}
                  />
                </Flex>
                <FormHelperText>
                  {calc.net > 0
                    ? `From your before/after we estimate about ${formatMoneyFlow(calc.net)} / month. Edit if your figure is different.`
                    : 'Enter what you believe this change is worth in money each month.'}
                </FormHelperText>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Link to evidence of this figure (optional)</FormLabel>
                <Input
                  type="url"
                  value={draft.valueEvidenceLink}
                  placeholder="e.g. https://drive.google.com/…"
                  bg="white"
                  onChange={(e) => patch({ valueEvidenceLink: e.target.value })}
                />
                <FormHelperText>
                  Optional. Share a cloud link to how you worked it out — no file upload needed.
                </FormHelperText>
              </FormControl>
            </SimpleGrid>
          </Box>

          <Checkbox
            isChecked={draft.sustained}
            onChange={(e) => patch({ sustained: e.target.checked })}
            colorScheme="primary"
          >
            <Text fontSize="sm">
              <Bold>It is still like this today.</Bold> We will ask your manager again in 90 days. If it has slipped
              back, the value comes off and nobody is blamed for it.
            </Text>
          </Checkbox>
        </Stack>
      )}

      {draft.step === 6 && (
        <Stack spacing={3}>
          <Heading size="md">What it is worth, and who checks it</Heading>
          <Text color="text.secondary" fontSize="sm">
            Your money figure from the last step is what gets verified. We also show how the platform
            estimated it from your before and after numbers.
          </Text>
          {!nn(draft.before) || !nn(draft.after) ? (
            <Note variant="warn" title="Not enough yet">
              Go back and fill in the before and after numbers.
            </Note>
          ) : (
            <SimpleGrid columns={{ base: 1, md: 3 }} gap={3}>
              <Box borderWidth="1px" borderColor="yellow.300" bg="yellow.50" rounded="lg" p={3}>
                <Text fontSize="10px" textTransform="uppercase" letterSpacing="0.08em" color="gray.600" fontWeight="700">
                  What you are claiming
                </Text>
                <Text fontSize="2xl" fontWeight="600" color="yellow.800" my={1}>
                  {formatMoneyFlow(nn(draft.moneyGained) || calc.net)}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  a month, unverified until it is checked
                </Text>
              </Box>
              <Box borderWidth="1px" borderColor="gray.200" rounded="lg" p={3}>
                <Text fontSize="10px" textTransform="uppercase" letterSpacing="0.08em" color="gray.600" fontWeight="700">
                  How we got there
                </Text>
                <Text fontSize="sm" fontWeight="600" my={1} lineHeight="tall">
                  {calc.basis || '-'}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {calc.real < 1
                    ? 'Then halved, because the time saved has not turned into cash yet.'
                    : 'Counted in full.'}
                </Text>
              </Box>
              <Box borderWidth="1px" borderColor="gray.200" rounded="lg" p={3}>
                <Text fontSize="10px" textTransform="uppercase" letterSpacing="0.08em" color="gray.600" fontWeight="700">
                  The figure we used
                </Text>
                <Text fontSize="sm" fontWeight="600" my={1}>
                  {calc.rateSupplied ? "Your organization's own" : 'A T4L default'}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {calc.rateLabel}
                </Text>
              </Box>
            </SimpleGrid>
          )}

          {nn(draft.before) && nn(draft.after) && (
            <Box borderWidth="1px" borderColor="purple.100" bg="purple.50" rounded="lg" p={3}>
              <Text fontSize="10px" textTransform="uppercase" letterSpacing="0.08em" color="purple.800" fontWeight="700">
                How this is classified · you do not pick this
              </Text>
              <Text fontSize="sm" fontWeight="700" color="#27062e" mt={1}>
                {calc.bucket === 'cash'
                  ? 'Cash impact'
                  : calc.bucket === 'avoidance'
                    ? 'Cost avoidance'
                    : 'Capacity released'}
              </Text>
              <Text fontSize="xs" color="gray.700" mt={1.5} lineHeight="1.55">
                {calc.bucket === 'cash'
                  ? 'Traceable to a P&L or budget line — e.g. revenue up, or spend that actually left the books.'
                  : calc.bucket === 'avoidance'
                    ? 'Spend that would have happened and did not — e.g. fewer defects, scrap, rework, or over-drawn PPE stopped by a control.'
                    : 'Hours freed with no cash movement yet. Tick “turned into real money” below only if overtime, contractors, or an unfilled post actually changed.'}
              </Text>
              <Text fontSize="xs" color="gray.600" mt={2} lineHeight="1.5">
                What you input: before / after numbers (+ money estimate). We classify from the measure type
                (money / items / time) and whether time saved became real cash.
              </Text>
            </Box>
          )}
          {!calc.rateSupplied && nn(draft.before) && nn(draft.after) && (
            <Note variant="warn" title="Using a default figure">
              Your finance team has not given us this one yet, so we are using a standard figure. Your claim can still be
              checked and approved, but it will be marked as based on a default until finance confirms their own number.
            </Note>
          )}
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={3} mt={2}>
            <FormControl isRequired>
              <FormLabel fontSize="sm">
                Who confirms the number
                <HelpBtn k="who" onOpen={setHelpKey} />
              </FormLabel>
              {orgMembersLoading ? (
                <Flex align="center" gap={2} py={2}>
                  <Spinner size="sm" />
                  <Text fontSize="sm" color="gray.600">
                    Loading people in your organisation…
                  </Text>
                </Flex>
              ) : (
                <Select
                  value={normalizeEmail(draft.ownerEmail)}
                  placeholder="Name and email · same organisation"
                  bg={!draft.ownerEmail ? 'yellow.50' : undefined}
                  onChange={(e) =>
                    selectOrgMember(e.target.value, { nameKey: 'ownerName', emailKey: 'ownerEmail' })
                  }
                >
                  {orgMembers.map((member) => (
                    <option key={member.id} value={member.email}>
                      {member.name} · {member.email}
                    </option>
                  ))}
                </Select>
              )}
              {draft.ownerEmail ? (
                <Text fontSize="xs" color="gray.600" mt={2}>
                  Selected: <Bold>{draft.ownerName}</Bold> ({draft.ownerEmail})
                </Text>
              ) : null}
              <FormHelperText>
                Name and email of a user in your organisation. Usually your manager or whoever owns
                the number. It cannot be you.
              </FormHelperText>
              {orgMembersError ? (
                <Text fontSize="xs" color="red.600" mt={1}>
                  {orgMembersError}
                </Text>
              ) : null}
              {!orgMembersLoading && !orgMembersError && orgMembers.length === 0 ? (
                <Text fontSize="xs" color="orange.700" mt={1}>
                  No other organisation members found to confirm this claim.
                </Text>
              ) : null}
            </FormControl>
            <FormControl isRequired={claimUsd >= 1000}>
              <FormLabel fontSize="sm">
                Finance validator {claimUsd >= 1000 ? '(needed at this size)' : '(optional at this size)'}
              </FormLabel>
              {orgMembersLoading ? (
                <Flex align="center" gap={2} py={2}>
                  <Spinner size="sm" />
                  <Text fontSize="sm" color="gray.600">
                    Loading people in your organisation…
                  </Text>
                </Flex>
              ) : (
                <Select
                  value={normalizeEmail(draft.financeEmail)}
                  placeholder="Name and email · same organisation"
                  onChange={(e) =>
                    selectOrgMember(e.target.value, { nameKey: 'financeName', emailKey: 'financeEmail' })
                  }
                >
                  {orgMembers
                    .filter((member) => member.email !== normalizeEmail(draft.ownerEmail))
                    .map((member) => (
                      <option key={member.id} value={member.email}>
                        {member.name} · {member.email}
                      </option>
                    ))}
                </Select>
              )}
              {draft.financeEmail ? (
                <Text fontSize="xs" color="gray.600" mt={2}>
                  Selected: <Bold>{draft.financeName}</Bold> ({draft.financeEmail})
                </Text>
              ) : null}
              <FormHelperText>
                {claimUsd >= 1000
                  ? 'Anything worth $1,000 a month or more needs finance in your organisation to sign it off.'
                  : 'Optional. Pick someone in your organisation if you want finance to verify the figure.'}
              </FormHelperText>
            </FormControl>
          </SimpleGrid>
          {(calc.fam === 'time' || calc.fam === 'people') && (
            <Checkbox
              isChecked={draft.realized}
              onChange={(e) => patch({ realized: e.target.checked })}
              colorScheme="primary"
            >
              <Text fontSize="sm">
                <Bold>The time saved turned into real money.</Bold> Tick this only if a post went unfilled, contractor
                spend went down, or overtime dropped. Otherwise we count half.
              </Text>
            </Checkbox>
          )}
          <Checkbox isChecked={draft.attest} onChange={(e) => patch({ attest: e.target.checked })} colorScheme="primary">
            <Text fontSize="sm">
              <Bold>These numbers came from where I said they did, and I have not claimed this improvement anywhere else.</Bold>
            </Text>
          </Checkbox>
          <Note variant="info" title="What happens after you send it">
            Your number goes in as <Bold purple>unverified</Bold>. It shows in your list but does not count towards any
            organization total yet. After manager (and finance if needed) checks, it becomes{' '}
            <Bold purple>verified and locked</Bold>.
          </Note>
        </Stack>
      )}

      <Flex mt={6} pt={4} borderTopWidth="1px" borderColor="border.subtle" gap={3} align="center" wrap="wrap" justify="flex-end">
        <Text flex="1" fontSize="sm" color="text.secondary" minW="160px">
          {tip}
        </Text>
        <Button
          variant="outline"
          onClick={() => (draft.step <= 1 ? onCancel() : patch({ step: draft.step - 1 }))}
          isDisabled={submitting}
        >
          {draft.step <= 1 ? 'Cancel' : 'Back'}
        </Button>
        {draft.step < 6 ? (
          <Button bg={PURPLE} color="white" _hover={{ bg: '#4a148c' }} onClick={goNext}>
            Next
          </Button>
        ) : (
          <Button
            bg="brand.gold"
            color="brand.deepPlum"
            _hover={{ bg: '#f9db59' }}
            onClick={() => void handleSubmit()}
            isLoading={submitting}
          >
            Send it for checking
          </Button>
        )}
      </Flex>

      <Modal isOpen={Boolean(help)} onClose={() => setHelpKey(null)} size="lg" isCentered>
        <ModalOverlay bg="blackAlpha.500" />
        <ModalContent>
          <ModalHeader>
            <Text fontSize="xs" color="brand.gold" textTransform="uppercase" letterSpacing="0.12em" mb={1}>
              In plain terms
            </Text>
            <Heading size="md">{help?.t}</Heading>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {help && (
              <>
                <Text fontSize="sm" color="text.secondary" whiteSpace="pre-wrap" mb={4}>
                  {help.b}
                </Text>
                <Flex justify="flex-end">
                  <Button size="sm" onClick={() => setHelpKey(null)}>
                    Close
                  </Button>
                </Flex>
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
}

export default ImpactClaimWizardV4
