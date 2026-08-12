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

interface Props {
  card: LearnerAssessmentReportCard | null
  /** When true, hide other learners — this card is already scoped to the viewer. */
  title?: string
  emptyMessage?: string
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
        </Box>

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
                  <Th isNumeric>Pre</Th>
                  <Th isNumeric>Post</Th>
                  <Th isNumeric>Δ</Th>
                  <Th>Rater views</Th>
                </Tr>
              </Thead>
              <Tbody>
                {card.courses.map((course) => (
                  <Tr key={course.courseKey}>
                    <Td>{course.courseTitle}</Td>
                    <Td isNumeric>{course.preSelf ?? '—'}</Td>
                    <Td isNumeric>{course.postSelf ?? '—'}</Td>
                    <Td isNumeric>
                      {course.delta == null ? (
                        '—'
                      ) : (
                        <Badge
                          colorScheme={course.delta >= 0 ? 'green' : 'orange'}
                          textTransform="none"
                        >
                          {course.delta > 0 ? `+${course.delta}` : course.delta}
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      {course.raterPosts.length === 0
                        ? '—'
                        : course.raterPosts
                            .map((r) => `${r.role}: ${r.avg ?? '—'}`)
                            .join(' · ')}
                    </Td>
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
