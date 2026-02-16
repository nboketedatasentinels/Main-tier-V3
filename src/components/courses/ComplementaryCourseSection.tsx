import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  HStack,
  Icon,
  Progress,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Tooltip,
  VStack,
} from '@chakra-ui/react'
import { BookOpen, Clock, ExternalLink, Sparkles } from 'lucide-react'
import { doc, getDoc } from 'firebase/firestore'
import { Link as RouterLink } from 'react-router-dom'
import type { UserProfile } from '@/types'
import { db } from '@/services/firebase'
import {
  getCourseDetailsFromMapping,
  getCourseMetadataFromMapping,
  resolveCourseTitleFromMapping,
  type CourseDifficulty,
} from '@/utils/courseMappings'
import { canAccessCourse, COMPLEMENTARY_COURSE_IDS } from '@/utils/membership'

interface NormalizedCourse {
  id: string
  title: string
  description: string
  link?: string
  progress?: number
  estimatedMinutes?: number
  difficulty?: CourseDifficulty
}

const formatDuration = (minutes?: number) => {
  if (!minutes || Number.isNaN(minutes)) return null
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining ? `${hours} hrs ${remaining} min` : `${hours} hrs`
}

const badgeColor = (difficulty?: CourseDifficulty) => {
  switch (difficulty) {
    case 'Beginner':
      return 'green'
    case 'Intermediate':
      return 'orange'
    case 'Advanced':
      return 'red'
    default:
      return 'gray'
  }
}

const buildCourseFromDoc = (courseId: string, data: Record<string, unknown>): NormalizedCourse => {
  const rawTitle = (data.title || data.name || data.courseTitle || 'Untitled Course') as string
  const title = resolveCourseTitleFromMapping(rawTitle) || rawTitle
  const details = getCourseDetailsFromMapping(title)
  const metadata = getCourseMetadataFromMapping(title)

  return {
    id: courseId,
    title,
    description: (details?.description || data.description || 'Description not available.') as string,
    link: (details?.link || data.link) as string | undefined,
    estimatedMinutes: metadata?.estimatedMinutes,
    difficulty: metadata?.difficulty,
  }
}

export interface ComplementaryCourseSectionProps {
  excludedCourseIds?: string[]
  progressMap: Map<string, number>
  progressLoading?: boolean
  profile: UserProfile | null
}

