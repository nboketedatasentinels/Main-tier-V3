import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertIcon,
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
} from '@chakra-ui/react'
import { AdminFormData, AdminRole, OrganizationRecord } from '@/types/admin'
import { OrganizationAssignmentsPicker } from '@/components/super-admin/OrganizationAssignmentsPicker'

interface AdminFormModalProps {
  isOpen: boolean
  mode?: 'create' | 'edit'
  onClose: () => void
  onSubmit: (data: AdminFormData) => Promise<void> | void
  initialData?: Partial<AdminFormData>
  organizations?: OrganizationRecord[]
}

const roleOptions: { value: AdminRole; label: string }[] = [
  { value: 'partner', label: 'Partner' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'ambassador', label: 'Ambassador' },
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
  const [submitError, setSubmitError] = useState<string | null>(null)

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

  useEffect(() => {
    if (isOpen) return
    setSubmitError(null)
  }, [isOpen])

  const isEdit = mode === 'edit'

  const emailValid = useMemo(() => /\S+@\S+\.\S+/.test(formData.email || ''), [formData.email])
  const organizationLookup = useMemo(
    () => new Map(organizations.map((org) => [org.id || '', org])),
    [organizations],
  )
  const selectedOrganizations = useMemo(
    () => formData.assignedOrganizations.map((orgId) => organizationLookup.get(orgId)).filter(Boolean),
    [formData.assignedOrganizations, organizationLookup],
  )
  const willClearPartnerAssignments =
    isEdit &&
    initialData?.role === 'partner' &&
    formData.role !== 'partner' &&
    (initialData?.assignedOrganizations?.length || 0) > 0

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (!formData.firstName) nextErrors.firstName = 'First name is required'
    if (!formData.lastName) nextErrors.lastName = 'Last name is required'
    if (!formData.email) nextErrors.email = 'Email is required'
    else if (!emailValid) nextErrors.email = 'Invalid email format'
    if (!formData.role) nextErrors.role = 'Role is required'
    if (formData.role === 'partner' && !formData.assignedOrganizations.length)
      nextErrors.assignedOrganizations = 'Partner users must be assigned to at least one organization'
    const missingOrganizations = formData.assignedOrganizations.filter((orgId) => !organizationLookup.has(orgId))
    const inactiveOrganizations = selectedOrganizations.filter((org) => org?.status && org.status !== 'active')
    if (missingOrganizations.length) {
      nextErrors.assignedOrganizations = 'One or more selected organizations could not be found.'
    } else if (inactiveOrganizations.length) {
      nextErrors.assignedOrganizations = 'Selected organizations must be active before assignment.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleChange = (key: keyof AdminFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit(formData)
      onClose()
    } catch (error) {
      console.error(error)
      setSubmitError(error instanceof Error ? error.message : 'Unable to save admin access changes.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{isEdit ? 'Edit Admin Access' : 'Add Admin Access'}</ModalHeader>
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
              <Text fontSize="sm" color="gray.500" mb={2}>
                For Partner role users, selected organizations drive dashboard visibility and data access.
              </Text>
              {willClearPartnerAssignments ? (
                <Alert status="warning" borderRadius="md" mb={3}>
                  <AlertIcon />
                  Changing this user away from Partner will clear their existing organization assignments on save.
                </Alert>
              ) : null}
              {organizations.length ? (
                <OrganizationAssignmentsPicker
                  organizations={organizations}
                  value={formData.assignedOrganizations}
                  onChange={(nextIds) => handleChange('assignedOrganizations', nextIds)}
                  helperText="Search and add one or more organizations."
                  allowInactive={false}
                />
              ) : (
                <Text color="gray.500">No organizations available.</Text>
              )}
              <FormErrorMessage>{errors.assignedOrganizations}</FormErrorMessage>
            </FormControl>

            {selectedOrganizations.length ? (
              <Box borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                  Assignment preview
                </Text>
                <Wrap spacing={2}>
                  {selectedOrganizations.map((org) => (
                    <WrapItem key={org?.id}>
                      <Text fontSize="sm" color={org?.status === 'active' ? 'gray.700' : 'orange.600'}>
                        {org?.name || 'Unknown'} {org?.code ? `(${org.code})` : '(No code)'}
                        {org?.status && org.status !== 'active' ? ` • ${org.status}` : ''}
                      </Text>
                    </WrapItem>
                  ))}
                </Wrap>
              </Box>
            ) : null}

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
            {submitError ? (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                {submitError}
              </Alert>
            ) : null}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleSubmit} isLoading={submitting}>
            {isEdit ? 'Save Changes' : 'Grant Admin Access'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
