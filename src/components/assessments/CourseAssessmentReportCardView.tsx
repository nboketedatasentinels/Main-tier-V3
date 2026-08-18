import {
  Badge,
  Box,
  Heading,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import type { LearnerAssessmentReportCard } from '@/services/courseAssessmentReportService'
import { scoreBandLabel } from '@/services/courseAssessmentReportMath'

interface Props {
  card: LearnerAssessmentReportCard | null
  title?: string
  emptyMessage?: string
}

const fmt = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : '-'

const fmtDelta = (n: number | null | undefined) => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}`
}

export function CourseAssessmentReportCardView({
  card,
  title = 'Your assessment report',
  emptyMessage = 'No Pre/Post assessment results yet.',
}: Props) {
  if (!card) {
    return (
      <Box borderWidth="1px" borderColor="gray.200" borderRadius="xl" bg="white" p={5}>
        <Heading size="sm" mb={2}>
          {title}
        </Heading>
        <Text fontSize="sm" color="gray.500">
          {emptyMessage}
        </Text>
      </Box>
    )
  }

  const warnings = card.flags.filter((f) => f.severity !== 'info')

  return (
    <Box borderWidth="1px" borderColor="gray.200" borderRadius="xl" bg="white" p={{ base: 4, md: 5 }}>
      <Stack spacing={4}>
        <Box>
          <Heading size="sm" color="gray.900">
            {title}
          </Heading>
          <Text fontSize="sm" color="gray.600" mt={1}>
            {card.learnerName}
            {card.currentWeek != null && card.totalWeeks != null
              ? ` · Week ${card.currentWeek} of ${card.totalWeeks}`
              : ''}
          </Text>
          <Text fontSize="sm" color="gray.700" mt={2}>
            Observed growth (matched Manager/Partner):{' '}
            <Badge colorScheme="purple" textTransform="none">
              {fmtDelta(card.overallObserverGrowth)}
            </Badge>
            {card.overallObserverPre != null && card.overallObserverPost != null
              ? ` (${fmt(card.overallObserverPre)} → ${fmt(card.overallObserverPost)})`
              : ''}
          </Text>
          <Text fontSize="xs" color="gray.500" mt={1}>
            Headline uses matched observer Pre/Post only. Self scores are a self-awareness lens.
          </Text>
        </Box>

        {warnings.map((f) => (
          <Box
            key={`${f.code}-${f.message}`}
            bg={f.offline ? 'orange.50' : 'yellow.50'}
            borderWidth="1px"
            borderColor={f.offline ? 'orange.200' : 'yellow.200'}
            borderRadius="md"
            px={3}
            py={2}
          >
            <Text fontSize="xs" color="orange.800">
              {f.message}
              {f.offline ? ' · Offline review flagged' : ''}
            </Text>
          </Box>
        ))}

        {!card.courses.length ? (
          <Text fontSize="sm" color="gray.500">
            {emptyMessage}
          </Text>
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Course</Th>
                  <Th isNumeric>Obs Pre</Th>
                  <Th isNumeric>Obs Post</Th>
                  <Th isNumeric>Matched Δ</Th>
                  <Th>Band</Th>
                  <Th isNumeric>Self Δ</Th>
                </Tr>
              </Thead>
              <Tbody>
                {card.courses.map((course) => (
                  <Tr key={course.courseKey}>
                    <Td>{course.courseTitle}</Td>
                    <Td isNumeric>{fmt(course.observerPre)}</Td>
                    <Td isNumeric>{fmt(course.observerPost)}</Td>
                    <Td isNumeric>
                      <Badge
                        colorScheme={
                          (course.observerMatchedGrowth ?? 0) >= 0 ? 'green' : 'orange'
                        }
                        textTransform="none"
                      >
                        {fmtDelta(course.observerMatchedGrowth)}
                      </Badge>
                    </Td>
                    <Td>{scoreBandLabel(course.observerPost)}</Td>
                    <Td isNumeric>{fmtDelta(course.delta)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Stack>
    </Box>
  )
}

export default CourseAssessmentReportCardView
