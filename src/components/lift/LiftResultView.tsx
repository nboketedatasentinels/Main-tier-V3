import React from 'react'
import { Badge, Box, Button, Flex, HStack, Text, VStack } from '@chakra-ui/react'
import {
  PILLARS,
  PILLAR_SHORT_LABEL,
  ARCHETYPE_CONTENT,
  ARCHETYPE_ACCENT,
  RESULT_CHROME,
  type PillarKey,
  type Archetype,
  type LeadTier,
  type Offer,
} from '@/config/liftAssessment'
import { ArchetypeSymbol } from '@/components/lift/ArchetypeSymbol'

// Brand palette (THEME_CONTRACT): plum, flame, royal purple, gold
const PLUM = '#27062e'
const ROYAL = '#350e6f'
const GOLD = '#eab130'

// Where the public funnel sends people to unlock the full breakdown.
const BOOKING_URL =
  'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ0K_YpzXDULQVZ0LGCIxH3K-no0TTHaBQ5jFNLUq6CC1lx_LFMyuwDUMLeByAHVx1ih5phOnIRF'

export interface LiftResultViewProps {
  pillars: Record<PillarKey, number>
  liftIndex: number
  archetype: Archetype
  developmentEdge: PillarKey | null
  recommendedOffer: Offer
  leadTier: LeadTier
  coachingTriggered: boolean
  /**
   * 'public' = the anonymous funnel result. It reveals the archetype + LIFT
   * score, then GATES the full breakdown behind a "book a call" CTA. 'app' =
   * the signed-in member view, which shows the full breakdown and the
   * next-step recommendation. Defaults to 'app'.
   */
  variant?: 'public' | 'app'
  /** Optional CTA shown at the bottom (e.g. "Continue to the app"). On the
   *  public gated view this becomes the low-key "continue anyway" escape. */
  onContinue?: () => void
  continueLabel?: string
}

const SINGLE_PILLAR_ARCHETYPES: Archetype[] = ['Anchor', 'Architect', 'Catalyst', 'Operator']

const Section: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box bg="white" borderRadius="2xl" p={{ base: 5, md: 7 }} boxShadow="sm" borderWidth="1px" borderColor="gray.100">
    {children}
  </Box>
)

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text fontSize="xs" fontWeight="bold" letterSpacing="0.14em" textTransform="uppercase" color={ROYAL} mb={4}>
    {children}
  </Text>
)

