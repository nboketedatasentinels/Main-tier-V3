import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Card,
  CardBody,
  Divider,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  Progress,
  SimpleGrid,
  Stack,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  type BadgeProps,
} from '@chakra-ui/react'
import { ClipboardList, Flame, Gift, Megaphone, Share2, Target, TrendingUp, Users } from 'lucide-react'
import { AmbassadorLayout } from '@/layouts/AmbassadorLayout'
import { AmbassadorSessionsPanel } from '@/components/ambassador/AmbassadorSessionsPanel'
import { RateLearnerCourseAssessment } from '@/components/assessments/RateLearnerCourseAssessment'
import {
  PRE_COURSE_SURVEY_SECTION_ID,
  PreCourseSurveyButton,
} from '@/components/assessments/PreCourseSurveyButton'
import { useAuth } from '@/hooks/useAuth'
import { useOrganizationProgramCourses } from '@/hooks/useOrganizationProgramCourses'
import { useOrgProgrammeCourseTitles } from '@/hooks/useOrgProgrammeCourseTitles'
import { fetchAssignedCoachees } from '@/services/learnerAssignmentService'
import { getDisplayName } from '@/utils/displayName'
import { JOURNEY_META } from '@/config/pointsConfig'
import { isJourneyType } from '@/utils/journeyType'
import { resolveCourseSurveyKind, courseSurveySectionTitle } from '@/utils/courseSurveyWindow'
import type { UserProfile } from '@/types'

type ReferralMetric = {
  label: string
  value: number | string
  change: string
  icon: typeof Share2
  color: NonNullable<BadgeProps['colorScheme']>
}

type ReferralStage = { stage: string; value: number; color: NonNullable<BadgeProps['colorScheme']> }

const referralMetrics: ReferralMetric[] = [
  { label: 'Active referrals', value: 42, change: '+8 this week', icon: Share2, color: 'purple' },
  { label: 'Successful enrollments', value: 19, change: '+4 this week', icon: Users, color: 'green' },
  { label: 'Rewards earned', value: '$860', change: 'Ready to redeem', icon: Gift, color: 'orange' },
  { label: 'Ecosystem events', value: 7, change: 'Next event in 2 days', icon: Megaphone, color: 'blue' },
]

const referralPipeline: ReferralStage[] = [
  { stage: 'Invited', value: 65, color: 'purple' },
  { stage: 'Joined', value: 44, color: 'green' },
  { stage: 'Active', value: 31, color: 'orange' },
  { stage: 'Converted', value: 19, color: 'teal' },
]

const recentReferrals = [
  { name: 'Alex Morgan', status: 'Converted', reward: '$45', activity: 'Completed onboarding' },
  { name: 'Priya Patel', status: 'Active', reward: '$20', activity: 'Submitted weekly update' },
  { name: 'Daniel Lee', status: 'Joined', reward: '$10', activity: 'Booked mentor session' },
  { name: 'Sara Kim', status: 'Invited', reward: '$0', activity: 'Invitation sent' },
]

const engagementHighlights = [
  { title: 'Ecosystem check-ins', metric: '12 touchpoints', detail: '4 follow-ups needed' },
  { title: 'Resource shares', metric: '23 shares', detail: 'Top: Leadership toolkit' },
  { title: 'Event sign-ups', metric: '18 RSVPs', detail: 'Mentor AMA on Friday' },
]

