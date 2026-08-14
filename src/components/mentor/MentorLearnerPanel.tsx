import React, { useMemo } from 'react'
import {
  Box,
  HStack,
  Icon,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Sparkles } from 'lucide-react'
import {
  buildAiInference,
  buildMentoringSessionPlan,
  buildStrengthsWeaknessesWriteUp,
} from '@/services/mentorCoachingInsights'
import { MentorshipGoalsCard } from '@/components/leadership/MentorshipGoalsCard'
import { getDisplayName } from '@/utils/displayName'
import { PERSONALITY_TYPES } from '@/config/personality-data'
import type { UserProfile } from '@/types'

const PLUM = '#27062e'
const GOLD = '#eab130'

const personalityLabel = (type?: string | null): string | null => {
  if (!type) return null
  const hit = PERSONALITY_TYPES.find((p) => p.type === type)
  return hit ? `${hit.type} · ${hit.name}` : type
}

type MentorLearnerPanelProps = {
  learner: UserProfile
  mentorId?: string | null
}

/**
 * Mentor mentee profile surface — parity with coach: values, age, personality,
 * AI-labeled notes, strengths/weaknesses, optional goal, suggested session topics.
 */
export const MentorLearnerPanel: React.FC<MentorLearnerPanelProps> = ({
  learner,
  mentorId,
}) => {
  const insightInput = useMemo(
    () => ({
      name: getDisplayName(learner),
      personalityType: learner.personalityType,
      coreValues: learner.coreValues,
      ageRange: (learner as { ageRange?: string | null }).ageRange ?? null,
      journeyType: typeof learner.journeyType === 'string' ? learner.journeyType : null,
      currentWeek: learner.currentWeek ?? null,
    }),
    [learner],
  )

  const aiNotes = useMemo(() => buildAiInference(insightInput), [insightInput])
  const strengths = useMemo(() => buildStrengthsWeaknessesWriteUp(insightInput), [insightInput])
  const sessionPlan = useMemo(() => buildMentoringSessionPlan(insightInput), [insightInput])

  const values = (learner.coreValues || []).filter(Boolean)
  const ageRange = (learner as { ageRange?: string | null }).ageRange

  return (
    <Stack spacing={5}>
      <Box border="1px solid" borderColor="gray.200" borderRadius="xl" bg="white" overflow="hidden">
        <Box px={5} py={4} borderBottom="1px solid" borderColor="gray.100" bg="gray.50">
          <Text fontSize="xs" fontWeight="semibold" letterSpacing="0.1em" color="gray.500">
            MENTEE PROFILE
          </Text>
          <Text mt={1} fontSize="lg" fontWeight="700" color={PLUM}>
            {getDisplayName(learner)}
          </Text>
          <Text fontSize="sm" color="gray.600">
            {[learner.companyName, learner.email].filter(Boolean).join(' · ')}
          </Text>
        </Box>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={0}>
          <Box px={5} py={4} borderBottom={{ base: '1px solid', md: 'none' }} borderColor="gray.100">
            <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="0.08em">
              PERSONALITY
            </Text>
            <Text mt={1} fontSize="sm" fontWeight="600" color={PLUM}>
              {personalityLabel(learner.personalityType) || 'Pending'}
            </Text>
          </Box>
          <Box
            px={5}
            py={4}
            borderBottom={{ base: '1px solid', md: 'none' }}
            borderLeft={{ md: '1px solid' }}
            borderColor="gray.100"
          >
            <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="0.08em">
              VALUES
            </Text>
            <Text mt={1} fontSize="sm" color="gray.700">
              {values.length ? values.join(' · ') : 'Not set yet'}
            </Text>
          </Box>
          <Box px={5} py={4} borderLeft={{ md: '1px solid' }} borderColor="gray.100">
            <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="0.08em">
              AGE BAND
            </Text>
            <Text mt={1} fontSize="sm" color="gray.700">
              {ageRange || 'Not set'}
            </Text>
          </Box>
        </SimpleGrid>
      </Box>

      <Box
        border="1px solid"
        borderColor="gray.200"
        borderLeftWidth="3px"
        borderLeftColor={GOLD}
        borderRadius="xl"
        bg="white"
        px={5}
        py={4}
      >
        <HStack spacing={2} mb={2}>
          <Icon as={Sparkles} color="gray.600" boxSize={4} />
          <Text fontSize="xs" fontWeight="bold" letterSpacing="0.08em" color="gray.500">
            {aiNotes.label.toUpperCase()} NOTES
          </Text>
        </HStack>
        <VStack align="stretch" spacing={2}>
          {aiNotes.lines.map((line) => (
            <Text key={line.slice(0, 48)} fontSize="sm" color="gray.700" lineHeight="1.65">
              {line}
            </Text>
          ))}
        </VStack>
        <Text mt={3} fontSize="xs" color="gray.500" fontStyle="italic">
          {aiNotes.disclaimer}
        </Text>
        {strengths.summary ? (
          <Text mt={3} fontSize="sm" color="gray.600" lineHeight="1.6">
            {strengths.summary}
          </Text>
        ) : null}
      </Box>

      <MentorshipGoalsCard
        learnerId={learner.id}
        mentorId={mentorId}
        audience="mentor"
      />

      <Box border="1px solid" borderColor="gray.200" borderRadius="xl" bg="white" px={5} py={4}>
        <Text fontSize="xs" fontWeight="bold" letterSpacing="0.08em" color="gray.500" mb={3}>
          SUGGESTED SESSION TOPICS · {sessionPlan.journeyLabel}
        </Text>
        <Stack spacing={3}>
          {sessionPlan.sessions.map((s) => (
            <Box key={s.index} p={3} borderRadius="lg" bg="gray.50" borderWidth="1px" borderColor="gray.100">
              <Text fontSize="sm" fontWeight="700" color={PLUM}>
                Session {s.index}: {s.title}
              </Text>
              <Text mt={1} fontSize="sm" color="gray.600" lineHeight="1.55">
                {s.focus}
              </Text>
              {s.suggestedTopics?.length ? (
                <VStack align="stretch" mt={2} spacing={1}>
                  {s.suggestedTopics.slice(0, 3).map((p) => (
                    <Text key={p.slice(0, 32)} fontSize="xs" color="gray.500">
                      · {p}
                    </Text>
                  ))}
                </VStack>
              ) : null}
            </Box>
          ))}
        </Stack>
      </Box>
    </Stack>
  )
}

export default MentorLearnerPanel
