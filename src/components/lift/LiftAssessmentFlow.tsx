import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, Gift, Lock, Sparkles } from 'lucide-react'
import {
  ITEMS,
  SCALE,
  INTAKE_FIELDS,
  CONTACT_FIELDS,
  COUNTRY_DIAL_CODES,
  DIAL_CODES,
  PILLARS,
  validateWorkEmail,
  validatePhone,
  type AssessmentItem,
  type ContactField,
  type IntakeField,
  type PillarKey,
} from '@/config/liftAssessment'
import { computeLiftResult, type ItemScores, type IntakeAnswers, type LiftResult } from '@/utils/liftScoring'

const PLUM = '#27062e'
const GOLD = '#eab130'

const MotionBox = motion(Box)

interface LiftAssessmentFlowProps {
  onComplete: (intake: IntakeAnswers, itemScores: ItemScores, result: LiftResult) => void
  /**
   * Fired the moment contact details are submitted (before the questions). The
   * public funnel uses this to save the lead up-front, so it is captured even if
   * the visitor abandons the assessment partway.
   */
  onContactCaptured?: (contact: IntakeAnswers) => void
  submitting?: boolean
  /** Where the flow opens. Public funnel passes 'countdown' (landing was the intro). */
  initialPhase?: 'intro' | 'countdown' | 'questions'
}

type Step =
  | { kind: 'intake'; field: IntakeField }
  | { kind: 'item'; item: AssessmentItem }

// Short pillar labels for the in-flow context chip.
const PILLAR_SHORT: Record<PillarKey, string> = {
  L: 'Leading Self',
  I: 'Innovation & AI',
  F: 'AI-Ready Teams',
  T: 'Transforming Business',
}
const PILLAR_NAME: Record<string, string> = PILLARS.reduce(
  (acc, p) => ({ ...acc, [p.key]: p.name }),
  {} as Record<string, string>,
)

