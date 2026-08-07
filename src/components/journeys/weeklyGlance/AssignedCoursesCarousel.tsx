import { useEffect, useState } from 'react'
import { Box, Flex, IconButton, Skeleton, Text } from '@chakra-ui/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AssignedCourseCard } from '@/components/courses/AssignedCourseCard'
import type { AssignedCourse } from '@/hooks/useAssignedCourses'
import { resolveCourseCompletion } from '@/hooks/useUserCourseCompletions'
import type { CourseCompletionRecord } from '@/services/courseCompletionService'
import { canAccessCourse } from '@/utils/membership'
import type { UserProfile } from '@/types'

type AssignedCoursesCarouselProps = {
  courses: AssignedCourse[]
  loading?: boolean
  completionsByKey: Map<string, CourseCompletionRecord>
  profile: UserProfile | null | undefined
  onCourseClick: (course: AssignedCourse) => void
}

/**
 * One-course-at-a-time carousel for Weekly Glance.
 * Chevrons step through assigned courses; only the active slide is mounted.
 */
export const AssignedCoursesCarousel = ({
  courses,
  loading = false,
  completionsByKey,
  profile,
  onCourseClick,
}: AssignedCoursesCarouselProps) => {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex((prev) => {
      if (courses.length === 0) return 0
      return Math.min(prev, courses.length - 1)
    })
  }, [courses.length])

  if (loading && !courses.length) {
    return <Skeleton h="170px" rounded="xl" w="full" />
  }

  if (!courses.length) return null

  const active = courses[index]
  if (!active) return null

  const canGoPrev = index > 0
  const canGoNext = index < courses.length - 1
  const showControls = courses.length > 1

  return (
    <Box position="relative" w="full">
      {showControls && (
        <Flex align="center" justify="space-between" mb={2} gap={2}>
          <Text fontSize="xs" fontWeight="semibold" color="gray.500">
            Course {index + 1} of {courses.length}
          </Text>
          <Flex gap={1}>
            <IconButton
              aria-label="Previous course"
              icon={<ChevronLeft size={18} />}
              size="sm"
              variant="solid"
              bg="white"
              color="#350e6f"
              border="1px solid"
              borderColor="gray.200"
              shadow="sm"
              isDisabled={!canGoPrev}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              _hover={{ bg: 'gray.50' }}
              _disabled={{ opacity: 0.35, cursor: 'default' }}
            />
            <IconButton
              aria-label="Next course"
              icon={<ChevronRight size={18} />}
              size="sm"
              variant="solid"
              bg="white"
              color="#350e6f"
              border="1px solid"
              borderColor="gray.200"
              shadow="sm"
              isDisabled={!canGoNext}
              onClick={() => setIndex((i) => Math.min(courses.length - 1, i + 1))}
              _hover={{ bg: 'gray.50' }}
              _disabled={{ opacity: 0.35, cursor: 'default' }}
            />
          </Flex>
        </Flex>
      )}

      <AssignedCourseCard
        key={`${active.periodLabel}-${active.id}-${index}`}
        periodLabel={active.periodLabel}
        periodNoun={active.periodNoun}
        hasAssignment
        course={active}
        availability={active.availability}
        dateRange={active.dateRange}
        unlockDate={active.unlockDate}
        points={active.points}
        completion={resolveCourseCompletion(completionsByKey, active)}
        hasAccess={canAccessCourse(profile, active.title, active.id)}
        showProgress={false}
        showAction={false}
        density="compact"
        onCardClick={() => onCourseClick(active)}
      />
    </Box>
  )
}
