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
} from '@chakra-ui/react'
import { ArrowRight } from 'lucide-react'
import type { JourneyBucket, JourneyProgressAggregate, JourneyProgressLearner } from '@/types/admin'

/**
 * The learner-journey story for the super admin overview, in plain language:
 * how many learners are keeping up, slipping, at risk, or haven't begun.
 * Clicking a card shows ONLY that group's learners right below - so the admin
 * sees exactly who the card is talking about, no cross-page guessing.
 *
 * Numbers come from real pace-ratio classification (listenToJourneyProgress /
 * partnerProgress.calculateUserRiskStatus).
 */

type GroupId = 'onTrack' | 'needsNudge' | 'atRisk' | 'notStarted'

type Group = {
  id: GroupId
  label: string
  caption: string
  color: string
  buckets: JourneyBucket[]
  /** Shown as the panel line when this group is empty. */
  emptyText: string
}

// The four plain-English groups. Each maps to one or more raw buckets.
const GROUPS: Group[] = [
  {
    id: 'onTrack',
    label: 'On track',
    caption: 'Keeping up or already finished',
    color: 'green.500',
    buckets: ['completed', 'onTrack'],
    emptyText: 'No one is on track yet.',
  },
  {
    id: 'needsNudge',
    label: 'Slightly behind',
    caption: 'A small push will help',
    color: 'yellow.400',
    buckets: ['needsNudge'],
    emptyText: 'No one is slightly behind. Nice.',
  },
  {
    id: 'atRisk',
    label: 'At risk',
    caption: 'Falling behind, may not finish',
    color: 'red.500',
    buckets: ['behind', 'critical'],
    emptyText: 'No one is at risk right now. 🎉',
  },
  {
    id: 'notStarted',
    label: 'Not started',
    caption: "Haven't begun yet",
    color: 'gray.400',
    buckets: ['notStarted'],
    emptyText: 'Everyone has started. 🎉',
  },
]

// Per-learner badge shown in the opened list (distinguishes the raw bucket).
const BUCKET_BADGE: Record<JourneyBucket, { label: string; scheme: string }> = {
  completed: { label: 'Finished', scheme: 'green' },
  onTrack: { label: 'On track', scheme: 'teal' },
  needsNudge: { label: 'Slightly behind', scheme: 'yellow' },
  behind: { label: 'Behind', scheme: 'orange' },
  critical: { label: 'At risk', scheme: 'red' },
  notStarted: { label: 'Not started', scheme: 'gray' },
}

const pct = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0)

const groupCount = (agg: JourneyProgressAggregate, group: Group) =>
  group.buckets.reduce((sum, b) => sum + agg[b], 0)

const journeySubline = (learner: JourneyProgressLearner) =>
  [learner.organization, learner.journeyType, learner.currentWeek ? `Week ${learner.currentWeek}` : null]
    .filter(Boolean)
    .join(' · ') || 'No organization'

const GroupCard: React.FC<{
  group: Group
  count: number
  total: number
  selected: boolean
  onSelect: () => void
}> = ({ group, count, total, selected, onSelect }) => (
  <Box
    as="button"
    textAlign="left"
    p={4}
    bg="white"
    borderRadius="xl"
    border="1px solid"
    borderColor={selected ? group.color : 'border.control'}
    borderLeftWidth="4px"
    borderLeftColor={group.color}
    boxShadow={selected ? 'md' : 'none'}
    outline={selected ? '2px solid' : 'none'}
    outlineColor={selected ? group.color : 'transparent'}
    onClick={onSelect}
    transition="all 0.15s"
    _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
    aria-pressed={selected}
  >
    <Stack spacing={1}>
      <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase" letterSpacing="wide">
        {group.label}
      </Text>
      <Flex align="baseline" gap={2}>
        <Text fontSize="3xl" fontWeight="extrabold" color="gray.800" lineHeight="1">
          {count}
        </Text>
        <Text fontSize="sm" fontWeight="bold" color="gray.400">
          {pct(count, total)}%
        </Text>
      </Flex>
      <Text fontSize="xs" color="text.muted">
        {group.caption}
      </Text>
      <Text fontSize="xs" fontWeight="semibold" color={selected ? group.color : 'gray.400'}>
        {selected ? 'Showing below' : 'Click to see who'}
      </Text>
    </Stack>
  </Box>
)

