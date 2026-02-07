import React, { useMemo } from 'react'
import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Grid,
  GridItem,
  Heading,
  Icon,
  Stack,
  Tag,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { Crown, ExternalLink, Sparkles, TimerReset } from 'lucide-react'
import { RequestUpgradeModal } from './RequestUpgradeModal'
import { RequestStatusView } from './RequestStatusView'
import { UpgradeCtaCard } from './UpgradeCtaCard'
import { useAuth } from '@/hooks/useAuth'
import { usePendingUpgradeRequest } from '@/hooks/useUpgradeRequests'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { isFreeUser } from '@/utils/membership'

const cohorts = [
  { name: 'First Cohort', startDate: 'Week of January 13', link: 'https://t4leader.com/pay/first-2026' },
  { name: 'Second Cohort', startDate: 'Week of February 10', link: 'https://t4leader.com/pay/second-2026' },
  { name: 'Third Cohort', startDate: 'Week of March 10', link: 'https://t4leader.com/pay/third-2026' },
  { name: 'Fourth Cohort', startDate: 'Week of April 14', link: 'https://t4leader.com/pay/fourth-2026' },
  { name: 'Fifth Cohort', startDate: 'Week of May 12', link: 'https://t4leader.com/pay/fifth-2026' },
  { name: 'Sixth Cohort', startDate: 'Week of June 9', link: 'https://t4leader.com/pay/sixth-2026' },
  { name: 'Seventh Cohort', startDate: 'Week of September 8', link: 'https://t4leader.com/pay/seventh-2026' },
  { name: 'Eighth Cohort', startDate: 'Week of October 13', link: 'https://t4leader.com/pay/eighth-2026' },
  { name: 'Ninth Cohort', startDate: 'Week of November 10', link: 'https://t4leader.com/pay/ninth-2026' },
]

export const UpgradePage: React.FC = () => {
  const { profile } = useAuth()
  const isPaid = useMemo(() => (profile ? !isFreeUser(profile) : false), [profile])
  const navigate = useNavigate()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { pendingRequest } = usePendingUpgradeRequest(profile?.id)
  const [searchParams] = useSearchParams()
  const source = searchParams.get('source')

  return (
    <Box bg="gray.50" minH={{ base: '100dvh', md: '100vh' }} py={12}>
      <Container maxW="6xl">
        <Stack spacing={8}>
          {isPaid && (
            <Box
              bg="white"
              borderWidth="1px"
              borderColor="green.200"
              borderRadius="xl"
              p={{ base: 5, md: 6 }}
              boxShadow="sm"
            >
              <Stack spacing={3}>
                <Heading size="md">Your membership is active</Heading>
                <Text color="gray.600">
                  Premium access is already unlocked for your account. Jump back into the dashboard to explore your
                  paid features.
                </Text>
                <Button alignSelf="flex-start" colorScheme="purple" onClick={() => navigate('/app/leaderboard')}>
                  Go to Dashboard
                </Button>
              </Stack>
            </Box>
          )}
          <Box
            bgGradient="linear(to-r, amber.200, pink.200)"
            borderRadius="xl"
            p={{ base: 6, md: 10 }}
            boxShadow="lg"
            position="relative"
            overflow="hidden"
          >
            <Icon as={Sparkles} color="white" opacity={0.2} boxSize={28} position="absolute" right={-6} top={-6} />
            <Stack spacing={4} maxW="3xl">
              <Tag size="lg" colorScheme="purple" w="fit-content">
                Premium Upgrade Journey
              </Tag>
              <Heading size="2xl">
                {isPaid ? 'Premium access confirmed' : 'Unlock your full leadership potential'}
              </Heading>
              <Text fontSize="lg" color="gray.700">
                {isPaid
                  ? 'You are already upgraded. Explore paid features and live cohorts from your dashboard.'
                  : 'Enroll in our 6-week journey cohorts or request a custom upgrade pathway. We\'ll respond within 24 hours.'}
                {source ? ` (via ${source})` : ''}
              </Text>
              <Stack direction={{ base: 'column', md: 'row' }} spacing={4}>
                {isPaid ? (
                  <Button colorScheme="purple" size="lg" onClick={() => navigate('/app/leaderboard')}>
                    Go to Dashboard
                  </Button>
                ) : (
                  <>
                    <Button colorScheme="purple" size="lg" onClick={onOpen} leftIcon={<Crown />}>
                      Request Upgrade
                    </Button>
                    <Button variant="outline" size="lg" colorScheme="purple" onClick={() => navigate('/login')}>
                      Already Paid? Sign In
                    </Button>
                  </>
                )}
              </Stack>
              {!isPaid && (
                <Text color="gray.600" fontSize="sm">
                  30-day money-back guarantee • Starting at $29/month • Join 10,000+ impact leaders
                </Text>
              )}
            </Stack>
          </Box>

          {pendingRequest && !isPaid && <RequestStatusView request={pendingRequest} />}

          {!isPaid && (
            <UpgradeCtaCard
              headline="Unlock Premium Features"
              benefits={['Unlimited impact entries', 'Advanced analytics', 'Priority support']}
              onClick={onOpen}
              storageKey="upgrade-page-cta"
            />
          )}

          {!isPaid && (
            <>
              <Stack spacing={3}>
                <Heading size="lg">Choose your 2026 cohort</Heading>
                <Text color="gray.600">Six-week journey cohorts with live coaching and accountability.</Text>
              </Stack>

              <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }} gap={4}>
                {cohorts.map((cohort) => (
                  <GridItem
                    key={cohort.name}
                    p={5}
                    borderWidth="1px"
                    borderRadius="lg"
                    bg="white"
                    borderColor="border.control"
                    _hover={{ shadow: 'md', borderColor: 'indigo.300' }}
                    transition="all 0.2s"
                  >
                    <Stack spacing={3} h="100%">
                      <Flex align="center" justify="space-between">
                        <Heading size="md">{cohort.name}</Heading>
                        <Badge colorScheme="purple">6-week journey</Badge>
                      </Flex>
                      <Text color="gray.600">{cohort.startDate}</Text>
                      <Flex align="center" color="gray.700" gap={2}>
                        <Icon as={TimerReset} />
                        <Text>Enrollment open</Text>
                      </Flex>
                      <Button
                        as="a"
                        href={cohort.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        rightIcon={<ExternalLink size={18} />}
                        colorScheme="purple"
                      >
                        Enroll Now
                      </Button>
                    </Stack>
                  </GridItem>
                ))}
              </Grid>
            </>
          )}
        </Stack>
      </Container>

      <RequestUpgradeModal isOpen={isOpen} onClose={onClose} />
    </Box>
  )
}
