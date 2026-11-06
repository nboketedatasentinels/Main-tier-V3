import React, { useState } from 'react'
import {
  Box,
  Button,
  ListItem,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  UnorderedList,
  useToast,
} from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { isLearnerRole } from '@/utils/role'

const PURPLE = '#350e6f'
const PURPLE_HOVER = '#27062e'

/**
 * One-time notice at a learner's first sign-in: Gemini pre-grades submitted
 * work and a partner makes the final decision. The answer is saved on the
 * profile (data.aiGradingConsent) and pre-ticks the consent box on capstone /
 * case study / practical pages and podcast assessments.
 */
export const AiGradingConsentGate: React.FC = () => {
  const { profile, updateProfile } = useAuth()
  const [saving, setSaving] = useState<'agreed' | 'declined' | null>(null)
  const toast = useToast()

  if (!profile || !isLearnerRole(profile.role) || profile.aiGradingConsent) return null

  const answer = async (decision: 'agreed' | 'declined') => {
    setSaving(decision)
    const { error } = await updateProfile({
      aiGradingConsent: { decision, at: new Date().toISOString() },
    })
    setSaving(null)
    if (error) {
      toast({
        title: 'Could not save your answer',
        description: 'Please try again in a moment.',
        status: 'error',
        duration: 4000,
      })
    }
  }

  return (
    <Modal
      isOpen
      onClose={() => undefined}
      closeOnOverlayClick={false}
      closeOnEsc={false}
      isCentered
      size="md"
    >
      <ModalOverlay />
      <ModalContent mx={4} bg="white" color="black">
        <ModalHeader fontSize="lg" color="black">
          How your work is graded
        </ModalHeader>
        <ModalBody>
          <UnorderedList spacing={2} fontSize="sm" color="black" lineHeight="1.55">
            <ListItem>
              Google Gemini (an AI tool) reads the written answers you submit and suggests a score
              and feedback.
            </ListItem>
            <ListItem>
              Your partner reviews it and makes the final Pass / Fail decision. AI never grades you
              alone.
            </ListItem>
            <ListItem>Only your answers are sent. Not your name, email or organisation.</ListItem>
            <ListItem>
              Your account is stored in the EU (Germany). Gemini may process answers in other
              countries, including the US.
            </ListItem>
            <ListItem>Please don&apos;t include other people&apos;s personal details.</ListItem>
          </UnorderedList>
          <Box mt={4}>
            <Text fontSize="xs" color="black">
              You can change your mind on any submission page.
            </Text>
          </Box>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button
            variant="outline"
            borderColor="black"
            color="black"
            onClick={() => void answer('declined')}
            isLoading={saving === 'declined'}
            isDisabled={saving !== null}
          >
            Not now
          </Button>
          <Button
            bg={PURPLE}
            color="white"
            _hover={{ bg: PURPLE_HOVER }}
            onClick={() => void answer('agreed')}
            isLoading={saving === 'agreed'}
            isDisabled={saving !== null}
          >
            I agree
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default AiGradingConsentGate
