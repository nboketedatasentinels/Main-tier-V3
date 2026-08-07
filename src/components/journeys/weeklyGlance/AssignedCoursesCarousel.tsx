import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Flex, IconButton, Skeleton, Stack } from '@chakra-ui/react'
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
 * Horizontal course carousel with chevron controls for Weekly Glance.
 * One compact card peeks as the slide; arrows scroll by card width.
 */
export const AssignedCoursesCarousel = ({
  courses,
  loading = false,
  completionsByKey,
  profile,
  onCourseClick,
}: AssignedCoursesCarouselProps) => {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current
    if (!el) {
      setCanScrollLeft(false)
      setCanScrollRight(false)
      return
    }
    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(maxScroll > 4 && el.scrollLeft < maxScroll - 4)
  }, [])

  useEffect(() => {
    updateScrollState()
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const resizeObserver = new ResizeObserver(() => updateScrollState())
    resizeObserver.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      resizeObserver.disconnect()
    }
  }, [courses.length, loading, updateScrollState])

  const scrollByCard = (direction: -1 | 1) => {
    const el = scrollerRef.current
    if (!el) return
    const firstCard = el.querySelector<HTMLElement>('[data-course-slide]')
    const amount = firstCard?.offsetWidth ?? el.clientWidth * 0.85
    el.scrollBy({ left: direction * (amount + 16), behavior: 'smooth' })
  }

  if (loading && !courses.length) {
    return (
      <Stack spacing={4}>
        <Skeleton h="170px" rounded="xl" />
      </Stack>
    )
  }

  if (!courses.length) return null

  const showControls = courses.length > 1

  return (
    <Box position="relative" w="full" h="full">
      {showControls && (
        <Flex
          position="absolute"
          top={2}
          right={2}
          zIndex={2}
          gap={1}
          pointerEvents="none"
        >
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
            pointerEvents="auto"
            isDisabled={!canScrollLeft}
            onClick={() => scrollByCard(-1)}
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
            pointerEvents="auto"
            isDisabled={!canScrollRight}
            onClick={() => scrollByCard(1)}
            _hover={{ bg: 'gray.50' }}
            _disabled={{ opacity: 0.35, cursor: 'default' }}
          />
        </Flex>
      )}

      <Flex
        ref={scrollerRef}
        overflowX="auto"
        overflowY="hidden"
        gap={4}
        h="full"
        pb={1}
        scrollSnapType="x mandatory"
        css={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {courses.map((course) => (
          <Box
            key={`${course.periodLabel}-${course.id}`}
            data-course-slide
            flex="0 0 100%"
            minW="100%"
            maxW="100%"
            scrollSnapAlign="start"
          >
            <AssignedCourseCard
              periodLabel={course.periodLabel}
              periodNoun={course.periodNoun}
              hasAssignment
              course={course}
              availability={course.availability}
              dateRange={course.dateRange}
              unlockDate={course.unlockDate}
              points={course.points}
              completion={resolveCourseCompletion(completionsByKey, course)}
              hasAccess={canAccessCourse(profile, course.title, course.id)}
              showProgress={false}
              showAction={false}
              density="compact"
              onCardClick={() => onCourseClick(course)}
            />
          </Box>
        ))}
      </Flex>
    </Box>
  )
}
