import React, { useState } from 'react'
import {
  Box,
  Button,
  Flex,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { MentorGuidelinesContent } from '@/components/mentor/MentorGuidelinesContent'
import { useAuth } from '@/hooks/useAuth'

type MentorGuidelinesModalProps = {
  isOpen: boolean
  onAcknowledged: () => void
}

export const MentorGuidelinesModal: React.FC<MentorGuidelinesModalProps> = ({
  isOpen,
  onAcknowledged,
}) => {
  const { updateProfile } = useAuth()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const handleUnderstand = async () => {
    setSaving(true)
    try {
      const acknowledgedAt = new Date().toISOString()
      const { error } = await updateProfile({
        mentorGuidelinesAcknowledgedAt: acknowledgedAt,
      })
      if (error) {
        toast({
          title: 'Could not save acknowledgment',
          description: error.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        return
      }
      try {
        localStorage.setItem('t4l.mentor_guidelines_acknowledged', acknowledgedAt)
      } catch {
        // ignore storage failures
      }
      onAcknowledged()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => undefined}
      size="4xl"
      scrollBehavior="inside"
      closeOnOverlayClick={false}
      closeOnEsc={false}
      isCentered
      blockScrollOnMount
    >
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(4px)" />
      <ModalContent
        mx={4}
        maxH="92vh"
        borderRadius="xl"
        overflow="hidden"
        border="1px solid"
        borderColor="gray.200"
      >
        <Box bg="brand.dark" px={{ base: 5, md: 8 }} py={{ base: 5, md: 6 }} color="white">
          <Text
            fontSize="xs"
            fontWeight="semibold"
            letterSpacing="0.16em"
            textTransform="uppercase"
            color="accent.highlight"
          >
            Welcome, mentor
          </Text>
          <Text mt={2} fontSize={{ base: 'xl', md: '2xl' }} fontWeight="800" letterSpacing="-0.02em">
            Please read the Mentor Guidelines
          </Text>
          <Text mt={2} color="whiteAlpha.800" fontSize="sm" maxW="640px" lineHeight="1.6">
            This is the standard for how mentoring works on T4L. Acknowledge once — you can reopen
            the full handbook anytime from the sidebar.
          </Text>
        </Box>

        <ModalBody px={{ base: 4, md: 8 }} py={6} bg="surface.subtle">
          <VStack align="stretch" spacing={0}>
            <MentorGuidelinesContent compact showHeader={false} />
          </VStack>
        </ModalBody>

        <ModalFooter
          borderTop="1px solid"
          borderColor="gray.200"
          bg="white"
          px={{ base: 4, md: 8 }}
          py={4}
        >
          <Flex w="full" direction={{ base: 'column', sm: 'row' }} align="center" justify="space-between" gap={3}>
            <Text fontSize="sm" color="gray.500" textAlign={{ base: 'center', sm: 'left' }}>
              Version 1 · August 2026
            </Text>
            <Button
              variant="primary"
              size="lg"
              minW={{ base: 'full', sm: '200px' }}
              onClick={() => void handleUnderstand()}
              isLoading={saving}
              loadingText="Saving…"
            >
              I understand
            </Button>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
