import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Flex, IconButton, Skeleton, Text } from '@chakra-ui/react'
import { differenceInCalendarDays, format, subDays } from 'date-fns'
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Lock, type LucideIcon } from 'lucide-react'
import type { AssignedCourse } from '@/hooks/useAssignedCourses'
import { resolveCourseCompletion } from '@/hooks/useUserCourseCompletions'
import type { CourseCompletionRecord } from '@/services/courseCompletionService'

type JourneyCoursesPanelProps = {
  courses: AssignedCourse[]
  loading?: boolean
  completionsByKey: Map<string, CourseCompletionRecord>
  onCourseClick: (course: AssignedCourse) => void
  /** Deadline for courses without their own block dates (e.g. the free complementary course). */
  fallbackDueDate?: Date | null
}

type CardTone = {
  icon: LucideIcon
  iconBg: string
  iconShadow: string
  ornamentBg: string
  hoverShadow: string
  hoverBorder: string
  titleColor: string
  muted: boolean
}

const openTone: CardTone = {
  icon: BookOpen,
  iconBg: '#350e6f',
  iconShadow: '0 4px 12px rgba(53, 14, 111, 0.3)',
  ornamentBg: 'purple.50',
  hoverShadow: '0 8px 25px rgba(139, 92, 246, 0.15)',
  hoverBorder: 'purple.200',
  titleColor: 'gray.800',
  muted: false,
}

const doneTone: CardTone = {
  icon: Check,
  iconBg: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
  iconShadow: '0 4px 12px rgba(4, 120, 87, 0.3)',
  ornamentBg: 'green.50',
  hoverShadow: '0 8px 25px rgba(16, 185, 129, 0.15)',
  hoverBorder: 'green.200',
  titleColor: 'gray.800',
  muted: false,
}

const lockedTone: CardTone = {
  icon: Lock,
  iconBg: '#d1d5db',
  iconShadow: 'none',
  ornamentBg: 'gray.100',
  hoverShadow: 'none',
  hoverBorder: 'gray.100',
  titleColor: 'gray.400',
  muted: true,
}

const statusCopy = (course: AssignedCourse, done: boolean) => {
  if (done) return 'Completed'
  if (course.availability === 'current') return 'Open now'
  if (course.availability === 'past') return 'Still open'
  if (course.unlockDate) return `Opens ${format(course.unlockDate, 'MMM d')}`
  return 'Not open yet'
}

