import React, { useMemo } from 'react'
import {
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface EnhancedUpgradePromptModalProps {
  feature: string
  title: string
  message?: string
  benefits?: string[]
  ctaText?: string
  targetTier?: 'paid' | 'partner'
  isOpen: boolean
  onClose: () => void
}

const defaultBenefits: Record<'paid' | 'partner', string[]> = {
  paid: [
    'Unlimited impact entries per month',
    'Organization-level analytics and insights',
    'Advanced verification tiers',
    'Export capabilities for stakeholder reports',
    'Access to Business impact tracking',
    'Priority support from our team',
  ],
  partner: [
    'Create and manage impact events',
    'Generate QR codes for volunteer check-in',
    'Track real-time event participation',
    'Bulk upload impact entries',
    'Access event analytics and reports',
    'Partner-level reporting and controls',
  ],
}

export const ImpactUpgradePromptModal: React.FC<EnhancedUpgradePromptModalProps> = ({
  feature,
  title,
  message,
  benefits,
  ctaText = 'Upgrade Now',
  targetTier = 'paid',
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate()
  const resolvedBenefits = useMemo(
    () => benefits ?? defaultBenefits[targetTier],
    [benefits, targetTier],
  )

  const handleCta = () => {
    if (targetTier === 'partner') {
      navigate('/contact?inquiry=partner-access')
    } else {
      navigate('/upgrade')
    }
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md" motionPreset="slideInBottom">
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent
        overflow="hidden"
        bg="white"
        color="#111111"
        borderRadius="2xl"
        boxShadow="0 24px 64px rgba(39, 6, 46, 0.22)"
        mx={4}
      >
        {/* Brand accent strip */}
        <Box
          h="4px"
          bgGradient="linear(to-r, #27062e, #350e6f, #f4540c, #eab130)"
        />

        <ModalCloseButton
          top={3}
          right={3}
          borderRadius="full"
          style={{ color: '#475569' }}
          _hover={{ bg: 'gray.100', color: '#111111' }}
        />

        <ModalBody px={{ base: 6, md: 8 }} pt={8} pb={4}>
          <VStack align="stretch" spacing={6}>
            <Stack spacing={3}>
              <Text
                fontSize="xs"
                fontWeight="700"
                letterSpacing="0.12em"
                textTransform="uppercase"
                style={{ color: '#350e6f' }}
              >
                {feature}
              </Text>
              <Text
                as="h2"
                fontSize={{ base: '1.5rem', md: '1.65rem' }}
                fontWeight="700"
                lineHeight="1.25"
                letterSpacing="-0.02em"
                style={{ color: '#111111' }}
              >
                {title}
              </Text>
              {message ? (
                <Text fontSize="md" lineHeight="1.55" style={{ color: '#334155' }}>
                  {message}
                </Text>
              ) : null}
            </Stack>

            <Flex
              align={{ base: 'flex-start', sm: 'center' }}
              justify="space-between"
              gap={3}
              flexDir={{ base: 'column', sm: 'row' }}
              bg="#FAF7FC"
              borderWidth="1px"
              borderColor="#E8DFF0"
              borderRadius="xl"
              px={5}
              py={4}
            >
              <Box>
                <Text fontSize="sm" fontWeight="600" style={{ color: '#111111' }}>
                  Impact Log Pro
                </Text>
                <Text fontSize="sm" style={{ color: '#64748B' }}>
                  Past entries stay readable forever
                </Text>
              </Box>
              <HStack
                spacing={1}
                align="baseline"
                bg="white"
                borderRadius="lg"
                px={3}
                py={2}
                borderWidth="1px"
                borderColor="#E8DFF0"
              >
                <Text fontSize="2xl" fontWeight="800" letterSpacing="-0.03em" style={{ color: '#27062e' }}>
                  $5
                </Text>
                <Text fontSize="sm" fontWeight="500" style={{ color: '#64748B' }}>
                  /mo
                </Text>
              </HStack>
            </Flex>

            <Stack spacing={3}>
              {resolvedBenefits.map((benefit) => (
                <HStack key={benefit} align="flex-start" spacing={3}>
                  <Flex
                    align="center"
                    justify="center"
                    w={5}
                    h={5}
                    mt="1px"
                    flexShrink={0}
                    borderRadius="full"
                    bg="#F3EEF8"
                  >
                    <Icon as={Check} boxSize={3} style={{ color: '#350e6f' }} strokeWidth={3} />
                  </Flex>
                  <Text fontSize="sm" lineHeight="1.45" style={{ color: '#1e293b' }}>
                    {benefit}
                  </Text>
                </HStack>
              ))}
            </Stack>
          </VStack>
        </ModalBody>

        <Box px={{ base: 6, md: 8 }} pb={7} pt={2}>
          <Stack spacing={3}>
            <Button
              size="lg"
              w="full"
              bg="#350e6f"
              color="white"
              borderRadius="xl"
              fontWeight="700"
              _hover={{ bg: '#27062e' }}
              _active={{ bg: '#1f0524' }}
              onClick={handleCta}
            >
              {ctaText}
            </Button>
            <Button
              variant="ghost"
              size="md"
              w="full"
              fontWeight="500"
              style={{ color: '#64748B' }}
              _hover={{ bg: 'gray.50', color: '#111111' }}
              onClick={onClose}
            >
              Maybe later
            </Button>
          </Stack>
        </Box>
      </ModalContent>
    </Modal>
  )
}