// Fisher-Yates shuffle (item order randomised per session; mapping preserved by id).
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const LiftAssessmentFlow: React.FC<LiftAssessmentFlowProps> = ({
  onComplete,
  onContactCaptured,
  submitting,
  initialPhase = 'intro',
}) => {
  const items = useMemo(() => shuffle(ITEMS), [])
  const steps = useMemo<Step[]>(
    () => [
      ...INTAKE_FIELDS.map((field) => ({ kind: 'intake', field }) as Step),
      ...items.map((item) => ({ kind: 'item', item }) as Step),
    ],
    [items],
  )

  const total = steps.length
  const [phase, setPhase] = useState<'intro' | 'countdown' | 'questions' | 'details'>(initialPhase)
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)
  const [intake, setIntake] = useState<IntakeAnswers>({})
  const [scores, setScores] = useState<ItemScores>({})
  const [scoring, setScoring] = useState(false)
  const advanceTimer = useRef<number | null>(null)

  const step = steps[index]
  const isLast = index === total - 1

  useEffect(
    () => () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
    },
    [],
  )

  const finish = useCallback(
    (finalIntake: IntakeAnswers, finalScores: ItemScores) => {
      setScoring(true)
      const result = computeLiftResult(finalScores, finalIntake)
      // A short, deliberate "scoring" beat - feels considered, not janky.
      window.setTimeout(() => onComplete(finalIntake, finalScores, result), 700)
    },
    [onComplete],
  )

  const advanceAfter = useCallback(
    (nextIntake: IntakeAnswers, nextScores: ItemScores) => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
      advanceTimer.current = window.setTimeout(() => {
        // Last question answered -> score + reveal results (details were collected up-front).
        if (isLast) finish(nextIntake, nextScores)
        else {
          setDir(1)
          setIndex((i) => Math.min(i + 1, total - 1))
        }
      }, 240)
    },
    [finish, isLast, total],
  )

  // Contact step submitted (up-front, before the questions): fold the details
  // into intake, hand them to the funnel to save the lead now, then start.
  const handleDetails = useCallback(
    (contact: Partial<IntakeAnswers>) => {
      const merged = { ...intake, ...contact }
      setIntake(merged)
      onContactCaptured?.(merged)
      setDir(1)
      setIndex(0)
      setPhase('questions')
    },
    [intake, onContactCaptured],
  )

  const pickIntake = useCallback(
    (value: string) => {
      if (step.kind !== 'intake') return
      const next = { ...intake, [step.field.id]: value }
      setIntake(next)
      advanceAfter(next, scores)
    },
    [advanceAfter, intake, scores, step],
  )

  const pickItem = useCallback(
    (value: number) => {
      if (step.kind !== 'item') return
      const next = { ...scores, [step.item.id]: value }
      setScores(next)
      advanceAfter(intake, next)
    },
    [advanceAfter, intake, scores, step],
  )

  const goBack = useCallback(() => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
    setDir(-1)
    setIndex((i) => Math.max(i - 1, 0))
  }, [])

  // Keyboard: 1-5 answers a scale item, number keys pick an intake option, Backspace goes back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (scoring || phase !== 'questions') return
      if (e.key === 'Backspace' && index > 0) {
        e.preventDefault()
        goBack()
        return
      }
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1) return
      if (step.kind === 'item' && n <= SCALE.labels.length) {
        e.preventDefault()
        pickItem(n - 1)
      } else if (step.kind === 'intake' && n <= step.field.options.length) {
        e.preventDefault()
        pickIntake(step.field.options[n - 1].value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goBack, index, phase, pickIntake, pickItem, scoring, step])

  const progress = Math.round(((index + (scoring ? 1 : 0)) / total) * 100)
  const selectedIntake = step.kind === 'intake' ? intake[step.field.id] : undefined
  const selectedItem = step.kind === 'item' ? scores[step.item.id] : undefined

  if (scoring || submitting) {
    return (
      <VStack spacing={6} py={16} textAlign="center">
        <Spinner thickness="4px" speed="0.7s" emptyColor="gray.100" color={PLUM} boxSize="56px" />
        <Box>
          <Text fontSize="xl" fontWeight="bold" color={PLUM}>
            Scoring your LIFT Index
          </Text>
          <Text fontSize="sm" color="gray.500" mt={1}>
            Mapping your answers across the four pillars…
          </Text>
        </Box>
      </VStack>
    )
  }

  if (phase === 'intro') {
    return <Intro onStart={() => setPhase('countdown')} />
  }

  if (phase === 'countdown') {
    return <Countdown onDone={() => setPhase('details')} />
  }

  if (phase === 'details') {
    return <ContactDetails onSubmit={handleDetails} submitting={Boolean(submitting)} />
  }

  return (
    <VStack align="stretch" spacing={0} minH={{ base: 'auto', md: '440px' }}>
      {/* Progress + context */}
      <Box>
        <HStack justify="space-between" mb={2}>
          <HStack spacing={2} minH="24px">
            {index > 0 && (
              <Flex
                as="button"
                onClick={goBack}
                align="center"
                gap={1}
                color="gray.500"
                fontSize="sm"
                _hover={{ color: PLUM }}
                aria-label="Previous question"
              >
                <ArrowLeft size={16} />
                Back
              </Flex>
            )}
            {step.kind === 'item' && (
              <Text
                fontSize="xs"
                fontWeight="bold"
                letterSpacing="0.08em"
                textTransform="uppercase"
                color={GOLD}
                title={PILLAR_NAME[step.item.pillar]}
              >
                {PILLAR_SHORT[step.item.pillar]}
              </Text>
            )}
          </HStack>
          <Text fontSize="sm" color="gray.500" fontWeight="medium">
            {index + 1} <Box as="span" color="gray.300">/ {total}</Box>
          </Text>
        </HStack>
        <Box h="6px" w="full" bg="gray.100" borderRadius="full" overflow="hidden">
          <MotionBox
            h="full"
            borderRadius="full"
            bgGradient={`linear(to-r, ${PLUM}, ${GOLD})`}
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </Box>
      </Box>

      {/* Question + answers */}
      <Flex flex="1" align="center" py={{ base: 6, md: 8 }}>
        <AnimatePresence mode="wait" custom={dir}>
          <MotionBox
            key={index}
            w="full"
            custom={dir}
            initial={{ opacity: 0, x: dir > 0 ? 40 : -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir > 0 ? -40 : 40 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {step.kind === 'intake' ? (
              <VStack align="stretch" spacing={5}>
                <Text fontSize={{ base: 'xl', md: '2xl' }} fontWeight="bold" color={PLUM} lineHeight="1.25">
                  {step.field.label}
                </Text>
                <VStack align="stretch" spacing={3}>
                  {step.field.options.map((opt) => {
                    const active = selectedIntake === opt.value
                    return (
                      <ChoiceRow
                        key={opt.value}
                        label={opt.label}
                        active={active}
                        onClick={() => pickIntake(opt.value)}
                      />
                    )
                  })}
                </VStack>
              </VStack>
            ) : (
              <VStack align="stretch" spacing={6}>
                <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold" color={PLUM} lineHeight="1.25">
                  {step.item.text}
                </Text>
                <VStack align="stretch" spacing={3}>
                  {SCALE.labels.map((label, value) => (
                    <ChoiceRow
                      key={value}
                      label={label}
                      active={selectedItem === value}
                      onClick={() => pickItem(value)}
                    />
                  ))}
                </VStack>
              </VStack>
            )}
          </MotionBox>
        </AnimatePresence>
      </Flex>

      <Text fontSize="xs" color="gray.400" textAlign="center" pt={2}>
        Tip: tap an answer to continue. Press 1-{SCALE.labels.length} on your keyboard, or Backspace to go back.
      </Text>
    </VStack>
  )
}

const Intro: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <VStack
    spacing={7}
    py={{ base: 8, md: 10 }}
    textAlign="center"
    minH={{ base: '360px', md: '440px' }}
    justify="center"
  >
    <MotionBox
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Flex
        display="inline-flex"
        align="center"
        gap={2}
        px={4}
        py={1.5}
        mb={4}
        borderRadius="full"
        bg="#fbf2d8"
        color="#9c6f15"
        fontWeight="bold"
        fontSize="sm"
      >
        <Sparkles size={16} /> The LIFT Index
      </Flex>
      <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="extrabold" color={PLUM} lineHeight="1.2">
        Discover your leadership profile
      </Text>
      <Text mt={3} maxW="md" mx="auto" color="gray.600">
        A quick self-assessment across the four LIFT pillars. Answer honestly - there are no right or wrong
        answers. It takes about 3-4 minutes.
      </Text>
    </MotionBox>
    <Button
      onClick={onStart}
      px={12}
      py={7}
      borderRadius="full"
      bg={PLUM}
      color="white"
      fontSize="lg"
      fontWeight="bold"
      shadow="lg"
      _hover={{ bg: '#3a0d44' }}
      _active={{ transform: 'scale(0.99)' }}
    >
      Get started
    </Button>
  </VStack>
)

