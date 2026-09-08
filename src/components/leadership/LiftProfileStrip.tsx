import React from 'react'
import { Badge, Box, HStack, Skeleton, Stack, Text } from '@chakra-ui/react'
import { useSessionPrepLift } from '@/hooks/useSessionPrepLift'
import { LiftCapabilityRadar } from '@/components/session-prep/LiftCapabilityRadar'

const PLUM = '#27062e'

type LiftProfileStripProps = {
  learnerId?: string | null
  /** Compact radar under the badge strip. */
  showRadar?: boolean
}

/**
 * Mentor/coach profile header: LIFT archetype + index up front (Nana: don't bury it).
 * Uses full profile width; radar + pillar scores share the row on larger screens.
 */
export const LiftProfileStrip: React.FC<LiftProfileStripProps> = ({
  learnerId,
  showRadar = true,
}) => {
  const { pillars, developmentEdge, liftIndex, archetype, assessedAt, loading } =
    useSessionPrepLift(learnerId)

  if (loading) {
    return (
      <Box px={5} py={3} borderTop="1px solid" borderColor="gray.100" bg="white" minW={0} overflow="hidden" w="full">
        <Skeleton height="18px" width="40%" mb={2} />
        <Skeleton height="72px" borderRadius="md" />
      </Box>
    )
  }

  const completed = Boolean(archetype || liftIndex != null || pillars)

  return (
    <Box px={5} py={4} borderTop="1px solid" borderColor="gray.100" bg="white" minW={0} overflow="hidden" w="full">
      <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap={3} mb={showRadar ? 3 : 0} minW={0}>
        <Stack spacing={1} minW={0} flex={1}>
          <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="0.08em">
            LIFT ASSESSMENT
          </Text>
          {completed ? (
            <HStack spacing={2} flexWrap="wrap">
              {archetype ? (
                <Badge colorScheme="purple" textTransform="none" rounded="md" px={2}>
                  {archetype}
                </Badge>
              ) : null}
              {liftIndex != null ? (
                <Text fontSize="sm" fontWeight="700" color={PLUM}>
                  Index {Math.round(liftIndex)}
                </Text>
              ) : null}
              {assessedAt ? (
                <Text fontSize="xs" color="gray.500">
                  Assessed {new Date(assessedAt).toLocaleDateString()}
                </Text>
              ) : null}
            </HStack>
          ) : (
            <Text fontSize="sm" fontWeight="600" color="orange.700" wordBreak="break-word">
              LIFT pending — learner has not completed the assessment yet
            </Text>
          )}
        </Stack>
      </HStack>
      {showRadar && completed ? (
        <Box w="full" minW={0}>
          <LiftCapabilityRadar
            pillars={pillars}
            gapPillar={developmentEdge}
            showScores
            layout="split"
          />
        </Box>
      ) : null}
    </Box>
  )
}

export default LiftProfileStrip
