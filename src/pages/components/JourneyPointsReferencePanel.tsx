import {
  Badge,
  Box,
  HStack,
  Heading,
  Icon,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { Flag } from 'lucide-react'
import {
  getJourneyPointsCrossReference,
  type ApprovalType,
  type JourneyType,
} from '@/config/pointsConfig'
import { getJourneyLabel, isMonthBasedJourney } from '@/utils/journeyType'
import { calculatePassMark } from '@/utils/completion'
import type { LeadershipAvailability } from '@/utils/leadershipAvailability'

const APPROVAL_TABLE_LABEL: Record<ApprovalType, string> = {
  auto: 'Auto Marks',
  self: 'Self Reporting',
  partner_approved: 'Partner Approved',
  partner_issued: 'Partner Issued',
  mentor_issued: 'Mentor Issued',
  ambassador_issued: 'Ambassador Issued',
}

const formatPoints = (value: number) => value.toLocaleString('en-US')

const isLeadershipActivity = (activityId: string) =>
  activityId === 'mentor_meetup' || activityId === 'ambassador_session'

type JourneyPointsReferencePanelProps = {
  journeyType: JourneyType
  leadershipAvailability?: LeadershipAvailability
}

/**
 * Product points table for month-based journeys (3M / 6M / 9M).
 * Shown on weekly-checklist so learners see the same Activity / Frequency /
 * Approval / Points / Max breakdown the programme is scored against.
 */
export const JourneyPointsReferencePanel = ({
  journeyType,
  leadershipAvailability,
}: JourneyPointsReferencePanelProps) => {
  if (!isMonthBasedJourney(journeyType)) return null

  const crossRef = getJourneyPointsCrossReference(journeyType)
  const hasMentor = leadershipAvailability?.hasMentor ?? true
  const hasAmbassador = leadershipAvailability?.hasAmbassador ?? true
  const passMark = calculatePassMark(journeyType, hasMentor, hasAmbassador)
  const withoutBoth = crossRef.pointVariants.find((v) => v.key === 'without_mentor_and_ambassador')
  const withoutOne = crossRef.pointVariants.find((v) => v.key === 'without_mentor_or_ambassador')

  return (
    <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl" boxShadow="sm" overflow="hidden">
      <Box px={{ base: 4, md: 5 }} py={4} borderBottomWidth="1px" borderColor="gray.100">
        <HStack spacing={2}>
          <Icon as={Flag} color="#350e6f" boxSize={5} />
          <Heading size="md" color="#350e6f" textTransform="uppercase" letterSpacing="wide">
            {getJourneyLabel(journeyType)}
          </Heading>
          <Badge colorScheme="purple" borderRadius="full">
            Programme points table
          </Badge>
        </HStack>
        <Text mt={2} fontSize="sm" color="gray.600">
          Your organization is on the {getJourneyLabel(journeyType)}. Complete activities below to reach the pass
          mark. Mentor and Ambassador rows apply when those roles are assigned.
        </Text>
      </Box>

      <Box overflowX="auto">
        <Table size="sm" variant="simple">
          <Thead bg="#350e6f">
            <Tr>
              <Th color="white" borderColor="#350e6f">
                Activity
              </Th>
              <Th color="white" borderColor="#350e6f" isNumeric>
                Frequency
              </Th>
              <Th color="white" borderColor="#350e6f">
                Approval Type
              </Th>
              <Th color="white" borderColor="#350e6f" isNumeric>
                Points Each
              </Th>
              <Th color="white" borderColor="#350e6f" isNumeric>
                Max
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {crossRef.activityBreakdown.map((row) => {
              const leadership = isLeadershipActivity(row.activityId)
              const missingLeadership =
                (row.activityId === 'mentor_meetup' && !hasMentor) ||
                (row.activityId === 'ambassador_session' && !hasAmbassador)
              const emphasisColor = leadership || missingLeadership ? 'red.600' : 'gray.800'
              return (
                <Tr key={row.activityId} bg={missingLeadership ? 'red.50' : undefined}>
                  <Td fontWeight="medium" color={emphasisColor}>
                    {row.title}
                  </Td>
                  <Td isNumeric color={emphasisColor}>
                    {row.frequency}
                  </Td>
                  <Td color={emphasisColor}>{APPROVAL_TABLE_LABEL[row.approvalType] ?? row.approvalType}</Td>
                  <Td isNumeric color={emphasisColor}>
                    {formatPoints(row.pointsEach)}
                  </Td>
                  <Td isNumeric fontWeight="semibold" color={emphasisColor}>
                    {formatPoints(row.maxPoints)}
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      </Box>

      <Stack spacing={2} px={{ base: 4, md: 5 }} py={4} borderTopWidth="1px" borderColor="gray.100">
        <HStack justify="space-between" flexWrap="wrap" spacing={3}>
          <Text fontWeight="bold" color="gray.800">
            MAXIMUM POSSIBLE
          </Text>
          <Text fontWeight="bold" color="gray.800">
            {formatPoints(crossRef.maxPossiblePoints)}
          </Text>
        </HStack>
        <HStack justify="space-between" flexWrap="wrap" spacing={3}>
          <Text fontWeight="bold" color="green.700">
            Pass Rate
          </Text>
          <Badge colorScheme="green" fontSize="sm" px={3} py={1} borderRadius="md">
            {formatPoints(passMark.adjustedThreshold)}
          </Badge>
        </HStack>
        {withoutBoth ? (
          <HStack justify="space-between" flexWrap="wrap" spacing={3}>
            <Text fontSize="sm" color="gray.600">
              No Mentor + Ambassador (both)
            </Text>
            <Text fontSize="sm" color="gray.700">
              {formatPoints(withoutBoth.maxPossiblePoints)} = pass mark {formatPoints(withoutBoth.passMarkPoints)}
            </Text>
          </HStack>
        ) : null}
        {withoutOne ? (
          <HStack justify="space-between" flexWrap="wrap" spacing={3}>
            <Text fontSize="sm" color="gray.600">
              No Ambassador / Mentor
            </Text>
            <Text fontSize="sm" color="gray.700">
              {formatPoints(withoutOne.maxPossiblePoints)} = pass mark {formatPoints(withoutOne.passMarkPoints)}
            </Text>
          </HStack>
        ) : null}
      </Stack>
    </Box>
  )
}
