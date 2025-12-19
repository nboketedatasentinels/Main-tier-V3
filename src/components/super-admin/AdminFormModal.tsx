import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  FormErrorMessage,
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
  Switch,
  Text,
  Wrap,
  WrapItem,
  Checkbox,
} from '@chakra-ui/react'
import { AdminFormData, AdminRole, OrganizationRecord } from '@/types/admin'

interface AdminFormModalProps {
  isOpen: boolean
  mode?: 'create' | 'edit'
  onClose: () => void
  onSubmit: (data: AdminFormData) => Promise<void> | void
  initialData?: Partial<AdminFormData>
  organizations?: OrganizationRecord[]
}

const roleOptions: { value: AdminRole; label: string }[] = [
  { value: 'partner', label: 'Partner (Company Admin)' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'ambassador', label: 'Ambassador' },
  { value: 'team_leader', label: 'Team Leader' },
]

const defaultState: AdminFormData = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'partner',
  assignedOrganizations: [],
  accountStatus: 'active',
}

export const AdminFormModal: React.FC<AdminFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  organizations = [],
  mode = 'create',
}) => {
  const [formData, setFormData] = useState<AdminFormData>(defaultState)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...defaultState,
        ...initialData,
        assignedOrganizations: initialData.assignedOrganizations || defaultState.assignedOrganizations,
        accountStatus: initialData.accountStatus || defaultState.accountStatus,
      })
    } else {
      setFormData(defaultState)
    }
  }, [initialData])

  const isEdit = mode === 'edit'

  const emailValid = useMemo(() => /\S+@\S+\.\S+/.test(formData.email || ''), [formData.email])

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (!formData.firstName) nextErrors.firstName = 'First name is required'
    if (!formData.lastName) nextErrors.lastName = 'Last name is required'
    if (!formData.email) nextErrors.email = 'Email is required'
    else if (!emailValid) nextErrors.email = 'Invalid email format'
    if (!formData.role) nextErrors.role = 'Role is required'
    if (formData.role === 'partner' && !formData.assignedOrganizations.length)
      nextErrors.assignedOrganizations = 'Partner admins must be assigned to at least one organization'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleChange = (key: keyof AdminFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleOrganizationsChange = (orgId: string) => {
    setFormData((prev) => {
      const exists = prev.assignedOrganizations.includes(orgId)
      const nextOrgs = exists
        ? prev.assignedOrganizations.filter((id) => id !== orgId)
        : [...prev.assignedOrganizations, orgId]
      return { ...prev, assignedOrganizations: nextOrgs }
    })
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    await onSubmit(formData)
    setSubmitting(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{isEdit ? 'Edit Admin' : 'Add Admin'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <FormControl isRequired isInvalid={!!errors.firstName}>
              <FormLabel>First Name</FormLabel>
              <Input
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                placeholder="Enter first name"
              />
              <FormErrorMessage>{errors.firstName}</FormErrorMessage>
            </FormControl>

            <FormControl isRequired isInvalid={!!errors.lastName}>
              <FormLabel>Last Name</FormLabel>
              <Input value={formData.lastName} onChange={(e) => handleChange('lastName', e.target.value)} placeholder="Enter last name" />
              <FormErrorMessage>{errors.lastName}</FormErrorMessage>
            </FormControl>

            <FormControl isRequired isInvalid={!!errors.email}>
              <FormLabel>Email</FormLabel>
              <Input value={formData.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="name@email.com" />
              <FormErrorMessage>{errors.email}</FormErrorMessage>
            </FormControl>

            <FormControl isRequired isInvalid={!!errors.role}>
              <FormLabel>Role</FormLabel>
              <Select value={formData.role} onChange={(e) => handleChange('role', e.target.value as AdminRole)}>
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <FormErrorMessage>{errors.role}</FormErrorMessage>
            </FormControl>

            <FormControl isInvalid={!!errors.assignedOrganizations}>
              <FormLabel>Assigned Organizations</FormLabel>
              {organizations.length ? (
                <Box borderWidth="1px" borderRadius="md" p={3}>
                  <Wrap spacing={3}>
                    {organizations.map((org) => (
                      <WrapItem key={org.id}>
                        <Checkbox
                          isChecked={formData.assignedOrganizations.includes(org.id || '')}
                          onChange={() => handleOrganizationsChange(org.id || '')}
                        >
                          {org.name}
                        </Checkbox>
                      </WrapItem>
                    ))}
                  </Wrap>
                </Box>
              ) : (
                <Text color="gray.500">No organizations available.</Text>
              )}
              <FormErrorMessage>{errors.assignedOrganizations}</FormErrorMessage>
            </FormControl>

            <FormControl display="flex" alignItems="center">
              <FormLabel mb="0">Active Status</FormLabel>
              <Switch
                isChecked={formData.accountStatus !== 'suspended'}
                onChange={(e) => handleChange('accountStatus', e.target.checked ? 'active' : 'suspended')}
              />
              <Text ml={3} color={formData.accountStatus === 'active' ? 'green.600' : 'orange.500'}>
                {formData.accountStatus === 'active' ? 'Active' : 'Suspended'}
              </Text>
            </FormControl>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleSubmit} isLoading={submitting}>
            {isEdit ? 'Save Changes' : 'Create Admin'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
