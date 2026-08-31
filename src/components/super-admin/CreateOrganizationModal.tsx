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
import { ClusterProgressionGuide } from '@/components/super-admin/ClusterProgressionGuide'
import {
  BulkInvitationResult,
  CourseOption,
  InviteDraft,
  OrganizationRecord,
  ProgramDurationOption,
} from '@/types/admin'
import {
  determineClusterFromTeamSize,
  fetchAvailableCourses,
  generateOrganizationCode,
} from '@/services/organizationService'
import { createOrganization as createSupabaseOrganization, inviteOrgMember, assertEmailAvailableForRole, roleConflictBucket, formatRoleConflictLabel } from '@/services/supabaseOrgService'
import { InvitationResultsModal } from './InvitationResultsModal'
import {
  MonthlyCourseAssignments,
  buildMonthlyAssignmentsFromArray,
  buildMonthlyAssignmentsSummary,
  computeProgramEndDateInputValue,
  formatMonthRange,
  getAssignedCourseIdsFromMonthlyAssignments,
  getProgramSegmentAvailabilityStatus,
  getProgramSegmentDateRange,
  getProgramSegmentLabel,
  resolveProgramCadence,
} from '@/utils/monthlyCourseAssignments'
import { downloadCSVTemplate, parseInvitationCSV } from '@/utils/csvUtils'
import { normalizeEmail } from '@/utils/email'
import {
  clusterBoundaries,
  clusterTiers,
  getClusterDisplayName,
  getClusterShortName,
  getClusterTierByName,
} from '@/utils/clusterTiers'
import {
  PILLAR_COURSE_PLAN,
  PILLAR_METADATA,
  PILLAR_OPTIONS,
  formatPillarWeekRange,
  type Pillar,
} from '@/types/pillar'
import {
  getMonthlyJourneyCourseOptions,
  isMonthlyJourneyDuration,
  evaluateSinglePillarCourseSet,
  wouldCreateSinglePillarCourseSet,
} from '@/config/courseCatalogue'
import { resolveJourneyType } from '@/utils/journeyType'

interface CreateOrganizationModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (organization: OrganizationRecord) => void
  adminName?: string
  adminId?: string
}