export const ComplementaryCourseSection: React.FC<ComplementaryCourseSectionProps> = ({
  excludedCourseIds,
  progressMap,
  progressLoading,
  profile,
}) => {
  const [courses, setCourses] = useState<NormalizedCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const complementaryIds = useMemo(() => {
    if (!excludedCourseIds?.length) return COMPLEMENTARY_COURSE_IDS
    const excludedSet = new Set(excludedCourseIds)
    return COMPLEMENTARY_COURSE_IDS.filter(courseId => !excludedSet.has(courseId))
  }, [excludedCourseIds])

  useEffect(() => {
    let isActive = true

    const fetchCourses = async () => {
      if (!complementaryIds.length) {
        if (isActive) {
          setCourses([])
          setLoading(false)
          setError(null)
        }
        return
      }

      try {
        setLoading(true)
        setError(null)
        const snapshots = await Promise.all(
          complementaryIds.map(courseId => getDoc(doc(db, 'courses', courseId)))
        )
        const nextCourses = snapshots
          .map((snap, index) => (snap.exists() ? buildCourseFromDoc(complementaryIds[index], snap.data()) : null))
          .filter(Boolean) as NormalizedCourse[]

        if (isActive) {
          setCourses(nextCourses)
          if (!nextCourses.length) {
            setError('Complementary course details are unavailable right now.')
          }
        }
      } catch (fetchError) {
        console.error('Error loading complementary courses', fetchError)
        if (isActive) {
          setCourses([])
          setError('Unable to load complementary courses right now.')
        }
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    fetchCourses()

    return () => {
      isActive = false
    }
  }, [complementaryIds])

  const coursesWithProgress = useMemo(
    () =>
      courses.map(course => ({
        ...course,
        progress: progressMap.get(course.id) ?? progressMap.get(course.title.trim().toLowerCase()),
      })),
    [courses, progressMap]
  )

  if (!complementaryIds.length) {
    return null
  }

  return (
    <Stack spacing={4} as="section">
      <HStack justify="space-between" align="center">
        <HStack spacing={3}>
          <Heading size="md" color="gray.800">
            Complementary courses
          </Heading>
          <Badge colorScheme="teal" variant="subtle" borderRadius="full">
            Available to all members
          </Badge>
        </HStack>
        <Badge colorScheme="purple" variant="subtle" borderRadius="full">
          {complementaryIds.length} course{complementaryIds.length === 1 ? '' : 's'}
        </Badge>
      </HStack>

      <Text color="gray.600" fontSize="sm">
        These leadership essentials are included with every membership, even as your organization program evolves.
      </Text>

      {(loading || progressLoading) && (
        <Flex align="center" justify="center" py={10} direction="column" gap={3}>
          <Spinner size="lg" color="teal.500" />
          <Text color="gray.600">Loading complementary courses…</Text>
        </Flex>
      )}

      {!loading && !progressLoading && error && (
        <Box
          border="1px solid"
          borderColor="border.control"
          borderRadius="2xl"
          bg="white"
          p={6}
          textAlign="center"
        >
          <Icon as={BookOpen} boxSize={10} color="text.muted" mb={3} />
          <Heading size="sm" color="gray.800" mb={2}>
            Complementary course unavailable
          </Heading>
          <Text color="gray.500">{error}</Text>
        </Box>
      )}

      {!loading && !progressLoading && !error && coursesWithProgress.length > 0 && (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={6}>
          {coursesWithProgress.map(course => {
            const hasAccess = canAccessCourse(profile, course.title, course.id)
            return (
              <Box
                key={course.id}
                as="article"
                borderRadius="3xl"
                overflow="hidden"
                border="1px solid"
                borderColor="border.control"
                boxShadow="md"
              >
                <Box bgGradient="linear(to-r, teal.50, teal.100)" p={4}>
                  <HStack justify="space-between">
                    <Badge colorScheme="teal" borderRadius="full" px={3} py={1} fontWeight="bold">
                      Complementary
                    </Badge>
                    <HStack spacing={2} color="teal.700">
                      <Icon as={Sparkles} />
                      <Text fontSize="sm">Available to all members</Text>
                    </HStack>
                  </HStack>
                </Box>

                <Stack spacing={0} divider={<Divider />} p={4} bg="white">
                  <Box py={3}>
                    <HStack justify="space-between" align="start" spacing={3}>
                      <VStack align="start" spacing={1} flex={1}>
                        <Heading size="sm" color="gray.800">
                          {course.title}
                        </Heading>
                        <Text color="gray.600" fontSize="sm">
                          {course.description}
                        </Text>
                        <HStack spacing={3} flexWrap="wrap">
                          {course.difficulty && (
                            <Badge colorScheme={badgeColor(course.difficulty)} variant="outline" borderRadius="full">
                              {course.difficulty}
                            </Badge>
                          )}
                          {course.estimatedMinutes && (
                            <HStack spacing={1} color="gray.500">
                              <Icon as={Clock} boxSize={4} />
                              <Text fontSize="xs">{formatDuration(course.estimatedMinutes)}</Text>
                            </HStack>
                          )}
                        </HStack>

                        {typeof course.progress === 'number' && (
                          <Box pt={1} width="full">
                            <Progress value={course.progress} size="sm" colorScheme="teal" borderRadius="full" aria-hidden />
                            <Text fontSize="xs" color="gray.500" mt={1}>
                              {course.progress.toFixed(0)}% complete
                            </Text>
                          </Box>
                        )}
                      </VStack>

                      <Tooltip
                        label={course.link ? '' : 'Course link has not been provided yet.'}
                        isDisabled={Boolean(course.link)}
                        hasArrow
                        shouldWrapChildren
                      >
                        <Button
                          as={hasAccess ? 'a' : (RouterLink as React.ElementType)}
                          href={hasAccess ? course.link : undefined}
                          to={hasAccess ? undefined : '/upgrade'}
                          target={hasAccess ? '_blank' : undefined}
                          rel={hasAccess ? 'noopener noreferrer' : undefined}
                          size="sm"
                          colorScheme="teal"
                          rightIcon={<ExternalLink size={16} />}
                          variant="solid"
                          borderRadius="full"
                          minW="120px"
                          isDisabled={!course.link}
                        >
                          {hasAccess ? 'Open course' : 'Upgrade to unlock'}
                        </Button>
                      </Tooltip>
                    </HStack>
                  </Box>
                </Stack>
              </Box>
            )
          })}
        </SimpleGrid>
      )}
    </Stack>
  )
}