export const AmbassadorDashboard: React.FC = () => {
  const { profile } = useAuth()
  const ambassadorName = profile?.fullName || profile?.firstName || 'Coach'
  const [coachees, setCoachees] = useState<UserProfile[]>([])

  useEffect(() => {
    if (!profile?.id) {
      setCoachees([])
      return
    }
    let cancelled = false
    void fetchAssignedCoachees(profile.id)
      .then((rows) => {
        if (!cancelled) setCoachees(rows)
      })
      .catch((err) => {
        console.error('[AmbassadorDashboard] coachees load failed', err)
        if (!cancelled) setCoachees([])
      })
    return () => {
      cancelled = true
    }
  }, [profile?.id])

  const rateLearners = useMemo(
    () =>
      coachees
        .filter((learner) => Boolean(learner.id))
        .map((learner) => ({
          id: learner.id!,
          name: getDisplayName(learner, 'Learner'),
          currentWeek: learner.currentWeek,
          journeyType: typeof learner.journeyType === 'string' ? learner.journeyType : undefined,
          journeyStatus: typeof learner.journeyStatus === 'string' ? learner.journeyStatus : undefined,
        })),
    [coachees],
  )

  const coacheeOrgId =
    coachees[0]?.organizationId ||
    coachees[0]?.companyId ||
    profile?.organizationId ||
    profile?.companyId ||
    null
  const { program: orgProgram } = useOrganizationProgramCourses(coacheeOrgId)
  const orgCourseTitles = useOrgProgrammeCourseTitles(orgProgram)

  const courseSurveyKind = useMemo(() => {
    const subject = coachees[0]
    const journeyType =
      typeof subject?.journeyType === 'string' && isJourneyType(subject.journeyType)
        ? subject.journeyType
        : null
    const weeks =
      subject?.programDurationWeeks ||
      (journeyType ? JOURNEY_META[journeyType].weeks : null) ||
      orgProgram?.programDurationWeeks ||
      null
    return resolveCourseSurveyKind({
      journeyStartDate: subject?.journeyStartDate,
      programDurationWeeks: weeks,
      currentWeek: subject?.currentWeek,
    })
  }, [coachees, orgProgram?.programDurationWeeks])

  return (
    <AmbassadorLayout
      activeItem="overview"
      ambassadorName={ambassadorName}
      avatarUrl={profile?.avatarUrl}
    >
      <Stack spacing={6}>
        <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4} flexWrap="wrap">
          <Stack spacing={2} maxW="640px">
            <Text fontSize="2xl" fontWeight="bold" color="brand.text">
              Welcome back, {ambassadorName}
            </Text>
            <Text color="brand.subtleText">
              Track referrals, celebrate wins, and grow the ecosystem with dedicated coach tools.
            </Text>
            <HStack spacing={3} flexWrap="wrap">
              <Badge colorScheme="purple">Referral program</Badge>
              <Badge colorScheme="green" variant="subtle">
                Recognition enabled
              </Badge>
              <PreCourseSurveyButton size="sm" kind={courseSurveyKind} />
            </HStack>
          </Stack>
          <Stack spacing={2} align="flex-end">
            <HStack spacing={3}>
              <Icon as={TrendingUp} />
              <Text fontWeight="semibold" color="brand.text">
                Momentum week
              </Text>
            </HStack>
            <Text fontSize="sm" color="brand.subtleText">
              Conversion trend up 12% vs last week
            </Text>
          </Stack>
        </Flex>

        <Box
          id={PRE_COURSE_SURVEY_SECTION_ID}
          scrollMarginTop="96px"
          borderRadius="xl"
          border="1px solid"
          borderColor="gray.200"
          bg="white"
          p={{ base: 4, md: 6 }}
        >
          <HStack spacing={3} mb={4} align="flex-start">
            <Icon as={ClipboardList} boxSize={5} color="gray.700" mt={1} />
            <Box>
              <Heading size="sm" color="gray.900">
                {courseSurveySectionTitle(courseSurveyKind)}
              </Heading>
              <Text fontSize="sm" color="gray.600" mt={1}>
                {courseSurveyKind === 'post'
                  ? orgCourseTitles.length
                    ? `Final 3 weeks: Post ratings for coachees (${orgCourseTitles.join(', ')}).`
                    : 'Final 3 weeks: complete Post ratings for coachees.'
                  : orgCourseTitles.length
                    ? `Pre ratings for coachees on their organisation programme (${orgCourseTitles.join(', ')}). Post unlocks in the last 3 weeks.`
                    : 'Pre ratings for coachees, scoped to admin-assigned organisation courses. Post unlocks in the last 3 weeks.'}
              </Text>
            </Box>
          </HStack>

          {profile?.id && rateLearners.length > 0 ? (
            <RateLearnerCourseAssessment
              respondentId={profile.id}
              raterRole="coach"
              learners={rateLearners}
              forcedKind={courseSurveyKind}
              allowedCourseTitles={coacheeOrgId ? orgCourseTitles : null}
            />
          ) : (
            <Text fontSize="sm" color="gray.500">
              Assign coachees first. Assessments appear here for each learner on your roster,
              scoped to their organisation&apos;s programme courses.
            </Text>
          )}
        </Box>

        <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4}>
          {referralMetrics.map((metric) => (
            <Card key={metric.label} border="1px solid" borderColor="brand.border" bg="white">
              <CardBody>
                <HStack justify="space-between" align="center">
                  <Box p={3} borderRadius="lg" bg={`${metric.color}.50`} color={`${metric.color}.600`}>
                    <Icon as={metric.icon} />
                  </Box>
                  <Badge colorScheme={metric.color}>{metric.change}</Badge>
                </HStack>
                <Stack spacing={1} mt={4}>
                  <Stat>
                    <StatLabel color="brand.subtleText">{metric.label}</StatLabel>
                    <StatNumber color="brand.text">{metric.value}</StatNumber>
                    <StatHelpText color="brand.subtleText">{metric.change}</StatHelpText>
                  </Stat>
                </Stack>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>

        {profile?.id && (
          <AmbassadorSessionsPanel
            ambassadorId={profile.id}
            ambassadorName={getDisplayName(profile, ambassadorName)}
            companyId={profile.companyId ?? null}
            companyCode={profile.companyCode ?? null}
          />
        )}

        <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6}>
          <GridItem>
            <Card border="1px solid" borderColor="brand.border" bg="white">
              <CardBody>
                <Stack spacing={4}>
                  <HStack justify="space-between">
                    <Text fontWeight="bold" color="brand.text">
                      Referral pipeline
                    </Text>
                    <Badge colorScheme="purple">Live</Badge>
                  </HStack>

                  <Stack spacing={3}>
                    {referralPipeline.map((stage) => (
                      <Box key={stage.stage}>
                        <HStack justify="space-between" mb={1}>
                          <Text color="brand.subtleText">{stage.stage}</Text>
                          <Text fontWeight="semibold" color="brand.text">{stage.value}</Text>
                        </HStack>
                        <Progress value={stage.value} colorScheme={stage.color} borderRadius="full" />
                      </Box>
                    ))}
                  </Stack>

                  <Divider />

                  <Stack spacing={3}>
                    <HStack justify="space-between" align="center">
                      <Text fontWeight="bold" color="brand.text">
                        Recent referrals
                      </Text>
                      <Badge colorScheme="green">Updated</Badge>
                    </HStack>

                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Name</Th>
                          <Th>Status</Th>
                          <Th>Reward</Th>
                          <Th>Activity</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {recentReferrals.map((referral) => (
                          <Tr key={referral.name}>
                            <Td fontWeight="semibold">{referral.name}</Td>
                            <Td>
                              <Badge colorScheme={referral.status === 'Converted' ? 'green' : referral.status === 'Active' ? 'purple' : 'gray'}>
                                {referral.status}
                              </Badge>
                            </Td>
                            <Td>{referral.reward}</Td>
                            <Td>{referral.activity}</Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Stack>
                </Stack>
              </CardBody>
            </Card>
          </GridItem>

          <GridItem>
            <Stack spacing={4}>
              <Card border="1px solid" borderColor="brand.border" bg="white">
                <CardBody>
                  <Stack spacing={3}>
                    <HStack justify="space-between">
                      <Text fontWeight="bold" color="brand.text">
                        Engagement focus
                      </Text>
                      <Badge colorScheme="orange">Action items</Badge>
                    </HStack>

                    <Stack spacing={3}>
                      {engagementHighlights.map((item) => (
                        <Box key={item.title} p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
                          <Text fontWeight="semibold" color="brand.text">
                            {item.title}
                          </Text>
                          <Text color="brand.text">{item.metric}</Text>
                          <Text fontSize="sm" color="brand.subtleText">
                            {item.detail}
                          </Text>
                        </Box>
                      ))}
                    </Stack>
                  </Stack>
                </CardBody>
              </Card>

              <Card border="1px solid" borderColor="brand.border" bg="white">
                <CardBody>
                  <Stack spacing={3}>
                    <HStack justify="space-between">
                      <Text fontWeight="bold" color="brand.text">
                        Recognition milestones
                      </Text>
                      <Badge colorScheme="purple">Rewards</Badge>
                    </HStack>

                    <VStack align="stretch" spacing={3}>
                      <HStack justify="space-between">
                        <HStack>
                          <Icon as={Flame} color="orange.500" />
                          <Text color="brand.text">Streak achiever</Text>
                        </HStack>
                        <Badge colorScheme="orange">7 days</Badge>
                      </HStack>
                      <HStack justify="space-between">
                        <HStack>
                          <Icon as={Gift} color="purple.500" />
                          <Text color="brand.text">Reward threshold</Text>
                        </HStack>
                        <Badge colorScheme="purple">$1000 goal</Badge>
                      </HStack>
                      <HStack justify="space-between">
                        <HStack>
                          <Icon as={Target} color="teal.500" />
                          <Text color="brand.text">Engagement target</Text>
                        </HStack>
                        <Badge colorScheme="teal">80% completion</Badge>
                      </HStack>
                    </VStack>
                  </Stack>
                </CardBody>
              </Card>
            </Stack>
          </GridItem>
        </Grid>
      </Stack>
    </AmbassadorLayout>
  )
}
