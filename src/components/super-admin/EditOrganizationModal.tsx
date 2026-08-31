import React, { useEffect, useMemo, useState } from 'react'
import {
 Accordion,
 AccordionButton,
 AccordionIcon,
 AccordionItem,
 AccordionPanel,
 Alert,
 AlertIcon,
 Box,
 Badge,
 Button,
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
 Spinner,
 Stack,
 Table,
 Tbody,
 Td,
 Text,
 Th,
 Thead,
 Tooltip,
 Tr,
 useToast,
} from '@chakra-ui/react'
import { ClusterProgressionGuide } from '@/components/super-admin/ClusterProgressionGuide'
import { InfoIcon } from '@chakra-ui/icons'
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import { CourseOption, OrganizationRecord, ProgramDurationOption } from '@/types/admin'
import { determineClusterFromTeamSize, fetchAvailableCourses } from '@/services/organizationService'
import {
 assertEmailAvailableForRole,
 assignLeadershipToOrg,
 findProfileIdByEmail,
 formatRoleConflictLabel,
 inviteOrgMember,
 removeOrganizationMember,
 roleConflictBucket,
 updateOrganization as updateSupabaseOrganization,
 updateOrganizationMember,
 type OrgMemberEditableRole,
} from '@/services/supabaseOrgService'
import { fetchOrganizationMembers, type OrgMemberRecord } from '@/services/supabaseSuperAdminService'
import { normalizeEmail } from '@/utils/email'
import {
 MonthlyCourseAssignments,
 buildMonthlyAssignmentsFromArray,
 formatMonthRange,
 getAssignedCourseIdsFromMonthlyAssignments,
 getProgramSegmentAvailabilityStatus,
 getProgramSegmentDateRange,
 getProgramSegmentLabel,
 resolveProgramCadence,
} from '@/utils/monthlyCourseAssignments'
import {
 clusterBoundaries,
 clusterTiers,
 getClusterDisplayName,
 getClusterShortName,
 getClusterTierByName,
} from '@/utils/clusterTiers'
import {
 getMonthlyJourneyCourseOptions,
 isMonthlyJourneyDuration,
 evaluateSinglePillarCourseSet,
 wouldCreateSinglePillarCourseSet,
} from '@/config/courseCatalogue'
import { resolveJourneyType } from '@/utils/journeyType'
import {
 PILLAR_COURSE_PLAN,
 type Pillar,
} from '@/types/pillar'

interface EditOrganizationModalProps {
 isOpen: boolean
 onClose: () => void
 organization?: OrganizationRecord | null
 onUpdated?: (organization: OrganizationRecord) => void
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
 status: 'pending',
 teamSize: 0,
 village: '',
 cluster: '',
 description: '',
 courseAssignments: [],
 programDuration: undefined,
 monthlyCourseAssignments: {},
 courseAssignmentStructure: 'monthly',
 purchasedCoachSessions: 5,
}

type InviteRole = 'user' | 'partner' | 'mentor' | 'ambassador'

type InviteDraft = {
 id: string
 email: string
 role: InviteRole
}

const inviteRoleOptions: InviteRole[] = ['user', 'partner', 'mentor', 'ambassador']

const formatInviteRoleLabel = (role: InviteRole) => {
 if (role === 'user') return 'User'
 if (role === 'partner') return 'Partner'
 if (role === 'mentor') return 'Mentor'
 return 'Coach'
}

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

/** HTML date inputs need YYYY-MM-DD; Supabase often returns full ISO timestamps. */
const toDateInputValue = (value?: string | Date | null): string => {
 if (!value) return ''
 if (value instanceof Date) {
 if (Number.isNaN(value.getTime())) return ''
 return value.toISOString().slice(0, 10)
 }
 const raw = String(value).trim()
 if (!raw) return ''
 if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
 const parsed = new Date(raw)
 if (Number.isNaN(parsed.getTime())) {
 const match = raw.match(/^(\d{4}-\d{2}-\d{2})/)
 return match?.[1] ?? ''
 }
 return parsed.toISOString().slice(0, 10)
}

