import React from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@chakra-ui/react'
import { ArrowRight, TrendingUp } from 'lucide-react'
import type { JourneyProgressAggregate, JourneyProgressLearner } from '@/types/admin'

/**
 * The learner-journey story for the super admin overview: who is progressing,
 * who is slipping, and who needs a hand right now. Replaces the old vanity
 * "System Health" strip. All numbers come from real pace-ratio classification
 * (see listenToJourneyProgress / partnerProgress.calculateUserRiskStatus).
 */

type Segment = {
  key: keyof Omit<JourneyProgressAggregate, 'total' | 'attention'>
  label: string
  color: string
  hint: string
}

// Full breakdown, best-to-worst. Drives both the segmented bar and its legend.
const SEGMENTS: Segment[] = [
  { key: 'completed', label: 'Completed', color: 'green.500', hint: 'Hit the pass mark' },
  { key: 'onTrack', label: 'On track', color: 'teal.400', hint: 'On pace to pass' },
  { key: 'needsNudge', label: 'Needs a nudge', color: 'yellow.400', hint: 'Slightly off pace' },
  { key: 'behind', label: 'Falling behind', color: 'orange.400', hint: 'Behind pace, still recoverable' },
  { key: 'critical', label: 'At risk', color: 'red.500', hint: 'May not pass at current pace' },
  { key: 'notStarted', label: 'Not started', color: 'gray.300', hint: 'No progress yet' },
]

const pct = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0)

type HeadlineTile = {
  label: string
  value: number
  total: number
  color: string
  caption: string
}

const HeadlineCard: React.FC<HeadlineTile & { onClick?: () => void }> = ({
  label,
  value,
  total,
  color,
  caption,
  onClick,
}) => (
  <Box
    p={4}
    bg="white"
    borderRadius="xl"
    border="1px solid"
    borderColor="border.control"
    borderLeftWidth="4px"
    borderLeftColor={color}
    cursor={onClick ? 'pointer' : 'default'}
    onClick={onClick}
    transition="all 0.2s"
    _hover={onClick ? { shadow: 'md', transform: 'translateY(-2px)' } : {}}
  >
    <Stack spacing={1}>
      <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase" letterSpacing="wide">
        {label}
      </Text>
      <Flex align="baseline" gap={2}>
        <Text fontSize="3xl" fontWeight="extrabold" color="gray.800" lineHeight="1">
          {value}
        </Text>
        <Text fontSize="sm" fontWeight="bold" color="gray.400">
          {pct(value, total)}%
        </Text>
      </Flex>
      <Text fontSize="xs" color="text.muted">
        {caption}
      </Text>
    </Stack>
  </Box>
)

const journeyLabel = (learner: JourneyProgressLearner) =>
  [learner.journeyType, learner.currentWeek ? `Week ${learner.currentWeek}` : null]
    .filter(Boolean)
    .join(' · ')

const AttentionRow: React.FC<{ learner: JourneyProgressLearner }> = ({ learner }) => (
  <Flex
    align="center"
    justify="space-between"
    gap={3}
    py={3}
    borderBottomWidth="1px"
    borderColor="gray.100"
    _last={{ borderBottomWidth: 0 }}
  >
    <Box minW={0}>
      <Text fontSize="sm" fontWeight="semibold" color="gray.800" noOfLines={1}>
        {learner.name}
      </Text>
      <Text fontSize="xs" color="gray.500" noOfLines={1}>
        {[learner.organization, journeyLabel(learner)].filter(Boolean).join(' · ') || 'No organization'}
      </Text>
    </Box>
    <HStack spacing={3} flexShrink={0}>
      {learner.deficit > 0 && (
        <Text fontSize="xs" color="gray.500" whiteSpace="nowrap">
          {learner.deficit.toLocaleString()} pts behind
        </Text>
      )}
      <Badge
        colorScheme={learner.level === 'critical' ? 'red' : 'orange'}
        variant="subtle"
        borderRadius="full"
        px={2}
        textTransform="none"
      >
        {learner.level === 'critical' ? 'At risk' : 'Behind'}
      </Badge>
    </HStack>
  </Flex>
)

