import React from 'react'
import {
  Box,
  Button,
  Code,
  Divider,
  Flex,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useClipboard,
} from '@chakra-ui/react'
import { BulkInvitationResult } from '@/types/admin'

interface InvitationResultsModalProps {
  isOpen: boolean
  onClose: () => void
  result: BulkInvitationResult | null
}

export const InvitationResultsModal: React.FC<InvitationResultsModalProps> = ({ isOpen, onClose, result }) => {
  const clipboard = useClipboard('')

  if (!result) return null

  const handleCopy = (code?: string) => {
    if (!code) return
    clipboard.onCopy(code)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Invitation summary</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Box>
              <Text fontWeight="semibold">
                {result.success} of {result.total} invitations completed successfully
              </Text>
              <Text color="gray.600" fontSize="sm">
                One-time codes expire after 24 hours.
              </Text>
            </Box>

            <Divider />

            <Stack spacing={3}>
              {result.results.map((entry) => (
                <Box key={entry.id} borderWidth="1px" borderRadius="md" p={3}>
                  <Flex justify="space-between" align="center">
                    <Box>
                      <Text fontWeight="medium">{entry.name}</Text>
                      {entry.email ? (
                        <Text fontSize="sm" color="gray.600">
                          {entry.email}
                        </Text>
                      ) : null}
                      <Text fontSize="sm" color="gray.500">
                        Method: {entry.method === 'email' ? 'Email invitation' : 'One-time code'}
                      </Text>
                    </Box>
                    <Text color={entry.status === 'success' ? 'green.500' : 'red.500'} fontWeight="semibold">
                      {entry.status === 'success' ? 'Success' : 'Failed'}
                    </Text>
                  </Flex>
                  {entry.message ? (
                    <Text mt={2} color="gray.600" fontSize="sm">
                      {entry.message}
                    </Text>
                  ) : null}
                  {entry.code ? (
                    <HStack mt={2} spacing={3} align="center">
                      <Code>{entry.code}</Code>
                      <Button size="sm" onClick={() => handleCopy(entry.code)}>
                        {clipboard.hasCopied ? 'Copied' : 'Copy'}
                      </Button>
                    </HStack>
                  ) : null}
                </Box>
              ))}
            </Stack>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