export const EditOrganizationModal: React.FC<EditOrganizationModalProps> = ({
 isOpen,
 onClose,
 organization,
 onUpdated,
}) => {
 const toast = useToast()
 const [form, setForm] = useState<OrganizationRecord>(emptyOrganization)
 // Seed from the T4L catalogue so 3M+ "Select course" dropdowns are populated
 // immediately (do not wait on Firestore/network fetch).
 const [courses, setCourses] = useState<CourseOption[]>(() => getMonthlyJourneyCourseOptions())
 const [isLoading, setIsLoading] = useState(false)
 const [isSubmitting, setIsSubmitting] = useState(false)
 const [monthlyAssignments, setMonthlyAssignments] = useState<MonthlyCourseAssignments>({})
 const [, setOriginalCohortStartDate] = useState<string | null>(null)
 const [members, setMembers] = useState<OrgMemberRecord[]>([])
 const [membersLoading, setMembersLoading] = useState(false)
 const [mentorEmail, setMentorEmail] = useState('')
 const [ambassadorEmail, setCoachEmail] = useState('')
 const [inviteDrafts, setInviteDrafts] = useState<InviteDraft[]>([])
 const [manualEmail, setManualEmail] = useState('')
 const [manualRole, setManualRole] = useState<InviteRole>('user')
 const [manualError, setManualError] = useState<string | null>(null)
 const [editingMember, setEditingMember] = useState<OrgMemberRecord | null>(null)
 const [editMemberName, setEditMemberName] = useState('')
 const [editMemberRole, setEditMemberRole] = useState<OrgMemberEditableRole>('user')
 const [editMemberSaving, setEditMemberSaving] = useState(false)
 const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)

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
 const isMonthlyJourney = isMonthlyJourneyDuration(form.programDuration)

 const remainingCourses = courseLimit - getAssignedCourseIdsFromMonthlyAssignments(monthlyAssignments, courseLimit).length
 const cohortStartDate = useMemo(
 () => (form.cohortStartDate ? new Date(String(form.cohortStartDate)) : null),
 [form.cohortStartDate],
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

 const sortedCourses = useMemo(() => {
 const catalogue = getMonthlyJourneyCourseOptions()
 if (isMonthlyJourney) return catalogue
 const fromFetch = [...courses].sort((a, b) => a.title.localeCompare(b.title))
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
 if (!isOpen) {
 setForm(emptyOrganization)
 setCourses(getMonthlyJourneyCourseOptions())
 setMonthlyAssignments({})
 setOriginalCohortStartDate(null)
 setMembers([])
 setMentorEmail('')
 setCoachEmail('')
 setInviteDrafts([])
 setManualEmail('')
 setManualRole('user')
 setManualError(null)
 setEditingMember(null)
 setEditMemberName('')
 setEditMemberRole('user')
 setRemovingMemberId(null)
 return
 }

 if (organization) {
 const cohortStart =
 toDateInputValue(organization.cohortStartDate as string | Date | undefined) ||
 toDateInputValue(organization.createdAt as string | Date | undefined)
 setForm({
 ...emptyOrganization,
 ...organization,
 cohortStartDate: cohortStart || undefined,
 })
 setOriginalCohortStartDate(cohortStart || null)
 setMonthlyAssignments(organization.monthlyCourseAssignments ?? {})
 }
 // Load the course catalog so the per-window "Select course" dropdowns have
 // options (previously hardcoded to [] here, which showed "No courses
 // available yet"). fetchAvailableCourses falls back to the local mapping.
 let active = true
 setIsLoading(true)
 fetchAvailableCourses()
 .then((options) => {
 if (active) setCourses(options)
 })
 .catch(() => {
 // Keep the local catalogue so admin course dropdowns stay usable.
 if (active) setCourses(getMonthlyJourneyCourseOptions())
 })
 .finally(() => {
 if (active) setIsLoading(false)
 })
 // Load who belongs to this org (learners + any leadership linked by
 // company_id / organization_id / company_code) so we can edit leadership
 // emails and add more members after creation.
 if (organization?.id || organization?.code) {
 setMembersLoading(true)
 fetchOrganizationMembers({ id: organization.id, code: organization.code })
 .then((rows) => {
 if (!active) return
 setMembers(rows)
 const mentor = rows.find((m) => (m.role || '').toLowerCase() === 'mentor')
 const coach = rows.find((m) => (m.role || '').toLowerCase() === 'ambassador')
 const partner = rows.find((m) => (m.role || '').toLowerCase() === 'partner')
 setMentorEmail(mentor?.email || organization?.assignedMentorEmail || '')
 setCoachEmail(coach?.email || organization?.assignedAmbassadorEmail || '')
 if (!organization?.assignedPartnerEmail && partner?.email) {
 setForm((prev) => ({ ...prev, assignedPartnerEmail: partner.email }))
 }
 })
 .catch(() => {
 if (active) setMembers([])
 })
 .finally(() => {
 if (active) setMembersLoading(false)
 })
 }
 return () => {
 active = false
 }
 }, [isOpen, organization])

 useEffect(() => {
 if (!isOpen) return
 // Always derive cluster from cohort size so the guide and assigned cluster
 // stay consistent (e.g. 40 users => Sahel).
 if ((form.teamSize ?? 0) > 0) {
 const nextCluster = determineClusterFromTeamSize(form.teamSize)
 if (nextCluster && form.cluster !== nextCluster) {
 setForm((prev) => ({ ...prev, cluster: nextCluster }))
 }
 }
 }, [form.cluster, form.teamSize, isOpen])

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

 if (!organization) return null

 const updateField = (key: keyof OrganizationRecord, value: unknown) => {
 setForm((prev) => ({ ...prev, [key]: value }))
 }

 const handleTeamSizeChange = (value: string) => {
 const parsed = Number(value)
 const cluster = determineClusterFromTeamSize(parsed)
 setForm((prev) => ({ ...prev, teamSize: parsed, cluster }))
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
 const next = { ...prev }
 const fromKey = String(fromIndex + 1)
 const toKey = String(toIndex + 1)
 const temp = next[fromKey] || ''
 next[fromKey] = next[toKey] || ''
 next[toKey] = temp
 return next
 })
 }

 const handleAddManualInvite = () => {
 const email = manualEmail.trim()
 if (!email || !isValidEmail(email)) {
 setManualError('Enter a valid email address.')
 return
 }
 const normalized = normalizeEmail(email)
 const alreadyQueued = inviteDrafts.some((draft) => normalizeEmail(draft.email) === normalized)
 const alreadyMember = members.some((member) => normalizeEmail(member.email || '') === normalized)
 if (alreadyQueued || alreadyMember) {
 setManualError('That email is already on this organization or in the add list.')
 return
 }
 setInviteDrafts((prev) => [
 ...prev,
 {
 id: `${normalized}-${Date.now()}`,
 email,
 role: manualRole,
 },
 ])
 setManualEmail('')
 setManualRole('user')
 setManualError(null)
 }

 const removeInviteDraft = (id: string) => {
 setInviteDrafts((prev) => prev.filter((draft) => draft.id !== id))
 }

 const reloadMembers = async () => {
 if (!organization?.id && !organization?.code) return
 setMembersLoading(true)
 try {
 const rows = await fetchOrganizationMembers({ id: organization.id, code: organization.code })
 setMembers(rows)
 const mentor = rows.find((m) => (m.role || '').toLowerCase() === 'mentor')
 const coach = rows.find((m) => (m.role || '').toLowerCase() === 'ambassador')
 const partner = rows.find((m) => (m.role || '').toLowerCase() === 'partner')
 setMentorEmail(mentor?.email || '')
 setCoachEmail(coach?.email || '')
 if (partner?.email) {
 setForm((prev) => ({ ...prev, assignedPartnerEmail: partner.email }))
 }
 } catch {
 setMembers([])
 } finally {
 setMembersLoading(false)
 }
 }

 const toEditableRole = (role?: string | null): OrgMemberEditableRole => {
 const normalized = (role || '').toLowerCase()
 if (normalized === 'partner') return 'partner'
 if (normalized === 'mentor') return 'mentor'
 if (normalized === 'ambassador') return 'ambassador'
 return 'user'
 }

 const openEditMember = (member: OrgMemberRecord) => {
 setEditingMember(member)
 setEditMemberName(member.name || '')
 setEditMemberRole(toEditableRole(member.role))
 }

 const closeEditMember = () => {
 setEditingMember(null)
 setEditMemberName('')
 setEditMemberRole('user')
 }

 const handleSaveMemberEdit = async () => {
 if (!organization?.id || !editingMember) return
 if (!editMemberName.trim()) {
 toast({ title: 'Name is required', status: 'warning' })
 return
 }
 setEditMemberSaving(true)
 try {
 await updateOrganizationMember({
 orgId: organization.id,
 userId: editingMember.id,
 role: editMemberRole,
 name: editMemberName,
 org: { code: form.code, name: form.name },
 })
 const previousRole = toEditableRole(editingMember.role)
 toast({
 title: 'User updated',
 description:
 previousRole !== editMemberRole
 ? `Role changed to ${formatInviteRoleLabel(editMemberRole)}. A confirmation email was sent.`
 : undefined,
 status: 'success',
 })
 closeEditMember()
 await reloadMembers()
 } catch (error) {
 toast({
 title: 'Unable to update user',
 description: error instanceof Error ? error.message : 'Unknown error',
 status: 'error',
 })
 } finally {
 setEditMemberSaving(false)
 }
 }

 const handleRemoveMember = async (member: OrgMemberRecord) => {
 if (!organization?.id) return
 const confirmed = window.confirm(
 `Remove ${member.name || member.email || 'this user'} from ${form.name || 'this organization'}? Their account will not be deleted.`,
 )
 if (!confirmed) return
 setRemovingMemberId(member.id)
 try {
 await removeOrganizationMember(organization.id, member.id)
 toast({ title: 'User removed from organization', status: 'success' })
 if (editingMember?.id === member.id) closeEditMember()
 await reloadMembers()
 } catch (error) {
 toast({
 title: 'Unable to remove user',
 description: error instanceof Error ? error.message : 'Unknown error',
 status: 'error',
 })
 } finally {
 setRemovingMemberId(null)
 }
 }

 const applyLeadershipEmail = async (
 orgId: string,
 email: string,
 role: 'mentor' | 'ambassador',
 ): Promise<string | null> => {
 const normalized = email.trim().toLowerCase()
 if (!normalized) return null
 await assertEmailAvailableForRole(normalized, role)
 const profileId = await findProfileIdByEmail(normalized)
 if (profileId) {
 await assignLeadershipToOrg(orgId, profileId, role, {
 code: form.code,
 name: form.name,
 })
 return 'assigned'
 }
 const result = await inviteOrgMember(orgId, normalized, role)
 if (!result.ok) return result.error || 'invite_failed'
 return result.status || 'pending'
 }

 const handleSubmit = async () => {
 if (!organization.id) return

 try {
 if (!form.name || form.name.length < 3) throw new Error('Organization name must be at least 3 characters')
 if (!form.programDuration) throw new Error('Program duration is required')

 let assignmentsToSave = { ...monthlyAssignments }
 if (form.programDuration === 1.5 && form.pillar) {
 const plan = PILLAR_COURSE_PLAN[form.pillar as Pillar]
 assignmentsToSave = {
 '1': plan[0].courseId,
 '2': plan[1].courseId,
 }
 }
 const missingMonths = Array.from({ length: courseLimit }, (_, index) => index + 1).filter(
 (month) => !assignmentsToSave[String(month)],
 )
 if (form.programDuration === 1.5 && missingMonths.length && !form.pillar) {
 throw new Error('This 6-week organization needs a pillar (or existing course assignments) before saving')
 }
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
 if (mentorEmail.trim() && !isValidEmail(mentorEmail)) {
 throw new Error('Mentor email is invalid')
 }
 if (ambassadorEmail.trim() && !isValidEmail(ambassadorEmail)) {
 throw new Error('Coach email is invalid')
 }
 const partnerEmailValue = (form.assignedPartnerEmail || '').trim()
 if (partnerEmailValue && !isValidEmail(partnerEmailValue)) {
 throw new Error('Transformation partner email is invalid')
 }

 const partnerNormalized = partnerEmailValue.toLowerCase()
 const mentorNormalized = mentorEmail.trim().toLowerCase()
 const ambassadorNormalized = ambassadorEmail.trim().toLowerCase()

 // Same-form conflicts between leadership emails / invite drafts.
 const formRoleByEmail = new Map<string, string>()
 const registerFormEmail = (email: string, role: string) => {
 if (!email) return
 const existing = formRoleByEmail.get(email)
 if (existing && roleConflictBucket(existing) !== roleConflictBucket(role)) {
 throw new Error(
 `${email} is listed as ${formatRoleConflictLabel(existing)} and also as ${formatRoleConflictLabel(role)}. ` +
 `Don't use this email for a different role.`,
 )
 }
 formRoleByEmail.set(email, role)
 }
 registerFormEmail(partnerNormalized, 'partner')
 registerFormEmail(mentorNormalized, 'mentor')
 registerFormEmail(ambassadorNormalized, 'ambassador')
 for (const draft of inviteDrafts.filter((d) => d.email.trim())) {
 registerFormEmail(draft.email.trim().toLowerCase(), draft.role)
 }

 if (partnerNormalized) await assertEmailAvailableForRole(partnerNormalized, 'partner')
 if (mentorNormalized) await assertEmailAvailableForRole(mentorNormalized, 'mentor')
 if (ambassadorNormalized) await assertEmailAvailableForRole(ambassadorNormalized, 'ambassador')
 for (const draft of inviteDrafts.filter((d) => d.email.trim())) {
 await assertEmailAvailableForRole(draft.email, draft.role)
 }

 setIsSubmitting(true)
 // Update core fields in Supabase. (The old Firebase updateOrganization +
 // cohort cascade are dead now that the Firebase DB was deleted.)
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
 await updateSupabaseOrganization(organization.id, {
 name: form.name.trim(),
 // Organization codes are immutable after create - never send code here.
 status: form.status,
 journeyType: resolvedJourneyType,
 programDurationWeeks,
 cohortStartDate: toDateInputValue(form.cohortStartDate as string | Date | undefined) || null,
 village: form.village ?? null,
 cluster: form.cluster ?? null,
 pillar: form.programDuration === 1.5 ? form.pillar ?? null : null,
 teamSize: form.teamSize ?? null,
 programDurationMonths: form.programDuration ?? null,
 partnerEmail: partnerEmailValue || null,
 monthlyCourseAssignments: assignmentsToSave,
 courseAssignments: orderedCourseAssignments,
 courseAssignmentStructure: 'monthly',
 description: form.description ?? null,
 purchasedCoachSessions:
 typeof form.purchasedCoachSessions === 'number' && form.purchasedCoachSessions > 0
 ? Math.round(form.purchasedCoachSessions)
 : 5,
 })

 const failedAdds: string[] = []
 let invitedNow = 0
 let invitedPending = 0

 // Leadership emails can be set/changed after the org already exists.
 try {
 await applyLeadershipEmail(organization.id, mentorEmail, 'mentor')
 } catch (error) {
 failedAdds.push(`mentor (${mentorEmail || 'empty'}): ${error instanceof Error ? error.message : 'failed'}`)
 }
 try {
 await applyLeadershipEmail(organization.id, ambassadorEmail, 'ambassador')
 } catch (error) {
 failedAdds.push(
 `coach (${ambassadorEmail || 'empty'}): ${error instanceof Error ? error.message : 'failed'}`,
 )
 }

 for (const draft of inviteDrafts) {
 const result = await inviteOrgMember(organization.id, draft.email, draft.role)
 if (result.ok) {
 if (result.status === 'enrolled') invitedNow += 1
 else invitedPending += 1
 } else {
 failedAdds.push(`${draft.email}: ${result.error || 'failed'}`)
 }
 }

 const inviteSummary =
 inviteDrafts.length > 0 || mentorEmail.trim() || ambassadorEmail.trim()
 ? [
 invitedNow ? `${invitedNow} enrolled now` : null,
 invitedPending ? `${invitedPending} pending signup` : null,
 failedAdds.length ? `${failedAdds.length} failed` : null,
 ]
 .filter(Boolean)
 .join(', ')
 : `Cluster: ${clusterDisplayName}`

 toast({
 title: failedAdds.length ? 'Organization updated with some invite issues' : 'Organization updated successfully',
 description: failedAdds.length
 ? `${inviteSummary}. Failed: ${failedAdds.slice(0, 3).join('; ')}`
 : inviteSummary,
 status: failedAdds.length ? 'warning' : 'success',
 duration: failedAdds.length ? 10000 : 5000,
 isClosable: true,
 })
 onUpdated?.({
 ...form,
 id: organization.id,
 organizationJourneyType: resolvedJourneyType ?? undefined,
 programDurationWeeks: programDurationWeeks ?? undefined,
 pillar: form.programDuration === 1.5 ? form.pillar : undefined,
 monthlyCourseAssignments: assignmentsToSave,
 courseAssignments: orderedCourseAssignments,
 courseAssignmentStructure: 'monthly',
 assignedPartnerEmail: partnerEmailValue || undefined,
 assignedMentorEmail: mentorEmail.trim() || undefined,
 assignedAmbassadorEmail: ambassadorEmail.trim() || undefined,
 })
 onClose()
 } catch (error) {
 toast({
 title: 'Unable to update organization',
 description: error instanceof Error ? error.message : 'Unknown error',
 status: 'error',
 })
 } finally {
 setIsSubmitting(false)
 }
 }

 const roleLabelMap: Record<string, string> = {
 super_admin: 'Super Admin',
 partner: 'Partner',
 mentor: 'Mentor',
 ambassador: 'Coach',
 paid_member: 'Paid Member',
 free_user: 'Free User',
 user: 'User',
 }
 const formatMemberRole = (role: string) => roleLabelMap[(role || '').toLowerCase()] || role

 return (
 <>
 <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="outside">
 <ModalOverlay />
 <ModalContent>
 <ModalHeader>Edit organization</ModalHeader>
 <ModalCloseButton />
 <ModalBody>
 {isLoading ? (
 <Flex justify="center" align="center" py={12} direction="column" gap={3}>
 <Spinner size="lg" />
 <Text color="gray.600">Loading organization data...</Text>
 </Flex>
 ) : (
 <Stack spacing={8}>
 <Box>
 <Text fontWeight="bold">ORGANIZATION DETAILS</Text>
 <Text color="gray.600" fontSize="sm">
 Update organization details and program configuration.
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
 <FormControl>
 <FormLabel display="flex" alignItems="center" gap={2}>
 Organization code
 <Tooltip label="Organization codes are permanent and cannot be changed after creation." placement="top">
 <InfoIcon color="text.muted" />
 </Tooltip>
 </FormLabel>
 <InputGroup>
 <InputLeftAddon>Code</InputLeftAddon>
 <Input
 value={form.code}
 isReadOnly
 isDisabled
 maxLength={6}
 placeholder="6-char code"
 textTransform="uppercase"
 fontFamily="mono"
 bg="gray.50"
 cursor="not-allowed"
 />
 </InputGroup>
 <FormHelperText color="gray.600">
 Code cannot be changed. Members use this to join the organization.
 </FormHelperText>
 </FormControl>
 </GridItem>
 <GridItem>
 <FormControl>
 <FormLabel>Village</FormLabel>
 <Input value={form.village} onChange={(e) => updateField('village', e.target.value)} />
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
 <GridItem>
 <FormControl
 isRequired
 isInvalid={courseLimit > 0 && (form.courseAssignments?.length || 0) !== courseLimit}
 >
 <FormLabel>Program duration</FormLabel>
 <Select
 placeholder="Select duration"
 value={form.programDuration?.toString() || ''}
 onChange={(e) => {
 const next = Number(e.target.value)
 const previous = form.programDuration
 updateField('programDuration', next)
 if (next !== 1.5) updateField('pillar', undefined)
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
 <GridItem>
 <FormControl>
 <FormLabel>Purchased coaching sessions</FormLabel>
 <Select
 value={String(form.purchasedCoachSessions ?? 5)}
 onChange={(e) =>
 updateField('purchasedCoachSessions', Number(e.target.value) || 5)
 }
 >
 {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map((n) => (
 <option key={n} value={n}>
 {n} session{n === 1 ? '' : 's'}
 {n === 1 || n === 5 ? ' (standard)' : ''}
 </option>
 ))}
 </Select>
 <FormHelperText>
 Org default for Transformation Coaching. Usually 1 or 5; raise when the company
 buys more. Per-learner overrides can still apply.
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
 <FormLabel>Program start date</FormLabel>
 <Input
 type="date"
 value={toDateInputValue(form.cohortStartDate as string | Date | undefined)}
 onChange={(e) => updateField('cohortStartDate', e.target.value)}
 />
 <FormHelperText>
 The cohort start date set when this organization was created.
 </FormHelperText>
 </FormControl>
 </GridItem>
 <GridItem>
 <FormControl>
 <FormLabel>Transformation partner</FormLabel>
 <Input
 type="email"
 placeholder="partner@example.com"
 value={form.assignedPartnerEmail || ''}
 onChange={(e) => updateField('assignedPartnerEmail', e.target.value)}
 />
 </FormControl>
 </GridItem>
 <GridItem>
 <FormControl>
 <FormLabel>Mentor</FormLabel>
 <Input
 type="email"
 placeholder="mentor@example.com"
 value={mentorEmail}
 onChange={(e) => setMentorEmail(e.target.value)}
 />
 </FormControl>
 </GridItem>
 <GridItem>
 <FormControl>
 <FormLabel>Coach</FormLabel>
 <Input
 type="email"
 placeholder="coach@example.com"
 value={ambassadorEmail}
 onChange={(e) => setCoachEmail(e.target.value)}
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
 <ClusterProgressionGuide
 teamSize={form.teamSize || 0}
 clusterName={form.cluster || clusterDisplayName}
 />
 </AccordionPanel>
 </AccordionItem>
 </Accordion>
 </GridItem>
 </Grid>

 <Box>
 <Text fontWeight="medium" mb={1}>
 {assignmentSectionLabel}
 </Text>
 <Text fontSize="sm" color="gray.600" mb={3}>
 {isMonthlyJourney
 ? `Assign exactly ${courseLimit} courses (1 per month). Learners only see these courses, in this order: Course 1 first, Course 2 second, and so on. At least two pillars must be represented - all courses cannot be from the same pillar.`
 : '6-week courses come from the organization pillar (when set) and are saved to the organization. Window 1 is shown first to learners.'}
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
 {`Course ${monthNumber} of ${courseLimit}`}
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
 {(sortedCourses.length
 ? sortedCourses
 : getMonthlyJourneyCourseOptions()
 ).map((course) => (
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
 {!(sortedCourses.length ? sortedCourses : getMonthlyJourneyCourseOptions()).length && (
 <Text fontSize="sm" color="gray.600">
 No courses available yet.
 </Text>
 )}
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
 {singlePillarCourseSet.blocked && (
 <Alert status="error" mt={3} borderRadius="md">
 <AlertIcon />
 {singlePillarCourseSet.message}
 </Alert>
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
 : availability === 'past'
 ? 'Ended'
 : 'Locked'
 return (
 <Flex key={monthNumber} justify="space-between" align="center" p={2} bg="white" borderRadius="md">
 <Text fontWeight="medium">{getProgramSegmentLabel(monthNumber, programCadence)}</Text>
 <HStack spacing={2}>
 <Badge colorScheme={availability === 'current' ? 'green' : availability === 'completed' ? 'purple' : availability === 'past' ? 'orange' : 'gray'}>
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
 )}
 </Box>

 <Box borderWidth="1px" borderRadius="lg" p={4} bg="gray.50">
 <Text fontWeight="bold" mb={1}>
 Add users
 </Text>
 <Text fontSize="sm" color="gray.600" mb={3}>
 Invite more people to this organization. Existing accounts are enrolled now; new emails stay
 pending until they sign up.
 </Text>
 <Grid templateColumns={{ base: '1fr', md: '2fr 1.4fr auto' }} gap={3} alignItems="start">
 <FormControl isInvalid={Boolean(manualError)}>
 <FormLabel fontSize="sm">Email</FormLabel>
 <Input
 value={manualEmail}
 onChange={(e) => {
 setManualEmail(e.target.value)
 if (manualError) setManualError(null)
 }}
 placeholder="jane.doe@example.com"
 bg="white"
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault()
 handleAddManualInvite()
 }
 }}
 />
 <FormErrorMessage>{manualError}</FormErrorMessage>
 </FormControl>
 <FormControl>
 <FormLabel fontSize="sm">Role</FormLabel>
 <Select
 value={manualRole}
 onChange={(e) => setManualRole(e.target.value as InviteRole)}
 bg="white"
 >
 {inviteRoleOptions.map((role) => (
 <option key={role} value={role}>
 {formatInviteRoleLabel(role)}
 </option>
 ))}
 </Select>
 </FormControl>
 <Box>
 <FormLabel display={{ base: 'none', md: 'flex' }} opacity={0} aria-hidden>
 Add
 </FormLabel>
 <Button colorScheme="purple" onClick={handleAddManualInvite} w={{ base: 'full', md: 'auto' }}>
 Add user
 </Button>
 </Box>
 </Grid>

 {inviteDrafts.length > 0 && (
 <Box mt={4}>
 <Text fontSize="sm" fontWeight="semibold" mb={2}>
 Users to add on save ({inviteDrafts.length})
 </Text>
 <Stack spacing={2}>
 {inviteDrafts.map((draft) => (
 <Flex
 key={draft.id}
 justify="space-between"
 align="center"
 borderWidth="1px"
 borderRadius="md"
 px={3}
 py={2}
 bg="white"
 >
 <HStack spacing={3}>
 <Text fontSize="sm">{draft.email}</Text>
 <Badge colorScheme="blue" variant="subtle">
 {formatInviteRoleLabel(draft.role)}
 </Badge>
 </HStack>
 <IconButton
 aria-label="Remove user"
 icon={<Trash2 size={14} />}
 size="sm"
 variant="ghost"
 colorScheme="red"
 onClick={() => removeInviteDraft(draft.id)}
 />
 </Flex>
 ))}
 </Stack>
 </Box>
 )}
 </Box>

 <Box borderWidth="1px" borderRadius="lg" p={4}>
 <Text fontWeight="bold" mb={1}>
 Existing users ({membersLoading ? '…' : members.length})
 </Text>
 <Text fontSize="sm" color="gray.600" mb={3}>
 People already linked to this organization. Edit a role or name, or remove someone from the org.
 </Text>
 {membersLoading ? (
 <Spinner size="sm" />
 ) : members.length ? (
 <Box maxH="280px" overflowY="auto" borderWidth="1px" borderRadius="md">
 <Table size="sm" variant="simple">
 <Thead bg="gray.50" position="sticky" top={0} zIndex={1}>
 <Tr>
 <Th>Name</Th>
 <Th>Email</Th>
 <Th>Role</Th>
 <Th textAlign="right">Actions</Th>
 </Tr>
 </Thead>
 <Tbody>
 {members.map((m) => (
 <Tr key={m.id}>
 <Td>{m.name}</Td>
 <Td color="gray.600">{m.email || '-'}</Td>
 <Td>
 <Badge colorScheme="purple" variant="subtle">
 {formatMemberRole(m.role)}
 </Badge>
 </Td>
 <Td>
 <HStack spacing={1} justify="flex-end">
 <Button
 size="xs"
 variant="outline"
 leftIcon={<Pencil size={12} />}
 onClick={() => openEditMember(m)}
 >
 Edit
 </Button>
 <IconButton
 aria-label={`Remove ${m.name}`}
 icon={<Trash2 size={14} />}
 size="xs"
 variant="ghost"
 colorScheme="red"
 isLoading={removingMemberId === m.id}
 onClick={() => void handleRemoveMember(m)}
 />
 </HStack>
 </Td>
 </Tr>
 ))}
 </Tbody>
 </Table>
 </Box>
 ) : (
 <Text fontSize="sm" color="gray.500">
 No users belong to this organization yet. Add people above, then save.
 </Text>
 )}
 </Box>
 </Stack>
 )}
 </ModalBody>
 <ModalFooter>
 <Button variant="ghost" mr={3} onClick={onClose}>
 Cancel
 </Button>
 <Button colorScheme="purple" onClick={handleSubmit} isLoading={isSubmitting} isDisabled={isLoading}>
 Save changes
 </Button>
 </ModalFooter>
 </ModalContent>
 </Modal>

 <Modal isOpen={Boolean(editingMember)} onClose={closeEditMember} isCentered size="md">
 <ModalOverlay />
 <ModalContent>
 <ModalHeader>Edit user</ModalHeader>
 <ModalCloseButton />
 <ModalBody>
 <Stack spacing={4}>
 <Text fontSize="sm" color="gray.600">
 Update this person&apos;s details for {form.name || 'the organization'}.
 </Text>
 <FormControl isRequired>
 <FormLabel>Name</FormLabel>
 <Input value={editMemberName} onChange={(e) => setEditMemberName(e.target.value)} />
 </FormControl>
 <FormControl>
 <FormLabel>Email</FormLabel>
 <Input value={editingMember?.email || ''} isReadOnly bg="gray.50" />
 <FormHelperText>Email is managed from the user&apos;s account and cannot be changed here.</FormHelperText>
 </FormControl>
 <FormControl>
 <FormLabel>Role</FormLabel>
 <Select
 value={editMemberRole}
 onChange={(e) => setEditMemberRole(e.target.value as OrgMemberEditableRole)}
 >
 {inviteRoleOptions.map((role) => (
 <option key={role} value={role}>
 {formatInviteRoleLabel(role)}
 </option>
 ))}
 </Select>
 </FormControl>
 </Stack>
 </ModalBody>
 <ModalFooter>
 <Button variant="ghost" mr={3} onClick={closeEditMember}>
 Cancel
 </Button>
 <Button colorScheme="purple" onClick={() => void handleSaveMemberEdit()} isLoading={editMemberSaving}>
 Save user
 </Button>
 </ModalFooter>
 </ModalContent>
 </Modal>
 </>
 )
}
