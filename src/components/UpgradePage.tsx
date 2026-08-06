import React, { useMemo } from 'react'
import {
  Box,
  Button,
  Container,
  Heading,
  Icon,
  Stack,
  Tag,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { Crown, Sparkles } from 'lucide-react'
import { RequestUpgradeModal } from './RequestUpgradeModal'
import { RequestStatusView } from './RequestStatusView'
import { UpgradeCtaCard } from './UpgradeCtaCard'
import { useAuth } from '@/hooks/useAuth'
import { usePendingUpgradeRequest } from '@/hooks/useUpgradeRequests'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { isFreeUser } from '@/utils/membership'

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
                  Full access is already unlocked for your account. Jump back into the dashboard to explore your
                  upgraded features.
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
                Upgrade Journey
              </Tag>
              <Heading size="2xl">
                {isPaid ? 'Full access confirmed' : 'Unlock your full leadership potential'}
              </Heading>
              <Text fontSize="lg" color="gray.700">
                {isPaid
                  ? 'You are already upgraded. Explore full-access features from your dashboard.'
                  : "Request a custom upgrade pathway. We'll respond within 24 hours."}
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
                      Already upgraded? Sign In
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
              headline="Unlock full access"
              benefits={['Unlimited impact entries', 'Advanced analytics', 'Priority support']}
              onClick={onOpen}
              storageKey="upgrade-page-cta"
            />
          )}
        </Stack>
      </Container>

      <RequestUpgradeModal isOpen={isOpen} onClose={onClose} />
    </Box>
  )
}
