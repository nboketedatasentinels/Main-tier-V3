import React, { useEffect, useState } from 'react'
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { OrganizationRecord } from '@/types/admin'

type Mode = 'create' | 'edit'

interface Props {
  isOpen: boolean
  onClose: () => void
  initialData?: OrganizationRecord | null
  onSubmit: (data: OrganizationRecord) => Promise<void>
  mode?: Mode
}

const defaultOrg: OrganizationRecord = {
  name: '',
  code: '',
  status: 'pending',
  teamSize: 10,
  transformationPartner: '',
  village: '',
  cluster: '',
  programStart: '',
  programEnd: '',
  assignmentCount: 0,
  partnerId: null,
}

export const OrganizationFormModal: React.FC<Props> = ({ isOpen, onClose, initialData, onSubmit, mode = 'create' }) => {
  const [form, setForm] = useState<OrganizationRecord>(initialData || defaultOrg)
  const [isSubmitting, setSubmitting] = useState(false)
  const toast = useToast()

  useEffect(() => {
    setForm(initialData || defaultOrg)
  }, [initialData])

  const handleChange = (key: keyof OrganizationRecord, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    if (!form.name || !form.code) {
      toast({ title: 'Name and code are required', status: 'warning' })
      return
    }

    try {
      setSubmitting(true)
      await onSubmit(form)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{mode === 'create' ? 'Create organization' : 'Edit organization'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <HStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Organization name</FormLabel>
                <Input value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Acme Corp" />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Company code</FormLabel>
                <Input value={form.code} onChange={(e) => handleChange('code', e.target.value)} placeholder="ACME" textTransform="uppercase" />
              </FormControl>
            </HStack>

            <HStack spacing={4}>
              <FormControl>
                <FormLabel>Team size limit</FormLabel>
                <Input type="number" value={form.teamSize ?? 0} onChange={(e) => handleChange('teamSize', Number(e.target.value))} />
              </FormControl>
              <FormControl>
                <FormLabel>Status</FormLabel>
                <Select value={form.status} onChange={(e) => handleChange('status', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                  <option value="watch">Watch</option>
                </Select>
              </FormControl>
            </HStack>

            <HStack spacing={4}>
              <FormControl>
                <FormLabel>Village</FormLabel>
                <Input value={form.village || ''} onChange={(e) => handleChange('village', e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel>Cluster</FormLabel>
                <Input value={form.cluster || ''} onChange={(e) => handleChange('cluster', e.target.value)} />
              </FormControl>
            </HStack>

            <HStack spacing={4}>
              <FormControl>
                <FormLabel>Program start</FormLabel>
                <Input type="date" value={form.programStart || ''} onChange={(e) => handleChange('programStart', e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel>Program end</FormLabel>
                <Input type="date" value={form.programEnd || ''} onChange={(e) => handleChange('programEnd', e.target.value)} />
              </FormControl>
            </HStack>

            <FormControl>
              <FormLabel>Transformation partner</FormLabel>
              <Input value={form.transformationPartner || ''} onChange={(e) => handleChange('transformationPartner', e.target.value)} placeholder="Partner name" />
            </FormControl>

            <FormControl>
              <FormLabel>Bulk email invite (CSV or manual)</FormLabel>
              <Stack spacing={2}>
                <Input type="file" accept=".csv" />
                <Textarea placeholder="email1@example.com, email2@example.com" rows={3} />
              </Stack>
            </FormControl>

            <Box fontSize="sm" color="gray.600">
              Add member emails now or upload later. Invites will be tracked in the admin activity log.
            </Box>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="purple" onClick={handleSubmit} isLoading={isSubmitting}>
            {mode === 'create' ? 'Create organization' : 'Save changes'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

