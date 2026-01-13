import React from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  VStack,
  HStack,
  Icon,
  Box,
  FormControl,
  FormLabel,
  Input,
  Textarea,
} from '@chakra-ui/react'
import { Users, Sparkles } from 'lucide-react'

interface BuildVillageModalProps {
  isOpen: boolean
  onCreate: () => void
  onSkip: () => void
  villageName?: string
  villagePurpose?: string
  onVillageNameChange?: (value: string) => void
  onVillagePurposeChange?: (value: string) => void
}

export const BuildVillageModal: React.FC<BuildVillageModalProps> = ({
  isOpen,
  onCreate,
  onSkip,
  villageName,
  villagePurpose,
  onVillageNameChange,
  onVillagePurposeChange,
}) => {
  const showForm = Boolean(onVillageNameChange && onVillagePurposeChange)

  return (
    <Modal isOpen={isOpen} onClose={onSkip} isCentered size="lg">
      <ModalOverlay bg="blackAlpha.600" />
      <ModalContent>
        <ModalHeader>Create your village</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <Text color="brand.subtleText">
              Rally your peers into a community space where you can collaborate, keep each other accountable, and share wins.
            </Text>

            <HStack spacing={3} align="flex-start" bg="brand.primaryMuted" p={3} borderRadius="lg">
              <Icon as={Users} color="brand.primary" boxSize={5} mt={1} />
              <Box>
                <Text fontWeight="semibold">Invite allies</Text>
                <Text color="brand.subtleText">Hand-pick people to join your space and set the tone for how you grow together.</Text>
              </Box>
            </HStack>

            <HStack spacing={3} align="flex-start" bg="brand.primaryMuted" p={3} borderRadius="lg">
              <Icon as={Sparkles} color="brand.primary" boxSize={5} mt={1} />
              <Box>
                <Text fontWeight="semibold">Shape your rituals</Text>
                <Text color="brand.subtleText">Add weekly check-ins, challenges, and celebrations that keep momentum high.</Text>
              </Box>
            </HStack>

            <Text fontSize="sm" color="brand.subtleText">
              Free users get one village to start experimenting. You can skip for now, but we will remember when you are ready.
            </Text>

            {showForm && (
              <VStack align="stretch" spacing={3} pt={2}>
                <FormControl>
                  <FormLabel color="brand.text">Village name</FormLabel>
                  <Input
                    value={villageName}
                    onChange={event => onVillageNameChange?.(event.target.value)}
                    placeholder="e.g. Impact Innovators"
                    bg="white"
                    borderColor="brand.border"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel color="brand.text">Purpose</FormLabel>
                  <Textarea
                    value={villagePurpose}
                    onChange={event => onVillagePurposeChange?.(event.target.value)}
                    placeholder="Describe what your village will focus on"
                    bg="white"
                    borderColor="brand.border"
                  />
                </FormControl>
              </VStack>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="outline" onClick={onSkip}>
            Skip for now
          </Button>
          <Button colorScheme="purple" onClick={onCreate} isDisabled={showForm ? !villageName?.trim() : false}>
            Build my village
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