const Countdown: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [n, setN] = useState(3)

  useEffect(() => {
    if (n === 0) {
      const t = window.setTimeout(onDone, 650)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => setN((v) => v - 1), 850)
    return () => window.clearTimeout(t)
  }, [n, onDone])

  const label = n > 0 ? String(n) : 'Start'

  return (
    <Flex direction="column" align="center" justify="center" minH={{ base: '360px', md: '440px' }} gap={8}>
      <Text fontSize="sm" letterSpacing="0.25em" textTransform="uppercase" color="gray.400">
        Get ready
      </Text>
      <Box position="relative" w="170px" h="170px">
        <MotionBox
          position="absolute"
          inset="0"
          borderRadius="full"
          border="3px solid"
          borderColor={GOLD}
          initial={{ scale: 0.85, opacity: 0.65 }}
          animate={{ scale: 1.18, opacity: 0 }}
          transition={{ duration: 0.85, repeat: Infinity, ease: 'easeOut' }}
        />
        <Flex position="absolute" inset="0" align="center" justify="center">
          <AnimatePresence mode="wait">
            <MotionBox
              key={label}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <Text
                fontWeight="extrabold"
                fontSize={label === 'Start' ? '4xl' : '7xl'}
                bgGradient={`linear(to-br, ${PLUM}, ${GOLD})`}
                bgClip="text"
              >
                {label}
              </Text>
            </MotionBox>
          </AnimatePresence>
        </Flex>
      </Box>
    </Flex>
  )
}

