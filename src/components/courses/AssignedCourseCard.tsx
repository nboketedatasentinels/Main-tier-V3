import React from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  Stack,
  Text,
  Tooltip,
} from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { ArrowUpRight, Award, BookOpen, CheckCircle2, Lock, Sparkles, type LucideIcon } from 'lucide-react'
import type { CourseCompletionRecord } from '@/services/courseCompletionService'

export type CourseAvailability = 'current' | 'past' | 'locked' | 'completed'

type CourseProgressStage = 'done' | 'current' | 'locked'

const stageColors: Record<CourseProgressStage, { dot: string; ring: string; label: string }> = {
  done: { dot: '#350e6f', ring: '#350e6f', label: '#350e6f' },
  current: { dot: 'white', ring: '#350e6f', label: '#350e6f' },
  locked: { dot: 'white', ring: '#cbd5e1', label: 'gray.500' },
}

/** Pre-assessment → Course → Post-assessment rail shown inside each card. */
export const CourseProgressTimeline: React.FC<{
  preDone: boolean
  courseDone: boolean
  postDone: boolean
}> = ({ preDone, courseDone, postDone }) => {
  const preStage: CourseProgressStage = preDone ? 'done' : 'current'
  const courseStage: CourseProgressStage = courseDone
    ? 'done'
    : preDone
      ? 'current'
      : 'locked'
  const postStage: CourseProgressStage = postDone
    ? 'done'
    : courseDone
      ? 'current'
      : 'locked'

  const stages: Array<{ label: string; stage: CourseProgressStage }> = [
    { label: 'Pre-assessment', stage: preStage },
    { label: 'Course', stage: courseStage },
    { label: 'Post-assessment', stage: postStage },
  ]

  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="md"
      px={3}
      py={2.5}
    >
      <Text
        fontSize="2xs"
        fontWeight="bold"
        color="gray.500"
        textTransform="uppercase"
        letterSpacing="0.06em"
        mb={2}
      >
        Progress
      </Text>
      <HStack spacing={0} align="center" w="full">
        {stages.map((step, idx) => {
          const colors = stageColors[step.stage]
          const isLast = idx === stages.length - 1
          const nextColors = !isLast ? stageColors[stages[idx + 1].stage] : null
          const connectorColor =
            nextColors && step.stage === 'done' && nextColors.label === '#350e6f'
              ? '#350e6f'
              : '#e2e8f0'
          return (
            <React.Fragment key={step.label}>
              <Stack spacing={1} align="center" minW="0" flexShrink={0}>
                <Flex
                  w={5}
                  h={5}
                  borderRadius="full"
                  bg={colors.dot}
                  border="2px solid"
                  borderColor={colors.ring}
                  align="center"
                  justify="center"
                  boxShadow={step.stage === 'current' ? '0 0 0 3px rgba(53, 14, 111, 0.12)' : 'none'}
                >
                  {step.stage === 'done' && (
                    <Icon as={CheckCircle2} boxSize={2.5} color="white" />
                  )}
                </Flex>
                <Text
                  fontSize="2xs"
                  fontWeight={step.stage === 'locked' ? 'medium' : 'semibold'}
                  color={colors.label}
                  whiteSpace="nowrap"
                  textTransform="none"
                >
                  {step.label}
                </Text>
              </Stack>
              {!isLast && (
                <Box flex="1" h="2px" bg={connectorColor} mx={2} mt={-3} />
              )}
            </React.Fragment>
          )
        })}
      </HStack>
    </Box>
  )
}

const formatCompletionDate = (value?: Date | null) => {
  if (!value) return null
  try {
    return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return null
  }
}

export interface AssignedCourseCardProps {
  /** Eyebrow label - "Week 1", "Weeks 1-2", "Month 3". */
  periodLabel: string
  /** Drives the copy used when nothing is assigned to this block. */
  periodNoun: 'week' | 'month'
  /** False when the block has no course assigned at all. */
  hasAssignment: boolean
  course?: { title: string; description: string; link?: string }
  availability: CourseAvailability
  dateRange?: string
  unlockDate?: Date | null
  /** Points the partner awards on verified completion. */
  points?: number | null
  completion?: CourseCompletionRecord
  /** Membership/tier access to this specific course. */
  hasAccess: boolean
  preAssessmentDone?: boolean
  postAssessmentDone?: boolean
  /** Course details are still resolving. */
  isLoading?: boolean
  /** Course details failed to resolve. */
  isMissing?: boolean
  /** Pre-assessment -> Course -> Post-assessment rail. Off on the dashboard. */
  showProgress?: boolean
  /** Open / Unlocks-on CTA. Off on the dashboard, where space is tight. */
  showAction?: boolean
  /** Required whenever showAction is left on. */
  onOpenCourse?: (link: string) => void
  /**
   * Turns the whole card into a button - hover lift, pointer, focus ring and
   * an arrow affordance. Used where the CTA button is hidden.
   */
  onCardClick?: () => void
  /**
   * 'compact' tightens the spacing and puts the points on the same row as the
   * date range instead of in its own block. Used on the dashboard.
   */
  density?: 'comfortable' | 'compact'
}

