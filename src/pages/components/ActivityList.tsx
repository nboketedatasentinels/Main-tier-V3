import { useMemo, useState } from 'react'
import {
  Box,
  Center,
  Collapse,
  Flex,
  Grid,
  HStack,
  Heading,
  Icon,
  Stack,
  Text,
} from '@chakra-ui/react'
import { ChevronDown, ChevronRight, PartyPopper } from 'lucide-react'
import type { ActivityState } from '@/hooks/useWeeklyChecklistViewModel'
import { getVisibleActivities } from '@/utils/activityStateManager'
import { ActivityRow } from './ActivityRow'

type Bucket = 'todo' | 'done' | 'locked'

const bucketFor = (activity: ActivityState): Bucket => {
  if (
    activity.status === 'completed' ||
    activity.availability.state === 'permanently_exhausted'
  )
    return 'done'
  if (activity.status === 'pending' || activity.status === 'rejected') return 'todo'
  if (activity.availability.state === 'available') return 'todo'
  return 'locked'
}

const SECTION_TITLES: Record<Bucket, string> = {
  todo: 'To do',
  done: 'Done',
  locked: 'Coming up',
}

interface ActivityListProps {
  activities: ActivityState[]
  selectedWeek: number
  currentWeek: number
  isWeekLocked: boolean
  isAdmin: boolean
  onOpenCurrentWeek: () => void
  onMarkCompleted: (activity: ActivityState) => Promise<void>
  onMarkNotStarted: (activity: ActivityState) => Promise<void>
  onOpenProof: (activity: ActivityState) => void
  isActivityBusy?: (activityId: string) => boolean
}

const ColumnHeader = () => (
  <Grid
    templateColumns="20px minmax(0,1fr) 70px 130px 90px 16px"
    gap={4}
    alignItems="center"
    px={4}
    py={2}
    borderBottom="1px solid"
    borderColor="gray.200"
    bg="gray.50"
    display={{ base: 'none', md: 'grid' }}
  >
    <Box />
    <Text
      fontSize="xs"
      fontWeight="semibold"
      color="gray.500"
      textTransform="uppercase"
      letterSpacing="0.04em"
    >
      Name
    </Text>
    <Text
      fontSize="xs"
      fontWeight="semibold"
      color="gray.500"
      textTransform="uppercase"
      letterSpacing="0.04em"
    >
      Done
    </Text>
    <Text
      fontSize="xs"
      fontWeight="semibold"
      color="gray.500"
      textTransform="uppercase"
      letterSpacing="0.04em"
    >
      Approval
    </Text>
    <Text
      fontSize="xs"
      fontWeight="semibold"
      color="gray.500"
      textTransform="uppercase"
      letterSpacing="0.04em"
      textAlign="right"
    >
      Points
    </Text>
    <Box />
  </Grid>
)

