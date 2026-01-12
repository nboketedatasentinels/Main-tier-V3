import React from 'react'
import {
  Box,
  Button,
  Heading,
  HStack,
  Icon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import type { LucideIcon } from 'lucide-react'

export interface SocialShareAction {
  label: string
  description?: string
  icon: LucideIcon
  color: string
  bg: string
  onClick: () => void
}

interface SocialShareModalProps {
  isOpen: boolean
  onClose: () => void
  actions: SocialShareAction[]
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({ isOpen, onClose, actions }) => (
  <Modal isOpen={isOpen} onClose={onClose} motionPreset="slideInBottom" isCentered size="lg">
    <ModalOverlay bg="blackAlpha.600" />
    <ModalContent>
      <ModalHeader>Share your invite</ModalHeader>
      <ModalCloseButton />
      <ModalBody>
        <Stack spacing={4}>
          <Text color="brand.subtleText">
            Pick a platform and send your invite with a pre-filled message and your unique referral link.
          </Text>
          <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
            {actions.map((action) => (
              <Button
                key={action.label}
                onClick={action.onClick}
                bg={action.bg}
                color={action.color}
                _hover={{ opacity: 0.9 }}
                _active={{ opacity: 0.85 }}
                height="auto"
                px={4}
                py={3}
                borderRadius="lg"
                justifyContent="flex-start"
                alignItems="flex-start"
                textAlign="left"
              >
                <HStack spacing={3} align="flex-start">
                  <Box
                    bg="whiteAlpha.300"
                    borderRadius="md"
                    p={2}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Icon as={action.icon} boxSize={5} />
                  </Box>
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="semibold">{action.label}</Text>
                    {action.description && (
                      <Text fontSize="xs" opacity={0.85}>
                        {action.description}
                      </Text>
                    )}
                  </VStack>
                </HStack>
              </Button>
            ))}
          </SimpleGrid>
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </ModalContent>
  </Modal>
)

interface InstagramShareModalProps {
  isOpen: boolean
  onClose: () => void
}

export const InstagramShareModal: React.FC<InstagramShareModalProps> = ({ isOpen, onClose }) => (
  <Modal isOpen={isOpen} onClose={onClose} motionPreset="slideInBottom" isCentered size="md">
    <ModalOverlay bg="blackAlpha.600" />
    <ModalContent>
      <ModalHeader>Share on Instagram</ModalHeader>
      <ModalCloseButton />
      <ModalBody>
        <Stack spacing={4}>
          <Heading size="sm">Link copied!</Heading>
          <Text color="brand.subtleText">
            Open Instagram and paste your link into your bio or story to invite your friends.
          </Text>
          <Stack spacing={3}>
            <HStack spacing={3} align="flex-start">
              <Box
                bg="purple.100"
                color="purple.700"
                borderRadius="full"
                w="28px"
                h="28px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontWeight="bold"
              >
                1
              </Box>
              <Text fontSize="sm">Tap “Edit profile” and paste the link into your bio.</Text>
            </HStack>
            <HStack spacing={3} align="flex-start">
              <Box
                bg="purple.100"
                color="purple.700"
                borderRadius="full"
                w="28px"
                h="28px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontWeight="bold"
              >
                2
              </Box>
              <Text fontSize="sm">Or add it to your story using a link sticker.</Text>
            </HStack>
          </Stack>
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Button colorScheme="purple" onClick={onClose}>
          Got it
        </Button>
      </ModalFooter>
    </ModalContent>
  </Modal>
)
