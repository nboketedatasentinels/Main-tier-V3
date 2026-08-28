/**
 * Impact claim wizard v4 — Chakra port of Desktop/T4L_Claim_Flow_v4.html.
 */
import React, { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Progress,
  Select,
  SimpleGrid,
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
  presetOf,
  presetsFor,
  suggestedGoal,
  type ClaimFlowCat,
  type ClaimFlowFam,
  type ClaimFlowHelpKey,
  type ClaimPreset,
} from '@/config/impactClaimFlowV4'

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
const RATE_LABEL: Record<string, string> = {
  hourly: 'hourly rate',
  annual: 'cost of employment',
  perError: 'cost per error',
  perTrip: 'cost per trip',
  holding: 'stock holding cost',
  margin: 'gross margin',
  none: 'no rate needed',
}

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
  target: string
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
  target: number
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
    target: '',
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
  title,
}: {
  on?: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <Button
      size="sm"
      title={title}
      onClick={onClick}
      borderRadius="full"
      h="auto"
      py={2}
      px={3}
      whiteSpace="normal"
      textAlign="left"
      fontWeight="600"
      bg={on ? PURPLE : 'white'}
      color={on ? 'white' : 'inherit'}
      borderWidth="1px"
      borderColor={on ? PURPLE : 'gray.300'}
      _hover={{ borderColor: PURPLE, color: on ? 'white' : PURPLE, bg: on ? '#4a148c' : 'purple.50' }}
    >
      {children}
    </Button>
  )
}

function Pend({ children }: { children: React.ReactNode }) {
  return (
    <Text as="span" fontStyle="italic" color="gray.400">
      {children}
    </Text>
  )
}
function Bold({ children, purple }: { children: React.ReactNode; purple?: boolean }) {
  return (
    <Text as="span" fontWeight="600" color={purple ? PURPLE : undefined}>
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
      boxShadow={on ? '0 0 0 3px rgba(53,14,111,.09)' : undefined}
      onClick={onClick}
      _hover={{ borderColor: 'purple.300' }}
      transition="all 0.15s"
    >
      {children}
    </Box>
  )
}

