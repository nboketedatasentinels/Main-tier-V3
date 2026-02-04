import React, { useEffect, useMemo, useState } from 'react'
import {
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
} from '@chakra-ui/react'
import { fetchOrganizations } from '@/services/superAdminService'
import { generateOrganizationCode, validateOrganizationCodeUnique } from '@/services/organizationService'
import type { OrganizationRecord } from '@/types/admin'
import type { UpgradeRequest } from '@/types/upgrade'

type ActionMode = 'existing' | 'new'

interface UpgradeRequestActionModalProps {
  isOpen: boolean
  onClose: () => void
  request: UpgradeRequest
  isSubmitting?: boolean
  onAssignExisting: (payload: {
    organizationId: string
    sendWelcomeEmail: boolean
    notes?: string
  }) => Promise<void>
  onCreateNew: (payload: {
    organizationData: OrganizationRecord
    sendWelcomeEmail: boolean
    notes?: string
  }) => Promise<void>
}

export const UpgradeRequestActionModal: React.FC<UpgradeRequestActionModalProps> = ({
  isOpen,
  onClose,
  request,
  isSubmitting = false,
  onAssignExisting,
  onCreateNew,
}) => {
  const [mode, setMode] = useState<ActionMode>('existing')
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([])
  const [search, setSearch] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [orgLoading, setOrgLoading] = useState(false)
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true)
  const [notes, setNotes] = useState('')
  const [newOrgName, setNewOrgName] = useState(request.villageName || '')
  const [newOrgCode, setNewOrgCode] = useState(generateOrganizationCode(request.villageName || ''))
  const [codeTouched, setCodeTouched] = useState(false)
  const [programDuration, setProgramDuration] = useState('')
  const [teamSize, setTeamSize] = useState('1')
  const [cohortStartDate, setCohortStartDate] = useState('')
  const [courseAssignments, setCourseAssignments] = useState('')
  const [useVillageDetails, setUseVillageDetails] = useState(Boolean(request.villageName))

  useEffect(() => {
    if (!isOpen) return
    setMode('existing')
    setNotes('')
    setSendWelcomeEmail(true)
    setNewOrgName(request.villageName || '')
    setNewOrgCode(generateOrganizationCode(request.villageName || ''))
    setCodeTouched(false)
    setProgramDuration('')
    setTeamSize('1')
    setCohortStartDate('')
    setCourseAssignments('')
    setUseVillageDetails(Boolean(request.villageName))
  }, [isOpen, request.villageName])

  useEffect(() => {
    if (!isOpen) return
    const loadOrganizations = async () => {
      setOrgLoading(true)
      try {
        const items = await fetchOrganizations()
        setOrganizations(items)
      } finally {
        setOrgLoading(false)
      }
    }
    void loadOrganizations()
  }, [isOpen])

  useEffect(() => {
    if (codeTouched) return
    if (!newOrgName.trim()) return
    setNewOrgCode(generateOrganizationCode(newOrgName))
  }, [codeTouched, newOrgName])

  const filteredOrganizations = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = organizations.filter((org) => Boolean(org.id))
    if (!term) return filtered
    return filtered.filter((org) => `${org.name} ${org.code}`.toLowerCase().includes(term))
  }, [organizations, search])

  const selectedOrg = organizations.find((org) => org.id === selectedOrgId)

  const handleAssign = async () => {
    if (!selectedOrgId) {
      throw new Error('Select an organization before approving the request.')
    }
    await onAssignExisting({ organizationId: selectedOrgId, sendWelcomeEmail, notes: notes.trim() || undefined })
  }

  const handleCreate = async () => {
    const trimmedName = newOrgName.trim()
    if (!trimmedName || trimmedName.length < 3) {
      throw new Error('Organization name must be at least 3 characters.')
    }

    const code = (newOrgCode || generateOrganizationCode(trimmedName)).trim().toUpperCase()
    if (code.length !== 6) {
      throw new Error('Organization code must be exactly 6 characters.')
    }

    const isUnique = await validateOrganizationCodeUnique(code)
    if (!isUnique) {
      throw new Error('Organization code is already in use.')
    }

    const duration = Number(programDuration)
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('Program duration must be greater than 0.')
    }

    const size = Number(teamSize)
    if (!Number.isFinite(size) || size <= 0) {
      throw new Error('Team size must be greater than 0.')
    }

    const assignments = courseAssignments
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    const organizationData: OrganizationRecord = {
      name: trimmedName,
      code,
      status: 'active',
      teamSize: size,
      programDuration: duration,
      cohortStartDate: cohortStartDate || undefined,
      courseAssignments: assignments.length ? assignments : undefined,
      description: useVillageDetails ? request.villageDescription || undefined : undefined,
      village: useVillageDetails ? request.villageName || undefined : undefined,
    }
    await onCreateNew({ organizationData, sendWelcomeEmail, notes: notes.trim() || undefined })
  }

  return (
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
                {request.userDetails?.fullName || request.user_id} requested {request.requested_tier || 'an upgrade'}.
              </Text>
              {request.villageName && (
                <Badge mt={2} colorScheme="purple" variant="subtle">
                  Village: {request.villageName}
                </Badge>
              )}
            </Box>

            <Tabs
              index={mode === 'existing' ? 0 : 1}
              onChange={(index) => setMode(index === 0 ? 'existing' : 'new')}
              colorScheme="purple"
              variant="enclosed"
            >
              <TabList>
                <Tab>Add to existing organization</Tab>
                <Tab>Create new organization</Tab>
              </TabList>
              <TabPanels>
                <TabPanel px={0}>
                  <Stack spacing={3}>
                    <FormControl>
                      <FormLabel>Search organizations</FormLabel>
                      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or code" />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel>Select organization</FormLabel>
                      <Select
                        value={selectedOrgId}
                        onChange={(event) => setSelectedOrgId(event.target.value)}
                        placeholder={orgLoading ? 'Loading...' : 'Select organization'}
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
                          Code: {selectedOrg.code || '—'} · Status: {selectedOrg.status}
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          Members: {selectedOrg.assignmentCount || selectedOrg.teamSize || '—'} · Partner:{' '}
                          {selectedOrg.assignedPartnerName || '—'}
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
                    <FormControl isRequired>
                      <FormLabel>Organization name</FormLabel>
                      <Input value={newOrgName} onChange={(event) => setNewOrgName(event.target.value)} />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel>Organization code</FormLabel>
                      <Input
                        value={newOrgCode}
                        onChange={(event) => {
                          setCodeTouched(true)
                          setNewOrgCode(event.target.value.toUpperCase().slice(0, 6))
                        }}
                        maxLength={6}
                      />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel>Program duration (weeks)</FormLabel>
                      <Input
                        type="number"
                        value={programDuration}
                        onChange={(event) => setProgramDuration(event.target.value)}
                        min={1}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Team size</FormLabel>
                      <Input type="number" value={teamSize} onChange={(event) => setTeamSize(event.target.value)} min={1} />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Cohort start date</FormLabel>
                      <Input type="date" value={cohortStartDate} onChange={(event) => setCohortStartDate(event.target.value)} />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Course assignments (comma separated)</FormLabel>
                      <Input
                        value={courseAssignments}
                        onChange={(event) => setCourseAssignments(event.target.value)}
                        placeholder="Leadership 101, Coaching Basics"
                      />
                    </FormControl>
                    <Checkbox
                      isChecked={useVillageDetails}
                      onChange={(event) => setUseVillageDetails(event.target.checked)}
                    >
                      Use village details for organization profile
                    </Checkbox>
                    <Box borderWidth="1px" borderRadius="md" p={3}>
                      <Text fontSize="sm" fontWeight="semibold" mb={1}>
                        Preview
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        A new organization will be created with this learner as the first paid member. You can refine
                        the full organization setup later.
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
              onClick={mode === 'existing' ? handleAssign : handleCreate}
              isLoading={isSubmitting}
              isDisabled={mode === 'existing' ? !selectedOrgId : !newOrgName.trim() || !programDuration.trim()}
            >
              Assign &amp; Approve
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
