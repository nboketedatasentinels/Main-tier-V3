import { Box, Flex, SimpleGrid, Skeleton, Stack, Text } from '@chakra-ui/react'
import { format } from 'date-fns'
import { Check, Lock } from 'lucide-react'
import type { AssignedCourse } from '@/hooks/useAssignedCourses'
import { resolveCourseCompletion } from '@/hooks/useUserCourseCompletions'
import type { CourseCompletionRecord } from '@/services/courseCompletionService'

type JourneyCoursesPanelProps = {
  courses: AssignedCourse[]
  loading?: boolean
  completionsByKey: Map<string, CourseCompletionRecord>
  onCourseClick: (course: AssignedCourse) => void
}

const statusCopy = (course: AssignedCourse, done: boolean) => {
  if (done) return 'Done'
  if (course.availability === 'current') return 'Open now'
  if (course.availability === 'past') return 'Still open'
  if (course.unlockDate) return `Opens ${format(course.unlockDate, 'MMM d')}`
  return 'Not open yet'
}

/**
 * The journey's courses, in order. Ones whose start date has not arrived
 * stay gray and quiet. The current one is the only card that asks to be opened.
 */
export const JourneyCoursesPanel = ({
  courses,
  loading = false,
  completionsByKey,
  onCourseClick,
}: JourneyCoursesPanelProps) => {
  if (loading && courses.length === 0) {
    return <Skeleton h="148px" rounded="2xl" />
  }

  if (courses.length === 0) return null

  const current = courses.find((course) => course.availability === 'current')
  const columns = courses.length >= 3 ? 3 : courses.length

  return (
    <Stack id="assigned-courses" scrollMarginTop="96px" spacing={3}>
      <Stack spacing={0.5}>
        <Text
          fontSize="xs"
          fontWeight="semibold"
          letterSpacing="0.14em"
          textTransform="uppercase"
          color="gray.500"
        >
          Your courses
        </Text>
        <Text fontSize="sm" color="gray.600">
          {current
            ? `${current.periodLabel} is open. Later courses stay quiet until their date.`
            : 'Each course opens when that part of your journey begins.'}
        </Text>
      </Stack>

      <SimpleGrid
        columns={{ base: 1, md: columns }}
        spacing={3}
        maxW={courses.length === 1 ? '420px' : 'full'}
      >
        {courses.map((course, index) => {
          const locked = course.availability === 'locked'
          const currentCard = course.availability === 'current'
          const done = Boolean(resolveCourseCompletion(completionsByKey, course))
          const number = String(index + 1).padStart(2, '0')

          return (
            <Box
              key={`${course.periodLabel}-${course.id}`}
              as="button"
              type="button"
              textAlign="left"
              w="full"
              bg={locked ? 'gray.100' : 'white'}
              color={locked ? 'gray.500' : 'gray.900'}
              border="1px solid"
              borderColor={currentCard ? '#27062e' : locked ? 'gray.200' : 'gray.200'}
              borderRadius="2xl"
              boxShadow={currentCard ? '0 10px 28px -18px rgba(39, 6, 46, 0.55)' : 'none'}
              px={4}
              py={4}
              cursor="pointer"
              transition="transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease"
              onClick={() => onCourseClick(course)}
              aria-label={`${course.title}. ${course.periodLabel}. ${statusCopy(course, done)}`}
              _hover={
                locked
                  ? { bg: 'gray.100' }
                  : {
                      transform: 'translateY(-2px)',
                      borderColor: '#27062e',
                      boxShadow: '0 12px 28px -16px rgba(39, 6, 46, 0.35)',
                    }
              }
              _focusVisible={{ outline: '2px solid #eab130', outlineOffset: '2px' }}
            >
              <Flex align="center" justify="space-between" gap={3}>
                <Text
                  fontSize="xs"
                  fontWeight="700"
                  letterSpacing="0.16em"
                  color={locked ? 'gray.400' : '#8A6708'}
                >
                  {number}
                </Text>
                {done ? (
                  <Flex
                    w={6}
                    h={6}
                    borderRadius="full"
                    bg="green.50"
                    color="green.700"
                    align="center"
                    justify="center"
                    aria-hidden
                  >
                    <Check size={14} />
                  </Flex>
                ) : locked ? (
                  <Lock size={14} aria-hidden />
                ) : currentCard ? (
                  <Text fontSize="xs" fontWeight="700" color="#27062e">
                    Now
                  </Text>
                ) : null}
              </Flex>

              <Text
                mt={3}
                fontSize="xs"
                fontWeight="semibold"
                letterSpacing="0.08em"
                textTransform="uppercase"
                color={locked ? 'gray.400' : 'gray.500'}
              >
                {course.periodLabel}
              </Text>
              <Text
                mt={1}
                fontSize="md"
                fontWeight="semibold"
                lineHeight="1.35"
                noOfLines={2}
                color={locked ? 'gray.500' : 'gray.900'}
              >
                {course.title}
              </Text>
              <Text mt={3} fontSize="sm" color={locked ? 'gray.400' : currentCard ? '#27062e' : 'gray.500'}>
                {statusCopy(course, done)}
              </Text>
            </Box>
          )
        })}
      </SimpleGrid>
    </Stack>
  )
}