export const ActivityList = ({
  activities,
  selectedWeek,
  currentWeek,
  isWeekLocked,
  isAdmin,
  onOpenCurrentWeek,
  onMarkCompleted,
  onOpenProof,
  isActivityBusy,
}: ActivityListProps) => {
  const visibleActivities = useMemo(() => getVisibleActivities(activities), [activities])

  const ordered = useMemo(
    () => visibleActivities.filter((activity) => activity?.id),
    [visibleActivities],
  )

  const groups = useMemo(() => {
    const acc: Record<Bucket, ActivityState[]> = { todo: [], done: [], locked: [] }
    ordered.forEach((a) => {
      acc[bucketFor(a)].push(a)
    })
    return acc
  }, [ordered])

  const firstActionableActivityId =
    groups.todo.find(
      (a) =>
        a.availability.state === 'available' &&
        (a.status === 'not_started' || a.status === 'rejected') &&
        !(a.approvalType === 'partner_issued' && !a.issuedByPartner),
    )?.id ?? null

  const todoPointsTotal = groups.todo.reduce((sum, a) => sum + (a.points ?? 0), 0)

  const focusFirstActionableActivity = () => {
    if (!firstActionableActivityId) return
    const target = document.getElementById(`activity-${firstActionableActivityId}`)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Record<Bucket, boolean>>({
    todo: false,
    done: true,
    locked: true,
  })

  const toggleSection = (bucket: Bucket) =>
    setCollapsedSections((prev) => ({ ...prev, [bucket]: !prev[bucket] }))

  if (!visibleActivities?.length) {
    return (
      <Box
        bg="white"
        p={8}
        borderRadius="xl"
        boxShadow="0 2px 8px rgba(0,0,0,0.04)"
        position="relative"
        overflow="hidden"
      >
        <Center flexDirection="column" gap={3} position="relative" zIndex={1}>
          <Flex
            w={12}
            h={12}
            borderRadius="xl"
            bg="linear-gradient(135deg, #350e6f 0%, #27062e 100%)"
            align="center"
            justify="center"
            boxShadow="0 4px 12px rgba(53, 14, 111, 0.3)"
          >
            <Icon as={PartyPopper} boxSize={6} color="white" />
          </Flex>
          <Heading size="sm" color="gray.800">
            You're all caught up
          </Heading>
          <Text color="gray.500" fontSize="sm" textAlign="center">
            New activities will unlock as each week opens. Come back soon.
          </Text>
        </Center>
      </Box>
    )
  }

  const renderSection = (bucket: Bucket) => {
    const items = groups[bucket]
    if (items.length === 0) return null
    const isCollapsed = collapsedSections[bucket]
    return (
      <Box key={bucket}>
        <Flex
          as="button"
          type="button"
          align="center"
          gap={2}
          w="100%"
          textAlign="left"
          px={4}
          py={2.5}
          bg="white"
          borderBottom={isCollapsed ? 'none' : '1px solid'}
          borderColor="gray.200"
          onClick={() => toggleSection(bucket)}
          _hover={{ bg: 'gray.50' }}
          _focusVisible={{
            outline: '2px solid',
            outlineColor: '#350e6f',
            outlineOffset: '-2px',
          }}
        >
          <Icon
            as={isCollapsed ? ChevronRight : ChevronDown}
            boxSize={4}
            color="gray.500"
          />
          <Text fontSize="sm" fontWeight="semibold" color="gray.800">
            {SECTION_TITLES[bucket]}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {items.length}
          </Text>
          {bucket === 'todo' && todoPointsTotal > 0 && (
            <Text fontSize="xs" color="#350e6f" fontWeight="semibold" ml="auto">
              +{todoPointsTotal.toLocaleString()} pts available
            </Text>
          )}
        </Flex>

        <Collapse in={!isCollapsed} animateOpacity>
          {bucket === 'todo' && <ColumnHeader />}
          {items.map((activity) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              selectedWeek={selectedWeek}
              currentWeek={currentWeek}
              isWeekLocked={isWeekLocked}
              isAdmin={isAdmin}
              isExpanded={expandedId === activity.id}
              hasAvailableAlternative={Boolean(
                firstActionableActivityId &&
                  firstActionableActivityId !== activity.id,
              )}
              onToggleExpand={() =>
                setExpandedId((prev) => (prev === activity.id ? null : activity.id))
              }
              onOpenCurrentWeek={onOpenCurrentWeek}
              onFocusAvailableActivity={focusFirstActionableActivity}
              onMarkCompleted={onMarkCompleted}
              onOpenProof={onOpenProof}
              isActionInFlight={Boolean(isActivityBusy?.(activity.id))}
            />
          ))}
        </Collapse>
      </Box>
    )
  }

  return (
    <Stack spacing={3}>
      <Flex justify="space-between" align="center" px={1}>
        <Stack spacing={0}>
          <Text
            fontSize="xs"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wide"
            color="gray.500"
          >
            Your activities
          </Text>
          <HStack spacing={3}>
            <Heading size="sm" color="gray.800">
              {groups.todo.length} to complete
            </Heading>
            <Text fontSize="sm" color="gray.500">
              · {groups.locked.length} coming up · {groups.done.length} done
            </Text>
          </HStack>
        </Stack>
      </Flex>

      <Box
        bg="white"
        borderRadius="lg"
        border="1px solid"
        borderColor="gray.200"
        overflow="hidden"
        boxShadow="0 1px 3px rgba(0,0,0,0.03)"
      >
        {renderSection('todo')}
        {renderSection('locked')}
        {renderSection('done')}
      </Box>
    </Stack>
  )
}
