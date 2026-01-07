import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
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
import { ChevronDown, ChevronUp, Eye, Plus, Upload, X } from 'lucide-react'
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
import {
  MonthlyCourseAssignments,
  buildMonthlyAssignmentsFromArray,
  buildMonthlyAssignmentsSummary,
  formatMonthRange,
  getAssignedCourseIdsFromMonthlyAssignments,
  getMonthAvailabilityStatus,
  getMonthDateRange,
} from '@/utils/monthlyCourseAssignments'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface CreateOrganizationModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (organization: OrganizationRecord) => void
  adminName?: string
  adminId?: string
  partners?: { id: string; name: string; email?: string }[]
  partnerAssignmentCounts?: Record<string, number>
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
  monthlyCourseAssignments: {},
  courseAssignmentStructure: 'monthly',
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
  partnerAssignmentCounts,
}) => {
  const toast = useToast()
  const [form, setForm] = useState<OrganizationRecord>(emptyOrganization)
  const [inviteDrafts, setInviteDrafts] = useState<InviteDraft[]>([blankInvite])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [mentors, setMentors] = useState<OrganizationLead[]>([])
  const [ambassadors, setAmbassadors] = useState<OrganizationLead[]>([])
  const [results, setResults] = useState<BulkInvitationResult | null>(null)
  const [partnerSearch, setPartnerSearch] = useState('')
  const [monthlyAssignments, setMonthlyAssignments] = useState<MonthlyCourseAssignments>({})
  const resultsModal = useDisclosure()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const courseLimit = useMemo(() => {
    const option = programDurations.find((duration) => duration.value === form.programDuration)
    return option?.courseCount ?? 0
  }, [form.programDuration])

  const remainingCourses = courseLimit - getAssignedCourseIdsFromMonthlyAssignments(monthlyAssignments, courseLimit).length
  const codeLength = form.code.trim().length
  const isCodeValidLength = codeLength === 6
  const cohortStartDate = useMemo(
    () => (form.cohortStartDate ? new Date(String(form.cohortStartDate)) : null),
    [form.cohortStartDate],
  )
  const monthlySummary = useMemo(
    () =>
      buildMonthlyAssignmentsSummary({
        monthlyAssignments,
        totalMonths: courseLimit,
        courseTitleLookup: (courseId) =>
          courses.find((course) => course.id === courseId)?.title || courseId,
      }),
    [monthlyAssignments, courseLimit, courses],
  )
  const duplicateCourses = useMemo(() => {
    const seen = new Set<string>()
    const duplicates = new Set<string>()
    Object.values(monthlyAssignments).forEach((courseId) => {
      if (!courseId) return
      if (seen.has(courseId)) {
        duplicates.add(courseId)
      } else {
        seen.add(courseId)
      }
    })
    return Array.from(duplicates)
  }, [monthlyAssignments])
  const emptyMonths = useMemo(
    () =>
      Array.from({ length: courseLimit }, (_, index) => ({
        month: index + 1,
        courseId: monthlyAssignments[String(index + 1)] || '',
      })).filter((entry) => !entry.courseId),
    [monthlyAssignments, courseLimit],
  )

  const sortedPartners = useMemo(
    () => [...partners].sort((a, b) => a.name.localeCompare(b.name)),
    [partners],
  )

  const filteredPartners = useMemo(() => {
    const term = partnerSearch.trim().toLowerCase()
    if (!term) return sortedPartners
    return sortedPartners.filter((item) => {
      const email = item.email?.toLowerCase() ?? ''
      return item.name.toLowerCase().includes(term) || email.includes(term)
    })
  }, [partnerSearch, sortedPartners])

  const buildPartnerLabel = (item: OrganizationLead) => {
    const emailSuffix = item.email ? ` — ${item.email}` : ''
    const assignmentCount = partnerAssignmentCounts?.[item.name] ?? 0
    const countSuffix = assignmentCount > 1 ? ` • ${assignmentCount} orgs` : ''
    return `${item.name}${emailSuffix}${countSuffix}`
  }

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
      setMonthlyAssignments({})
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

  useEffect(() => {
    if (!isOpen) return
    if (!courseLimit) {
      setMonthlyAssignments({})
      return
    }
    setMonthlyAssignments((prev) => {
      const seed = Object.keys(prev).length
        ? prev
        : buildMonthlyAssignmentsFromArray(form.courseAssignments || [], courseLimit)
      const next: MonthlyCourseAssignments = {}
      for (let index = 0; index < courseLimit; index += 1) {
        const key = String(index + 1)
        next[key] = seed[key] || ''
      }
      return next
    })
  }, [courseLimit, form.courseAssignments, isOpen])

  const updateField = (key: keyof OrganizationRecord, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleTeamSizeChange = (value: string) => {
    const parsed = Number(value)
    const cluster = determineClusterFromTeamSize(parsed)
    setForm((prev) => ({ ...prev, teamSize: parsed, cluster }))
  }

  const handleMonthlyAssignmentChange = (monthKey: string, courseId: string) => {
    setMonthlyAssignments((prev) => ({
      ...prev,
      [monthKey]: courseId,
    }))
  }

  const swapMonthlyAssignments = (fromIndex: number, toIndex: number) => {
    setMonthlyAssignments((prev) => {
      const next = { ...prev }
      const fromKey = String(fromIndex + 1)
      const toKey = String(toIndex + 1)
      const temp = next[fromKey] || ''
      next[fromKey] = next[toKey] || ''
      next[toKey] = temp
      return next
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
      if (courseLimit && emptyMonths.length) {
        throw new Error(`Please assign a course for each of the ${courseLimit} month(s)`)
      }

      const invitations = validateInvitations()

      setIsSubmitting(true)
      const assignmentArray = getAssignedCourseIdsFromMonthlyAssignments(monthlyAssignments, courseLimit)
      const organizationPayload: OrganizationRecord = {
        ...form,
        code: form.code.toUpperCase(),
        courseAssignments: assignmentArray,
        monthlyCourseAssignments: monthlyAssignments,
        courseAssignmentStructure: 'monthly',
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
                    <Input
                      value={partnerSearch}
                      onChange={(e) => setPartnerSearch(e.target.value)}
                      placeholder="Search partners"
                      mb={2}
                    />
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
                      <option value="">— No partner —</option>
                      {filteredPartners.map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {buildPartnerLabel(partner)}
                        </option>
                      ))}
                    </Select>
                    {!filteredPartners.length && (
                      <FormHelperText color="gray.600">No partners available.</FormHelperText>
                    )}
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
                  Monthly course assignments
                </Text>
                {courseLimit === 0 ? (
                  <Text fontSize="sm" color="gray.600">
                    Select a program duration to enable course assignments.
                  </Text>
                ) : null}
                <Stack spacing={3}>
                  {Array.from({ length: courseLimit }, (_, index) => {
                    const monthNumber = index + 1
                    const monthKey = String(monthNumber)
                    const assignedCourse = monthlyAssignments[monthKey] || ''
                    const dateRange = cohortStartDate
                      ? (() => {
                          const { startDate, endDate } = getMonthDateRange(cohortStartDate, index)
                          return formatMonthRange(startDate, endDate)
                        })()
                      : undefined
                    const isEmpty = !assignedCourse
                    return (
                      <Box key={monthKey} borderWidth="1px" borderRadius="lg" p={3} bg="gray.50">
                        <Flex justify="space-between" align="center" mb={2}>
                          <HStack spacing={2}>
                            <Badge colorScheme={isEmpty ? 'red' : 'green'} borderRadius="full">
                              Month {monthNumber}
                            </Badge>
                            {dateRange && (
                              <Text fontSize="sm" color="gray.600">
                                {dateRange}
                              </Text>
                            )}
                          </HStack>
                          <HStack spacing={1}>
                            <IconButton
                              aria-label="Move course up"
                              size="sm"
                              icon={<ChevronUp size={16} />}
                              onClick={() => swapMonthlyAssignments(index, index - 1)}
                              isDisabled={index === 0}
                              variant="ghost"
                            />
                            <IconButton
                              aria-label="Move course down"
                              size="sm"
                              icon={<ChevronDown size={16} />}
                              onClick={() => swapMonthlyAssignments(index, index + 1)}
                              isDisabled={index === courseLimit - 1}
                              variant="ghost"
                            />
                          </HStack>
                        </Flex>
                        <Select
                          placeholder="Select course"
                          value={assignedCourse}
                          onChange={(e) => handleMonthlyAssignmentChange(monthKey, e.target.value)}
                          bg="white"
                        >
                          {courses.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.title}
                            </option>
                          ))}
                        </Select>
                        {isEmpty && (
                          <Text fontSize="xs" color="red.500" mt={2}>
                            Course assignment required for this month.
                          </Text>
                        )}
                      </Box>
                    )
                  })}
                </Stack>
                <Text mt={2} fontSize="sm" color={remainingCourses > 0 ? 'gray.600' : 'green.500'}>
                  {courseLimit === 0
                    ? 'Select a program duration to assign courses'
                    : `${Math.max(remainingCourses, 0)} course(s) remaining to assign`}
                </Text>
                {duplicateCourses.length > 0 && (
                  <Alert status="warning" mt={3} borderRadius="md">
                    <AlertIcon />
                    Duplicate courses assigned for multiple months: {duplicateCourses.join(', ')}.
                  </Alert>
                )}
                {emptyMonths.length > 0 && courseLimit > 0 && (
                  <Alert status="error" mt={3} borderRadius="md">
                    <AlertIcon />
                    {emptyMonths.length} month(s) still need course assignments.
                  </Alert>
                )}
                {courseLimit > 0 && (
                  <Box mt={4} borderWidth="1px" borderRadius="lg" p={3} bg="white">
                    <HStack justify="space-between" mb={2}>
                      <Text fontWeight="semibold">Monthly breakdown summary</Text>
                      <HStack spacing={2} color="purple.600">
                        <Eye size={16} />
                        <Text fontSize="sm">Admin preview</Text>
                      </HStack>
                    </HStack>
                    <Stack spacing={2}>
                      {monthlySummary.map((entry) => (
                        <Flex key={entry.month} justify="space-between" align="center">
                          <Text fontWeight="medium">Month {entry.month}</Text>
                          <Text color={entry.courseId ? 'gray.700' : 'red.500'}>{entry.title}</Text>
                        </Flex>
                      ))}
                    </Stack>
                  </Box>
                )}
                {courseLimit > 0 && (
                  <Box mt={4} borderWidth="1px" borderRadius="lg" p={3} bg="gray.50">
                    <Text fontWeight="semibold" mb={2}>
                      Learner dashboard preview
                    </Text>
                    <Stack spacing={2}>
                      {Array.from({ length: courseLimit }, (_, index) => {
                        const monthNumber = index + 1
                        const courseId = monthlyAssignments[String(monthNumber)] || ''
                        const availability = getMonthAvailabilityStatus({
                          cohortStartDate,
                          currentDate: new Date(),
                          monthIndex: index,
                        })
                        const label =
                          availability === 'current'
                            ? 'Current month'
                            : availability === 'completed'
                              ? 'Completed'
                              : 'Locked'
                        return (
                          <Flex key={monthNumber} justify="space-between" align="center" p={2} bg="white" borderRadius="md">
                            <Text fontWeight="medium">Month {monthNumber}</Text>
                            <HStack spacing={2}>
                              <Badge colorScheme={availability === 'current' ? 'green' : availability === 'completed' ? 'purple' : 'gray'}>
                                {label}
                              </Badge>
                              <Text fontSize="sm" color="gray.600">
                                {courseId
                                  ? courses.find((course) => course.id === courseId)?.title || courseId
                                  : 'Unassigned'}
                              </Text>
                            </HStack>
                          </Flex>
                        )
                      })}
                    </Stack>
                  </Box>
                )}
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
