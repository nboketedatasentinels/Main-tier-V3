import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Checkbox,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftAddon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Text,
  Textarea,
  Tooltip,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { InfoIcon } from '@chakra-ui/icons'
import { Plus, Upload, X } from 'lucide-react'
import {
  BulkInvitationResult,
  CourseOption,
  InviteDraft,
  OrganizationLead,
  OrganizationRecord,
  ProgramDurationOption,
} from '@/types/admin'
import {
  createOrganizationWithInvitations,
  determineClusterFromTeamSize,
  fetchAmbassadors,
  fetchAvailableCourses,
  fetchMentors,
  generateOrganizationCode,
  validateOrganizationCodeUnique,
} from '@/services/organizationService'
import { InvitationResultsModal } from './InvitationResultsModal'
import { downloadCSVTemplate, parseInvitationCSV } from '@/utils/csvUtils'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface CreateOrganizationModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (organization: OrganizationRecord) => void
  adminName?: string
  adminId?: string
  partners?: { id: string; name: string; email?: string }[]
}

const programDurations: ProgramDurationOption[] = [
  { value: 1.5, label: '1.5 months (6 weeks)', courseCount: 3 },
  { value: 3, label: '3 months', courseCount: 3 },
  { value: 6, label: '6 months', courseCount: 6 },
  { value: 9, label: '9 months', courseCount: 9 },
  { value: 12, label: '12 months', courseCount: 12 },
]

const emptyOrganization: OrganizationRecord = {
  name: '',
  code: '',
  status: 'pending',
  teamSize: 0,
  village: '',
  cluster: '',
  description: '',
  courseAssignments: [],
  programDuration: undefined,
}

const blankInvite: InviteDraft = {
  id: 'invite-0',
  name: '',
  email: '',
  role: 'user',
  method: 'email',
}

