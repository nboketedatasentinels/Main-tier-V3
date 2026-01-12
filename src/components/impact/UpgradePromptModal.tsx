import React, { useMemo } from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  Icon,
  List,
  ListIcon,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
} from '@chakra-ui/react'
import { Crown, Sparkles, CheckCircle2, LockKeyhole } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface EnhancedUpgradePromptModalProps {
  feature: string
  title: string
  message: string
  benefits?: string[]
  ctaText?: string
  targetTier?: 'paid' | 'admin'
  isOpen: boolean
  onClose: () => void
}

const defaultBenefits: Record<'paid' | 'admin', string[]> = {
  paid: [
    'Unlimited impact entries per month',
    'Organization-level analytics and insights',
    'Advanced verification tiers (Evidence & Third-Party)',
    'Export capabilities for stakeholder reports',
    'Access to Business impact tracking',
    'Priority support from our team',
  ],
  admin: [
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
  const resolvedBenefits = useMemo(() => benefits ?? defaultBenefits[targetTier], [benefits, targetTier])

  const handleCta = () => {
    if (targetTier === 'admin') {
      navigate('/contact?inquiry=partner-access')
    } else {
      navigate('/upgrade')
    }
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent overflow="hidden">
        <Box bgGradient="linear(to-r, purple.500, indigo.600)" color="white" px={6} py={5}>
          <Flex justify="space-between" align="center">
            <Stack spacing={1}>
              <Flex align="center" gap={2}>
                <Icon as={Crown} color="white" />
                <Badge colorScheme="yellow" bg="accent.warning" color="text.primary">
                  Premium Access
                </Badge>
              </Flex>
              <Text fontSize="xl" fontWeight="bold" color="white">
                {title}
              </Text>
              <Text color="whiteAlpha.800">{message}</Text>
            </Stack>
            <Icon as={Sparkles} boxSize={10} color="yellow.300" />
          </Flex>
        </Box>
        <ModalHeader>
          <Flex align="center" gap={2}>
            <Icon as={LockKeyhole} />
            <Text>Unlock {feature}</Text>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Box borderWidth="1px" borderStyle="dashed" borderRadius="md" p={3} borderColor="border.strong">
              <Text fontWeight="semibold">Join 10,000+ Impact Leaders</Text>
              <Text color="text.secondary">Starting at $29/month. 30-day money-back guarantee.</Text>
            </Box>
            <List spacing={2}>
              {resolvedBenefits.map((benefit) => (
                <ListItem key={benefit} display="flex" alignItems="center" gap={2}>
                  <ListIcon as={CheckCircle2} color="green.500" />
                  <Text>{benefit}</Text>
                </ListItem>
              ))}
            </List>
          </Stack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={onClose}>
            Maybe Later
          </Button>
          <Button colorScheme="purple" onClick={handleCta}>
            {ctaText}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
