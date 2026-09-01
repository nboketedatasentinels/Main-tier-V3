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
  targetTier?: 'paid' | 'partner'
  isOpen: boolean
  onClose: () => void
}

const defaultBenefits: Record<'paid' | 'partner', string[]> = {
  paid: [
    'Unlimited impact entries per month',
    'Organization-level analytics and insights',
    'Advanced verification tiers (Evidence & Third-Party)',
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
  const resolvedBenefits = useMemo(() => benefits ?? defaultBenefits[targetTier], [benefits, targetTier])

  const handleCta = () => {
    if (targetTier === 'partner') {
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
        <Box bg="gray.50" borderBottomWidth="1px" borderColor="border.subtle" px={6} py={5}>
          <Flex justify="space-between" align="center" gap={4}>
            <Stack spacing={2} flex={1} minW={0}>
              <Flex align="center" gap={2}>
                <Icon as={Crown} color="brand.primary" />
                <Badge colorScheme="yellow" bg="accent.warning" color="black">
                  Full Access
                </Badge>
              </Flex>
              <Text fontSize="xl" fontWeight="bold" color="black">
                {title}
              </Text>
              <Text color="black" opacity={0.85}>
                {message}
              </Text>
            </Stack>
            <Icon as={Sparkles} boxSize={10} color="orange.400" flexShrink={0} />
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
              <Text fontWeight="semibold">Keep the evidence flowing</Text>
              <Text color="text.secondary">Impact Log Pro from ~$5/month. Past entries stay readable forever.</Text>
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