// ── Contact capture: the moment the assessment is done, before results show.
// Framed as the unlock - "your profile + points are ready, tell us where to send them."
const ContactDetails: React.FC<{
  onSubmit: (contact: Partial<IntakeAnswers>) => void
  submitting: boolean
}> = ({ onSubmit, submitting }) => {
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const setField = (id: string, value: string) => {
    setValues((v) => {
      const next = { ...v, [id]: value }
      // Auto-fill the phone dial code from the chosen country (still editable).
      if (id === 'country') {
        const code = COUNTRY_DIAL_CODES[value]
        if (code) next.dialCode = code
      }
      return next
    })
    // Clear an error as soon as the user starts fixing it. Choosing a dial code
    // (or a country, which auto-fills it) also clears any phone error, since
    // that error is keyed to the phone field, not the code.
    setErrors((e) => {
      if (!errors[id] && !(id === 'dialCode' || id === 'country')) return e
      const cleared = { ...e, [id]: '' }
      if (id === 'dialCode' || id === 'country') cleared.phone = ''
      return cleared
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    for (const field of CONTACT_FIELDS) {
      const val = (values[field.id] ?? '').trim()
      if (field.id === 'email') {
        // Work email only: reject personal/disposable providers, not just bad shape.
        const emailError = validateWorkEmail(val)
        if (emailError) next[field.id] = emailError
      } else if (field.id === 'phone') {
        // Optional, but if given it must be a real, plausible number.
        const phoneError = validatePhone(val, values.dialCode ?? '')
        if (phoneError) next[field.id] = phoneError
      } else if (field.required && !val) {
        next[field.id] = `${field.label} is required`
      }
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return

    // Hand back trimmed, non-empty values only.
    const contact: Partial<IntakeAnswers> = {}
    for (const field of CONTACT_FIELDS) {
      const val = (values[field.id] ?? '').trim()
      if (val) contact[field.id] = val
    }
    // Combine dial code + national number into one E.164-ish string, dropping a
    // leading zero when a code is present (e.g. +254 + 0712... -> +254712...).
    const rawPhone = (values.phone ?? '').trim()
    if (rawPhone) {
      const code = (values.dialCode ?? '').trim()
      let digits = rawPhone.replace(/\D/g, '')
      if (code) digits = digits.replace(/^0+/, '')
      contact.phone = code ? `${code}${digits}` : digits
    } else {
      delete contact.phone
    }
    onSubmit(contact)
  }

  const half = CONTACT_FIELDS.filter((f) => f.half)
  const full = CONTACT_FIELDS.filter((f) => !f.half)

  const renderField = (field: ContactField) => {
    const value = values[field.id] ?? ''
    const error = errors[field.id]
    const focusStyles = {
      borderColor: GOLD,
      boxShadow: `0 0 0 1px ${GOLD}`,
    }
    return (
      <FormControl key={field.id} isInvalid={Boolean(error)} isRequired={field.required}>
        <FormLabel fontSize="sm" fontWeight="semibold" color={PLUM} mb={1.5}>
          {field.label}
        </FormLabel>
        {field.id === 'phone' ? (
          <HStack spacing={2} align="stretch">
            <Select
              aria-label="Country dial code"
              value={values.dialCode ?? ''}
              onChange={(e) => setField('dialCode', e.target.value)}
              w="110px"
              flexShrink={0}
              size="lg"
              borderRadius="xl"
              borderWidth="2px"
              borderColor="gray.200"
              bg="white"
              color={values.dialCode ? 'gray.800' : 'gray.400'}
              _hover={{ borderColor: 'gray.300' }}
              _focus={focusStyles}
            >
              <option value="" disabled>
                +code
              </option>
              {DIAL_CODES.map((code) => (
                <option key={code} value={code} style={{ color: '#1A202C' }}>
                  {code}
                </option>
              ))}
            </Select>
            <Input
              type="tel"
              value={value}
              onChange={(e) => setField(field.id, e.target.value)}
              placeholder={field.placeholder}
              size="lg"
              borderRadius="xl"
              borderWidth="2px"
              borderColor="gray.200"
              bg="white"
              flex="1"
              _hover={{ borderColor: 'gray.300' }}
              _focus={focusStyles}
              _placeholder={{ color: 'gray.400' }}
            />
          </HStack>
        ) : field.type === 'select' ? (
          <Select
            value={value}
            onChange={(e) => setField(field.id, e.target.value)}
            placeholder={`Select ${field.label.toLowerCase()}`}
            size="lg"
            borderRadius="xl"
            borderWidth="2px"
            borderColor="gray.200"
            bg="white"
            color={value ? 'gray.800' : 'gray.400'}
            _hover={{ borderColor: 'gray.300' }}
            _focus={focusStyles}
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ color: '#1A202C' }}>
                {opt.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            type={field.type}
            value={value}
            onChange={(e) => setField(field.id, e.target.value)}
            placeholder={field.placeholder}
            size="lg"
            borderRadius="xl"
            borderWidth="2px"
            borderColor="gray.200"
            bg="white"
            _hover={{ borderColor: 'gray.300' }}
            _focus={focusStyles}
            _placeholder={{ color: 'gray.400' }}
          />
        )}
        <FormErrorMessage fontSize="xs">{error}</FormErrorMessage>
      </FormControl>
    )
  }

  return (
    <MotionBox
      as="form"
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <VStack align="stretch" spacing={6}>
        {/* Gold strip - sets the expectation for what's next */}
        <Flex
          align="center"
          gap={3}
          px={4}
          py={3}
          borderRadius="xl"
          bgGradient="linear(to-r, #fffaf0, #fbf2d8)"
          borderWidth="1px"
          borderColor="#f3e2b3"
        >
          <Flex
            align="center"
            justify="center"
            boxSize="38px"
            borderRadius="full"
            bg={GOLD}
            color={PLUM}
            flexShrink={0}
          >
            <Gift size={20} />
          </Flex>
          <Box>
            <Text fontWeight="bold" color={PLUM} fontSize="sm">
              About 4 minutes, then your full profile
            </Text>
            <Text fontSize="xs" color="#9c6f15">
              We&apos;ll email your LIFT profile so you never lose it.
            </Text>
          </Box>
        </Flex>

        {/* The form */}
        <VStack align="stretch" spacing={4}>
          <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
            {half.map(renderField)}
          </SimpleGrid>
          {full.map(renderField)}
        </VStack>

        <Button
          type="submit"
          isLoading={submitting}
          loadingText="Saving your details"
          size="lg"
          py={7}
          borderRadius="full"
          bg={PLUM}
          color="white"
          fontWeight="bold"
          fontSize="md"
          shadow="lg"
          _hover={{ bg: '#3a0d44' }}
          _active={{ transform: 'scale(0.99)' }}
        >
          Start the assessment
        </Button>

        <Flex align="center" justify="center" gap={1.5} color="gray.400">
          <Lock size={13} />
          <Text fontSize="xs">Your details are private and used only to deliver your results.</Text>
        </Flex>
      </VStack>
    </MotionBox>
  )
}

const ChoiceRow: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({
  label,
  active,
  onClick,
}) => (
  <Box
    as="button"
    type="button"
    onClick={onClick}
    textAlign="left"
    w="full"
    px={5}
    py={4}
    borderRadius="xl"
    borderWidth="2px"
    borderColor={active ? PLUM : 'gray.200'}
    bg={active ? PLUM : 'white'}
    color={active ? 'white' : 'gray.700'}
    fontWeight="semibold"
    transition="all 0.15s ease"
    _hover={active ? {} : { borderColor: GOLD, bg: '#fffaf0', transform: 'translateY(-1px)' }}
    _active={{ transform: 'scale(0.99)' }}
  >
    <Flex align="center" justify="space-between" gap={3}>
      <Text color={active ? 'white' : 'inherit'}>{label}</Text>
      {active && <Check size={20} />}
    </Flex>
  </Box>
)

export default LiftAssessmentFlow
