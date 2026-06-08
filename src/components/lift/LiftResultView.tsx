import React from 'react'
import {
  Badge,
  Box,
  Button,
  Divider,
  Heading,
  HStack,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'
import {
  PILLARS,
  ARCHETYPE_COPY,
  OFFERS,
  COACHING,
  type PillarKey,
  type Archetype,
  type LeadTier,
  type Offer,
} from '@/config/liftAssessment'

// Brand palette (THEME_CONTRACT): plum, flame, royal purple, gold
const PLUM = '#27062e'
const FLAME = '#f4540c'
const ROYAL = '#350e6f'
const GOLD = '#eab130'

export interface LiftResultViewProps {
  pillars: Record<PillarKey, number>
  liftIndex: number
  archetype: Archetype
  developmentEdge: PillarKey | null
  recommendedOffer: Offer
  leadTier: LeadTier
  coachingTriggered: boolean
  /** Optional CTA shown at the bottom (e.g. "Continue to the app"). */
  onContinue?: () => void
  continueLabel?: string
}

const pillarName = (key: PillarKey | null): string =>
  key ? PILLARS.find((p) => p.key === key)?.name ?? '' : ''

export const LiftResultView: React.FC<LiftResultViewProps> = ({
  pillars,
  liftIndex,
  archetype,
  developmentEdge,
  recommendedOffer,
  leadTier,
  coachingTriggered,
  onContinue,
  continueLabel = 'Continue',
}) => {
  const copy = ARCHETYPE_COPY[archetype]
  const radarData = PILLARS.map((p) => ({ pillar: p.key, score: pillars[p.key] }))

  return (
    <VStack align="stretch" spacing={6}>
      {/* LIFT Index + radar */}
      <Box bg="white" borderRadius="2xl" p={{ base: 5, md: 7 }} boxShadow="sm" borderWidth="1px">
        <Stack direction={{ base: 'column', md: 'row' }} align="center" spacing={6}>
          <VStack spacing={0} minW="160px">
            <Text fontSize="sm" color="gray.500" fontWeight="medium">
              Your LIFT Index
            </Text>
            <Text fontSize="6xl" fontWeight="bold" lineHeight="1" color={PLUM}>
              {liftIndex}
            </Text>
            <Text fontSize="xs" color="gray.400">
              out of 100
            </Text>
          </VStack>
          <Box flex="1" h="260px" w="full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="#e2d9ea" />
                <PolarAngleAxis dataKey="pillar" tick={{ fill: ROYAL, fontSize: 13, fontWeight: 600 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#9aa', fontSize: 10 }} />
                <Radar dataKey="score" stroke={FLAME} fill={GOLD} fillOpacity={0.45} />
              </RadarChart>
            </ResponsiveContainer>
          </Box>
        </Stack>
        <HStack spacing={4} mt={2} justify="center" wrap="wrap">
          {PILLARS.map((p) => (
            <HStack key={p.key} spacing={2}>
              <Badge bg={PLUM} color="white" borderRadius="full" px={2}>
                {p.key}
              </Badge>
              <Text fontSize="sm" color="gray.600">
                {pillars[p.key]}
              </Text>
            </HStack>
          ))}
        </HStack>
      </Box>

      {/* Archetype block */}
      <Box bg="white" borderRadius="2xl" p={{ base: 5, md: 7 }} boxShadow="sm" borderWidth="1px">
        <Heading size="lg" color={PLUM}>
          {archetype === 'Emerging Leader' ? 'The Emerging Leader' : `The ${archetype}`}
        </Heading>
        <Text mt={3} color="gray.700" lineHeight="1.7">
          {copy.body}
        </Text>

        <Divider my={4} />

        <VStack align="stretch" spacing={2} fontSize="sm">
          <Text>
            <Text as="span" fontWeight="bold" color={ROYAL}>
              Strength:{' '}
            </Text>
            {copy.strength}
          </Text>
          {copy.showEdge && developmentEdge && (
            <Text>
              <Text as="span" fontWeight="bold" color={ROYAL}>
                Your edge:{' '}
              </Text>
              {pillarName(developmentEdge)}
            </Text>
          )}
          <Text>
            <Text as="span" fontWeight="bold" color={ROYAL}>
              Start here:{' '}
            </Text>
            {recommendedOffer.label}
            {recommendedOffer.price ? ` (${recommendedOffer.price})` : ''}
          </Text>
          <Text fontStyle="italic" color="gray.500" mt={1}>
            Say it out loud: &ldquo;{copy.sayItOutLoud}&rdquo;
          </Text>
        </VStack>
      </Box>

      {/* Tier-specific CTA */}
      <Box bg="white" borderRadius="2xl" p={{ base: 5, md: 7 }} boxShadow="sm" borderWidth="1px">
        {leadTier === 'A' ? (
          <VStack align="stretch" spacing={3}>
            <Heading size="sm" color={PLUM}>
              Let&rsquo;s talk about your transformation at scale
            </Heading>
            <Text fontSize="sm" color="gray.600">
              Based on your role and team, the best next step is a conversation.
            </Text>
            <Button bg={FLAME} color="white" _hover={{ bg: ROYAL }} alignSelf="flex-start">
              Book a discovery call
            </Button>
          </VStack>
        ) : leadTier === 'B' ? (
          <VStack align="stretch" spacing={3}>
            <Heading size="sm" color={PLUM}>
              Your recommended Power Journey
            </Heading>
            <Text fontSize="sm" color="gray.700">
              {recommendedOffer.label}
              {recommendedOffer.price ? ` - ${recommendedOffer.price}` : ''}
            </Text>
            <Button bg={FLAME} color="white" _hover={{ bg: ROYAL }} alignSelf="flex-start">
              Start this journey
            </Button>
          </VStack>
        ) : (
          <VStack align="stretch" spacing={3}>
            <Heading size="sm" color={PLUM}>
              Your next steps
            </Heading>
            <Text fontSize="sm" color="gray.700">
              {archetype === 'Practitioner'
                ? `${OFFERS.topVoices.label} (${OFFERS.topVoices.price}), the coaching path, and an invitation to apply to the closed Practitioner community.`
                : `${recommendedOffer.label}${recommendedOffer.price ? ` (${recommendedOffer.price})` : ''}, plus an invitation to join the community.`}
            </Text>
            <Button bg={FLAME} color="white" _hover={{ bg: ROYAL }} alignSelf="flex-start">
              Explore membership and community
            </Button>
          </VStack>
        )}
      </Box>

      {/* Coaching overlay (any archetype) */}
      {coachingTriggered && (
        <Box bg="orange.50" borderRadius="2xl" p={{ base: 5, md: 6 }} borderWidth="1px" borderColor="orange.200">
          <Heading size="sm" color={ROYAL}>
            Transformation Coaching
          </Heading>
          <Text fontSize="sm" color="gray.700" mt={2}>
            {COACHING.single} or {COACHING.pack}. {COACHING.blurb}
          </Text>
          <Button mt={3} variant="outline" borderColor={FLAME} color={FLAME} _hover={{ bg: 'orange.100' }} size="sm">
            Book a coaching session
          </Button>
        </Box>
      )}

      {onContinue && (
        <Button size="lg" bg={PLUM} color="white" _hover={{ bg: ROYAL }} onClick={onContinue}>
          {continueLabel}
        </Button>
      )}
    </VStack>
  )
}
