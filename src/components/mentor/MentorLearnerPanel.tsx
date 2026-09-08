import React from 'react'
import {
  Box,
  Flex,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { MentorshipGoalsCard } from '@/components/leadership/MentorshipGoalsCard'
import { LiftProfileStrip } from '@/components/leadership/LiftProfileStrip'
import { getDisplayName } from '@/utils/displayName'
import { PERSONALITY_TYPES } from '@/config/personality-data'
import type { UserProfile } from '@/types'

const PLUM = '#27062e'

const personalityLabel = (type?: string | null): string | null => {
  if (!type) return null
  const hit = PERSONALITY_TYPES.find((p) => p.type === type)
  return hit ? `${hit.type} · ${hit.name}` : type
}

type MentorLearnerPanelProps = {
  learner: UserProfile
  mentorId?: string | null
  /** Top-right action (e.g. Points ranking button). */
  headerAction?: React.ReactNode
}

/**
 * Mentor mentee profile surface - values, age, personality, LIFT, goals.
 * Session topics live under Session prep (collapsed) to avoid a long duplicate stack.
 */
export const MentorLearnerPanel: React.FC<MentorLearnerPanelProps> = ({
  learner,
  mentorId,
  headerAction,
}) => {
  const values = (learner.coreValues || []).filter(Boolean)
  const ageRange = (learner as { ageRange?: string | null }).ageRange

  return (
    <Stack spacing={4} minW={0} maxW="100%" overflow="hidden" w="full">
      <Box border="1px solid" borderColor="gray.200" borderRadius="xl" bg="white" overflow="hidden" minW={0} w="full">
        <Flex
          px={5}
          py={4}
          borderBottom="1px solid"
          borderColor="gray.100"
          bg="gray.50"
          align="flex-start"
          justify="space-between"
          gap={3}
          flexWrap="wrap"
        >
          <Box minW={0} flex="1">
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
          {headerAction ? <Box flexShrink={0}>{headerAction}</Box> : null}
        </Flex>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={0}>
          <Box px={5} py={4} borderBottom={{ base: '1px solid', md: 'none' }} borderColor="gray.100">
            <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="0.08em">
              PERSONALITY
            </Text>
            <Text mt={1} fontSize="sm" fontWeight="600" color={PLUM}>
              {personalityLabel(learner.personalityType) || 'Not set yet'}
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
        <LiftProfileStrip learnerId={learner.id} />
      </Box>

      <MentorshipGoalsCard
        learnerId={learner.id}
        mentorId={mentorId}
        audience="mentor"
      />
    </Stack>
  )
}

export default MentorLearnerPanel