interface CardVisual {
  strip: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  eyebrowColor: string
  badge: { label: string; bg: string; color: string } | null
}

/**
 * One course block card - the unit rendered by the courses timeline on
 * My Courses and by the courses section on the weekly glance dashboard.
 */
export const AssignedCourseCard: React.FC<AssignedCourseCardProps> = ({
  periodLabel,
  periodNoun,
  hasAssignment,
  course,
  availability,
  dateRange,
  unlockDate,
  points,
  completion,
  hasAccess,
  preAssessmentDone = false,
  postAssessmentDone = false,
  isLoading = false,
  isMissing = false,
  showProgress = true,
  showAction = true,
  onOpenCourse,
  onCardClick,
  density = 'comfortable',
}) => {
  const isClickable = Boolean(onCardClick)
  const isCompact = density === 'compact'
  const isApproved = Boolean(completion)
  const hasCourse = Boolean(course)
  const hasLink = Boolean(course?.link)
  const isLocked = availability === 'locked'
  const isCurrent = availability === 'current'
  const canOpen = hasAccess && !isLocked && hasLink
  const unlockDateLabel =
    isLocked && unlockDate
      ? unlockDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : null

  const visual: CardVisual = isApproved
    ? {
        strip: '#16a34a',
        icon: Award,
        iconBg: 'green.50',
        iconColor: 'green.600',
        eyebrowColor: 'green.700',
        badge: { label: 'Completed', bg: 'green.50', color: 'green.700' },
      }
    : isCurrent
      ? {
          strip: '#350e6f',
          icon: Sparkles,
          iconBg: 'purple.50',
          iconColor: '#350e6f',
          eyebrowColor: '#350e6f',
          badge: null,
        }
      : availability === 'past'
        ? {
            strip: '#350e6f',
            icon: BookOpen,
            iconBg: 'purple.50',
            iconColor: '#350e6f',
            eyebrowColor: '#350e6f',
            badge: { label: 'Available', bg: 'purple.50', color: '#350e6f' },
          }
        : isLocked
          ? {
              strip: '#e5e7eb',
              icon: Lock,
              iconBg: 'gray.100',
              iconColor: 'gray.500',
              eyebrowColor: 'gray.500',
              badge: { label: 'Locked', bg: 'gray.100', color: 'gray.600' },
            }
          : {
              strip: '#350e6f',
              icon: BookOpen,
              iconBg: 'purple.50',
              iconColor: '#350e6f',
              eyebrowColor: '#350e6f',
              badge: null,
            }

  const awardedDateLabel = completion?.approvedAt ? formatCompletionDate(completion.approvedAt) : null

  return (
    <Box
      position="relative"
      borderRadius="xl"
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      overflow="hidden"
      h="full"
      display="flex"
      flexDirection="column"
      transition="all 0.2s ease"
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable && course ? `Open ${course.title}` : undefined}
      cursor={isClickable ? 'pointer' : undefined}
      onClick={onCardClick}
      onKeyDown={
        isClickable
          ? (event: React.KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onCardClick?.()
              }
            }
          : undefined
      }
      _hover={
        isClickable || canOpen
          ? {
              borderColor: '#350e6f',
              boxShadow: '0 8px 24px -12px rgba(39, 6, 46, 0.2)',
              transform: 'translateY(-2px)',
            }
          : undefined
      }
      _active={isClickable ? { transform: 'translateY(0)' } : undefined}
      _focusVisible={{ outline: '2px solid #350e6f', outlineOffset: '2px' }}
      // Arrow affordance follows the card's own hover state.
      sx={
        isClickable
          ? { '&:hover .assigned-course-arrow': { color: '#350e6f', transform: 'translate(2px, -2px)' } }
          : undefined
      }
      opacity={isLocked ? 0.85 : 1}
    >
      <Box h="3px" bg={visual.strip} />

      <Stack
        spacing={isCompact ? 3 : 4}
        p={isCompact ? { base: 3.5, md: 4 } : { base: 4, md: 5 }}
        flex="1"
        justify="space-between"
      >
        <Stack spacing={isCompact ? 2.5 : 4}>
          <HStack justify="space-between" align="center">
            <HStack spacing={2.5} align="center">
              <Box
                p={2}
                borderRadius="lg"
                bg={visual.iconBg}
                color={visual.iconColor}
                display="inline-flex"
              >
                <Icon as={visual.icon} boxSize={4} />
              </Box>
              <Text
                fontSize="xs"
                fontWeight="bold"
                letterSpacing="0.14em"
                textTransform="uppercase"
                color={visual.eyebrowColor}
              >
                {periodLabel}
              </Text>
            </HStack>
            <HStack spacing={2} align="center">
              {visual.badge && (
                <Badge
                  bg={visual.badge.bg}
                  color={visual.badge.color}
                  textTransform="none"
                  fontSize="2xs"
                  fontWeight="semibold"
                  px={2}
                  py={0.5}
                  borderRadius="full"
                >
                  {visual.badge.label}
                </Badge>
              )}
              {isClickable && (
                <Icon
                  as={ArrowUpRight}
                  className="assigned-course-arrow"
                  boxSize={4}
                  color="gray.400"
                  transition="color 0.2s ease, transform 0.2s ease"
                  aria-hidden
                />
              )}
            </HStack>
          </HStack>

          <Stack spacing={1.5}>
            <Heading
              as="h3"
              size="sm"
              color="#27062e"
              fontWeight="bold"
              letterSpacing="-0.01em"
              lineHeight="1.3"
            >
              {course?.title || (hasAssignment ? 'Course assigned' : 'Course not assigned')}
            </Heading>
            <Text fontSize="sm" color="gray.600" lineHeight="1.55" noOfLines={2}>
              {course?.description ||
                `Your ${periodNoun === 'week' ? 'weekly' : 'monthly'} course assignment.`}
            </Text>
          </Stack>

          {/* Compact: date on the left, points chip on the right, one row. */}
          {isCompact ? (
            (dateRange || (hasCourse && (isApproved || points))) && (
              <Flex justify="space-between" align="center" gap={2}>
                <Text fontSize="xs" color="gray.500" fontWeight="medium" noOfLines={1}>
                  {dateRange}
                </Text>
                {hasCourse && (isApproved || points) && (
                  <HStack
                    spacing={1.5}
                    bg={isApproved ? 'green.50' : isCurrent ? 'purple.50' : 'gray.50'}
                    border="1px solid"
                    borderColor={isApproved ? 'green.200' : isCurrent ? 'purple.100' : 'gray.200'}
                    borderRadius="full"
                    px={2}
                    py={0.5}
                    flexShrink={0}
                  >
                    <Icon
                      as={Award}
                      boxSize={3.5}
                      color={isApproved ? 'green.600' : isCurrent ? '#350e6f' : 'gray.500'}
                    />
                    <Text
                      fontSize="2xs"
                      fontWeight="bold"
                      color={isApproved ? 'green.800' : isCurrent ? '#350e6f' : 'gray.700'}
                      whiteSpace="nowrap"
                    >
                      {isApproved
                        ? completion?.points
                          ? `+${completion.points.toLocaleString()} pts`
                          : 'Completed'
                        : `${points?.toLocaleString()} pts`}
                    </Text>
                  </HStack>
                )}
              </Flex>
            )
          ) : (
            dateRange && (
              <Text fontSize="xs" color="gray.500" fontWeight="medium">
                {dateRange}
              </Text>
            )
          )}

          {!isCompact && hasCourse && isApproved ? (
            <HStack
              spacing={2}
              bg="green.50"
              border="1px solid"
              borderColor="green.200"
              borderRadius="md"
              px={3}
              py={2}
              align="center"
            >
              <Icon as={Award} color="green.600" boxSize={4} />
              <Stack spacing={0} flex="1">
                <Text fontSize="xs" fontWeight="bold" color="green.800" lineHeight="1.2">
                  {completion?.points
                    ? `+${completion.points.toLocaleString()} pts awarded`
                    : 'Course completed'}
                </Text>
                {awardedDateLabel && (
                  <Text fontSize="2xs" color="green.700" lineHeight="1.2">
                    Verified by partner on {awardedDateLabel}
                  </Text>
                )}
              </Stack>
            </HStack>
          ) : !isCompact && hasCourse && points ? (
            <HStack
              spacing={2}
              bg={isCurrent ? 'purple.50' : 'gray.50'}
              border="1px solid"
              borderColor={isCurrent ? 'purple.100' : 'gray.200'}
              borderRadius="md"
              px={3}
              py={2}
              align="center"
            >
              <Icon as={Award} color={isCurrent ? '#350e6f' : 'gray.500'} boxSize={4} />
              <Stack spacing={0} flex="1">
                <Text
                  fontSize="xs"
                  fontWeight="bold"
                  color={isCurrent ? '#350e6f' : 'gray.700'}
                  lineHeight="1.2"
                >
                  {points.toLocaleString()} pts
                </Text>
                <Text
                  fontSize="2xs"
                  color={isCurrent ? 'purple.700' : 'gray.500'}
                  lineHeight="1.2"
                >
                  {isLocked
                    ? 'Awarded by partner on completion'
                    : isCurrent
                      ? 'Awarded by partner once verified'
                      : availability === 'past'
                        ? 'Awaiting partner verification'
                        : 'Awarded by partner on completion'}
                </Text>
              </Stack>
            </HStack>
          ) : null}

          {isMissing && (
            <Text fontSize="xs" color="red.500">
              Course details unavailable. Please contact support.
            </Text>
          )}
          {!hasAssignment && (
            <Text fontSize="xs" color="gray.500">
              No course assigned for this {periodNoun} yet.
            </Text>
          )}
        </Stack>

        {showProgress && hasAssignment && hasCourse && (
          <CourseProgressTimeline
            preDone={preAssessmentDone}
            courseDone={isApproved}
            postDone={postAssessmentDone}
          />
        )}

        {showAction && hasAssignment && (
          <Box pt={1}>
            {isLoading ? (
              <Button
                size="sm"
                bg="#350e6f"
                color="white"
                borderRadius="md"
                fontWeight="semibold"
                isLoading
                loadingText="Loading"
                w="full"
              >
                Loading
              </Button>
            ) : (
              <Tooltip
                label={
                  !hasCourse
                    ? isMissing
                      ? 'Course details are unavailable.'
                      : 'Course details are still loading.'
                    : !hasLink
                      ? 'Course link has not been provided yet.'
                      : isLocked && unlockDateLabel
                        ? `Unlocks on ${unlockDateLabel}`
                        : isLocked
                          ? 'Course is locked until its unlock date.'
                          : !hasAccess
                            ? 'Upgrade your membership to access this course.'
                            : ''
                }
                isDisabled={!isLocked && hasAccess && hasLink && hasCourse}
                hasArrow
                shouldWrapChildren
              >
                <Button
                  as={canOpen ? 'button' : (RouterLink as React.ElementType)}
                  to={canOpen ? undefined : '/upgrade'}
                  onClick={
                    canOpen && course?.link
                      ? (e: React.MouseEvent) => {
                          e.preventDefault()
                          onOpenCourse?.(course.link!)
                        }
                      : undefined
                  }
                  size="sm"
                  bg={isApproved && canOpen ? 'transparent' : canOpen ? '#350e6f' : 'transparent'}
                  color={isApproved && canOpen ? 'green.700' : canOpen ? 'white' : 'gray.600'}
                  border={isApproved && canOpen ? '1px solid' : canOpen ? 'none' : '1px solid'}
                  borderColor={isApproved && canOpen ? 'green.300' : 'gray.300'}
                  _hover={
                    isApproved && canOpen
                      ? { bg: 'green.50', borderColor: 'green.400' }
                      : canOpen
                        ? { bg: '#27062e' }
                        : undefined
                  }
                  _active={
                    isApproved && canOpen
                      ? { bg: 'green.100' }
                      : canOpen
                        ? { bg: '#27062e' }
                        : undefined
                  }
                  borderRadius="md"
                  fontWeight="semibold"
                  w="full"
                  isDisabled={!hasCourse || !hasLink || isLocked}
                  leftIcon={isLocked ? <Lock size={14} /> : undefined}
                  rightIcon={!isLocked && canOpen ? <ArrowUpRight size={14} /> : undefined}
                >
                  {isLocked && unlockDateLabel
                    ? `Unlocks ${unlockDateLabel}`
                    : !hasCourse
                      ? 'Course unavailable'
                      : !hasLink
                        ? 'Link unavailable'
                        : !hasAccess
                          ? 'Upgrade to unlock'
                          : isApproved
                            ? 'Revisit course'
                            : 'Open course'}
                </Button>
              </Tooltip>
            )}
          </Box>
        )}
      </Stack>
    </Box>
  )
}

export default AssignedCourseCard