const LearnerRow: React.FC<{ learner: JourneyProgressLearner }> = ({ learner }) => {
  const badge = BUCKET_BADGE[learner.bucket]
  return (
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
          {journeySubline(learner)}
        </Text>
      </Box>
      <HStack spacing={3} flexShrink={0}>
        {learner.deficit > 0 && (
          <Text fontSize="xs" color="gray.500" whiteSpace="nowrap">
            {learner.deficit.toLocaleString()} pts behind
          </Text>
        )}
        <Badge colorScheme={badge.scheme} variant="subtle" borderRadius="full" px={2} textTransform="none">
          {badge.label}
        </Badge>
      </HStack>
    </Flex>
  )
}

type LearnerJourneyHealthProps = {
  aggregate: JourneyProgressAggregate
  onReviewUsers: () => void
}

export const LearnerJourneyHealth: React.FC<LearnerJourneyHealthProps> = ({ aggregate, onReviewUsers }) => {
  const { total, learners } = aggregate
  // Start focused on the most urgent group so the admin sees who needs help first.
  const [selectedId, setSelectedId] = React.useState<GroupId>('atRisk')
  const selectedGroup = GROUPS.find((g) => g.id === selectedId) ?? GROUPS[0]
  const selectedBuckets = new Set<JourneyBucket>(selectedGroup.buckets)
  const shown = learners.filter((l) => selectedBuckets.has(l.bucket))

  return (
    <Stack spacing={4}>
      <Flex align="center" justify="space-between" wrap="wrap" gap={2}>
        <Stack spacing={0}>
          <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase" letterSpacing="wider">
            How your learners are doing
          </Text>
          <Text fontSize="sm" color="text.muted">
            {total.toLocaleString()} learners. Click a box to see exactly who is in it.
          </Text>
        </Stack>
        <Button
          size="sm"
          variant="ghost"
          rightIcon={<ArrowRight size={16} />}
          onClick={onReviewUsers}
          colorScheme="purple"
        >
          Manage all learners
        </Button>
      </Flex>

      {total === 0 ? (
        <Box p={6} bg="white" borderRadius="xl" border="1px solid" borderColor="border.control">
          <Text fontSize="sm" color="text.muted">
            No learners enrolled yet. This fills in once learners start their journeys.
          </Text>
        </Box>
      ) : (
        <>
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
            {GROUPS.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                count={groupCount(aggregate, group)}
                total={total}
                selected={group.id === selectedId}
                onSelect={() => setSelectedId(group.id)}
              />
            ))}
          </SimpleGrid>

          {/* Focused list: ONLY the selected group's learners. */}
          <Box p={5} bg="white" borderRadius="xl" border="1px solid" borderColor="border.control">
            <Flex align="center" gap={2} mb={shown.length ? 3 : 0} wrap="wrap">
              <Box w={3} h={3} borderRadius="sm" bg={selectedGroup.color} />
              <Text fontSize="sm" fontWeight="bold" color="gray.800">
                {selectedGroup.label}
              </Text>
              <Text fontSize="sm" color="gray.500">
                {shown.length} {shown.length === 1 ? 'learner' : 'learners'} - {selectedGroup.caption.toLowerCase()}
              </Text>
            </Flex>
            {shown.length === 0 ? (
              <Text fontSize="sm" color="text.muted">
                {selectedGroup.emptyText}
              </Text>
            ) : (
              <Stack spacing={0}>
                {shown.map((learner) => (
                  <LearnerRow key={learner.id} learner={learner} />
                ))}
              </Stack>
            )}
          </Box>
        </>
      )}
    </Stack>
  )
}

export default LearnerJourneyHealth
