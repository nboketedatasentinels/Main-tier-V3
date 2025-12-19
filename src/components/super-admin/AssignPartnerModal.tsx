import React, { useEffect, useState } from 'react'
import {
  Badge,
  Button,
  FormControl,
  FormLabel,
  Input,
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
import { OrganizationRecord } from '@/types/admin'

interface Props {
  isOpen: boolean
  onClose: () => void
  organization?: OrganizationRecord | null
  onSubmit: (partnerName: string) => Promise<void>
}

export const AssignPartnerModal: React.FC<Props> = ({ isOpen, onClose, organization, onSubmit }) => {
  const [partner, setPartner] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setPartner(organization?.transformationPartner || '')
  }, [organization])

  const handleSubmit = async () => {
    setLoading(true)
    await onSubmit(partner)
    setLoading(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Assign transformation partner</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Text color="gray.700">
              Update the primary partner responsible for this organization. Assignment changes are logged for audit
              visibility.
            </Text>
            <FormControl>
              <FormLabel>Partner name</FormLabel>
              <Input value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="Partner company" />
            </FormControl>
            {organization && (
              <Stack spacing={1} fontSize="sm" color="gray.600">
                <Text>Current partner: {organization.transformationPartner || 'Unassigned'}</Text>
                <Badge colorScheme={organization.status === 'active' ? 'green' : 'orange'} w="fit-content">
                  {organization.status}
                </Badge>
              </Stack>
            )}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="purple" onClick={handleSubmit} isLoading={loading}>
            Save assignment
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