type LearnerJourneyHealthProps = {
  aggregate: JourneyProgressAggregate
  onReviewUsers: () => void
}

export const LearnerJourneyHealth: React.FC<LearnerJourneyHealthProps> = ({ aggregate, onReviewUsers }) => {
  const { total } = aggregate
  const progressing = aggregate.completed + aggregate.onTrack
  const atRisk = aggregate.behind + aggregate.critical

  const headlines: HeadlineTile[] = [
    { label: 'Progressing', value: progressing, total, color: 'green.500', caption: 'On pace to pass or done' },
    { label: 'Needs a nudge', value: aggregate.needsNudge, total, color: 'yellow.400', caption: 'Slightly off pace' },
    { label: 'At risk', value: atRisk, total, color: 'red.500', caption: 'Behind and may not pass' },
    { label: 'Not started', value: aggregate.notStarted, total, color: 'gray.400', caption: 'No progress yet' },
  ]

  return (
    <Stack spacing={4}>
      <Flex align="center" justify="space-between" wrap="wrap" gap={2}>
        <Stack spacing={0}>
          <HStack spacing={2}>
            <TrendingUp size={16} />
            <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase" letterSpacing="wider">
              Learner Journey Health
            </Text>
          </HStack>
          <Text fontSize="sm" color="text.muted">
            {total.toLocaleString()} learners, measured against their journey pace
          </Text>
        </Stack>
        <Button
          size="sm"
          variant="ghost"
          rightIcon={<ArrowRight size={16} />}
          onClick={onReviewUsers}
          colorScheme="purple"
        >
          Review learners
        </Button>
      </Flex>

      {total === 0 ? (
        <Box p={6} bg="white" borderRadius="xl" border="1px solid" borderColor="border.control">
          <Text fontSize="sm" color="text.muted">
            No learners enrolled yet. Progress will appear here once learners start their journeys.
          </Text>
        </Box>
      ) : (
        <>
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
            {headlines.map((tile) => (
              <HeadlineCard key={tile.label} {...tile} onClick={onReviewUsers} />
            ))}
          </SimpleGrid>

          {/* Full distribution bar */}
          <Box p={5} bg="white" borderRadius="xl" border="1px solid" borderColor="border.control">
            <Flex h="12px" borderRadius="full" overflow="hidden" bg="gray.100">
              {SEGMENTS.map((seg) => {
                const value = aggregate[seg.key]
                if (value <= 0) return null
                return (
                  <Tooltip key={seg.key} label={`${seg.label}: ${value} (${pct(value, total)}%)`} hasArrow>
                    <Box flex={`${value} 0 0`} bg={seg.color} h="full" />
                  </Tooltip>
                )
              })}
            </Flex>
            <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={3} mt={4}>
              {SEGMENTS.map((seg) => (
                <HStack key={seg.key} spacing={2} align="start">
                  <Box w={3} h={3} borderRadius="sm" bg={seg.color} mt={1} flexShrink={0} />
                  <Stack spacing={0}>
                    <Text fontSize="sm" fontWeight="bold" color="gray.800">
                      {aggregate[seg.key]}
                    </Text>
                    <Text fontSize="xs" color="gray.500" lineHeight="1.2">
                      {seg.label}
                    </Text>
                  </Stack>
                </HStack>
              ))}
            </SimpleGrid>
          </Box>

          {/* Needs attention now */}
          {aggregate.attention.length > 0 && (
            <Box p={5} bg="white" borderRadius="xl" border="1px solid" borderColor="border.control">
              <Flex align="center" justify="space-between" mb={1}>
                <Text fontSize="sm" fontWeight="bold" color="gray.800">
                  Needs attention now
                </Text>
                <Text fontSize="xs" color="gray.500">
                  Most-delayed learners
                </Text>
              </Flex>
              <Stack spacing={0}>
                {aggregate.attention.map((learner) => (
                  <AttentionRow key={learner.id} learner={learner} />
                ))}
              </Stack>
            </Box>
          )}
        </>
      )}
    </Stack>
  )
}

export default LearnerJourneyHealth
