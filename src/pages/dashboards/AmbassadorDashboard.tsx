import React from 'react'
import {
  Badge,
  Box,
  Card,
  CardBody,
  Divider,
  Flex,
  Grid,
  GridItem,
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
import { Flame, Gift, Megaphone, Share2, Target, TrendingUp, Users } from 'lucide-react'
import { AmbassadorLayout } from '@/layouts/AmbassadorLayout'
import { AmbassadorSessionsPanel } from '@/components/ambassador/AmbassadorSessionsPanel'
import { useAuth } from '@/hooks/useAuth'
import { getDisplayName } from '@/utils/displayName'

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
  const ambassadorName = profile?.fullName || profile?.firstName || 'Ambassador'

  return (
    <AmbassadorLayout
      activeItem="overview"
      ambassadorName={ambassadorName}
      avatarUrl={profile?.avatarUrl}
    >
      <Stack spacing={6}>
        <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={6} wrap="wrap">
          <Stack spacing={2}>
            <Text fontSize="2xl" fontWeight="bold" color="brand.text">
              Welcome back, {ambassadorName}
            </Text>
            <Text color="brand.subtleText">
              Track referrals, celebrate wins, and grow the ecosystem with dedicated ambassador tools.
            </Text>
            <HStack spacing={3}>
              <Badge colorScheme="purple">Referral program</Badge>
              <Badge colorScheme="green" variant="subtle">
                Recognition enabled
              </Badge>
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
