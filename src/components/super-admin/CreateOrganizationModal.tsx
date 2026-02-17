import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertIcon,
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Checkbox,
  Editable,
  EditableInput,
  EditablePreview,
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
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { InfoIcon } from '@chakra-ui/icons'
import { ChevronDown, ChevronUp, Eye } from 'lucide-react'
import {
  BulkInvitationResult,
  CourseOption,
  InvitationPayload,
  InviteDraft,
  OrganizationRecord,
  ProgramDurationOption,
} from '@/types/admin'
import {
  createOrganizationWithInvitations,
  determineClusterFromTeamSize,
  fetchAvailableCourses,
  generateOrganizationCode,
  validateOrganizationCodeUnique,
} from '@/services/organizationService'
import { InvitationResultsModal } from './InvitationResultsModal'
import {
  MonthlyCourseAssignments,
  buildMonthlyAssignmentsFromArray,
  buildMonthlyAssignmentsSummary,
  formatMonthRange,
  getAssignedCourseIdsFromMonthlyAssignments,
  getProgramSegmentAvailabilityStatus,
  getProgramSegmentDateRange,
  getProgramSegmentLabel,
  resolveProgramCadence,
} from '@/utils/monthlyCourseAssignments'
import { downloadCSVTemplate, parseInvitationCSV } from '@/utils/csvUtils'
import { normalizeEmail } from '@/utils/email'
import { resolveCourseIdFromMapping } from '@/utils/courseMappings'
import {
  clusterBoundaries,
  clusterTiers,
  getClusterDisplayName,
  getClusterShortName,
  getClusterTierByName,
} from '@/utils/clusterTiers'

interface CreateOrganizationModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (organization: OrganizationRecord) => void
  adminName?: string
  adminId?: string
}

const programDurations: ProgramDurationOption[] = [
  { value: 1.5, label: '6 weeks (3 x 2-week windows)', courseCount: 3 },
  { value: 3, label: '3 months', courseCount: 3 },
  { value: 6, label: '6 months', courseCount: 6 },
  { value: 9, label: '9 months', courseCount: 9 },
]

const emptyOrganization: OrganizationRecord = {
  name: '',
  code: '',
  village: '',
  status: 'pending',
  courseAssignments: [],
  programDuration: undefined,
  monthlyCourseAssignments: {},
  courseAssignmentStructure: 'monthly',
  teamSize: 0,
  cluster: '',
}

const inviteRoleOptions: InviteDraft['role'][] = ['user', 'partner', 'mentor', 'ambassador']

