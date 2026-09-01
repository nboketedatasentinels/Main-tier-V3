import React, { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  Stack,
  Text,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { Check, CreditCard, Lock, ShieldCheck } from 'lucide-react'
import { RequestUpgradeModal } from './RequestUpgradeModal'
import { RequestStatusView } from './RequestStatusView'
import { useAuth } from '@/hooks/useAuth'
import { usePendingUpgradeRequest } from '@/hooks/useUpgradeRequests'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { hasUnlimitedImpactLogAccess, isFreeUser } from '@/utils/membership'
import { openImpactLogProCheckout } from '@/services/paymentService'

const impactProBenefits = [
  'Unlimited Impact Log entries',
  'PDF and CSV export for stakeholders',
  'Verifier workflow without the free-tier wall',
  'Cancel anytime — past logs stay yours',
]

const fullAccessBenefits = [
  'Everything in Impact Log Pro',
  'Mentor and coach pathways',
  'Full programme access',
  'Priority support',
]

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
  const impactProStatus = searchParams.get('impact_pro')
  const [checkoutBusy, setCheckoutBusy] = useState(false)

  const startImpactPro = async () => {
    setCheckoutBusy(true)
    try {
      await openImpactLogProCheckout()
    } catch (err) {
      toast({
        title: 'Could not start checkout',
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
    <Box bg="#F7F5F9" minH={{ base: '100dvh', md: '100vh' }} py={{ base: 10, md: 14 }}>
      <Container maxW="4xl">
        <Stack spacing={8} style={{ color: '#111111' }}>
          {impactProStatus === 'success' && (
            <Box bg="#ECFDF5" borderWidth="1px" borderColor="#A7F3D0" borderRadius="xl" p={5}>
              <Heading size="sm" mb={1} style={{ color: '#065F46' }}>
                Payment received
              </Heading>
              <Text fontSize="sm" style={{ color: '#047857' }}>
                Stripe is confirming Impact Log Pro. Refresh in a few seconds if unlimited logging is not
                unlocked yet.
              </Text>
            </Box>
          )}

          {impactProStatus === 'cancel' && (
            <Box bg="#FFF7ED" borderWidth="1px" borderColor="#FED7AA" borderRadius="xl" p={5}>
              <Heading size="sm" mb={1} style={{ color: '#9A3412' }}>
                Checkout cancelled
              </Heading>
              <Text fontSize="sm" style={{ color: '#C2410C' }}>
                No charge was made. Pick a plan below when you are ready.
              </Text>
            </Box>
          )}

          {(isPaid || hasImpactPro) && (
            <Box
              bg="white"
              borderWidth="1px"
              borderColor="#A7F3D0"
              borderRadius="xl"
              p={{ base: 5, md: 6 }}
              boxShadow="sm"
            >
              <Stack spacing={3}>
                <Heading size="md" style={{ color: '#111111' }}>
                  {isPaid ? 'Your membership is active' : 'Impact Log Pro is active'}
                </Heading>
                <Text style={{ color: '#334155' }}>
                  {isPaid
                    ? 'Full access is unlocked. Jump back into the dashboard to keep going.'
                    : 'Unlimited Impact Log is unlocked on your account.'}
                </Text>
                <Button
                  alignSelf="flex-start"
                  bg="#350e6f"
                  color="white"
                  _hover={{ bg: '#27062e' }}
                  onClick={() => navigate('/app/leaderboard')}
                >
                  Go to Dashboard
                </Button>
              </Stack>
            </Box>
          )}

          <VStack spacing={3} textAlign="center" px={2}>
            <Text
              fontSize="xs"
              fontWeight="700"
              letterSpacing="0.14em"
              textTransform="uppercase"
              style={{ color: '#350e6f' }}
            >
              Checkout
            </Text>
            <Heading
              as="h1"
              fontSize={{ base: '2xl', md: '3xl' }}
              fontWeight="800"
              letterSpacing="-0.03em"
              lineHeight="1.2"
              style={{ color: '#111111' }}
            >
              Choose a plan
            </Heading>
            <Text fontSize="md" maxW="lg" style={{ color: '#475569' }}>
              Secure Stripe checkout. Cancel anytime. Past Impact Log entries stay readable forever.
            </Text>
          </VStack>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5} alignItems="stretch">
            {/* Impact Log Pro — primary checkout card */}
            <Box
              bg="white"
              borderWidth="2px"
              borderColor="#350e6f"
              borderRadius="2xl"
              overflow="hidden"
              boxShadow="0 16px 40px rgba(53, 14, 111, 0.12)"
              position="relative"
            >
              <Box h="4px" bgGradient="linear(to-r, #27062e, #350e6f, #f4540c, #eab130)" />
              <Box
                position="absolute"
                top={4}
                right={4}
                bg="#eab130"
                color="#111111"
                fontSize="xs"
                fontWeight="700"
                px={3}
                py={1}
                borderRadius="full"
              >
                Most popular
              </Box>
              <Stack spacing={6} p={{ base: 6, md: 7 }}>
                <Box>
                  <Text fontSize="sm" fontWeight="700" style={{ color: '#350e6f' }}>
                    Impact Log Pro
                  </Text>
                  <HStack align="baseline" spacing={1} mt={2}>
                    <Text fontSize="4xl" fontWeight="800" letterSpacing="-0.04em" style={{ color: '#111111' }}>
                      $5
                    </Text>
                    <Text fontSize="md" fontWeight="500" style={{ color: '#64748B' }}>
                      /month
                    </Text>
                  </HStack>
                  <Text fontSize="sm" mt={1} style={{ color: '#64748B' }}>
                    Billed monthly · cancel anytime
                  </Text>
                </Box>

                <Stack spacing={3}>
                  {impactProBenefits.map((benefit) => (
                    <HStack key={benefit} align="flex-start" spacing={3}>
                      <Flex
                        align="center"
                        justify="center"
                        w={5}
                        h={5}
                        mt="1px"
                        flexShrink={0}
                        borderRadius="full"
                        bg="#DBEAFE"
                      >
                        <Icon as={Check} boxSize={3} style={{ color: '#60A5FA' }} strokeWidth={3} />
                      </Flex>
                      <Text fontSize="sm" style={{ color: '#1e293b' }}>
                        {benefit}
                      </Text>
                    </HStack>
                  ))}
                </Stack>

                {hasImpactPro || isPaid ? (
                  <Button size="lg" w="full" borderRadius="xl" isDisabled>
                    Already included
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    w="full"
                    borderRadius="xl"
                    bg="#350e6f"
                    color="white"
                    fontWeight="700"
                    leftIcon={<Icon as={CreditCard} boxSize={4} />}
                    _hover={{ bg: '#27062e' }}
                    _active={{ bg: '#1f0524' }}
                    isLoading={checkoutBusy}
                    loadingText="Redirecting to Stripe…"
                    onClick={() => void startImpactPro()}
                  >
                    Continue to checkout
                  </Button>
                )}
              </Stack>
            </Box>

            {/* Full programme — request path */}
            <Box
              bg="white"
              borderWidth="1px"
              borderColor="#E8DFF0"
              borderRadius="2xl"
              overflow="hidden"
              boxShadow="sm"
            >
              <Stack spacing={6} p={{ base: 6, md: 7 }} h="full">
                <Box>
                  <Text fontSize="sm" fontWeight="700" style={{ color: '#64748B' }}>
                    Full programme
                  </Text>
                  <Text fontSize="2xl" fontWeight="800" letterSpacing="-0.03em" mt={2} style={{ color: '#111111' }}>
                    Custom pricing
                  </Text>
                  <Text fontSize="sm" mt={1} style={{ color: '#64748B' }}>
                    Mentor / coach pathways · we reply within 24 hours
                  </Text>
                </Box>

                <Stack spacing={3} flex="1">
                  {fullAccessBenefits.map((benefit) => (
                    <HStack key={benefit} align="flex-start" spacing={3}>
                      <Flex
                        align="center"
                        justify="center"
                        w={5}
                        h={5}
                        mt="1px"
                        flexShrink={0}
                        borderRadius="full"
                        bg="#F1F5F9"
                      >
                        <Icon as={Check} boxSize={3} style={{ color: '#475569' }} strokeWidth={3} />
                      </Flex>
                      <Text fontSize="sm" style={{ color: '#1e293b' }}>
                        {benefit}
                      </Text>
                    </HStack>
                  ))}
                </Stack>

                {isPaid ? (
                  <Button size="lg" w="full" borderRadius="xl" isDisabled>
                    Already active
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    w="full"
                    borderRadius="xl"
                    variant="outline"
                    borderColor="#350e6f"
                    style={{ color: '#350e6f' }}
                    fontWeight="700"
                    _hover={{ bg: '#FAF7FC' }}
                    onClick={onOpen}
                  >
                    Request full upgrade
                  </Button>
                )}
              </Stack>
            </Box>
          </SimpleGrid>

          <HStack
            justify="center"
            spacing={{ base: 4, md: 8 }}
            flexWrap="wrap"
            pt={1}
            style={{ color: '#64748B' }}
          >
            <HStack spacing={2}>
              <Icon as={Lock} boxSize={3.5} />
              <Text fontSize="xs" fontWeight="500">
                Secure Stripe checkout
              </Text>
            </HStack>
            <HStack spacing={2}>
              <Icon as={ShieldCheck} boxSize={3.5} />
              <Text fontSize="xs" fontWeight="500">
                Cancel anytime
              </Text>
            </HStack>
            <HStack spacing={2}>
              <Icon as={CreditCard} boxSize={3.5} />
              <Text fontSize="xs" fontWeight="500">
                Card payment · no invoice chase
              </Text>
            </HStack>
          </HStack>

          {pendingRequest && !isPaid && <RequestStatusView request={pendingRequest} />}

          {!profile && (
            <Text textAlign="center" fontSize="sm" style={{ color: '#64748B' }}>
              Already upgraded?{' '}
              <Button variant="link" color="#350e6f" onClick={() => navigate('/login')}>
                Sign in
              </Button>
            </Text>
          )}
        </Stack>
      </Container>

      <RequestUpgradeModal isOpen={isOpen} onClose={onClose} />
    </Box>
  )
}
