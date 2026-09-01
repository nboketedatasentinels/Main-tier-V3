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
import { CheckCircle2, LockKeyhole } from 'lucide-react'
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
      <ModalContent overflow="hidden" bg="white" color="#111111">
        <Box bg="#F7F7F8" borderBottomWidth="1px" borderColor="gray.200" px={6} py={5} pr={12}>
          <Stack spacing={2}>
            <Badge bg="#eab130" style={{ color: '#111111' }} alignSelf="flex-start">
              Full Access
            </Badge>
            <Text as="h2" fontSize="xl" fontWeight="bold" style={{ color: '#111111' }}>
              {title}
            </Text>
            {message ? (
              <Text as="p" fontSize="md" style={{ color: '#111111' }}>
                {message}
              </Text>
            ) : null}
          </Stack>
        </Box>
        <ModalCloseButton style={{ color: '#111111' }} />
        <ModalHeader color="#111111">
          <Flex align="center" gap={2}>
            <Icon as={LockKeyhole} style={{ color: '#111111' }} />
            <Text style={{ color: '#111111' }}>Unlock {feature}</Text>
          </Flex>
        </ModalHeader>
        <ModalBody>
          <Stack spacing={4} color="#111111">
            <Box borderWidth="1px" borderStyle="dashed" borderRadius="md" p={3} borderColor="border.strong">
              <Text fontWeight="semibold" style={{ color: '#111111' }}>
                Keep the evidence flowing
              </Text>
              <Text style={{ color: '#334155' }}>
                Impact Log Pro from $5/month. Past entries stay readable forever.
              </Text>
            </Box>
            <List spacing={2}>
              {resolvedBenefits.map((benefit) => (
                <ListItem key={benefit} display="flex" alignItems="center" gap={2}>
                  <ListIcon as={CheckCircle2} color="green.500" />
                  <Text style={{ color: '#111111' }}>{benefit}</Text>
                </ListItem>
              ))}
            </List>
          </Stack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={onClose} style={{ color: '#111111' }}>
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