const formatInviteRoleLabel = (role: InviteDraft['role']) => {
  if (role === 'user') return 'User'
  return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const commonEmailDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com']

type InviteDraftField = 'email' | 'role'
type InviteDraftErrors = Partial<Record<InviteDraftField, string>>
type InviteDraftEntry = InviteDraft & {
  isValid: boolean
  errors: InviteDraftErrors
  source?: 'manual' | 'csv'
  rowNumber?: number
  addedAt: number
  isNew?: boolean
}

const deriveInviteNameFromEmail = (email: string) => {
  const localPart = email.split('@')[0] || ''
  const normalized = localPart.replace(/[._-]+/g, ' ').trim()
  if (!normalized) return 'Invited user'
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
}

export const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  adminId,
  adminName,
}) => {
  const toast = useToast()
  const [form, setForm] = useState<OrganizationRecord>(emptyOrganization)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [results, setResults] = useState<BulkInvitationResult | null>(null)
  const [monthlyAssignments, setMonthlyAssignments] = useState<MonthlyCourseAssignments>({})
  const [inviteDrafts, setInviteDrafts] = useState<InviteDraftEntry[]>([])
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [manualEntry, setManualEntry] = useState({
    email: '',
    role: 'user' as InviteDraft['role'],
  })
  const [manualErrors, setManualErrors] = useState<InviteDraftErrors>({})
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([])
  const [recentImportIds, setRecentImportIds] = useState<string[]>([])
  const [lastImportCount, setLastImportCount] = useState(0)
  const bulkDeleteDialog = useDisclosure()
  const clearAllDialog = useDisclosure()
  const bulkDeleteCancelRef = React.useRef<HTMLButtonElement | null>(null)
  const clearAllCancelRef = React.useRef<HTMLButtonElement | null>(null)
  const resultsModal = useDisclosure()

  const courseLimit = useMemo(() => {
    const option = programDurations.find((duration) => duration.value === form.programDuration)
    return option?.courseCount ?? 0
  }, [form.programDuration])
  const programCadence = useMemo(() => resolveProgramCadence(form.programDuration), [form.programDuration])
  const assignmentUnit = programCadence === 'biweekly' ? 'window' : 'month'
  const assignmentUnitPlural = programCadence === 'biweekly' ? 'windows' : 'months'
  const assignmentSectionLabel = programCadence === 'biweekly' ? '2-week window course assignments' : 'Monthly course assignments'
  const assignmentBreakdownLabel = programCadence === 'biweekly' ? 'Cycle breakdown summary' : 'Monthly breakdown summary'

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
  const inviteStats = useMemo(() => {
    const total = inviteDrafts.length
    const valid = inviteDrafts.filter((draft) => draft.isValid).length
    const invalid = total - valid
    return { total, valid, invalid }
  }, [inviteDrafts])

  const sortedCourses = useMemo(
    () => [...courses].sort((a, b) => a.title.localeCompare(b.title)),
    [courses],
  )
  const clusterDisplayName = useMemo(() => getClusterDisplayName(form.cluster), [form.cluster])
  const clusterShortName = useMemo(() => getClusterShortName(form.cluster), [form.cluster])
  const clusterTier = useMemo(() => getClusterTierByName(form.cluster), [form.cluster])
  const clusterHelperColor = clusterTier.colorScheme === 'gray' ? 'gray.600' : `${clusterTier.colorScheme}.600`
  const hasValidTeamSize = (form.teamSize || 0) > 0
  const isClusterAssigned = (form.teamSize || 0) >= 4 && Boolean(form.cluster)
  const nextBoundary = clusterBoundaries.find((boundary) => boundary > (form.teamSize || 0))
  const transitionHint = hasValidTeamSize && nextBoundary ? `${nextBoundary - 1}→${nextBoundary}` : null
  const isClusterBoundary = clusterBoundaries.includes(form.teamSize || 0) && hasValidTeamSize
  const boundaryTier = clusterTiers.find((tier) => tier.min === form.teamSize)
  const nextBoundaryTier = boundaryTier
    ? clusterTiers[clusterTiers.findIndex((tier) => tier.name === boundaryTier.name) + 1]
    : undefined
  const clusterProgressMax = 50
  const clusterProgressValue = Math.min(form.teamSize || 0, clusterProgressMax)
  const clusterProgressPercent = (clusterProgressValue / clusterProgressMax) * 100
  const clusterHighlightBg = `${clusterTier.colorScheme}.50`
  const clusterTooltipContent = (
    <Box>
      <Text fontWeight="semibold" mb={2}>
        Cluster breakdown
      </Text>
      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th>Cluster</Th>
            <Th>Range</Th>
            <Th>Badge</Th>
          </Tr>
        </Thead>
        <Tbody>
          {clusterTiers.map((tier) => (
            <Tr key={tier.name}>
              <Td>{tier.shortName}</Td>
              <Td>{tier.rangeLabel} users</Td>
              <Td>
                <Badge colorScheme={tier.colorScheme} variant="subtle">
                  {tier.shortName}
                </Badge>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      <Text fontSize="xs" color="gray.600" mt={2}>
        No Cluster (1-3), Kalahari (4-10), Sahara (11-20), Sahel (21-40), Serengeti (41+).
      </Text>
    </Box>
  )
  const clusterHelperText = isClusterAssigned
    ? `Assigned to ${clusterShortName} based on cohort size.`
    : 'No cluster assigned (1-3 users).'
  const boundaryAlertText = nextBoundaryTier
    ? `Cluster tier: ${clusterShortName}. Adding 1 more user keeps you in ${clusterShortName}; ${nextBoundaryTier.shortName} begins at ${nextBoundaryTier.min} users.`
    : `Cluster tier: ${clusterShortName}. You're in the highest tier.`

  useEffect(() => {
    if (form.name && !form.code) {
      setForm((prev) => ({ ...prev, code: generateOrganizationCode(form.name) }))
    }
  }, [form.name, form.code])

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyOrganization)
      setCourses([])
      setResults(null)
      setMonthlyAssignments({})
      setInviteDrafts([])
      setInviteError(null)
      setManualEntry({ email: '', role: 'user' })
      setManualErrors({})
      setSelectedDraftIds([])
      setRecentImportIds([])
      setLastImportCount(0)
      return
    }

    const fetchData = async () => {
      try {
        const [courseOptions] = await Promise.all([fetchAvailableCourses()])
        setCourses(courseOptions)
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

  const buildInviteDraftEntry = (draft: InviteDraft, source?: InviteDraftEntry['source'], rowNumber?: number): InviteDraftEntry => {
    const normalizedEmail = normalizeEmail(draft.email || '')
    const method: InviteDraft['method'] = 'email'
    return {
      ...draft,
      name: deriveInviteNameFromEmail(normalizedEmail),
      email: normalizedEmail,
      method,
      isValid: true,
      errors: {},
      source,
      rowNumber,
      addedAt: Date.now(),
      isNew: source === 'csv',
    }
  }

  const validateInviteDraft = (
    draft: InviteDraftEntry,
    emailCounts: Map<string, number>,
  ): InviteDraftErrors => {
    const errors: InviteDraftErrors = {}
    const normalizedEmail = normalizeEmail(draft.email || '')
    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      errors.email = 'A valid email address is required.'
    }
    if (normalizedEmail && (emailCounts.get(normalizedEmail) || 0) > 1) {
      errors.email = 'Duplicate email detected.'
    }

    if (!inviteRoleOptions.includes(draft.role)) {
      errors.role = 'Select a valid role.'
    }

    return errors
  }

  const recomputeInviteDrafts = (drafts: InviteDraftEntry[]) => {
    const emailCounts = drafts.reduce((map, draft) => {
      const normalized = normalizeEmail(draft.email || '')
      if (normalized) {
        map.set(normalized, (map.get(normalized) || 0) + 1)
      }
      return map
    }, new Map<string, number>())

    return drafts.map((draft) => {
      const normalizedEmail = normalizeEmail(draft.email || '')
      const method: InviteDraft['method'] = 'email'
      const errors = validateInviteDraft(draft, emailCounts)
      return {
        ...draft,
        name: deriveInviteNameFromEmail(normalizedEmail),
        email: normalizedEmail,
        method,
        errors,
        isValid: Object.keys(errors).length === 0,
      }
    })
  }

  const addInviteDrafts = (incoming: InviteDraftEntry[]) => {
    setInviteDrafts((prev) => recomputeInviteDrafts([...prev, ...incoming]))
  }

  const updateDraftField = (draftId: string, field: InviteDraftField, value: string) => {
    setInviteDrafts((prev) => {
      const nextValue = field === 'role' ? (value as InviteDraft['role']) : value
      const next = prev.map((draft) => {
        if (draft.id !== draftId) return draft
        const nextDraft = { ...draft, [field]: nextValue }
        const normalizedEmail = normalizeEmail(nextDraft.email || '')
        const method: InviteDraft['method'] = 'email'
        return {
          ...nextDraft,
          name: deriveInviteNameFromEmail(normalizedEmail),
          email: normalizedEmail,
          method,
          isNew: draft.isNew && draft.source !== 'csv' ? draft.isNew : false,
        }
      })
      return recomputeInviteDrafts(next)
    })
  }

  const removeDrafts = (draftIds: string[]) => {
    setInviteDrafts((prev) => recomputeInviteDrafts(prev.filter((draft) => !draftIds.includes(draft.id))))
    setSelectedDraftIds((prev) => prev.filter((id) => !draftIds.includes(id)))
  }

  const resetManualEntry = () => {
    setManualEntry({ email: '', role: 'user' })
    setManualErrors({})
  }

  const handleInviteFile = async (file?: File | null) => {
    if (!file) return
    try {
      const drafts = await parseInvitationCSV(file)
      setInviteError(null)
      const entries = drafts.map((draft, index) => buildInviteDraftEntry(draft, 'csv', index + 2))
      addInviteDrafts(entries)
      setRecentImportIds(entries.map((entry) => entry.id))
      setLastImportCount(entries.length)
      toast({ title: `Imported ${entries.length} user${entries.length === 1 ? '' : 's'} from CSV`, status: 'success' })
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Unable to parse CSV file.')
    }
  }

  const validateManualEntry = (entry: typeof manualEntry) => {
    const draft = buildInviteDraftEntry(
      {
        id: 'manual-preview',
        name: deriveInviteNameFromEmail(normalizeEmail(entry.email || '')),
        email: normalizeEmail(entry.email || ''),
        role: entry.role,
        method: 'email',
      },
      'manual',
    )
    const emailCounts = new Map<string, number>()
    const normalized = normalizeEmail(draft.email || '')
    if (normalized) {
      emailCounts.set(normalized, 1 + inviteDrafts.filter((existing) => normalizeEmail(existing.email) === normalized).length)
    }
    const errors = validateInviteDraft(draft, emailCounts)
    setManualErrors(errors)
    return errors
  }

  const handleAddManualEntry = () => {
    const errors = validateManualEntry(manualEntry)
    if (Object.keys(errors).length > 0) {
      setInviteError('Fix validation errors before adding the user.')
      return
    }
    setInviteError(null)
    const draft: InviteDraft = {
      id: `${Date.now()}-${Math.round(Math.random() * 1000)}`,
      name: deriveInviteNameFromEmail(normalizeEmail(manualEntry.email || '')),
      email: normalizeEmail(manualEntry.email || ''),
      role: manualEntry.role,
      method: 'email',
    }
    addInviteDrafts([buildInviteDraftEntry(draft, 'manual')])
    resetManualEntry()
    toast({ title: 'User added. Add another if needed.', status: 'success' })
  }

  const handleMonthlyAssignmentChange = (monthKey: string, courseId: string) => {
    setMonthlyAssignments((prev) => ({
      ...prev,
      [monthKey]: courseId,
    }))
  }

  const swapMonthlyAssignments = (fromIndex: number, toIndex: number) => {
    setMonthlyAssignments((prev) => {
      const maxIndex = Object.keys(prev).length - 1
      if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return prev
      if (maxIndex < 0) return prev
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex > maxIndex ||
        toIndex > maxIndex ||
        fromIndex === toIndex
      ) {
        return prev
      }
      const next = { ...prev }
      const fromKey = String(fromIndex + 1)
      const toKey = String(toIndex + 1)
      const temp = next[fromKey] || ''
      next[fromKey] = next[toKey] || ''
      next[toKey] = temp
      return next
    })
  }

  const handleSubmit = async () => {
    try {
      if (!form.name || form.name.length < 3) throw new Error('Organization name must be at least 3 characters')
      if (!form.code) throw new Error('Organization code is required')
      if (!isCodeValidLength) throw new Error('Organization code must be exactly 6 characters')
      const isUnique = await validateOrganizationCodeUnique(form.code)
      if (!isUnique) throw new Error('Organization code is already in use')
      if (!form.programDuration) throw new Error('Program duration is required')
      if (!form.teamSize || form.teamSize <= 0) {
        throw new Error('Cohort size must be greater than 0 to assign a cluster')
      }
      if (courseLimit && emptyMonths.length) {
        throw new Error(`Please assign a course for each of the ${courseLimit} ${assignmentUnit}${courseLimit > 1 ? 's' : ''}`)
      }
      if (inviteDrafts.some((draft) => !draft.isValid)) {
        throw new Error('Resolve invitation errors before submitting.')
      }

      setIsSubmitting(true)
      const normalizedMonthlyAssignments: MonthlyCourseAssignments = {}
      Object.entries(monthlyAssignments).forEach(([monthKey, courseId]) => {
        normalizedMonthlyAssignments[monthKey] = resolveCourseIdFromMapping(courseId)
      })
      const assignmentArray = getAssignedCourseIdsFromMonthlyAssignments(normalizedMonthlyAssignments, courseLimit)
      const organizationPayload: OrganizationRecord = {
        ...form,
        code: form.code.toUpperCase(),
        courseAssignments: assignmentArray,
        monthlyCourseAssignments: normalizedMonthlyAssignments,
        courseAssignmentStructure: 'monthly',
        cohortStartDate: form.cohortStartDate,
        programDuration: form.programDuration,
      }

      const invitationPayloads: InvitationPayload[] = inviteDrafts.map((draft) => ({
        name: draft.name,
        email: draft.email || undefined,
        role: draft.role,
        method: draft.method,
        organizationId: '',
      }))

      const { organizationId, invitationResult } = await createOrganizationWithInvitations(
        organizationPayload,
        invitationPayloads,
        { adminId, adminName },
      )

      const now = new Date()
      const organizationWithId: OrganizationRecord = {
        ...organizationPayload,
        id: organizationId,
        createdAt: organizationPayload.createdAt ?? now,
        updatedAt: organizationPayload.updatedAt ?? now,
      }
      if (onCreated) {
        try {
          await onCreated(organizationWithId)
        } catch (onCreatedError) {
          console.error('[CreateOrganizationModal] Organization was created but post-create callback failed.', {
            organizationId,
            error: onCreatedError,
          })
          toast({
            title: 'Organization created',
            description: 'Post-create updates failed. Refresh to sync the latest data.',
            status: 'warning',
          })
        }
      }
      if (invitationResult) {
        setResults(invitationResult)
        resultsModal.onOpen()
      }
      toast({
        title: 'Organization created successfully',
        description: `Cluster: ${clusterDisplayName}`,
        status: 'success',
      })
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
                <Text fontWeight="bold">Organization details</Text>
                <Text color="gray.600" fontSize="sm">
                  Configure the organization profile and program duration details.
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
                        <InfoIcon color="text.muted" />
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
                    <FormLabel>Village name</FormLabel>
                    <Input
                      value={form.village || ''}
                      onChange={(e) => updateField('village', e.target.value)}
                      placeholder="e.g. North Star Village"
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
                        ? `Assign ${courseLimit} course${courseLimit > 1 ? 's' : ''} across ${courseLimit} ${assignmentUnit}${courseLimit > 1 ? 's' : ''}`
                        : 'Select a duration to enable course assignments'}
                    </FormErrorMessage>
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl isRequired>
                    <FormLabel>Cohort size</FormLabel>
                    <Input
                      type="number"
                      min={1}
                      value={form.teamSize || ''}
                      onChange={(e) => handleTeamSizeChange(e.target.value)}
                    />
                    <FormHelperText color={hasValidTeamSize ? clusterHelperColor : 'gray.500'}>
                      {hasValidTeamSize
                        ? `Cohort size determines cluster tier: ${clusterDisplayName}.`
                        : 'Enter a cohort size to preview the cluster tier.'}
                    </FormHelperText>
                    {transitionHint ? (
                      <FormHelperText color="gray.500">Next tier transition: {transitionHint} users</FormHelperText>
                    ) : null}
                  </FormControl>
                </GridItem>
                <GridItem>
                  <FormControl>
                    <FormLabel display="flex" alignItems="center" gap={2}>
                      Cluster
                      <Tooltip label={clusterTooltipContent} placement="top" maxW="360px">
                        <InfoIcon color="text.muted" />
                      </Tooltip>
                    </FormLabel>
                    <InputGroup>
                      <Input
                        value={clusterDisplayName}
                        isReadOnly
                        placeholder="Auto-calculated from cohort size"
                      />
                      {isClusterAssigned ? (
                        <InputRightElement width="auto" mr={2}>
                          <Badge colorScheme={clusterTier.colorScheme} variant="subtle">
                            {clusterShortName}
                          </Badge>
                        </InputRightElement>
                      ) : null}
                    </InputGroup>
                    <FormHelperText color={isClusterAssigned ? clusterHelperColor : 'gray.600'}>
                      {clusterHelperText}
                    </FormHelperText>
                  </FormControl>
                </GridItem>
                {isClusterBoundary ? (
                  <GridItem colSpan={{ base: 1, md: 2 }}>
                    <Alert status="info" borderRadius="md">
                      <AlertIcon />
                      {boundaryAlertText}
                    </Alert>
                  </GridItem>
                ) : null}
                <GridItem>
                  <FormControl>
                    <FormLabel>Cohort start date</FormLabel>
                    <Input
                      type="date"
                      value={form.cohortStartDate ? String(form.cohortStartDate) : ''}
                      onChange={(e) => updateField('cohortStartDate', e.target.value)}
                    />
                  </FormControl>
                </GridItem>
                <GridItem colSpan={{ base: 1, md: 2 }}>
                  <Accordion allowToggle>
                    <AccordionItem borderWidth="1px" borderRadius="md" overflow="hidden">
                      <AccordionButton bg="gray.50">
                        <Box flex="1" textAlign="left" fontWeight="semibold">
                          Cluster tier reference guide
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel bg="gray.50">
                        <Table size="sm" variant="simple">
                          <Thead>
                            <Tr>
                              <Th>Cluster Name</Th>
                              <Th>Cohort Size Range</Th>
                              <Th>Color Badge</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {clusterTiers.map((tier) => (
                              <Tr key={tier.name} bg={tier.name === clusterDisplayName ? clusterHighlightBg : 'transparent'}>
                                <Td>
                                  {tier.shortName}
                                </Td>
                                <Td>{tier.rangeLabel} users</Td>
                                <Td>
                                  <Badge colorScheme={tier.colorScheme} variant="subtle">
                                    {tier.shortName}
                                  </Badge>
                                </Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                        <Box mt={4}>
                          <Text fontSize="sm" fontWeight="semibold" mb={2}>
                            Cluster progression
                          </Text>
                          <Box position="relative" h="10px" bg="gray.200" borderRadius="full" overflow="hidden">
                            <Flex h="100%">
                              {clusterTiers.map((tier) => {
                                const rangeMax = tier.max ?? clusterProgressMax
                                const rangeStart = Math.max(tier.min, 1)
                                const cappedMax = Math.min(rangeMax, clusterProgressMax)
                                const widthPercent =
                                  ((cappedMax - rangeStart + 1) / clusterProgressMax) * 100
                                return (
                                  <Box
                                    key={tier.name}
                                    w={`${widthPercent}%`}
                                    bg={`${tier.colorScheme}.400`}
                                  />
                                )
                              })}
                            </Flex>
                            {clusterBoundaries.map((boundary) => {
                              const left = `${(boundary / clusterProgressMax) * 100}%`
                              const boundaryTierName =
                                clusterTiers.find((tier) => tier.min === boundary)?.shortName ?? 'New tier'
                              return (
                                <Tooltip
                                  key={boundary}
                                  label={`${boundary} users: ${boundaryTierName} begins`}
                                  placement="top"
                                >
                                  <Box
                                    position="absolute"
                                    top="-4px"
                                    left={left}
                                    transform="translateX(-50%)"
                                    w="2px"
                                    h="18px"
                                    bg="gray.600"
                                  />
                                </Tooltip>
                              )
                            })}
                            {hasValidTeamSize ? (
                              <Tooltip label={`${form.teamSize} users`} placement="top">
                                <Box
                                  position="absolute"
                                  top="-7px"
                                  left={`${clusterProgressPercent}%`}
                                  transform="translateX(-50%)"
                                  w="18px"
                                  h="18px"
                                  bg="white"
                                  borderWidth="2px"
                                  borderColor={`${clusterTier.colorScheme}.500`}
                                  borderRadius="full"
                                />
                              </Tooltip>
                            ) : null}
                          </Box>
                          <Grid templateColumns="repeat(5, 1fr)" mt={2} fontSize="xs" color="gray.600">
                            {clusterTiers.map((tier) => (
                              <Text key={tier.name} textAlign="center">
                                {tier.shortName}
                              </Text>
                            ))}
                          </Grid>
                          <HStack justify="space-between" mt={1} fontSize="xs" color="gray.500">
                            <Text>1-3</Text>
                            <Text>4</Text>
                            <Text>11</Text>
                            <Text>21</Text>
                            <Text>41+</Text>
                          </HStack>
                        </Box>
                      </AccordionPanel>
                    </AccordionItem>
                  </Accordion>
                </GridItem>
              </Grid>

              <Box>
                <Text fontWeight="medium" mb={2}>
                  {assignmentSectionLabel}
                </Text>
                {courseLimit === 0 ? (
                  <Text fontSize="sm" color="gray.600">
                    Select a program duration to enable {assignmentUnit} assignments.
                  </Text>
                ) : null}
                <Stack spacing={3}>
                  {Array.from({ length: courseLimit }, (_, index) => {
                    const monthNumber = index + 1
                    const monthKey = String(monthNumber)
                    const assignedCourse = monthlyAssignments[monthKey] || ''
                    const dateRange = cohortStartDate
                      ? (() => {
                          const { startDate, endDate } = getProgramSegmentDateRange({
                            cohortStartDate,
                            segmentIndex: index,
                            cadence: programCadence,
                          })
                          return formatMonthRange(startDate, endDate)
                        })()
                      : undefined
                    const isEmpty = !assignedCourse
                    return (
                      <Box key={monthKey} borderWidth="1px" borderRadius="lg" p={3} bg="gray.50">
                        <Flex justify="space-between" align="center" mb={2}>
                          <HStack spacing={2}>
                            <Badge colorScheme={isEmpty ? 'red' : 'green'} borderRadius="full">
                              {getProgramSegmentLabel(monthNumber, programCadence)}
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
                          {sortedCourses.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.title}
                            </option>
                          ))}
                        </Select>
                        {isEmpty && (
                          <Text fontSize="xs" color="red.500" mt={2}>
                            Course assignment required for this {assignmentUnit}.
                          </Text>
                        )}
                      </Box>
                    )
                  })}
                </Stack>
                <Text mt={2} fontSize="sm" color={remainingCourses > 0 ? 'gray.600' : 'green.500'}>
                  {courseLimit === 0
                    ? `Select a program duration to assign courses to ${assignmentUnitPlural}`
                    : `${Math.max(remainingCourses, 0)} course(s) remaining to assign`}
                </Text>
                {duplicateCourses.length > 0 && (
                  <Alert status="warning" mt={3} borderRadius="md">
                    <AlertIcon />
                    Duplicate courses assigned for multiple {assignmentUnitPlural}: {duplicateCourses.join(', ')}.
                  </Alert>
                )}
                {emptyMonths.length > 0 && courseLimit > 0 && (
                  <Alert status="error" mt={3} borderRadius="md">
                    <AlertIcon />
                    {emptyMonths.length} {assignmentUnit}(s) still need course assignments.
                  </Alert>
                )}
                {courseLimit > 0 && (
                  <Box mt={4} borderWidth="1px" borderRadius="lg" p={3} bg="white">
                    <HStack justify="space-between" mb={2}>
                      <Text fontWeight="semibold">{assignmentBreakdownLabel}</Text>
                      <HStack spacing={2} color="purple.600">
                        <Eye size={16} />
                        <Text fontSize="sm">Admin preview</Text>
                      </HStack>
                    </HStack>
                    <Text fontSize="sm" color="gray.600" mb={3}>
                      Cluster assignment: {clusterDisplayName}
                    </Text>
                    <Stack spacing={2}>
                      {monthlySummary.map((entry) => (
                        <Flex key={entry.month} justify="space-between" align="center">
                          <Text fontWeight="medium">{getProgramSegmentLabel(entry.month, programCadence)}</Text>
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
                        const availability = getProgramSegmentAvailabilityStatus({
                          cohortStartDate,
                          currentDate: new Date(),
                          segmentIndex: index,
                          cadence: programCadence,
                        })
                        const label =
                          availability === 'current'
                            ? (programCadence === 'biweekly' ? 'Current window' : 'Current month')
                            : availability === 'completed'
                              ? 'Completed'
                              : 'Locked'
                        return (
                          <Flex key={monthNumber} justify="space-between" align="center" p={2} bg="white" borderRadius="md">
                            <Text fontWeight="medium">{getProgramSegmentLabel(monthNumber, programCadence)}</Text>
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

              <Box>
                <Text fontWeight="medium" mb={2}>
                  User addition
                </Text>
                <Stack spacing={3}>
                  <FormControl>
                    <FormLabel>Upload CSV</FormLabel>
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        void handleInviteFile(file)
                        e.target.value = ''
                      }}
                    />
                    <FormHelperText>
                      Use columns: Email, Role.
                      <Button variant="link" size="sm" ml={2} onClick={downloadCSVTemplate}>
                        Download template
                      </Button>
                    </FormHelperText>
                  </FormControl>
                  {lastImportCount > 0 ? (
                    <Alert status="info" borderRadius="md">
                      <AlertIcon />
                      Review {lastImportCount} imported user{lastImportCount === 1 ? '' : 's'} in the table below.
                    </Alert>
                  ) : null}
                  <Box borderWidth="1px" borderRadius="md" p={4} bg="gray.50">
                     <Text fontWeight="semibold" mb={3}>
                       Add user manually
                     </Text>
                     <Grid
                      templateColumns={{ base: '1fr', lg: '2fr 1.3fr auto' }}
                      gap={3}
                      alignItems="flex-end"
                    >
                      <FormControl isRequired isInvalid={Boolean(manualErrors.email)}>
                        <FormLabel display="flex" alignItems="center" gap={2}>
                          Email
                          <Tooltip label="A valid email is required. Users set their own profile name during signup.">
                            <InfoIcon color="text.muted" />
                          </Tooltip>
                        </FormLabel>
                        <Input
                          value={manualEntry.email}
                          onChange={(e) => {
                            const rawEmail = e.target.value
                            const nextEntry = { ...manualEntry, email: rawEmail }
                            setManualEntry(nextEntry)
                            validateManualEntry(nextEntry)
                          }}
                          placeholder="jane.doe@example.com"
                          list="email-domains"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddManualEntry()
                            }
                          }}
                        />
                        <datalist id="email-domains">
                          {commonEmailDomains.map((domain) => (
                            <option key={domain} value={`@${domain}`} />
                          ))}
                        </datalist>
                        <FormHelperText>Email invitations only.</FormHelperText>
                        <FormErrorMessage>{manualErrors.email}</FormErrorMessage>
                      </FormControl>
                      <FormControl isInvalid={Boolean(manualErrors.role)}>
                        <FormLabel display="flex" alignItems="center" gap={2}>
                          Role
                          <Tooltip label="Assign the user role for the invitation.">
                            <InfoIcon color="text.muted" />
                          </Tooltip>
                        </FormLabel>
                        <Select
                          value={manualEntry.role}
                          onChange={(e) => {
                            const nextEntry = { ...manualEntry, role: e.target.value as InviteDraft['role'] }
                            setManualEntry(nextEntry)
                            validateManualEntry(nextEntry)
                          }}
                        >
                          {inviteRoleOptions.map((role) => (
                            <option key={role} value={role}>
                              {formatInviteRoleLabel(role)}
                            </option>
                          ))}
                        </Select>
                        <FormErrorMessage>{manualErrors.role}</FormErrorMessage>
                      </FormControl>
                      <Button colorScheme="purple" onClick={handleAddManualEntry} alignSelf="flex-end">
                        Add user
                      </Button>
                    </Grid>
                  </Box>
                  {inviteError ? (
                    <Alert status="error" borderRadius="md">
                      <AlertIcon />
                      {inviteError}
                    </Alert>
                  ) : null}
                  <Box borderWidth="1px" borderRadius="md" p={4} bg="white">
                    <HStack justify="space-between" mb={3} flexWrap="wrap">
                      <Text fontWeight="semibold">Invitation drafts</Text>
                      <HStack spacing={2}>
                        <Badge colorScheme="purple">Total: {inviteStats.total}</Badge>
                        <Badge colorScheme="green">Valid: {inviteStats.valid}</Badge>
                        <Badge colorScheme={inviteStats.invalid ? 'red' : 'gray'}>
                          Errors: {inviteStats.invalid}
                        </Badge>
                      </HStack>
                    </HStack>
                    {inviteStats.invalid ? (
                      <Alert status="error" mb={3} borderRadius="md">
                        <AlertIcon />
                        Fix validation errors before submitting the invitation list.
                      </Alert>
                    ) : null}
                    {inviteDrafts.length ? (
                      <>
                        <HStack spacing={3} mb={3} flexWrap="wrap">
                          <Checkbox
                            isChecked={selectedDraftIds.length === inviteDrafts.length && inviteDrafts.length > 0}
                            onChange={(e) => {
                              setSelectedDraftIds(e.target.checked ? inviteDrafts.map((draft) => draft.id) : [])
                            }}
                          >
                            Select all
                          </Checkbox>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (selectedDraftIds.length) bulkDeleteDialog.onOpen()
                            }}
                            isDisabled={!selectedDraftIds.length}
                          >
                            Delete selected ({selectedDraftIds.length})
                          </Button>
                          <Select
                            size="sm"
                            maxW="180px"
                            placeholder="Change role"
                            onChange={(e) => {
                              const role = e.target.value as InviteDraft['role']
                              if (!role || !selectedDraftIds.length) return
                              setInviteDrafts((prev) =>
                                recomputeInviteDrafts(
                                  prev.map((draft) =>
                                    selectedDraftIds.includes(draft.id) ? { ...draft, role } : draft,
                                  ),
                                ),
                              )
                            }}
                          >
                            {inviteRoleOptions.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </Select>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (inviteDrafts.length) clearAllDialog.onOpen()
                            }}
                            isDisabled={!inviteDrafts.length}
                          >
                            Clear all
                          </Button>
                        </HStack>
                        <Box overflowX="auto">
                          <Table size="sm" variant="simple">
                            <Thead>
                              <Tr>
                                <Th>#</Th>
                                <Th>Select</Th>
                                <Th>Email</Th>
                                <Th>Role</Th>
                                <Th>Status</Th>
                                <Th>Actions</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {inviteDrafts.map((draft, index) => {
                                const hasErrors = !draft.isValid
                                const isHighlighted = recentImportIds.includes(draft.id)
                                return (
                                  <Tr
                                    key={draft.id}
                                    bg={hasErrors ? 'red.50' : isHighlighted ? 'blue.50' : 'transparent'}
                                  >
                                    <Td>{index + 1}</Td>
                                    <Td>
                                      <Checkbox
                                        isChecked={selectedDraftIds.includes(draft.id)}
                                        onChange={(e) => {
                                          setSelectedDraftIds((prev) =>
                                            e.target.checked
                                              ? [...prev, draft.id]
                                              : prev.filter((id) => id !== draft.id),
                                          )
                                        }}
                                      />
                                    </Td>
                                    <Td>
                                      <Editable
                                        value={draft.email}
                                        onChange={(value) => updateDraftField(draft.id, 'email', value)}
                                      >
                                        <EditablePreview />
                                        <EditableInput />
                                      </Editable>
                                      {draft.errors.email ? (
                                        <Text fontSize="xs" color="red.500">
                                          {draft.errors.email}
                                        </Text>
                                      ) : null}
                                    </Td>
                                    <Td>
                                      <Select
                                        size="sm"
                                        value={draft.role}
                                        onChange={(e) => updateDraftField(draft.id, 'role', e.target.value)}
                                      >
                                        {inviteRoleOptions.map((role) => (
                                          <option key={role} value={role}>
                                            {formatInviteRoleLabel(role)}
                                          </option>
                                        ))}
                                      </Select>
                                      {draft.errors.role ? (
                                        <Text fontSize="xs" color="red.500">
                                          {draft.errors.role}
                                        </Text>
                                      ) : null}
                                    </Td>
                                    <Td>
                                      <Badge colorScheme={draft.isValid ? 'green' : 'red'}>
                                        {draft.isValid ? 'Valid' : 'Needs review'}
                                      </Badge>
                                    </Td>
                                    <Td>
                                      <Button size="xs" variant="ghost" onClick={() => removeDrafts([draft.id])}>
                                        Delete
                                      </Button>
                                    </Td>
                                  </Tr>
                                )
                              })}
                            </Tbody>
                          </Table>
                        </Box>
                      </>
                    ) : (
                      <Text fontSize="sm" color="gray.600">
                        No users added yet.
                      </Text>
                    )}
                  </Box>
                </Stack>
              </Box>

              <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
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

      <AlertDialog
        isOpen={bulkDeleteDialog.isOpen}
        leastDestructiveRef={bulkDeleteCancelRef}
        onClose={bulkDeleteDialog.onClose}
      >
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader>Delete selected invitations?</AlertDialogHeader>
          <AlertDialogBody>
            This will remove {selectedDraftIds.length} selected invitation draft
            {selectedDraftIds.length === 1 ? '' : 's'}.
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={bulkDeleteCancelRef} onClick={bulkDeleteDialog.onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="red"
              ml={3}
              onClick={() => {
                removeDrafts(selectedDraftIds)
                bulkDeleteDialog.onClose()
              }}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        isOpen={clearAllDialog.isOpen}
        leastDestructiveRef={clearAllCancelRef}
        onClose={clearAllDialog.onClose}
      >
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader>Clear all invitation drafts?</AlertDialogHeader>
          <AlertDialogBody>This will remove all invitation drafts currently in the list.</AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={clearAllCancelRef} onClick={clearAllDialog.onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="red"
              ml={3}
              onClick={() => {
                setInviteDrafts([])
                setSelectedDraftIds([])
                setRecentImportIds([])
                setLastImportCount(0)
                clearAllDialog.onClose()
              }}
            >
              Clear all
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InvitationResultsModal isOpen={resultsModal.isOpen} onClose={resultsModal.onClose} result={results} />
    </>
  )
}
