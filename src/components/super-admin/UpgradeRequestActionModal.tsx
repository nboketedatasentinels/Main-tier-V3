import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormLabel,
  Heading,
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
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { CreateOrganizationModal } from '@/components/super-admin/CreateOrganizationModal'
import { fetchAdminOrganizationsList } from '@/services/admin/adminUsersService'
import type { UpgradeRequest } from '@/types/upgrade'
import { getDisplayName } from '@/utils/displayName'

type ActionMode = 'existing' | 'new'

type OrganizationOption = { id: string; name: string; code?: string }

interface UpgradeRequestActionModalProps {
  isOpen: boolean
  onClose: () => void
  request: UpgradeRequest
  isSubmitting?: boolean
  adminId?: string
  adminName?: string
  onAssignExisting: (payload: {
    organizationId: string
    sendWelcomeEmail: boolean
    notes?: string
  }) => Promise<void>
}

export const UpgradeRequestActionModal: React.FC<UpgradeRequestActionModalProps> = ({
  isOpen,
  onClose,
  request,
  isSubmitting = false,
  adminId,
  adminName,
  onAssignExisting,
}) => {
  const toast = useToast()
  const requesterEmail = request.userDetails?.email?.trim() || ''
  const requesterName = useMemo(
    () =>
      getDisplayName(
        {
          fullName: request.userDetails?.fullName ?? undefined,
          firstName: request.userDetails?.firstName ?? undefined,
          lastName: request.userDetails?.lastName ?? undefined,
          email: requesterEmail || undefined,
        },
        'Unknown user',
      ),
    [request.userDetails?.firstName, request.userDetails?.fullName, request.userDetails?.lastName, requesterEmail],
  )
  const [mode, setMode] = useState<ActionMode>('existing')
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([])
  const [search, setSearch] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [orgLoading, setOrgLoading] = useState(false)
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true)
  const [notes, setNotes] = useState('')
  const [createOrgOpen, setCreateOrgOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setMode('existing')
    setNotes('')
    setSendWelcomeEmail(true)
    setSelectedOrgId('')
    setSearch('')
    setCreateOrgOpen(false)
    setFormError(null)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const loadOrganizations = async () => {
      setOrgLoading(true)
      try {
        const items = await fetchAdminOrganizationsList()
        setOrganizations(items)
      } catch (error) {
        console.error(error)
        setFormError('Unable to load organisations. Please try again.')
      } finally {
        setOrgLoading(false)
      }
    }
    void loadOrganizations()
  }, [isOpen])

  const filteredOrganizations = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = organizations.filter((org) => Boolean(org.id))
    if (!term) return filtered
    return filtered.filter((org) => `${org.name} ${org.code}`.toLowerCase().includes(term))
  }, [organizations, search])

  const selectedOrg = organizations.find((org) => org.id === selectedOrgId)

  const handleAssign = async () => {
    if (!selectedOrgId) {
      toast({ title: 'Select an organization before approving', status: 'warning' })
      return
    }
    setFormError(null)
    await onAssignExisting({ organizationId: selectedOrgId, sendWelcomeEmail, notes: notes.trim() || undefined })
  }

  const handleOrganizationCreated = (organization: { id?: string; name?: string; code?: string }) => {
    const organizationId = organization.id
    if (!organizationId) {
      setFormError('Organization created but missing an ID. Please refresh and try again.')
      return
    }

    setOrganizations((prev) => {
      const nextEntry: OrganizationOption = {
        id: organizationId,
        name: organization.name || 'Untitled organization',
        code: organization.code,
      }
      return [nextEntry, ...prev.filter((org) => org.id !== organizationId)]
    })
    setSelectedOrgId(organizationId)
    setMode('existing')
    toast({ title: 'Organization created', description: 'Selected for this upgrade approval.', status: 'success' })
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Approve upgrade request</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={5}>
            <Box>
              <Heading size="sm" mb={2}>
                Request summary
              </Heading>
              <Text fontSize="sm">
                {requesterName}
                {requesterEmail ? ` (${requesterEmail})` : ''} requested {request.requested_tier || 'an upgrade'}.
              </Text>
              {request.villageName && (
                <Badge mt={2} colorScheme="purple" variant="subtle">
                  Village: {request.villageName}
                </Badge>
              )}
            </Box>

            {formError ? (
              <Alert status="error">
                <AlertIcon />
                {formError}
              </Alert>
            ) : null}

            <Tabs
              index={mode === 'existing' ? 0 : 1}
              onChange={(index) => setMode(index === 0 ? 'existing' : 'new')}
              colorScheme="purple"
              variant="enclosed"
            >
              <TabList>
                <Tab>Add to organisation</Tab>
                <Tab>Create organisation</Tab>
              </TabList>
              <TabPanels>
                <TabPanel px={0}>
                  <Stack spacing={3}>
                    <FormControl>
                      <FormLabel>Search organisations</FormLabel>
                      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or code" />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel>Select organisation</FormLabel>
                      <Select
                        value={selectedOrgId}
                        onChange={(event) => setSelectedOrgId(event.target.value)}
                        placeholder={orgLoading ? 'Loading...' : 'Select organisation'}
                      >
                        {filteredOrganizations.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name} {org.code ? `(${org.code})` : ''}
                          </option>
                        ))}
                      </Select>
                    </FormControl>

                    {selectedOrg && (
                      <Box borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
                        <Text fontWeight="semibold">{selectedOrg.name}</Text>
                        <Text fontSize="sm" color="gray.600">
                          Code: {selectedOrg.code || '—'}
                        </Text>
                      </Box>
                    )}
                    <Box borderWidth="1px" borderRadius="md" p={3}>
                      <Text fontSize="sm" fontWeight="semibold" mb={1}>
                        Preview
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        User will be added as a paid member. Village information will remain on their profile. They will
                        see the organization dashboard after next login.
                      </Text>
                    </Box>
                  </Stack>
                </TabPanel>
                <TabPanel px={0}>
                  <Stack spacing={3}>
                    <Text fontSize="sm" color="gray.600">
                      Create the organisation using the standard Organisation Management form. Once created, it will be
                      selected automatically for this upgrade approval.
                    </Text>
                    <Button
                      size="sm"
                      variant="outline"
                      colorScheme="purple"
                      onClick={() => {
                        setFormError(null)
                        setCreateOrgOpen(true)
                      }}
                      isDisabled={isSubmitting}
                      alignSelf="flex-start"
                    >
                      Create new organisation
                    </Button>
                    <Box borderWidth="1px" borderRadius="md" p={3}>
                      <Text fontSize="sm" fontWeight="semibold" mb={1}>
                        Preview
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        After creating the organisation, it will be selected automatically—then click “Assign & Approve”.
                      </Text>
                    </Box>
                  </Stack>
                </TabPanel>
              </TabPanels>
            </Tabs>

            <Divider />

            <Box>
              <Heading size="sm" mb={2}>
                Confirmation
              </Heading>
              <Checkbox isChecked={sendWelcomeEmail} onChange={(event) => setSendWelcomeEmail(event.target.checked)}>
                Send welcome email to user
              </Checkbox>
              <FormControl mt={3}>
                <FormLabel>Admin notes</FormLabel>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes for internal records" />
              </FormControl>
            </Box>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="ghost" onClick={onClose} isDisabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                colorScheme="purple"
                onClick={handleAssign}
                isLoading={isSubmitting}
                isDisabled={!selectedOrgId}
              >
                Assign &amp; Approve
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <CreateOrganizationModal
        isOpen={createOrgOpen}
        onClose={() => setCreateOrgOpen(false)}
        onCreated={handleOrganizationCreated}
        adminId={adminId}
        adminName={adminName}
      />
    </>
  )
}