export const LiftResultView: React.FC<LiftResultViewProps> = ({
  pillars,
  liftIndex,
  archetype,
  developmentEdge,
  variant = 'app',
  onContinue,
  continueLabel = 'Continue',
}) => {
  const isPublic = variant === 'public'
  const content = ARCHETYPE_CONTENT[archetype]
  const accent = ARCHETYPE_ACCENT[archetype]
  const archetypeName = archetype === 'Emerging Leader' ? 'The Emerging Leader' : `The ${archetype}`

  // Carry = highest pillar, edge = lowest (developmentEdge). Bar badges only for
  // the four single-pillar archetypes; Practitioner/Emerging explain in copy.
  const carryKey = PILLARS.reduce<PillarKey>(
    (best, p) => (pillars[p.key] > pillars[best] ? p.key : best),
    PILLARS[0].key,
  )
  const showBarBadges = SINGLE_PILLAR_ARCHETYPES.includes(archetype)

  // Sections 2–5: the detailed breakdown. Shown in full to signed-in members;
  // blurred behind the booking gate for the anonymous public funnel.
  const breakdown = (
    <>
      {/* 2 · Pillar profile (bars, width = score) */}
      <Section>
        <SectionTitle>Your pillar profile</SectionTitle>
        <VStack align="stretch" spacing={4}>
          {PILLARS.map((p) => {
            const score = pillars[p.key]
            const isCarry = showBarBadges && p.key === carryKey
            const isEdge = showBarBadges && p.key === developmentEdge
            return (
              <Box key={p.key}>
                <Flex justify="space-between" align="center" mb={1.5} gap={2}>
                  <HStack spacing={2} minW={0}>
                    <Badge bg={PLUM} color="white" borderRadius="full" px={2} flexShrink={0}>
                      {p.key}
                    </Badge>
                    <Text fontSize="sm" fontWeight="semibold" color={PLUM} noOfLines={1}>
                      {p.name}
                    </Text>
                    {isCarry && (
                      <Badge bg={GOLD} color={PLUM} borderRadius="full" px={2} fontSize="0.62rem" flexShrink={0}>
                        {RESULT_CHROME.carryBadge}
                      </Badge>
                    )}
                    {isEdge && (
                      <Badge
                        variant="outline"
                        color={ROYAL}
                        borderColor={ROYAL}
                        borderRadius="full"
                        px={2}
                        fontSize="0.62rem"
                        flexShrink={0}
                      >
                        {RESULT_CHROME.edgeBadge}
                      </Badge>
                    )}
                  </HStack>
                  <Text fontSize="sm" fontWeight="bold" color={PLUM} flexShrink={0}>
                    {score}
                  </Text>
                </Flex>
                <Box h="10px" w="full" bg="gray.100" borderRadius="full" overflow="hidden">
                  <Box h="full" borderRadius="full" bgGradient={`linear(to-r, ${PLUM}, ${GOLD})`} width={`${score}%`} />
                </Box>
              </Box>
            )
          })}
        </VStack>
      </Section>

      {/* 3 · Pillar by pillar */}
      <Section>
        <SectionTitle>Pillar by pillar</SectionTitle>
        <VStack align="stretch" spacing={5}>
          {content.pillarBlocks.map((block) => (
            <Box key={block.key}>
              <Flex align="center" gap={2} mb={2}>
                <Text fontSize="md" fontWeight="bold" color={PLUM}>
                  {block.key} · {PILLAR_SHORT_LABEL[block.key]}
                </Text>
                {block.role && (
                  <Text fontSize="sm" fontWeight="semibold" color={accent}>
                    {block.role === 'strength' ? '(your strength)' : '(your edge)'}
                  </Text>
                )}
              </Flex>
              <VStack align="stretch" spacing={1.5} fontSize="sm" color="gray.700" lineHeight="1.6">
                <Text>
                  <Text as="span" fontWeight="bold" color={ROYAL}>
                    How you show up.{' '}
                  </Text>
                  {block.howYouShowUp}
                </Text>
                <Text>
                  <Text as="span" fontWeight="bold" color={ROYAL}>
                    Asset.{' '}
                  </Text>
                  {block.asset}
                </Text>
                <Text>
                  <Text as="span" fontWeight="bold" color={ROYAL}>
                    Watch for.{' '}
                  </Text>
                  {block.watchFor}
                </Text>
              </VStack>
            </Box>
          ))}
        </VStack>
      </Section>

      {/* 4 · Carry and edge */}
      <Box
        borderRadius="2xl"
        p={{ base: 5, md: 6 }}
        bgGradient="linear(to-r, #fffaf0, #fbf2d8)"
        borderWidth="1px"
        borderColor="#f3e2b3"
      >
        <SectionTitle>Carry and edge</SectionTitle>
        <Text color={PLUM} fontWeight="medium" lineHeight="1.7">
          {content.carryEdge}
        </Text>
      </Box>

      {/* 5 · How this plays out under pressure */}
      <Section>
        <SectionTitle>How this plays out under pressure</SectionTitle>
        <VStack align="stretch" spacing={4}>
          {content.scenarios.map((s) => (
            <Box key={s.situation} borderLeftWidth="3px" borderColor={GOLD} pl={4}>
              <Text fontWeight="bold" color={PLUM} fontSize="sm">
                {s.situation}
              </Text>
              <Text fontSize="sm" color="gray.700" mt={1} lineHeight="1.6">
                {s.guidance}
              </Text>
            </Box>
          ))}
        </VStack>
      </Section>
    </>
  )

  return (
    <VStack align="stretch" spacing={5}>
      {/* 1 · Archetype reveal */}
      <Section>
        <VStack align="stretch" spacing={4}>
          <Text fontSize="xs" fontWeight="bold" letterSpacing="0.18em" textTransform="uppercase" color={accent}>
            {RESULT_CHROME.eyebrow}
          </Text>
          <Flex align="center" gap={4} wrap="wrap">
            <Box flexShrink={0}>
              <ArchetypeSymbol archetype={archetype} size={68} />
            </Box>
            <Box flex="1" minW="180px">
              <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="extrabold" color={PLUM} lineHeight="1.1">
                {archetypeName}
              </Text>
              <Text fontSize="sm" color="gray.600" mt={1}>
                <Text as="span" fontWeight="bold" color={accent}>
                  Strongest pillar:{' '}
                </Text>
                {content.strongest}
              </Text>
            </Box>
            <VStack spacing={0} align={{ base: 'flex-start', sm: 'flex-end' }}>
              <Text fontSize="xs" color="gray.500" fontWeight="medium">
                LIFT Index
              </Text>
              <Text
                fontSize="4xl"
                fontWeight="extrabold"
                lineHeight="1"
                bgGradient={`linear(to-br, ${PLUM}, ${GOLD})`}
                bgClip="text"
              >
                {liftIndex}
              </Text>
              <Text fontSize="xs" color="gray.400">
                out of 100
              </Text>
            </VStack>
          </Flex>
          <Text color="gray.700" lineHeight="1.7">
            {content.reveal}
          </Text>
        </VStack>
      </Section>

      {isPublic ? (
        /* Public funnel: tease the breakdown, then gate it behind a call. */
        <Box position="relative">
          {/* Blurred peek of the full breakdown — enough to see it's rich, not enough to read. */}
          <Box
            aria-hidden="true"
            maxH="300px"
            overflow="hidden"
            filter="blur(7px)"
            opacity={0.55}
            sx={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <VStack align="stretch" spacing={5}>
              {breakdown}
            </VStack>
          </Box>
          {/* Fade the peek into the gate. */}
          <Box
            position="absolute"
            left={0}
            right={0}
            bottom={0}
            h="180px"
            bgGradient="linear(to-b, rgba(255,255,255,0), #ffffff)"
            pointerEvents="none"
          />

          {/* The gate — the last, unmissable thing. */}
          <Box
            mt={-14}
            position="relative"
            borderRadius="2xl"
            p={{ base: 6, md: 8 }}
            bgGradient={`linear(to-br, ${PLUM}, ${ROYAL})`}
            color="white"
            boxShadow="2xl"
            borderWidth="1px"
            borderColor="whiteAlpha.200"
          >
            <VStack align="stretch" spacing={4}>
              <Text
                fontSize="xs"
                fontWeight="bold"
                letterSpacing="0.16em"
                textTransform="uppercase"
                color={GOLD}
                textAlign="center"
              >
                🔒 Your full breakdown is ready
              </Text>
              <Text fontSize={{ base: 'xl', md: '2xl' }} fontWeight="extrabold" lineHeight="1.2" textAlign="center">
                You&rsquo;ve seen your score. You haven&rsquo;t seen what it means.
              </Text>
              <Text color="whiteAlpha.900" lineHeight="1.7" textAlign="center">
                The number is the easy part. The real read — where you&rsquo;ll quietly stall, the strength you can
                build a career on, and the one move that shifts your trajectory — is mapped out below. On a short
                call we&rsquo;ll walk you through all of it, together, and where to go next.
              </Text>

              <VStack
                align="stretch"
                spacing={2}
                bg="whiteAlpha.100"
                borderRadius="xl"
                p={4}
                fontSize="sm"
                color="whiteAlpha.900"
              >
                {[
                  'Your four pillars, scored and ranked',
                  'Where you lose ground under real pressure',
                  'Your carry strength — and your growth edge',
                  'The single most valuable thing to build next',
                ].map((line) => (
                  <HStack key={line} align="start" spacing={2}>
                    <Text as="span" color={GOLD} fontWeight="bold" lineHeight="1.6">
                      ✓
                    </Text>
                    <Text lineHeight="1.6">{line}</Text>
                  </HStack>
                ))}
              </VStack>

              <Button
                as="a"
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                size="lg"
                bg={GOLD}
                color={PLUM}
                fontWeight="bold"
                _hover={{ bg: '#f9db59', transform: 'translateY(-1px)' }}
                _active={{ bg: GOLD }}
                boxShadow="lg"
              >
                Book my call — unlock everything
              </Button>

              <Text fontSize="xs" color="whiteAlpha.700" textAlign="center">
                No pressure — bring your questions.
              </Text>

              {onContinue && (
                <Button
                  variant="link"
                  color="whiteAlpha.700"
                  fontSize="sm"
                  fontWeight="medium"
                  onClick={onContinue}
                  _hover={{ color: 'white' }}
                >
                  I&rsquo;ll continue with just my score for now
                </Button>
              )}
            </VStack>
          </Box>
        </Box>
      ) : (
        /* Signed-in member: the full breakdown, plus next steps. */
        <>
          {breakdown}

          {/* Footer chrome */}
          <VStack spacing={1.5} pt={1} textAlign="center">
            <Text fontSize="xs" color="gray.500">
              {RESULT_CHROME.retake}
            </Text>
            <Text fontSize="xs" color="gray.400" fontStyle="italic">
              {RESULT_CHROME.mission}
            </Text>
          </VStack>

          {onContinue && (
            <Button size="lg" bg={PLUM} color="white" _hover={{ bg: ROYAL }} onClick={onContinue}>
              {continueLabel}
            </Button>
          )}
        </>
      )}
    </VStack>
  )
}