export const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  adminId,
  adminName,
  partners = [],
}) => {
  const toast = useToast()
  const [form, setForm] = useState<OrganizationRecord>(emptyOrganization)
  const [inviteDrafts, setInviteDrafts] = useState<InviteDraft[]>([blankInvite])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [mentors, setMentors] = useState<OrganizationLead[]>([])
  const [ambassadors, setAmbassadors] = useState<OrganizationLead[]>([])
  const [results, setResults] = useState<BulkInvitationResult | null>(null)
  const resultsModal = useDisclosure()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const courseLimit = useMemo(() => {
    const option = programDurations.find((duration) => duration.value === form.programDuration)
    return option?.courseCount ?? 0
  }, [form.programDuration])

  const remainingCourses = courseLimit - (form.courseAssignments?.length || 0)
  const codeLength = form.code.trim().length
  const isCodeValidLength = codeLength === 6

  useEffect(() => {
    if (form.name && !form.code) {
      setForm((prev) => ({ ...prev, code: generateOrganizationCode(form.name) }))
    }
  }, [form.name, form.code])

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyOrganization)
      setInviteDrafts([blankInvite])
      setCourses([])
      setMentors([])
      setAmbassadors([])
      setResults(null)
      return
    }

    const fetchData = async () => {
      try {
        const [courseOptions, mentorOptions, ambassadorOptions] = await Promise.all([
          fetchAvailableCourses(),
          fetchMentors(),
          fetchAmbassadors(),
        ])
        setCourses(courseOptions)
        setMentors(mentorOptions)
        setAmbassadors(ambassadorOptions)
      } catch (error) {
        console.error(error)
        toast({ title: 'Unable to load form data', status: 'error' })
      }
    }

    fetchData()
  }, [isOpen, toast])

  const updateField = (key: keyof OrganizationRecord, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleTeamSizeChange = (value: string) => {
    const parsed = Number(value)
    const cluster = determineClusterFromTeamSize(parsed)
    setForm((prev) => ({ ...prev, teamSize: parsed, cluster }))
  }

  const handleCourseToggle = (courseId: string) => {
    setForm((prev) => {
      const assignments = prev.courseAssignments || []
      const exists = assignments.includes(courseId)
      if (!exists && courseLimit && assignments.length >= courseLimit) {
        toast({ title: 'Course limit reached for selected duration', status: 'warning' })
        return prev
      }
      const nextAssignments = exists
        ? assignments.filter((id) => id !== courseId)
        : [...assignments, courseId]
      return { ...prev, courseAssignments: nextAssignments }
    })
  }

  const handleInviteChange = (id: string, field: keyof InviteDraft, value: string) => {
    setInviteDrafts((prev) => prev.map((draft) => (draft.id === id ? { ...draft, [field]: value } : draft)))
  }

  const addInviteDraft = () => {
    if (inviteDrafts.length >= (form.teamSize || 0)) {
      toast({ title: 'Invitation count cannot exceed cohort size', status: 'warning' })
      return
    }
    setInviteDrafts((prev) => [
      ...prev,
      {
        ...blankInvite,
        id: `invite-${Date.now()}`,
      },
    ])
  }

  const removeInviteDraft = (id: string) => {
    if (inviteDrafts.length === 1) return
    setInviteDrafts((prev) => prev.filter((draft) => draft.id !== id))
  }

  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const drafts = await parseInvitationCSV(file)
      if (drafts.length > (form.teamSize || drafts.length)) {
        toast({ title: 'Import exceeds cohort size', status: 'error' })
        return
      }
      setInviteDrafts(drafts)
      toast({ title: `Imported ${drafts.length} invitations`, status: 'success' })
    } catch (error) {
      toast({
        title: 'Unable to process CSV',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const validateInvitations = () => {
    const trimmed = inviteDrafts.filter((draft) => draft.name || draft.email)
    const emails = new Set<string>()
    for (const draft of trimmed) {
      if (!draft.name.trim()) {
        throw new Error('Invitation name is required')
      }
      if (draft.method === 'email') {
        if (!draft.email.trim()) throw new Error('Email is required for email invitations')
        if (!emailRegex.test(draft.email.trim())) throw new Error(`Invalid email: ${draft.email}`)
        if (emails.has(draft.email.trim())) throw new Error(`Duplicate email: ${draft.email}`)
        emails.add(draft.email.trim())
      }
    }
    if (trimmed.length > (form.teamSize || 0)) {
      throw new Error('Invitations cannot exceed cohort size')
    }
    return trimmed
  }

  const handleSubmit = async () => {
    try {
      if (!form.name || form.name.length < 3) throw new Error('Organization name must be at least 3 characters')
      if (!form.code) throw new Error('Organization code is required')
      if (!isCodeValidLength) throw new Error('Organization code must be exactly 6 characters')
      const isUnique = await validateOrganizationCodeUnique(form.code)
      if (!isUnique) throw new Error('Organization code is already in use')
      if (!form.programDuration) throw new Error('Program duration is required')
      if (!form.teamSize || form.teamSize <= 0) throw new Error('Cohort size must be greater than 0')
      if (courseLimit && (form.courseAssignments?.length || 0) !== courseLimit) {
        throw new Error(`Please assign exactly ${courseLimit} course(s) for the selected duration`)
      }

      const invitations = validateInvitations()

      setIsSubmitting(true)
      const organizationPayload: OrganizationRecord = {
        ...form,
        code: form.code.toUpperCase(),
        courseAssignments: form.courseAssignments || [],
        cohortStartDate: form.cohortStartDate,
        programDuration: form.programDuration,
      }

      const { organizationId, invitationResult } = await createOrganizationWithInvitations(
        organizationPayload,
        invitations.map((invite) => ({
          name: invite.name.trim(),
          email: invite.email.trim() || undefined,
          role: invite.role,
          method: invite.method,
          organizationId: '',
        })),
        { adminId, adminName },
      )

      const organizationWithId = { ...organizationPayload, id: organizationId }
      if (onCreated) {
        await onCreated(organizationWithId)
      }
      if (invitationResult) {
        setResults(invitationResult)
        resultsModal.onOpen()
      }
      toast({ title: 'Organization created successfully', status: 'success' })
      onClose()
    } catch (error) {
      toast({
        title: 'Unable to create organization',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const invitationCountColor = inviteDrafts.length > (form.teamSize || 0) ? 'red.500' : 'gray.600'

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create organization</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={8}>
              <Box>
                <Text fontWeight="bold">1. ORGANIZATION DETAILS</Text>
                <Text color="gray.600" fontSize="sm">
                  Configure the organization profile, program duration, and leadership assignments.
                </Text>
              </Box>

              <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
                <GridItem>
                  <FormControl isRequired>
                    <FormLabel>Organization name</FormLabel>
                    <Input
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="Acme Corp"
                    />
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl isRequired isInvalid={codeLength > 0 && !isCodeValidLength}>
                    <FormLabel display="flex" alignItems="center" gap={2}>
                      Organization code
                      <Tooltip label="6-character code: 2-letter prefix + 4 random characters." placement="top">
                        <InfoIcon color="gray.400" />
                      </Tooltip>
                    </FormLabel>
                    <InputGroup>
                      <InputLeftAddon>Code</InputLeftAddon>
                      <Input
                        value={form.code}
                        onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                        maxLength={6}
                        placeholder="6-char code"
                        textTransform="uppercase"
                      />
                    </InputGroup>
                    <FormHelperText color={isCodeValidLength ? 'green.500' : 'gray.600'}>
                      {codeLength}/6 characters
                    </FormHelperText>
                    <FormErrorMessage>Organization code must be exactly 6 characters.</FormErrorMessage>
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl>
                    <FormLabel>Village</FormLabel>
                    <Input value={form.village} onChange={(e) => updateField('village', e.target.value)} />
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl>
                    <FormLabel>Cluster</FormLabel>
                    <Input value={form.cluster} isReadOnly placeholder="Auto-calculated" />
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl isRequired>
                    <FormLabel>Cohort size</FormLabel>
                    <Input
                      type="number"
                      value={form.teamSize || ''}
                      onChange={(e) => handleTeamSizeChange(e.target.value)}
                      min={1}
                    />
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl isRequired>
                    <FormLabel>Program duration</FormLabel>
                    <Select
                      placeholder="Select duration"
                      value={form.programDuration?.toString() || ''}
                      onChange={(e) => updateField('programDuration', Number(e.target.value))}
                    >
                      {programDurations.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    <FormErrorMessage>
                      {courseLimit > 0
                        ? `Assign ${courseLimit} course${courseLimit > 1 ? 's' : ''}`
                        : 'Select a duration to enable course assignments'}
                    </FormErrorMessage>
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl>
                    <FormLabel>Program start date</FormLabel>
                    <Input
                      type="date"
                      value={form.cohortStartDate ? String(form.cohortStartDate) : ''}
                      onChange={(e) => updateField('cohortStartDate', e.target.value)}
                    />
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl>
                    <FormLabel>Transformation partner</FormLabel>
                    <Select
                      placeholder="Select partner"
                      value={form.assignedPartnerId || ''}
                      onChange={(e) => {
                        const partner = partners.find((item) => item.id === e.target.value)
                        updateField('assignedPartnerId', e.target.value || null)
                        updateField('assignedPartnerName', partner?.name || null)
                        updateField('assignedPartnerEmail', partner?.email || null)
                      }}
                    >
                      {partners.map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {partner.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </GridItem>
                <GridItem colSpan={2}>
                  <FormControl>
                    <FormLabel>Description</FormLabel>
                    <Textarea
                      value={(form as { description?: string }).description || ''}
                      onChange={(e) => updateField('description', e.target.value)}
                    />
                  </FormControl>
                </GridItem>
              </Grid>

              <Box>
                <Text fontWeight="medium" mb={2}>
                  Course assignments
                </Text>
                {courseLimit === 0 ? (
                  <Text fontSize="sm" color="gray.600">
                    Select a program duration to enable course assignments.
                  </Text>
                ) : null}
                <Stack
                  maxH="200px"
                  overflowY="auto"
                  borderWidth="1px"
                  borderRadius="md"
                  p={3}
                  spacing={2}
                >
                  {courses.map((course) => (
                    <Checkbox
                      key={course.id}
                      isChecked={form.courseAssignments?.includes(course.id)}
                      onChange={() => handleCourseToggle(course.id)}
                    >
                      {course.title}
                    </Checkbox>
                  ))}
                </Stack>
                <Text mt={2} fontSize="sm" color={remainingCourses > 0 ? 'gray.600' : 'green.500'}>
                  {courseLimit === 0
                    ? 'Select a program duration to assign courses'
                    : `${Math.max(remainingCourses, 0)} course(s) remaining to assign`}
                </Text>
              </Box>

              <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
                <GridItem>
                  <FormControl>
                    <FormLabel>Mentor</FormLabel>
                    <Select
                      placeholder="Select mentor"
                      value={form.assignedMentorId || ''}
                      onChange={(e) => {
                        const mentor = mentors.find((m) => m.id === e.target.value)
                        updateField('assignedMentorId', mentor?.id || null)
                        updateField('assignedMentorName', mentor?.name || null)
                        updateField('assignedMentorEmail', mentor?.email || null)
                      }}
                    >
                      {mentors.map((mentor) => (
                        <option key={mentor.id} value={mentor.id}>
                          {mentor.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl>
                    <FormLabel>Ambassador</FormLabel>
                    <Select
                      placeholder="Select ambassador"
                      value={form.assignedAmbassadorId || ''}
                      onChange={(e) => {
                        const ambassador = ambassadors.find((m) => m.id === e.target.value)
                        updateField('assignedAmbassadorId', ambassador?.id || null)
                        updateField('assignedAmbassadorName', ambassador?.name || null)
                        updateField('assignedAmbassadorEmail', ambassador?.email || null)
                      }}
                    >
                      {ambassadors.map((ambassador) => (
                        <option key={ambassador.id} value={ambassador.id}>
                          {ambassador.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl>
                    <FormLabel>Status</FormLabel>
                    <Select
                      value={form.status}
                      onChange={(e) => updateField('status', e.target.value as OrganizationRecord['status'])}
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                      <option value="watch">Watch</option>
                    </Select>
                  </FormControl>
                </GridItem>
              </Grid>

              <Divider />

              <Box>
                <Text fontWeight="bold">2. ADD USERS</Text>
                <Text color="gray.600" fontSize="sm">
                  Invite learners via email or one-time codes. Import CSV for bulk setup.
                </Text>
              </Box>

              <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }}>
                <HStack spacing={3} mb={{ base: 3, md: 0 }}>
                  <Button leftIcon={<Plus size={16} />} onClick={addInviteDraft}>
                    Add manual entry
                  </Button>
                  <Button leftIcon={<Upload size={16} />} onClick={() => fileInputRef.current?.click()}>
                    Upload CSV
                  </Button>
                  <Button variant="ghost" onClick={downloadCSVTemplate}>
                    Download template
                  </Button>
                </HStack>
                <Text fontWeight="medium" color={invitationCountColor}>
                  {inviteDrafts.length} / {form.teamSize || 0} invitations
                </Text>
              </Flex>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleCsvUpload}
              />

              <Stack spacing={3}>
                {inviteDrafts.map((draft) => (
                  <Box key={draft.id} borderWidth="1px" borderRadius="md" p={3}>
                    <Grid templateColumns={{ base: '1fr', md: 'repeat(4, 1fr)' }} gap={3} alignItems="center">
                      <FormControl isRequired>
                        <FormLabel>Name</FormLabel>
                        <Input value={draft.name} onChange={(e) => handleInviteChange(draft.id, 'name', e.target.value)} />
                      </FormControl>
                      <FormControl isRequired={draft.method === 'email'}>
                        <FormLabel>Email</FormLabel>
                        <Input value={draft.email} onChange={(e) => handleInviteChange(draft.id, 'email', e.target.value)} />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Role</FormLabel>
                        <Select
                          value={draft.role}
                          onChange={(e) => handleInviteChange(draft.id, 'role', e.target.value)}
                        >
                          <option value="user">User</option>
                          <option value="mentor">Mentor</option>
                          <option value="ambassador">Ambassador</option>
                          <option value="partner">Partner</option>
                        </Select>
                      </FormControl>
                      <FormControl>
                        <FormLabel>Method</FormLabel>
                        <Select
                          value={draft.method}
                          onChange={(e) => handleInviteChange(draft.id, 'method', e.target.value)}
                        >
                          <option value="email">Email</option>
                          <option value="one_time_code">One-time code</option>
                        </Select>
                      </FormControl>
                      <GridItem colSpan={4} textAlign="right">
                        <IconButton
                          aria-label="Remove invitation"
                          size="sm"
                          icon={<X size={14} />}
                          variant="ghost"
                          onClick={() => removeInviteDraft(draft.id)}
                          isDisabled={inviteDrafts.length === 1}
                        />
                      </GridItem>
                    </Grid>
                  </Box>
                ))}
              </Stack>

              <Alert status="warning" borderRadius="md">
                <AlertIcon />
                If your admin session is out of sync, refresh before submitting to avoid inconsistent permissions.
              </Alert>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="purple" onClick={handleSubmit} isLoading={isSubmitting}>
              Create organization
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <InvitationResultsModal isOpen={resultsModal.isOpen} onClose={resultsModal.onClose} result={results} />
    </>
  )
}
