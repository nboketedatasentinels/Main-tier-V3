import React, { useMemo, useState } from 'react'
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
  useToast,
} from '@chakra-ui/react'
import { Crown, Sparkles } from 'lucide-react'
import { RequestUpgradeModal } from './RequestUpgradeModal'
import { RequestStatusView } from './RequestStatusView'
import { UpgradeCtaCard } from './UpgradeCtaCard'
import { useAuth } from '@/hooks/useAuth'
import { usePendingUpgradeRequest } from '@/hooks/useUpgradeRequests'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { hasUnlimitedImpactLogAccess, isFreeUser } from '@/utils/membership'
import { openImpactLogProCheckout } from '@/services/paymentService'

export const UpgradePage: React.FC = () => {
  const { profile } = useAuth()
  const toast = useToast()
  const isPaid = useMemo(() => (profile ? !isFreeUser(profile) : false), [profile])
  const hasImpactPro = useMemo(
    () => Boolean(profile && hasUnlimitedImpactLogAccess(profile)),
    [profile],
  )
  const navigate = useNavigate()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { pendingRequest } = usePendingUpgradeRequest(profile?.id)
  const [searchParams] = useSearchParams()
  const source = searchParams.get('source')
  const impactProStatus = searchParams.get('impact_pro')
  const [checkoutBusy, setCheckoutBusy] = useState(false)

  const startImpactPro = async () => {
    setCheckoutBusy(true)
    try {
      await openImpactLogProCheckout()
    } catch (err) {
      toast({
        title: 'Could not start Impact Log Pro checkout',
        description:
          err instanceof Error
            ? err.message
            : 'Stripe may not be configured yet. Ask an admin to set STRIPE_IMPACT_LOG_PRICE_ID.',
        status: 'error',
        duration: 8000,
        isClosable: true,
      })
      setCheckoutBusy(false)
    }
  }

  return (
    <Box bg="gray.50" minH={{ base: '100dvh', md: '100vh' }} py={12}>
      <Container maxW="6xl">
        <Stack spacing={8}>
          {impactProStatus === 'success' && (
            <Box bg="green.50" borderWidth="1px" borderColor="green.200" borderRadius="xl" p={5} style={{ color: '#111111' }}>
              <Heading size="sm" mb={1} style={{ color: '#111111' }}>
                Impact Log Pro checkout complete
              </Heading>
              <Text fontSize="sm" style={{ color: '#334155' }}>
                Stripe is confirming your subscription. Refresh in a few seconds if unlimited Impact Log is not
                unlocked yet.
              </Text>
            </Box>
          )}
          {isPaid && (
            <Box
              bg="white"
              borderWidth="1px"
              borderColor="green.200"
              borderRadius="xl"
              p={{ base: 5, md: 6 }}
              boxShadow="sm"
              style={{ color: '#111111' }}
            >
              <Stack spacing={3}>
                <Heading size="md" style={{ color: '#111111' }}>
                  Your membership is active
                </Heading>
                <Text style={{ color: '#334155' }}>
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
            color="#111111"
          >
            <Icon as={Sparkles} color="#350e6f" opacity={0.15} boxSize={28} position="absolute" right={-6} top={-6} />
            <Stack spacing={4} maxW="3xl" style={{ color: '#111111' }}>
              <Tag size="lg" colorScheme="purple" w="fit-content">
                Upgrade Journey
              </Tag>
              <Heading size="2xl" style={{ color: '#111111' }}>
                {isPaid ? 'Full access confirmed' : 'Unlock your full leadership potential'}
              </Heading>
              <Text fontSize="lg" style={{ color: '#1e293b' }}>
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
                      Request full upgrade
                    </Button>
                    {!hasImpactPro && (
                      <Button
                        variant="solid"
                        size="lg"
                        colorScheme="orange"
                        isLoading={checkoutBusy}
                        onClick={() => void startImpactPro()}
                      >
                        Impact Log Pro · $5/mo
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="lg"
                      colorScheme="purple"
                      borderColor="#350e6f"
                      style={{ color: '#350e6f' }}
                      onClick={() => navigate('/login')}
                    >
                      Already upgraded? Sign In
                    </Button>
                  </>
                )}
              </Stack>
              {!isPaid && (
                <Text fontSize="sm" style={{ color: '#334155' }}>
                  Full programme (mentor/coach) via custom upgrade · or Impact Log only for $5/month (cancel anytime)
                </Text>
              )}
            </Stack>
          </Box>

          {pendingRequest && !isPaid && <RequestStatusView request={pendingRequest} />}

          {!isPaid && !hasImpactPro && (
            <UpgradeCtaCard
              headline="Just need Impact Log?"
              benefits={[
                'Unlimited Impact Log entries after your 2 free ones',
                'PDF and CSV export',
                '$5/month — cancel anytime',
              ]}
              onClick={() => void startImpactPro()}
              storageKey="upgrade-page-impact-pro-cta"
            />
          )}

          {!isPaid && (
            <UpgradeCtaCard
              headline="Unlock full access"
              benefits={['Unlimited impact entries', 'Mentor & coach pathways', 'Priority support']}
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