/** Red deadline copy for a course the learner still has to finish. */
const deadlineCopy = (dueDate: Date | null) => {
  if (!dueDate) return { headline: 'Complete it now', detail: null }
  const lastDay = subDays(dueDate, 1)
  const daysLeft = differenceInCalendarDays(lastDay, new Date())
  if (daysLeft < 0) return { headline: 'Overdue', detail: `Was due ${format(lastDay, 'MMM d')}` }
  if (daysLeft === 0) return { headline: 'Due today', detail: format(lastDay, 'MMM d') }
  return {
    headline: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`,
    detail: `Due ${format(lastDay, 'EEE, MMM d')}`,
  }
}

/**
 * The learner's journey course as a tile in the KPI strip. An open course the learner
 * has not finished is flagged as required, with a red deadline and a call to action.
 * Courses whose date has not arrived stay gray.
 */
export const JourneyCoursesPanel = ({
  courses,
  loading = false,
  completionsByKey,
  onCourseClick,
  fallbackDueDate = null,
}: JourneyCoursesPanelProps) => {
  const [index, setIndex] = useState(0)

  // Open on the first course the learner still owes (overdue or open now), so paid
  // members in a later month land on the course that needs doing, not Month 1.
  const focusIndex = useMemo(() => {
    const owed = courses.findIndex(
      (course) =>
        course.availability !== 'locked' && !resolveCourseCompletion(completionsByKey, course)
    )
    if (owed >= 0) return owed
    const current = courses.findIndex((course) => course.availability === 'current')
    return current >= 0 ? current : 0
  }, [courses, completionsByKey])

  useEffect(() => {
    setIndex(focusIndex)
  }, [focusIndex])

  if (loading && courses.length === 0) {
    return <Skeleton h="full" minH="168px" rounded="xl" />
  }

  if (courses.length === 0) return null

  const course = courses[index]
  if (!course) return null

  const done = Boolean(resolveCourseCompletion(completionsByKey, course))
  const locked = course.availability === 'locked' && !done
  const urgent = !done && !locked
  const tone = done ? doneTone : locked ? lockedTone : openTone
  const status = statusCopy(course, done)
  const deadline = urgent ? deadlineCopy(course.dueDate ?? fallbackDueDate) : null
  const showControls = courses.length > 1

  return (
    <Box
      id="assigned-courses"
      scrollMarginTop="96px"
      h="full"
      p={5}
      bg="white"
      borderRadius="xl"
      border="1px solid"
      borderColor={urgent ? 'red.200' : 'gray.100'}
      boxShadow="0 2px 8px rgba(0,0,0,0.04)"
      position="relative"
      overflow="hidden"
      transition="all 0.3s ease"
      _hover={
        tone.muted
          ? undefined
          : {
              transform: 'translateY(-2px)',
              boxShadow: tone.hoverShadow,
              borderColor: urgent ? 'red.300' : tone.hoverBorder,
            }
      }
    >
      <Box
        position="absolute"
        top={0}
        right={0}
        w="60px"
        h="60px"
        bg={urgent ? 'red.50' : tone.ornamentBg}
        borderRadius="0 0 0 100%"
      />
      <Flex align="flex-start" justify="space-between" mb={3} position="relative">
        <Flex
          w={10}
          h={10}
          bg={tone.iconBg}
          borderRadius="xl"
          align="center"
          justify="center"
          boxShadow={tone.iconShadow}
        >
          <Box as={tone.icon} w={5} h={5} color="white" />
        </Flex>
        {showControls ? (
          <Flex align="center" gap={0.5}>
            <Text fontSize="xs" color="gray.500" mr={1}>
              {index + 1} / {courses.length}
            </Text>
            <IconButton
              aria-label="Previous course"
              icon={<ChevronLeft size={16} />}
              size="xs"
              variant="ghost"
              color="#350e6f"
              isDisabled={index === 0}
              onClick={() => setIndex((current) => Math.max(0, current - 1))}
            />
            <IconButton
              aria-label="Next course"
              icon={<ChevronRight size={16} />}
              size="xs"
              variant="ghost"
              color="#350e6f"
              isDisabled={index >= courses.length - 1}
              onClick={() => setIndex((current) => Math.min(courses.length - 1, current + 1))}
            />
          </Flex>
        ) : null}
      </Flex>
      <Text
        fontSize="xs"
        color={tone.muted ? 'gray.400' : 'gray.500'}
        fontWeight="semibold"
        textTransform="uppercase"
        letterSpacing="wide"
        mb={1}
      >
        {urgent ? (
          <>
            <Text as="span" color="red.600" fontWeight="bold">
              Required
            </Text>{' '}
            · {course.periodLabel}
          </>
        ) : (
          `Your course · ${course.periodLabel}`
        )}
      </Text>
      <Text
        fontWeight="bold"
        fontSize="xl"
        color={tone.titleColor}
        lineHeight="1.2"
        letterSpacing="-0.02em"
        noOfLines={2}
      >
        {course.title}
      </Text>
      {deadline ? (
        <Text fontSize="sm" color="gray.600" mt={1.5}>
          <Text as="span" color="red.600" fontWeight="bold">
            {deadline.headline}
          </Text>
          {deadline.detail ? ` · ${deadline.detail}` : null}
        </Text>
      ) : (
        <Text fontSize="xs" color={tone.muted ? 'gray.400' : 'gray.500'} mt={1}>
          {status}
        </Text>
      )}
      {urgent ? (
        <>
          <Text fontSize="xs" color="gray.600" mt={1}>
            You <Text as="span" color="red.600" fontWeight="bold">must complete</Text> this course
            to stay on track.
          </Text>
          <Button
            mt={3}
            size="sm"
            w="full"
            bg="red.600"
            color="white"
            _hover={{ bg: 'red.700' }}
            rightIcon={<ArrowRight size={14} />}
            onClick={() => onCourseClick(course)}
          >
            Complete it now
          </Button>
        </>
      ) : (
        <Button
          mt={3}
          size="sm"
          variant="ghost"
          color={tone.muted ? 'gray.500' : '#350e6f'}
          px={0}
          rightIcon={<ArrowRight size={14} />}
          onClick={() => onCourseClick(course)}
          aria-label={`${course.title}. ${course.periodLabel}. ${status}`}
        >
          {done ? 'Review course' : 'View course'}
        </Button>
      )}
    </Box>
  )
}