const programDurations: ProgramDurationOption[] = [
  { value: 1.5, label: '6 weeks (2 x 3-week windows)', courseCount: 2 },
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
}) => {
  const toast = useToast()
  const [form, setForm] = useState<OrganizationRecord>(emptyOrganization)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Seed from the T4L catalogue so 3M+ dropdowns never render empty while
  // Firestore/network course fetch is in flight or fails.
  const [courses, setCourses] = useState<CourseOption[]>(() => getMonthlyJourneyCourseOptions())
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
  // Transformation partner (existing user) to assign on create.
  const [partnerEmail, setPartnerEmail] = useState('')

  useEffect(() => {
    if (!isOpen) setPartnerEmail('')
  }, [isOpen])
  const [lastImportCount, setLastImportCount] = useState(0)
  const bulkDeleteDialog = useDisclosure()
  const clearAllDialog = useDisclosure()
  const bulkDeleteCancelRef = React.useRef<HTMLButtonElement | null>(null)
  const clearAllCancelRef = React.useRef<HTMLButtonElement | null>(null)
  const resultsModal = useDisclosure()

  const courseLimit = useMemo(() => {
    const duration = Number(form.programDuration)
    if (!Number.isFinite(duration)) return 0
    const option = programDurations.find(
      (entry) => entry.value === duration || Math.abs(entry.value - duration) < 0.0001,
    )
    return option?.courseCount ?? 0
  }, [form.programDuration])
  const programCadence = useMemo(() => resolveProgramCadence(form.programDuration), [form.programDuration])
  const assignmentUnit = programCadence === 'biweekly' ? 'window' : 'month'
  const assignmentUnitPlural = programCadence === 'biweekly' ? 'windows' : 'months'
  const assignmentSectionLabel = programCadence === 'biweekly' ? '3-week window course assignments' : 'Monthly course assignments'
  // Show course slots for every paid duration (6W + 3M/6M/9M). 6W is pillar-
  // driven; month-based journeys pick from the T4L catalogue.
  const isMonthlyJourney = isMonthlyJourneyDuration(form.programDuration)
  const showCourseAssignments = courseLimit > 0
  const assignmentBreakdownLabel = programCadence === 'biweekly' ? 'Cycle breakdown summary' : 'Monthly breakdown summary'

  const remainingCourses = courseLimit - getAssignedCourseIdsFromMonthlyAssignments(monthlyAssignments, courseLimit).length
  const codeLength = form.code.trim().length
  const isCodeValidLength = codeLength === 6
  const cohortStartDate = useMemo(
    () => (form.cohortStartDate ? new Date(String(form.cohortStartDate)) : null),
    [form.cohortStartDate],
  )
  const programEndDate = useMemo(
    () =>
      computeProgramEndDateInputValue(
        form.cohortStartDate ? String(form.cohortStartDate) : '',
        form.programDuration,
      ),
    [form.cohortStartDate, form.programDuration],
  )
  const sortedCourses = useMemo(() => {
    const catalogue = getMonthlyJourneyCourseOptions()
    // 3M / 6M / 9M: always the curated catalogue (1 course per month).
    if (isMonthlyJourney) return catalogue
    const fromFetch = [...courses].sort((a, b) => a.title.localeCompare(b.title))
    // Never leave the Select empty if the async course fetch fails.
    return fromFetch.length ? fromFetch : catalogue
  }, [courses, isMonthlyJourney])
  const courseTitleById = useMemo(() => {
    const map = new Map<string, string>()
    sortedCourses.forEach((course) => map.set(course.id, course.title))
    courses.forEach((course) => {
      if (!map.has(course.id)) map.set(course.id, course.title)
    })
    return map
  }, [courses, sortedCourses])
  const monthlySummary = useMemo(
    () =>
      buildMonthlyAssignmentsSummary({
        monthlyAssignments,
        totalMonths: courseLimit,
        courseTitleLookup: (courseId) => courseTitleById.get(courseId) || courseId,
      }),
    [monthlyAssignments, courseLimit, courseTitleById],
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
  const singlePillarCourseSet = useMemo(
    () => (isMonthlyJourney ? evaluateSinglePillarCourseSet(monthlyAssignments) : { blocked: false }),
    [isMonthlyJourney, monthlyAssignments],
  )
  const inviteStats = useMemo(() => {
    const total = inviteDrafts.length
    const valid = inviteDrafts.filter((draft) => draft.isValid).length
    const invalid = total - valid
    return { total, valid, invalid }
  }, [inviteDrafts])

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
      setCourses(getMonthlyJourneyCourseOptions())
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
        setCourses(courseOptions.length ? courseOptions : getMonthlyJourneyCourseOptions())
      } catch (error) {
        console.error(error)
        setCourses(getMonthlyJourneyCourseOptions())
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
    if (isMonthlyJourney && courseId) {
      const check = wouldCreateSinglePillarCourseSet({
        assignments: monthlyAssignments,
        monthKey,
        nextCourseId: courseId,
      })
      if (check.blocked) {
        toast({
          title: 'Pillar mix required',
          description:
            check.message ??
            'All courses cannot belong to the same pillar. Pick at least one from a different pillar.',
          status: 'warning',
          duration: 6000,
          isClosable: true,
        })
        return
      }
    }
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
      if (!form.programDuration) throw new Error('Program duration is required')
      if (form.programDuration === 1.5 && !form.pillar) {
        throw new Error('Pillar is required for the 6-week journey')
      }

      // Prefer pillar plan for 6W so DB always gets the two course ids even if
      // local assignment state was cleared by a duration remount.
      let assignmentsToSave = { ...monthlyAssignments }
      if (form.programDuration === 1.5 && form.pillar) {
        const plan = PILLAR_COURSE_PLAN[form.pillar]
        assignmentsToSave = {
          '1': plan[0].courseId,
          '2': plan[1].courseId,
        }
      }

      const missingMonths = Array.from({ length: courseLimit }, (_, index) => index + 1).filter(
        (month) => !assignmentsToSave[String(month)],
      )
      if (missingMonths.length) {
        throw new Error(
          form.programDuration === 1.5
            ? 'Select a pillar so both 6-week courses are assigned'
            : `Assign a course for every month (${missingMonths.length} still empty)`,
        )
      }
      if (form.programDuration !== 1.5) {
        const pillarMix = evaluateSinglePillarCourseSet(assignmentsToSave)
        if (pillarMix.blocked) {
          throw new Error(
            pillarMix.message ??
              'All courses cannot belong to the same pillar. Pick at least one from a different pillar.',
          )
        }
      }
      if (!form.teamSize || form.teamSize <= 0) {
        throw new Error('Cohort size must be greater than 0 to assign a cluster')
      }
      if (inviteDrafts.some((draft) => !draft.isValid)) {
        throw new Error('Resolve invitation errors before submitting.')
      }

      const partnerEmailNormalized = partnerEmail.trim().toLowerCase()
      if (partnerEmailNormalized && !emailRegex.test(partnerEmailNormalized)) {
        throw new Error('Transformation partner email is invalid')
      }

      // Block same-form conflicts (e.g. partner email also invited as User).
      if (partnerEmailNormalized) {
        const conflictDraft = inviteDrafts.find(
          (draft) =>
            draft.isValid &&
            draft.email.trim().toLowerCase() === partnerEmailNormalized &&
            roleConflictBucket(draft.role) !== 'partner',
        )
        if (conflictDraft) {
          throw new Error(
            `${partnerEmailNormalized} is listed as ${formatRoleConflictLabel(conflictDraft.role)} in User addition. ` +
              `Don't use this email for a different role (Partner).`,
          )
        }
      }

      // Preflight role conflicts against existing accounts / pending invites
      // before creating the org, so the admin sees a clear error immediately.
      if (partnerEmailNormalized) {
        await assertEmailAvailableForRole(partnerEmailNormalized, 'partner')
      }
      for (const draft of inviteDrafts.filter((d) => d.isValid && d.email.trim())) {
        await assertEmailAvailableForRole(draft.email, draft.role)
      }

      setIsSubmitting(true)

      // Create the organization in Supabase. (The old Firebase path hung under
      // Supabase auth - that's why the button did nothing.)
      const programDurationWeeks = form.programDuration ? Math.round(form.programDuration * 4) : null
      const resolvedJourneyType =
        resolveJourneyType({
          journeyType: form.organizationJourneyType,
          programDurationWeeks,
          programDuration: form.programDuration,
        }) ?? null
      // Ordered course array derived from the per-month assignment map, kept for
      // consumers that read the flat `courseAssignments` array.
      const orderedCourseAssignments = Array.from({ length: courseLimit }, (_, index) =>
        assignmentsToSave[String(index + 1)] || '',
      )
      const created = await createSupabaseOrganization({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        // New orgs are created Active (the Status field was removed from this
        // modal). Always send 'active' to satisfy organizations_status_check.
        status: 'active',
        journeyType: resolvedJourneyType,
        programDurationWeeks,
        cohortStartDate: form.cohortStartDate ? String(form.cohortStartDate) : null,
        programEnd: programEndDate || null,
        village: form.village ?? null,
        cluster: form.cluster ?? null,
        pillar: form.programDuration === 1.5 ? form.pillar ?? null : null,
        teamSize: form.teamSize ?? null,
        programDurationMonths: form.programDuration ?? null,
        partnerEmail: partnerEmail.trim() || null,
        monthlyCourseAssignments: assignmentsToSave,
        courseAssignments: orderedCourseAssignments,
        courseAssignmentStructure: 'monthly',
      })

      const now = new Date()
      const organizationWithId: OrganizationRecord = {
        ...form,
        id: created.id,
        code: form.code.toUpperCase(),
        organizationJourneyType: resolvedJourneyType ?? undefined,
        programDurationWeeks: programDurationWeeks ?? undefined,
        programEnd: programEndDate || undefined,
        pillar: form.programDuration === 1.5 ? form.pillar : undefined,
        monthlyCourseAssignments: assignmentsToSave,
        courseAssignments: orderedCourseAssignments,
        courseAssignmentStructure: 'monthly',
        assignedPartnerEmail: partnerEmail.trim() || undefined,
        // If the partner email matched an existing user, createOrganization
        // links them and returns the id - carry it so the new row shows the
        // partner immediately instead of "Unassigned".
        transformationPartnerId: created.transformationPartnerId ?? undefined,
        createdAt: now,
        updatedAt: now,
      }
      if (onCreated) {
        try {
          await onCreated(organizationWithId)
        } catch (onCreatedError) {
          console.error('[CreateOrganizationModal] post-create callback failed', onCreatedError)
        }
      }

      // Add the invited members to the org. Existing accounts are enrolled into
      // the org's paid journey immediately; new emails become pending invites
      // that enroll automatically when they sign up with that email.
      const validDrafts = inviteDrafts.filter((draft) => draft.isValid && draft.email.trim())
      let invitedNow = 0
      let invitedPending = 0
      const failedInvites: string[] = []
      for (const draft of validDrafts) {
        const result = await inviteOrgMember(created.id, draft.email, draft.role)
        if (result.ok) {
          if (result.status === 'enrolled') invitedNow += 1
          else invitedPending += 1
        } else {
          // Never let a failed invite hide behind a green toast: collect it so
          // the admin is told exactly which emails did not get added.
          failedInvites.push(
            result.error
              ? `${draft.email} (${result.error})`
              : draft.email,
          )
          console.warn('[CreateOrganizationModal] invite failed', draft.email, result.error)
        }
      }

      const inviteSummary =
        validDrafts.length > 0
          ? `${invitedNow} member(s) enrolled now, ${invitedPending} will join on signup.` +
            (failedInvites.length
              ? ` ${failedInvites.length} invite(s) FAILED: ${failedInvites.join(', ')}`
              : '')
          : `Cluster: ${clusterDisplayName}`
      toast({
        title: failedInvites.length
          ? 'Organization created, but some invites failed'
          : 'Organization created successfully',
        description: inviteSummary,
        status: failedInvites.length ? 'warning' : 'success',
        duration: failedInvites.length ? 12000 : 5000,
        isClosable: true,
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
      <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="outside">
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
                      onChange={(e) => {
                        const next = Number(e.target.value)
                        const previous = form.programDuration
                        updateField('programDuration', next)
                        if (next !== 1.5) updateField('pillar', undefined)
                        // Switching 6W ↔ 3M/6M/9M must not keep old pillar course picks.
                        if (next !== previous) setMonthlyAssignments({})
                      }}
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
                {form.programDuration === 1.5 ? (
                  <GridItem colSpan={{ base: 1, md: 2 }}>
                    <FormControl isRequired isInvalid={!form.pillar}>
                      <FormLabel display="flex" alignItems="center" gap={2}>
                        Power Journey pillar
                        <Tooltip
                          label="Each pillar splits the 6 weeks differently. The pillar determines course content and the notification schedule learners receive."
                          placement="top"
                        >
                          <InfoIcon color="text.muted" />
                        </Tooltip>
                      </FormLabel>
                      <Select
                        placeholder="Select pillar"
                        value={form.pillar || ''}
                        onChange={(e) => {
                          const nextPillar = (e.target.value as Pillar) || undefined
                          updateField('pillar', nextPillar)
                          if (nextPillar) {
                            const plan = PILLAR_COURSE_PLAN[nextPillar]
                            setMonthlyAssignments({
                              '1': plan[0].courseId,
                              '2': plan[1].courseId,
                            })
                          }
                        }}
                      >
                        {PILLAR_OPTIONS.map((value) => (
                          <option key={value} value={value}>
                            {PILLAR_METADATA[value].label}
                          </option>
                        ))}
                      </Select>
                      {form.pillar ? (
                        <FormHelperText>
                          Auto-assigned courses:{' '}
                          <strong>{PILLAR_COURSE_PLAN[form.pillar][0].title}</strong>{' '}
                          ({formatPillarWeekRange(PILLAR_COURSE_PLAN[form.pillar][0].weekRange)})
                          {' + '}
                          <strong>{PILLAR_COURSE_PLAN[form.pillar][1].title}</strong>{' '}
                          ({formatPillarWeekRange(PILLAR_COURSE_PLAN[form.pillar][1].weekRange)})
                        </FormHelperText>
                      ) : (
                        <FormHelperText color="orange.600">
                          Pillar is required for 6-week cohorts.
                        </FormHelperText>
                      )}
                      <FormErrorMessage>Pillar is required for the 6-week journey.</FormErrorMessage>
                    </FormControl>
                  </GridItem>
                ) : null}
                {showCourseAssignments ? (
                  <GridItem colSpan={{ base: 1, md: 2 }}>
                    <Box
                      borderWidth="1px"
                      borderRadius="lg"
                      p={4}
                      bg="gray.50"
                      borderColor="gray.200"
                    >
                      <Text fontWeight="medium" mb={1}>
                        {assignmentSectionLabel}
                      </Text>
                      <Text fontSize="sm" color="gray.600" mb={3}>
                        {isMonthlyJourney
                          ? `Assign exactly ${courseLimit} courses (1 per month). Open each dropdown and pick from the T4L catalogue. At least two pillars must be represented - all courses cannot be from the same pillar.`
                          : '6-week courses are assigned automatically from the selected pillar and saved to the organization. Window 1 is shown first to learners.'}
                      </Text>
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
                          const isPillarLocked = Boolean(form.pillar && form.programDuration === 1.5)
                          const pillarPlanEntry =
                            isPillarLocked && form.pillar
                              ? PILLAR_COURSE_PLAN[form.pillar][index]
                              : null
                          const selectValue = pillarPlanEntry?.courseId || assignedCourse
                          const courseOptions =
                            sortedCourses.length > 0
                              ? sortedCourses
                              : getMonthlyJourneyCourseOptions()
                          return (
                            <Box key={monthKey} borderWidth="1px" borderRadius="lg" p={3} bg="white">
                              <Flex justify="space-between" align="center" mb={2}>
                                <HStack spacing={2}>
                                  <Badge colorScheme={!selectValue ? 'red' : 'green'} borderRadius="full">
                                    {pillarPlanEntry
                                      ? formatPillarWeekRange(pillarPlanEntry.weekRange)
                                      : `Course ${monthNumber} of ${courseLimit}`}
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
                                    isDisabled={isPillarLocked || index === 0}
                                    variant="ghost"
                                  />
                                  <IconButton
                                    aria-label="Move course down"
                                    size="sm"
                                    icon={<ChevronDown size={16} />}
                                    onClick={() => swapMonthlyAssignments(index, index + 1)}
                                    isDisabled={isPillarLocked || index === courseLimit - 1}
                                    variant="ghost"
                                  />
                                </HStack>
                              </Flex>
                              <Select
                                placeholder={isPillarLocked ? undefined : 'Select course'}
                                value={selectValue}
                                onChange={(e) => handleMonthlyAssignmentChange(monthKey, e.target.value)}
                                bg="white"
                                color="gray.900"
                                isDisabled={isPillarLocked}
                                opacity={1}
                                _disabled={{
                                  color: 'gray.900',
                                  opacity: 1,
                                  cursor: 'not-allowed',
                                  bg: 'white',
                                }}
                              >
                                {courseOptions.map((course) => (
                                  <option key={course.id} value={course.id}>
                                    {course.title}
                                  </option>
                                ))}
                              </Select>
                              {isEmpty && !isPillarLocked && (
                                <Text fontSize="xs" color="red.500" mt={2}>
                                  Course assignment required for this {assignmentUnit}.
                                </Text>
                              )}
                              {isPillarLocked && pillarPlanEntry ? (
                                <Text fontSize="xs" color="gray.600" mt={2}>
                                  Auto-assigned from pillar: {pillarPlanEntry.title}
                                </Text>
                              ) : null}
                              {!isPillarLocked && courseOptions.length === 0 ? (
                                <Text fontSize="xs" color="red.500" mt={2}>
                                  No courses available in the catalogue.
                                </Text>
                              ) : null}
                            </Box>
                          )
                        })}
                      </Stack>
                      <Text mt={2} fontSize="sm" color={remainingCourses > 0 ? 'gray.600' : 'green.500'}>
                        {`${Math.max(remainingCourses, 0)} course(s) remaining to assign`}
                      </Text>
                      {duplicateCourses.length > 0 && (
                        <Alert status="warning" mt={3} borderRadius="md">
                          <AlertIcon />
                          Duplicate courses assigned for multiple {assignmentUnitPlural}:{' '}
                          {duplicateCourses.join(', ')}.
                        </Alert>
                      )}
                      {emptyMonths.length > 0 && courseLimit > 0 && (
                        <Alert status="error" mt={3} borderRadius="md">
                          <AlertIcon />
                          {emptyMonths.length} {assignmentUnit}(s) still need course assignments.
                        </Alert>
                      )}
                      {singlePillarCourseSet.blocked && (
                        <Alert status="error" mt={3} borderRadius="md">
                          <AlertIcon />
                          {singlePillarCourseSet.message}
                        </Alert>
                      )}
                    </Box>
                  </GridItem>
                ) : null}
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
                <GridItem>
                  <FormControl>
                    <FormLabel>Program end date</FormLabel>
                    <Input type="date" value={programEndDate} isReadOnly bg="gray.50" />
                    <FormHelperText>
                      Auto-calculated from cohort start date and program duration.
                    </FormHelperText>
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
                        <ClusterProgressionGuide
                          teamSize={form.teamSize || 0}
                          clusterName={form.cluster || clusterDisplayName}
                        />
                      </AccordionPanel>
                    </AccordionItem>
                  </Accordion>
                </GridItem>
              </Grid>

              {showCourseAssignments && courseLimit > 0 && (
                <Box>
                  <Box borderWidth="1px" borderRadius="lg" p={3} bg="white">
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
                            ? programCadence === 'biweekly'
                              ? 'Current window'
                              : 'Current month'
                            : availability === 'completed'
                              ? 'Completed'
                              : availability === 'past'
                                ? 'Ended'
                                : 'Locked'
                        return (
                          <Flex
                            key={monthNumber}
                            justify="space-between"
                            align="center"
                            p={2}
                            bg="white"
                            borderRadius="md"
                          >
                            <Text fontWeight="medium">
                              {getProgramSegmentLabel(monthNumber, programCadence)}
                            </Text>
                            <HStack spacing={2}>
                              <Badge
                                colorScheme={
                                  availability === 'current'
                                    ? 'green'
                                    : availability === 'completed'
                                      ? 'purple'
                                      : availability === 'past'
                                        ? 'orange'
                                        : 'gray'
                                }
                              >
                                {label}
                              </Badge>
                              <Text fontSize="sm" color="gray.600">
                                {courseId ? courseTitleById.get(courseId) || courseId : 'Unassigned'}
                              </Text>
                            </HStack>
                          </Flex>
                        )
                      })}
                    </Stack>
                  </Box>
                </Box>
              )}

              <Box>
                <FormControl>
                  <FormLabel display="flex" alignItems="center" gap={2}>
                    Transformation partner email
                  </FormLabel>
                  <Input
                    type="email"
                    placeholder="partner@example.com"
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                  />
                  <FormHelperText>
                    Assign the partner by email. Only this email can sign up as the partner for this organization
                    (a partner can be assigned to several). Leave blank to assign later.
                  </FormHelperText>
                </FormControl>
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
                      templateColumns={{ base: '1fr', md: '2fr 1.4fr auto' }}
                      gap={3}
                      alignItems="start"
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
                      <Box>
                        {/* invisible label keeps the button on the same row as the inputs */}
                        <FormLabel display={{ base: 'none', md: 'flex' }} opacity={0} aria-hidden>
                          Add
                        </FormLabel>
                        <Button colorScheme="purple" onClick={handleAddManualEntry} w={{ base: 'full', md: 'auto' }}>
                          Add user
                        </Button>
                      </Box>
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
