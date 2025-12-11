import React from 'react'
import {
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

interface UpgradePromptModalProps {
  featureName: string
  benefits: string[]
  isOpen: boolean
  onClose: () => void
}

export const UpgradePromptModal: React.FC<UpgradePromptModalProps> = ({ featureName, benefits, isOpen, onClose }) => {
  const navigate = useNavigate()

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Flex align="center" gap={3}>
            <Box bg="yellow.100" color="yellow.600" p={2} borderRadius="full">
              <Icon as={LockKeyhole} />
            </Box>
            <Text>Premium Feature</Text>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={3}>
            <Text fontWeight="bold" fontSize="lg">
              Unlock {featureName}
            </Text>
            <Text color="gray.600">Upgrade to access this premium feature.</Text>
            <List spacing={2}>
              {benefits.map((benefit) => (
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
          <Button colorScheme="purple" onClick={() => navigate('/upgrade')}>
            Upgrade Now
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