export const ImpactClaimWizardV4: React.FC<Props> = ({ rates, submitting, onCancel, onSubmit }) => {
  const toast = useToast()
  const [draft, setDraft] = useState<ClaimWizardDraft>(blankClaimWizardDraft)
  const [helpKey, setHelpKey] = useState<ClaimFlowHelpKey | null>(null)
  const patch = (partial: Partial<ClaimWizardDraft>) => setDraft((d) => ({ ...d, ...partial }))

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
      return preset
        ? `Using the standard measure: ${preset.name.toLowerCase()}`
        : 'Pick the one that sounds most like your work.'
    if (draft.step === 3)
      return nn(draft.before) ? `Before: ${f1(draft.before)} ${draft.unit}` : 'Enter what it was before you changed anything.'
    if (draft.step === 4)
      return nn(draft.target) ? `Goal: ${f1(draft.target)} ${draft.unit}` : 'A goal is what you were aiming for.'
    if (draft.step === 5) return nn(draft.after) ? `After: ${f1(draft.after)} ${draft.unit}` : 'Enter what it is now.'
    return `Worth about ${formatMoneyFlow(calc.net)} a month once it is checked.`
  }, [calc.net, draft, preset])

  const guard = (): string | null => {
    if (draft.step === 2 && !draft.preset) return 'Choose what you are measuring.'
    if (draft.step === 2 && !draft.name.trim()) return 'Give it a short name so you recognise it later.'
    if (draft.step === 3 && !nn(draft.before)) return 'Enter the before number.'
    if (draft.step === 3 && !draft.locked)
      return 'Tick the box to lock the before number. Locking is what makes it believable later.'
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
    if (p) patch({ preset: id, unit: p.unit, fam: p.fam })
    else patch({ preset: 'CUSTOM', unit: draft.unit || CLAIM_FLOW_UNITS[draft.fam].opts[0] })
  }

  const buildPayload = (): ClaimWizardSubmitPayload => {
    const periods = Math.max(1, nn(draft.periods) || 3)
    const windowTo = format(new Date(), 'yyyy-MM-dd')
    const windowFrom = format(subMonths(new Date(), periods), 'yyyy-MM-dd')
    const windowLabel = `${format(new Date(windowFrom), 'MMM yyyy')} to ${format(new Date(windowTo), 'MMM yyyy')}`
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
      target: nn(draft.target),
      intervention: draft.intervention.trim(),
      ownerName: draft.ownerName.trim(),
      ownerEmail: draft.ownerEmail.trim().toLowerCase(),
      financeName: draft.financeName.trim(),
      financeEmail: draft.financeEmail.trim().toLowerCase(),
      realized: draft.realized,
      attest: draft.attest,
      sustained: draft.sustained,
      calc: { net: calc.net, gross: calc.gross, bucket: calc.bucket, basis: calc.basis, fam: calc.fam },
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
    if (!draft.ownerName.trim()) {
      toast({ status: 'warning', title: 'Enter who can confirm this is right.' })
      return
    }
    if (!EMAIL_RE.test(draft.ownerEmail.trim())) {
      toast({ status: 'warning', title: 'Enter a valid email for the measure owner.' })
      return
    }
    if (calc.net >= 1000) {
      if (!draft.financeName.trim()) {
        toast({ status: 'warning', title: 'Finance name is required for claims of $1,000 a month or more.' })
        return
      }
      if (!EMAIL_RE.test(draft.financeEmail.trim())) {
        toast({ status: 'warning', title: 'Enter a valid finance email.' })
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
  const sug = suggestedGoal(preset, nn(draft.before))
  const dirGood =
    !nn(draft.after) || !nn(draft.before)
      ? true
      : preset?.dir === 'up'
        ? nn(draft.after) > nn(draft.before)
        : nn(draft.after) < nn(draft.before)
  const m = nn(draft.months)

  return (
    <Box bg="white" borderWidth="1px" borderColor="border.subtle" rounded="xl" p={{ base: 4, md: 6 }} shadow="sm">
      <Text fontSize="10px" letterSpacing="0.14em" textTransform="uppercase" color="brand.gold" fontWeight="700" mb={2}>
        Log an improvement · step {draft.step} of 6
      </Text>
      <Wrap spacing={1} mb={2}>
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
                bg={on ? PURPLE : done ? 'green.50' : 'gray.100'}
                color={on ? 'white' : done ? 'green.700' : 'gray.500'}
              >
                {n}. {label}
              </Box>
            </WrapItem>
          )
        })}
      </Wrap>
      <Progress
        value={(draft.step / 6) * 100}
        size="sm"
        mb={4}
        borderRadius="full"
        bg="gray.100"
        sx={{ '& > div': { background: 'linear-gradient(90deg, #eab130, #f9db59)' } }}
      />

      {draft.step > 1 && (
        <Box mb={4} p={4} rounded="lg" borderWidth="1px" borderColor="purple.100" bgGradient="linear(to-b, purple.50, white)">
          <Text fontSize="10px" letterSpacing="0.14em" textTransform="uppercase" color={PURPLE} fontWeight="700" mb={1}>
            Your improvement in one sentence
          </Text>
          <Text fontSize="md" lineHeight="tall">
            You {preset?.dir === 'up' ? 'increased' : 'reduced'}{' '}
            {preset || isCustom ? (
              <Bold purple>{draft.name || preset?.name.toLowerCase() || 'your measure'}</Bold>
            ) : (
              <Pend>what you are measuring</Pend>
            )}{' '}
            {draft.where ? (
              <>
                in <Bold purple>{draft.where}</Bold>
              </>
            ) : (
              <Pend>in a team or process</Pend>
            )}
            . It was{' '}
            {nn(draft.before) ? (
              <Bold purple>
                {f1(draft.before)} {draft.unit}
              </Bold>
            ) : (
              <Pend>the before number</Pend>
            )}
            , now it is{' '}
            {nn(draft.after) ? (
              <Bold purple>
                {f1(draft.after)} {draft.unit}
              </Bold>
            ) : (
              <Pend>the after number</Pend>
            )}
            {preset && preset.count !== 'none' ? (
              nn(draft.count) ? (
                <>
                  , across <Bold purple>{f1(draft.count)}</Bold> {preset.count === 'people' ? 'people' : 'a month'}
                </>
              ) : (
                <Pend>, and how often it happens</Pend>
              )
            ) : null}
            .
            {preset && nn(draft.before) && nn(draft.after) ? (
              <>
                {' '}
                That is worth about <Bold purple>{formatMoneyFlow(calc.net)} a month</Bold>, using{' '}
                {calc.rateSupplied ? "your organization's own figures" : 'a T4L default figure'}.
              </>
            ) : null}
          </Text>
        </Box>
      )}

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
                onClick={() => patch({ cat: c.k, preset: null, unit: '' })}
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
                    title={w.d}
                    onClick={() =>
                      patch(rev ? { growth: w.k, preset: null, unit: '' } : { waste: w.k, preset: null, unit: '' })
                    }
                  >
                    {w.n}
                  </Chip>
                </WrapItem>
              ))}
            </Wrap>
            <Text fontSize="xs" color="gray.500" mt={2}>
              {chipList.find((w) => w.k === chipSel)?.d}
            </Text>
          </Box>
          <Note variant="info" title="Why we ask this first">
            It narrows the next screen from fifteen options to three or four that match what you actually did. It also
            lets Transformation Leader add up the same kind of improvement across every client.
          </Note>
        </Stack>
      )}

      {draft.step === 2 && (
        <Stack spacing={3}>
          <Heading size="md">
            What are you measuring
            <HelpBtn k="measure" onOpen={setHelpKey} />
          </Heading>
          <Text color="text.secondary" fontSize="sm">
            These are the standard ways this kind of improvement gets measured. Pick the closest. It sets the units and
            the sums for you.
          </Text>
          {shown.map((x) => (
            <CardPick key={x.id} on={draft.preset === x.id} onClick={() => pickPreset(x.id)}>
              <Text fontWeight="600">{x.name}</Text>
              <Text fontSize="sm" color="text.secondary">
                {x.ask}
              </Text>
              <HStack mt={2} spacing={2} flexWrap="wrap">
                <Box as="span" fontSize="xs" px={2} py={0.5} rounded="full" bg="purple.50" color="purple.800">
                  measured in {x.unit}
                </Box>
                <Box as="span" fontSize="xs" px={2} py={0.5} rounded="full" bg="blue.50" color="blue.800">
                  {x.needs === 'none' ? 'no rate needed' : `uses your ${RATE_LABEL[x.needs] || x.needs}`}
                </Box>
                <Box as="span" fontSize="xs" px={2} py={0.5} rounded="full" bg="gray.100" color="gray.600">
                  {x.eg}
                </Box>
              </HStack>
            </CardPick>
          ))}
          <CardPick on={isCustom} onClick={() => pickPreset('CUSTOM')}>
            <Text fontWeight="600">None of these fit</Text>
            <Text fontSize="sm" color="text.secondary">
              Describe it yourself. It still gets checked, but it will not roll up with the standard measures.
            </Text>
          </CardPick>
          {(preset || isCustom) && (
            <Stack spacing={3} mt={2}>
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                <FormControl>
                  <FormLabel fontSize="sm">Give it a short name</FormLabel>
                  <Input
                    value={draft.name}
                    placeholder={preset ? `${preset.name}, Accounts Payable` : 'e.g. My custom measure'}
                    bg={!draft.name ? 'yellow.50' : undefined}
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                  <FormHelperText>How you will recognise it in your list.</FormHelperText>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Where does this happen</FormLabel>
                  <Input
                    value={draft.where}
                    placeholder="e.g. Accounts Payable, Warehouse 2, Planning team"
                    onChange={(e) => patch({ where: e.target.value })}
                  />
                  <FormHelperText>The team, site or process.</FormHelperText>
                </FormControl>
              </SimpleGrid>
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                {isCustom && (
                  <FormControl>
                    <FormLabel fontSize="sm">Unit family</FormLabel>
                    <Select
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
                <FormControl>
                  <FormLabel fontSize="sm">
                    Measured in
                    <HelpBtn k="unit" onOpen={setHelpKey} />
                  </FormLabel>
                  <Select value={draft.unit} onChange={(e) => patch({ unit: e.target.value })}>
                    {unitOpts.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Select>
                  <FormHelperText>{CLAIM_FLOW_UNITS[fam].label}. Change it if your team counts it differently.</FormHelperText>
                </FormControl>
                {preset && (
                  <Note variant="gold" title="How this one turns into money">
                    {preset.valueRule}
                  </Note>
                )}
              </SimpleGrid>
            </Stack>
          )}
        </Stack>
      )}

      {draft.step === 3 && (
        <Stack spacing={3}>
          <Heading size="md">
            The before number
            <HelpBtn k="before" onOpen={setHelpKey} />
          </Heading>
          <Text color="text.secondary" fontSize="sm">
            {preset?.ask || 'What did it look like before you changed anything?'} Answer for how things were before you
            changed anything.
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
            <FormControl>
              <FormLabel fontSize="sm">Before you changed anything, it was</FormLabel>
              <Flex>
                <Input
                  borderRightRadius={0}
                  inputMode="decimal"
                  value={draft.before}
                  placeholder="e.g. 6.5"
                  bg={!nn(draft.before) ? 'yellow.50' : undefined}
                  onChange={(e) => patch({ before: e.target.value })}
                />
                <Select
                  borderLeftRadius={0}
                  maxW="150px"
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
              <FormHelperText>{preset?.eg || 'Use the same definition you will use for after.'}</FormHelperText>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">
                How far back does that number go
                <HelpBtn k="months" onOpen={setHelpKey} />
              </FormLabel>
              <Select value={draft.months} onChange={(e) => patch({ months: Number(e.target.value) })}>
                {MONTH_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <FormHelperText>
                Twelve months is best because it covers your busy and quiet spells. Less is fine, it just means the
                number is marked as an estimate.
              </FormHelperText>
            </FormControl>
          </SimpleGrid>
          <Checkbox
            isChecked={draft.lockedBefore}
            onChange={(e) => patch({ lockedBefore: e.target.checked })}
            colorScheme="primary"
          >
            <Text fontSize="sm">
              <Bold>I got this from a system or a record, before I made the change.</Bold> Untick if you worked it out
              afterwards.
            </Text>
          </Checkbox>
          <FormControl>
            <FormLabel fontSize="sm">Where did the number come from</FormLabel>
            <Input
              value={draft.evidenceRef}
              placeholder="e.g. SAP report run 28 June, or the shift log book"
              onChange={(e) => patch({ evidenceRef: e.target.value })}
            />
            <FormHelperText>A system name and a date is enough. You can attach the file later.</FormHelperText>
          </FormControl>
          <Checkbox isChecked={draft.locked} onChange={(e) => patch({ locked: e.target.checked })} colorScheme="primary">
            <Text fontSize="sm">
              <Bold>
                Lock this before number.
                <HelpBtn k="lock" onOpen={setHelpKey} />
              </Bold>{' '}
              After this it cannot be quietly changed. This is what makes anyone believe the improvement later.
            </Text>
          </Checkbox>
          {draft.locked && (
            <Note variant="good" title="Locked">
              {format(new Date(), 'yyyy-MM-dd')}, by you. Anyone reviewing this can see it was locked before the result
              was entered.
            </Note>
          )}
          {!draft.lockedBefore || m < 3 ? (
            <Note variant="warn" title="This will be marked as an estimate">
              Either the number came from memory or from after the change. That is allowed. It just means the value stays
              unverified and does not go into any organization total.
            </Note>
          ) : m >= 12 ? (
            <Note variant="good" title="Strong before number">
              Twelve months from a system, locked before the change. This can be fully verified once someone checks it.
            </Note>
          ) : (
            <Note variant="info" title="Good enough">
              Less than a year, so we note that seasonality is not covered. It can still be fully verified.
            </Note>
          )}
        </Stack>
      )}

      {draft.step === 4 && (
        <Stack spacing={3}>
          <Heading size="md">
            What were you aiming for
            <HelpBtn k="goal" onOpen={setHelpKey} />
          </Heading>
          <Text color="text.secondary" fontSize="sm">
            The goal you set before you started. Same units as your before number, so we can compare like with like.
          </Text>
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
                />
                <Input borderLeftRadius={0} maxW="110px" textAlign="center" value={draft.unit} isReadOnly bg="gray.50" />
              </Flex>
              <FormHelperText>Same unit as your before number, so the two can be compared.</FormHelperText>
            </FormControl>
            <Box>
              <Text fontSize="sm" fontWeight="600" mb={2}>
                Not sure? Use a typical one
              </Text>
              <Wrap spacing={2}>
                {(
                  [
                    ['A modest goal', 0.85],
                    ['A typical goal', 1 - (preset?.typical || 30) / 100],
                    ['An ambitious goal', 0.5],
                  ] as const
                ).map(([lab, factor]) => {
                  const v = preset?.dir === 'up' ? nn(draft.before) * (2 - factor) : nn(draft.before) * factor
                  return (
                    <WrapItem key={lab}>
                      <Chip onClick={() => patch({ target: v.toFixed(2) })}>
                        <Box>
                          <Text>{lab}</Text>
                          <Text fontWeight="400" fontSize="11px">
                            {f1(v)} {draft.unit}
                          </Text>
                        </Box>
                      </Chip>
                    </WrapItem>
                  )
                })}
              </Wrap>
              <Text fontSize="xs" color="gray.500" mt={2}>
                Across other organizations, this kind of improvement typically lands around {preset?.typical || 30}{' '}
                percent. You can put in anything.
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
              Your before was {f1(draft.before)} and your after is {f1(draft.after)}. You can still send it. An honest
              result that did not work is worth more to the programme than a number that was massaged.
            </Note>
          )}
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
            You do not type the money. We work it out from your numbers and the figures your finance team gave us.
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
                  {formatMoneyFlow(calc.net)}
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
                  {calc.basis || '—'}
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
          {!calc.rateSupplied && nn(draft.before) && nn(draft.after) && (
            <Note variant="warn" title="Using a default figure">
              Your finance team has not given us this one yet, so we are using a standard figure. Your claim can still be
              checked and approved, but it will be marked as based on a default until finance confirms their own number.
            </Note>
          )}
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={3} mt={2}>
            <FormControl isRequired>
              <FormLabel fontSize="sm">
                Who can confirm this is right
                <HelpBtn k="who" onOpen={setHelpKey} />
              </FormLabel>
              <Input
                mb={2}
                value={draft.ownerName}
                placeholder="Name"
                bg={!draft.ownerName ? 'yellow.50' : undefined}
                onChange={(e) => patch({ ownerName: e.target.value })}
              />
              <Input
                type="email"
                value={draft.ownerEmail}
                placeholder="Email"
                bg={!draft.ownerEmail ? 'yellow.50' : undefined}
                onChange={(e) => patch({ ownerEmail: e.target.value })}
              />
              <FormHelperText>Usually your manager, or whoever owns the number. It cannot be you.</FormHelperText>
            </FormControl>
            <FormControl isRequired={calc.net >= 1000}>
              <FormLabel fontSize="sm">
                Finance check {calc.net >= 1000 ? '(needed at this size)' : '(optional at this size)'}
              </FormLabel>
              <Input mb={2} value={draft.financeName} placeholder="Name" onChange={(e) => patch({ financeName: e.target.value })} />
              <Input
                type="email"
                value={draft.financeEmail}
                placeholder="Email"
                onChange={(e) => patch({ financeEmail: e.target.value })}
              />
              <FormHelperText>
                {calc.net >= 1000
                  ? 'Anything worth $1,000 a month or more needs finance to sign it off before it counts.'
                  : 'Not required, but adding finance is what turns it from an estimate into a verified number.'}
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
