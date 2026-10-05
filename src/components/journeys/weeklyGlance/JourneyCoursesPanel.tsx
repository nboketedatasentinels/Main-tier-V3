import { useEffect, useState } from 'react'
import { Box, Flex, IconButton, Skeleton, Stack, Text } from '@chakra-ui/react'
import { format } from 'date-fns'
import { BookOpen, Check, ChevronLeft, ChevronRight, Lock, type LucideIcon } from 'lucide-react'
import type { AssignedCourse } from '@/hooks/useAssignedCourses'
import { resolveCourseCompletion } from '@/hooks/useUserCourseCompletions'
import type { CourseCompletionRecord } from '@/services/courseCompletionService'

type JourneyCoursesPanelProps = {
  courses: AssignedCourse[]
  loading?: boolean
  completionsByKey: Map<string, CourseCompletionRecord>
  onCourseClick: (course: AssignedCourse) => void
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

/**
 * Journey courses drawn as the same white tiles as the points, pending, and pace cards.
 * Courses whose date has not arrived stay gray.
 */
export const JourneyCoursesPanel = ({
  courses,
  loading = false,
  completionsByKey,
  onCourseClick,
}: JourneyCoursesPanelProps) => {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex((prev) => {
      if (courses.length === 0) return 0
      return Math.min(prev, courses.length - 1)
    })
  }, [courses.length])

  if (loading && courses.length === 0) {
    return (
      <Stack spacing={3}>
        <Text
          fontSize="xs"
          fontWeight="semibold"
          textTransform="uppercase"
          letterSpacing="wide"
          color="gray.500"
        >
          Your courses
        </Text>
        <Skeleton h="168px" rounded="xl" />
      </Stack>
    )
  }

  if (courses.length === 0) return null

  const course = courses[index]
  if (!course) return null

  const done = Boolean(resolveCourseCompletion(completionsByKey, course))
  const locked = course.availability === 'locked' && !done
  const tone = done ? doneTone : locked ? lockedTone : openTone
  const status = statusCopy(course, done)
  const showControls = courses.length > 1

  return (
    <Stack id="assigned-courses" scrollMarginTop="96px" spacing={3}>
      <Flex align="center" justify="space-between" gap={2}>
        <Text
          fontSize="xs"
          fontWeight="semibold"
          textTransform="uppercase"
          letterSpacing="wide"
          color="gray.500"
        >
          Your courses
        </Text>
        {showControls ? (
          <Flex align="center" gap={1}>
            <Text fontSize="xs" color="gray.400" mr={1}>
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
      <Box
        as="button"
        type="button"
        textAlign="left"
        w="full"
        h="full"
        p={5}
        bg="white"
        borderRadius="xl"
        border="1px solid"
        borderColor="gray.100"
        boxShadow="0 2px 8px rgba(0,0,0,0.04)"
        cursor="pointer"
        position="relative"
        overflow="hidden"
        transition="all 0.3s ease"
        onClick={() => onCourseClick(course)}
        aria-label={`${course.title}. ${course.periodLabel}. ${status}`}
        _hover={
          tone.muted
            ? undefined
            : {
                transform: 'translateY(-2px)',
                boxShadow: tone.hoverShadow,
                borderColor: tone.hoverBorder,
              }
        }
        _focusVisible={{ outline: '2px solid #350e6f', outlineOffset: '2px' }}
      >
        <Box
          position="absolute"
          top={0}
          right={0}
          w="60px"
          h="60px"
          bg={tone.ornamentBg}
          borderRadius="0 0 0 100%"
        />
        <Flex
          w={10}
          h={10}
          bg={tone.iconBg}
          borderRadius="xl"
          align="center"
          justify="center"
          mb={3}
          boxShadow={tone.iconShadow}
        >
          <Box as={tone.icon} w={5} h={5} color="white" />
        </Flex>
        <Text
          fontSize="xs"
          color={tone.muted ? 'gray.400' : 'gray.500'}
          fontWeight="semibold"
          textTransform="uppercase"
          letterSpacing="wide"
          mb={1}
        >
          {course.periodLabel}
        </Text>
        <Text
          fontWeight="bold"
          fontSize="xl"
          color={tone.titleColor}
          lineHeight="1.2"
          letterSpacing="-0.02em"
          noOfLines={3}
        >
          {course.title}
        </Text>
        <Text fontSize="xs" color={tone.muted ? 'gray.400' : 'gray.500'} mt={1}>
          {status}
        </Text>
      </Box>
    </Stack>
  )
}
