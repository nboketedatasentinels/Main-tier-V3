import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  Code,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  IconButton,
  Input,
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
  Text,
  Textarea,
  useClipboard,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon } from '@chakra-ui/icons'
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore'

import { useAuth } from '@/hooks/useAuth'
import { db } from '@/services/firebase'
import { OrganizationStatus } from '@/types/admin'

const PROGRAM_DURATION_OPTIONS = [
  { value: '1.5', label: '6 Weeks', courseCount: 3 },
  { value: '3', label: '3 Months', courseCount: 3 },
  { value: '6', label: '6 Months', courseCount: 6 },
  { value: '9', label: '9 Months', courseCount: 9 },
  { value: '12', label: '12 Months', courseCount: 12 },
]

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type InvitationMethod = 'email' | 'one_time_code'

interface CourseOption {
  id: string
  title: string
}

interface TransformationPartner {
  id: string
  name: string
  email?: string
}

interface OrganizationLead {
  id: string
  name: string
  email?: string
}

interface InviteDraft {
  id: string
  name: string
  email: string
  role: string
  method: InvitationMethod
}

interface CreateOrganizationModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: () => void
  transformationPartners: TransformationPartner[]
  currentUserId?: string
}

interface FormState {
  name: string
  village: string
  cluster: string
  teamSize: string
  description: string
  status: OrganizationStatus
  code: string
  programDuration: string
  cohortStartDate: string
  assignedCourses: string[]
  assignedMentorId: string
  assignedAmbassadorId: string
}

interface InvitationResultEntry {
  userName: string
  userEmail?: string
  success: boolean
  method: InvitationMethod
  error?: string
  code?: string
}

interface BulkInvitationResult {
  successful: number
  total: number
  codeInvites: number
  results: InvitationResultEntry[]
}

const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

const createInitialState = (): FormState => ({
  name: '',
  village: '',
  cluster: '',
  teamSize: '',
  description: '',
  status: 'pending',
  code: '',
  programDuration: '',
  cohortStartDate: '',
  assignedCourses: [],
  assignedMentorId: '',
  assignedAmbassadorId: '',
})

const createInviteDraft = (): InviteDraft => ({
  id: crypto.randomUUID(),
  name: '',
  email: '',
  role: 'user',
  method: 'email',
})

const generateOrganizationCode = (name: string): string => {
  const prefix = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase().padEnd(2, 'X')
  let code = prefix
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

const determineClusterFromTeamSize = (teamSize: number | null): string => {
  if (!teamSize || Number.isNaN(teamSize)) return ''
  if (teamSize >= 41) return 'Serengeti Cluster'
  if (teamSize >= 21) return 'Sahel Cluster'
  if (teamSize >= 11) return 'Sahara Cluster'
  if (teamSize >= 4) return 'Kalahari Cluster'
  return ''
}

const mapInviteMethod = (email?: string | null, rawMethod?: string): InvitationMethod => {
  if (rawMethod === 'one_time_code') return 'one_time_code'
  if (rawMethod === 'email') return 'email'
  if (email) return 'email'
  return 'one_time_code'
}

const normalizeCsvHeader = (header: string): string => header.trim().toLowerCase()

const headerAliases: Record<string, string> = {
  name: 'name',
  'full name': 'name',
  'full_name': 'name',
  email: 'email',
  'email address': 'email',
  role: 'role',
  'invitation method': 'method',
  method: 'method',
}

export const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  transformationPartners,
  currentUserId,
}) => {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [formState, setFormState] = useState<FormState>(createInitialState)
  const [hasCustomCode, setHasCustomCode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshingSession, setIsRefreshingSession] = useState(false)
  const [isProcessingCsv, setIsProcessingCsv] = useState(false)
  const [isLoadingCourses, setIsLoadingCourses] = useState(false)
  const [isLoadingLeads, setIsLoadingLeads] = useState(false)
  const [availableCourses, setAvailableCourses] = useState<CourseOption[]>([])
  const [mentors, setMentors] = useState<OrganizationLead[]>([])
  const [ambassadors, setAmbassadors] = useState<OrganizationLead[]>([])
  const [inviteDrafts, setInviteDrafts] = useState<InviteDraft[]>([createInviteDraft()])
  const [selectedPartnerId, setSelectedPartnerId] = useState('')
  const [invitationResults, setInvitationResults] = useState<BulkInvitationResult | null>(null)
  const invitationResultsDisclosure = useDisclosure()
  const [adminSessionOutOfSync, setAdminSessionOutOfSync] = useState(false)
  const [adminSessionError, setAdminSessionError] = useState<string | null>(null)
  const { isSuperAdmin, user, refreshAdminSession } = useAuth()
  const { onCopy, setValue, hasCopied } = useClipboard('')

  const courseLimit = useMemo(() => {
    const option = PROGRAM_DURATION_OPTIONS.find((item) => item.value === formState.programDuration)
    return option?.courseCount ?? 0
  }, [formState.programDuration])

  const teamSizeLimit = useMemo(() => {
    const parsed = Number.parseInt(formState.teamSize, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  }, [formState.teamSize])

  const inviteCount = useMemo(
    () => inviteDrafts.filter((invite) => invite.name || invite.email).length,
    [inviteDrafts]
  )

  const preparedInvitations = useMemo(
    () => inviteDrafts.filter((invite) => invite.name || invite.email),
    [inviteDrafts]
  )

  const helperTextMessage = useMemo(() => {
    if (!formState.programDuration) {
      return 'Select a program duration to enable course assignments.'
    }

    if (courseLimit > 0 && availableCourses.length < courseLimit) {
      return `Only ${availableCourses.length} course(s) available. Add more courses or select a shorter program duration.`
    }

    if (courseLimit === 0) {
      return 'No specific course requirement for the selected duration.'
    }

    const remaining = courseLimit - formState.assignedCourses.length
    if (remaining === 0) {
      return 'All required courses assigned.'
    }
    return `${remaining} course(s) remaining to assign.`
  }, [availableCourses.length, courseLimit, formState.assignedCourses.length, formState.programDuration])

  const helperTextColor = useMemo(() => {
    if (!formState.programDuration) return 'gray.600'
    if (courseLimit > 0 && availableCourses.length < courseLimit) return 'red.500'
    if (courseLimit > 0 && formState.assignedCourses.length === courseLimit) return 'green.500'
    return 'gray.600'
  }, [availableCourses.length, courseLimit, formState.assignedCourses.length, formState.programDuration])

  const sessionAlertDescription =
    adminSessionError ||
    "We could not verify your admin permissions. Use the 'Refresh Session' button to sync without signing out. If the issue continues, please sign out and sign back in."

  useEffect(() => {
    if (isOpen) {
      setFormState((prev) => ({ ...prev, code: generateOrganizationCode(prev.name || 'ORG') }))
      setInviteDrafts([createInviteDraft()])
      loadCourses()
      loadLeads()
      setAdminSessionError(null)
      setAdminSessionOutOfSync(false)
    }
  }, [isOpen, loadCourses, loadLeads])

  useEffect(() => {
    if (!isOpen) {
      setFormState(createInitialState())
      setSelectedPartnerId('')
      setIsSubmitting(false)
      setHasCustomCode(false)
      setAvailableCourses([])
      setIsLoadingCourses(false)
      setInviteDrafts([createInviteDraft()])
      setMentors([])
      setAmbassadors([])
      setIsLoadingLeads(false)
      setInvitationResults(null)
      setAdminSessionError(null)
      setAdminSessionOutOfSync(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!hasCustomCode) {
      setFormState((prev) => ({ ...prev, code: generateOrganizationCode(prev.name || 'ORG') }))
    }
  }, [formState.name, hasCustomCode])

  useEffect(() => {
    const parsedTeamSize = Number.parseInt(formState.teamSize, 10)
    setFormState((prev) => ({ ...prev, cluster: determineClusterFromTeamSize(parsedTeamSize) }))
  }, [formState.teamSize])

  useEffect(() => {
    if (courseLimit > 0 && formState.assignedCourses.length > courseLimit) {
      setFormState((prev) => ({
        ...prev,
        assignedCourses: prev.assignedCourses.slice(0, courseLimit),
      }))
    }
  }, [courseLimit, formState.assignedCourses.length])

  const loadCourses = useCallback(async () => {
    try {
      setIsLoadingCourses(true)
      const coursesRef = collection(db, 'courses')
      const snapshot = await getDocs(query(coursesRef, orderBy('title', 'asc')))
      const loadedCourses: CourseOption[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        title: (docSnap.data() as { title?: string }).title || 'Untitled course',
      }))
      setAvailableCourses(loadedCourses)
    } catch (error) {
      console.error('Failed to load courses', error)
      toast({ title: 'Failed to load courses', status: 'error' })
    } finally {
      setIsLoadingCourses(false)
    }
  }, [toast])

  const loadLeads = useCallback(async () => {
    try {
      setIsLoadingLeads(true)
      const usersRef = collection(db, 'users')
      const mentorQuery = query(usersRef, where('role', '==', 'mentor'), orderBy('fullName', 'asc'))
      const ambassadorQuery = query(usersRef, where('role', '==', 'ambassador'), orderBy('fullName', 'asc'))

      const [mentorSnapshot, ambassadorSnapshot] = await Promise.all([
        getDocs(mentorQuery),
        getDocs(ambassadorQuery),
      ])

      const mapLead = (snap: typeof mentorSnapshot): OrganizationLead[] =>
        snap.docs
          .map((docSnap) => {
            const data = docSnap.data() as { fullName?: string; email?: string }
            return {
              id: docSnap.id,
              name: data.fullName || 'Mentor',
              email: data.email,
            }
          })
          .sort((a, b) => a.name.localeCompare(b.name))

      setMentors(mapLead(mentorSnapshot))
      setAmbassadors(mapLead(ambassadorSnapshot))
    } catch (error) {
      console.error('Failed to load leads', error)
      toast({ title: 'Failed to load mentors or ambassadors', status: 'error' })
    } finally {
      setIsLoadingLeads(false)
    }
  }, [toast])

  const handleChange = (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = event.target.value
    if (key === 'code') {
      setHasCustomCode(true)
    }
    setFormState((prev) => ({ ...prev, [key]: value }))
  }

  const handleRegenerateCode = () => {
    const newCode = generateOrganizationCode(formState.name || 'ORG')
    setFormState((prev) => ({ ...prev, code: newCode }))
    setHasCustomCode(false)
  }

  const handleToggleCourseSelection = (courseId: string) => {
    setFormState((prev) => {
      const alreadySelected = prev.assignedCourses.includes(courseId)

      if (alreadySelected) {
        return { ...prev, assignedCourses: prev.assignedCourses.filter((id) => id !== courseId) }
      }

      if (courseLimit > 0 && prev.assignedCourses.length >= courseLimit) {
        toast({
          title: 'Course selection limit reached.',
          description: `You can assign up to ${courseLimit} course(s) for the selected duration.`,
          status: 'warning',
        })
        return prev
      }

      return { ...prev, assignedCourses: [...prev.assignedCourses, courseId] }
    })
  }

  const handleAddInvite = () => {
    if (teamSizeLimit && inviteDrafts.length >= teamSizeLimit) {
      toast({
        title: 'Too many users added.',
        description: `Cohort size is limited to ${teamSizeLimit} user(s). Remove an invite or increase cohort size.`,
        status: 'warning',
      })
      return
    }
    setInviteDrafts((prev) => [...prev, createInviteDraft()])
  }

  const handleRemoveInvite = (id: string) => {
    setInviteDrafts((prev) => {
      const filtered = prev.filter((invite) => invite.id !== id)
      if (filtered.length === 0) {
        return [createInviteDraft()]
      }
      return filtered
    })
  }

  const handleInviteChange = (id: string, key: keyof InviteDraft, value: string) => {
    setInviteDrafts((prev) => prev.map((invite) => (invite.id === id ? { ...invite, [key]: value } : invite)))
  }

  const handleFileUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleDownloadTemplate = () => {
    const content = ['Name,Email,Role,Invitation Method', 'Jane Doe,jane@example.com,user,email', 'John Smith,,user,code'].join('\n')
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'organization_invites_template.csv')
    link.click()
    URL.revokeObjectURL(url)
  }

  const parseCsv = (text: string): InviteDraft[] => {
    const lines = text.split(/\r?\n/).filter(Boolean)
    if (lines.length < 2) {
      throw new Error('CSV must include at least one data row.')
    }

    const headers = lines[0].split(',').map((header) => normalizeCsvHeader(header))
    const mappedHeaders = headers.map((header) => headerAliases[header] || header)

    const nameIndex = mappedHeaders.indexOf('name')
    if (nameIndex === -1) {
      throw new Error('Name column is required.')
    }

    const emailIndex = mappedHeaders.indexOf('email')
    const roleIndex = mappedHeaders.indexOf('role')
    const methodIndex = mappedHeaders.indexOf('method')

    return lines.slice(1).map((line) => {
      const parts = line.split(',')
      const name = (parts[nameIndex] || '').trim()
      const email = emailIndex >= 0 ? (parts[emailIndex] || '').trim() : ''
      const rawRole = roleIndex >= 0 ? (parts[roleIndex] || '').trim() : ''
      const rawMethod = methodIndex >= 0 ? (parts[methodIndex] || '').trim() : ''

      return {
        id: crypto.randomUUID(),
        name,
        email,
        role: rawRole || 'user',
        method: mapInviteMethod(email, rawMethod.toLowerCase()),
      }
    })
  }

  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsProcessingCsv(true)
    try {
      const text = await file.text()
      const parsed = parseCsv(text)
      if (!parsed.length) {
        throw new Error('No valid invitation rows found.')
      }

      setInviteDrafts((prev) => [...prev, ...parsed])
      toast({ title: `${parsed.length} invitation(s) added`, status: 'success' })
    } catch (error) {
      console.error('CSV upload failed', error)
      toast({
        title: 'Invalid CSV',
        description: (error as Error)?.message || 'Could not parse CSV file.',
        status: 'error',
      })
    } finally {
      setIsProcessingCsv(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const validateOrganizationCode = async (code: string) => {
    const companiesRef = collection(db, 'companies')
    const snapshot = await getDocs(query(companiesRef, where('code', '==', code)))
    return snapshot.empty
  }

  const performSessionRefresh = async () => {
    try {
      setIsRefreshingSession(true)
      await refreshAdminSession()
      setAdminSessionOutOfSync(false)
      setAdminSessionError(null)
      toast({ title: 'Session refreshed', status: 'success' })
      return { success: true }
    } catch (error) {
      console.warn('Session refresh failed', error)
      setAdminSessionError((error as Error)?.message || 'Unable to refresh session')
      toast({
        title: 'Continuing with stored admin permissions',
        description: 'We could not sync your admin session automatically.',
        status: 'info',
      })
      return { success: false }
    } finally {
      setIsRefreshingSession(false)
    }
  }

  const handleRefreshSessionClick = async () => {
    await performSessionRefresh()
  }

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: 'Authentication required.', status: 'error' })
      return
    }

    if (!isSuperAdmin) {
      toast({
        title: 'Super admin permissions required.',
        description: 'Contact support if recently granted access.',
        status: 'error',
      })
      return
    }

    if (!formState.name.trim()) {
      toast({ title: 'Organization name is required.', status: 'error' })
      return
    }

    if (!formState.programDuration) {
      toast({ title: 'Program duration is required.', status: 'error' })
      return
    }

    const parsedDuration = Number.parseFloat(formState.programDuration)
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      toast({ title: 'Invalid program duration selected.', status: 'error' })
      return
    }

    if (courseLimit > 0 && availableCourses.length < courseLimit) {
      toast({
        title: 'Not enough courses available.',
        description: `Only ${availableCourses.length} course(s) available to assign.`,
        status: 'error',
      })
      return
    }

    if (courseLimit > 0 && formState.assignedCourses.length !== courseLimit) {
      toast({
        title: 'Incomplete course assignments.',
        description: `Please assign ${courseLimit} course(s) for the selected program duration.`,
        status: 'error',
      })
      return
    }

    if (!formState.teamSize.trim()) {
      toast({ title: 'Cohort size is required.', status: 'error' })
      return
    }

    const parsedTeamSize = Number.parseInt(formState.teamSize, 10)
    if (!Number.isFinite(parsedTeamSize) || parsedTeamSize <= 0) {
      toast({ title: 'Cohort size must be greater than zero.', status: 'error' })
      return
    }

    if (teamSizeLimit && inviteCount > teamSizeLimit) {
      toast({
        title: 'Too many users added.',
        description: `Cohort size is limited to ${teamSizeLimit} user(s). Remove an invite or increase cohort size.`,
        status: 'error',
      })
      return
    }

    const invalidInvite = preparedInvitations.find((invitation) => {
      if (!invitation.name) return true
      if (invitation.method === 'email' && !invitation.email) return true
      if (invitation.email && !EMAIL_REGEX.test(invitation.email)) return true
      return false
    })

    if (invalidInvite) {
      toast({
        title: 'Invalid invitation entry.',
        description: 'Ensure each user has a name and valid email (for email invitations).',
        status: 'error',
      })
      return
    }

    const duplicateEmail = preparedInvitations
      .map((invitation) => invitation.email)
      .filter(Boolean)
      .find((email, index, array) => array.indexOf(email) !== index)

    if (duplicateEmail) {
      toast({
        title: 'Duplicate email detected.',
        description: `${duplicateEmail} is listed more than once.`,
        status: 'error',
      })
      return
    }

    if (adminSessionOutOfSync) {
      await performSessionRefresh()
    }

    setIsSubmitting(true)
    try {
      const normalizedCode = formState.code.trim().toUpperCase()
      const isUniqueCode = await validateOrganizationCode(normalizedCode)
      if (!isUniqueCode) {
        toast({ title: 'Organization code already exists.', status: 'error' })
        return
      }

      const selectedPartner = transformationPartners.find((partner) => partner.id === selectedPartnerId)
      const selectedMentor = mentors.find((mentor) => mentor.id === formState.assignedMentorId)
      const selectedAmbassador = ambassadors.find((ambassador) => ambassador.id === formState.assignedAmbassadorId)

      const cohortDate = formState.cohortStartDate ? Timestamp.fromDate(new Date(formState.cohortStartDate)) : null

      const companiesRef = collection(db, 'companies')
      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim() || undefined,
        village: formState.village.trim() || undefined,
        cluster: formState.cluster.trim() || undefined,
        teamSize: parsedTeamSize,
        status: formState.status,
        code: normalizedCode,
        createdBy: currentUserId || user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        cohortStartDate: cohortDate,
        programDuration: parsedDuration,
        courseAssignments: formState.assignedCourses,
        assignedPartnerId: selectedPartner?.id,
        assignedPartnerName: selectedPartner?.name,
        assignedPartnerEmail: selectedPartner?.email,
        assignedMentorId: selectedMentor?.id,
        assignedMentorName: selectedMentor?.name,
        assignedMentorEmail: selectedMentor?.email,
        assignedAmbassadorId: selectedAmbassador?.id,
        assignedAmbassadorName: selectedAmbassador?.name,
        assignedAmbassadorEmail: selectedAmbassador?.email,
      }

      const document = await addDoc(companiesRef, payload)

      let bulkResults: BulkInvitationResult | null = null

      if (preparedInvitations.length > 0) {
        const invitationsRef = collection(db, 'invitations')
        const results: InvitationResultEntry[] = []

        for (const invitation of preparedInvitations) {
          const method = invitation.method
          const invitationPayload = {
            name: invitation.name,
            email: invitation.email || null,
            role: invitation.role,
            method,
            companyCode: normalizedCode,
            organizationId: document.id,
            createdAt: serverTimestamp(),
          }

          try {
            await addDoc(invitationsRef, invitationPayload)
            results.push({
              userName: invitation.name,
              userEmail: invitation.email || undefined,
              success: true,
              method,
              code: method === 'one_time_code' ? generateOrganizationCode('CODE') : undefined,
            })
          } catch (error) {
            console.error('Failed to create invitation', error)
            results.push({
              userName: invitation.name,
              userEmail: invitation.email || undefined,
              success: false,
              method,
              error: (error as Error)?.message || 'Unknown error',
            })
          }
        }

        const successful = results.filter((entry) => entry.success).length
        const codeInvites = results.filter((entry) => entry.method === 'one_time_code' && entry.success).length
        bulkResults = {
          successful,
          total: results.length,
          codeInvites,
          results,
        }

        setInvitationResults(bulkResults)
        if (results.length > 0) {
          invitationResultsDisclosure.onOpen()
        }
      }

      toast({ title: 'Organization created successfully.', status: 'success' })
      onCreated?.()
      onClose()
    } catch (error) {
      console.error('Failed to create organization', error)
      toast({ title: 'Unable to create organization', status: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isSuperAdmin) {
    return null
  }

  const canAddMoreInvites = teamSizeLimit ? inviteDrafts.length < teamSizeLimit : true

  const renderInviteForm = (invite: InviteDraft) => {
    const method = invite.method
    const isMissingName = !invite.name && (invite.email || method === 'one_time_code')
    const isInvalidEmail = Boolean(invite.email) && !EMAIL_REGEX.test(invite.email)

    return (
      <Box key={invite.id} borderWidth="1px" borderRadius="md" p={3}>
        <Stack spacing={3}>
          <FormControl isRequired isInvalid={isMissingName}>
            <FormLabel>Name</FormLabel>
            <Input
              value={invite.name}
              onChange={(event) => handleInviteChange(invite.id, 'name', event.target.value)}
              placeholder="Learner name"
            />
            <FormErrorMessage>Name is required for each invitation.</FormErrorMessage>
          </FormControl>

          <FormControl isRequired={method === 'email'} isInvalid={isInvalidEmail}>
            <FormLabel>Email {method === 'one_time_code' ? '(optional)' : ''}</FormLabel>
            <Input
              type="email"
              value={invite.email}
              onChange={(event) => handleInviteChange(invite.id, 'email', event.target.value)}
              placeholder="name@example.com"
            />
            <FormErrorMessage>Enter a valid email address.</FormErrorMessage>
          </FormControl>

          <Stack direction={{ base: 'column', sm: 'row' }} spacing={3}>
            <FormControl>
              <FormLabel>Role</FormLabel>
              <Select
                value={invite.role}
                onChange={(event) => handleInviteChange(invite.id, 'role', event.target.value)}
              >
                <option value="user">Learner</option>
                <option value="mentor">Mentor</option>
                <option value="ambassador">Ambassador</option>
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>Invitation Method</FormLabel>
              <Select
                value={invite.method}
                onChange={(event) => handleInviteChange(invite.id, 'method', event.target.value as InvitationMethod)}
              >
                <option value="email">Email invitation</option>
                <option value="one_time_code">One-time code</option>
              </Select>
              <FormHelperText color="gray.600">
                Choose one-time code for learners without email access.
              </FormHelperText>
            </FormControl>
          </Stack>

          <Flex justify="flex-end">
            <IconButton
              aria-label="Remove invitation"
              icon={<DeleteIcon />}
              onClick={() => handleRemoveInvite(invite.id)}
              variant="outline"
              colorScheme="red"
              isDisabled={inviteDrafts.length === 1 && !invite.name && !invite.email}
            />
          </Flex>
        </Stack>
      </Box>
    )
  }

  const renderCourseSelection = () => (
    <FormControl>
      <FormLabel>Assign Courses</FormLabel>
      <Stack spacing={2} maxH="200px" overflowY="auto" borderWidth="1px" borderRadius="md" p={3}>
        {isLoadingCourses ? (
          <Flex justify="center" align="center" py={6}>
            <Spinner size="sm" />
            <Text ml={2} color="gray.600">
              Loading courses…
            </Text>
          </Flex>
        ) : availableCourses.length === 0 ? (
          <Text color="gray.600">No courses available to assign yet.</Text>
        ) : (
          availableCourses.map((course) => (
            <Checkbox
              key={course.id}
              isChecked={formState.assignedCourses.includes(course.id)}
              onChange={() => handleToggleCourseSelection(course.id)}
            >
              {course.title}
            </Checkbox>
          ))
        )}
      </Stack>
      <FormHelperText color={helperTextColor}>{helperTextMessage}</FormHelperText>
    </FormControl>
  )

  const renderSectionHeader = (title: string, subtitle: string) => (
    <Box>
      <Text fontSize="xs" fontWeight="bold" letterSpacing="widest" color="gray.500">
        {title}
      </Text>
      <Text color="gray.700" fontWeight="medium" mt={1}>
        {subtitle}
      </Text>
    </Box>
  )

  const renderSessionBanner = () => {
    if (!adminSessionOutOfSync && !adminSessionError) return null
    return (
      <Alert status={adminSessionOutOfSync ? 'warning' : 'info'} variant="left-accent" borderRadius="md">
        <Flex align="flex-start" gap={3} flex="1" width="100%">
          <AlertIcon />
          <Box>
            <AlertTitle fontSize="sm">Refresh admin session</AlertTitle>
            <AlertDescription fontSize="sm">{sessionAlertDescription}</AlertDescription>
          </Box>
        </Flex>
        <Button
          size="sm"
          colorScheme="yellow"
          variant="solid"
          onClick={handleRefreshSessionClick}
          isLoading={isRefreshingSession}
        >
          Refresh Session
        </Button>
      </Alert>
    )
  }

  const renderInvitationSummary = () => (
    <Text fontSize="sm" color={inviteCount > (teamSizeLimit ?? Number.MAX_SAFE_INTEGER) ? 'red.500' : 'gray.600'}>
      {inviteCount} invitation{inviteCount === 1 ? '' : 's'} prepared.
      {teamSizeLimit === undefined
        ? ' Set a cohort size to limit the number of invitations.'
        : ` Cohort size allows up to ${teamSizeLimit} participant${teamSizeLimit === 1 ? '' : 's'}.`}
    </Text>
  )

  const renderInvitationResultsModal = () => {
    if (!invitationResults) return null

    return (
      <Modal isOpen={invitationResultsDisclosure.isOpen} onClose={invitationResultsDisclosure.onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Invitation summary</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Box>
                <Text fontWeight="semibold">Overall status</Text>
                <Text fontSize="sm" color="gray.600">
                  {invitationResults.successful} of {invitationResults.total} invitations completed successfully.
                </Text>
                {invitationResults.codeInvites > 0 && (
                  <Text fontSize="sm" color="gray.600" mt={2}>
                    One-time codes expire after 24 hours. Share them securely with learners.
                  </Text>
                )}
              </Box>

              {invitationResults.results.map((entry, index) => (
                <Box key={`${entry.userName}-${index}`} borderWidth="1px" borderRadius="md" p={3}>
                  <Flex justify="space-between" align="center" gap={3}>
                    <Box>
                      <Text fontWeight="semibold">{entry.userName}</Text>
                      {entry.userEmail && (
                        <Text fontSize="sm" color="gray.600">
                          {entry.userEmail}
                        </Text>
                      )}
                      <Text fontSize="sm" color="gray.600" mt={1}>
                        Method: {entry.method === 'email' ? 'Email invitation' : 'One-time code'}
                      </Text>
                    </Box>
                    <Box textAlign="right">
                      <Text fontSize="sm" color={entry.success ? 'green.500' : 'red.500'} fontWeight="semibold">
                        {entry.success ? 'Success' : 'Failed'}
                      </Text>
                      {entry.error && (
                        <Text fontSize="sm" color="red.500">
                          {entry.error}
                        </Text>
                      )}
                      {entry.method === 'one_time_code' && entry.success && entry.code && (
                        <Stack spacing={1} mt={2} align="flex-end">
                          <Code fontSize="md">{entry.code}</Code>
                          <Button
                            size="sm"
                            variant="ghost"
                            colorScheme="brand"
                            onClick={() => {
                              setValue(entry.code || '')
                              onCopy()
                            }}
                          >
                            {hasCopied ? 'Copied' : 'Copy code'}
                          </Button>
                        </Stack>
                      )}
                    </Box>
                  </Flex>
                </Box>
              ))}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={invitationResultsDisclosure.onClose} colorScheme="brand">
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    )
  }

  const sortedPartners = [...transformationPartners].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create Organization</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={6}>
              {renderSessionBanner()}

              <Stack spacing={4}>
                {renderSectionHeader('1. ORGANIZATION DETAILS',
                  'Provide the organization profile, cohort settings, and leadership assignments.')}

                <FormControl isRequired>
                  <FormLabel>Name</FormLabel>
                  <Input
                    value={formState.name}
                    onChange={handleChange('name')}
                    placeholder="Organization name"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Organization Code</FormLabel>
                  <Stack direction={{ base: 'column', sm: 'row' }} spacing={2}>
                    <Input value={formState.code} onChange={handleChange('code')} maxLength={20} textTransform="uppercase" />
                    <Button onClick={handleRegenerateCode} variant="outline">
                      Regenerate
                    </Button>
                  </Stack>
                </FormControl>

                <FormControl>
                  <FormLabel>Village</FormLabel>
                  <Input value={formState.village} onChange={handleChange('village')} placeholder="Village" />
                </FormControl>

                <FormControl>
                  <FormLabel>Cluster</FormLabel>
                  <Input value={formState.cluster} placeholder="Cluster" isReadOnly />
                  <FormHelperText color="gray.600">
                    Cluster is assigned automatically based on the cohort size.
                  </FormHelperText>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Cohort Size</FormLabel>
                  <Input
                    value={formState.teamSize}
                    onChange={handleChange('teamSize')}
                    placeholder="Number of learners"
                    type="number"
                    min={1}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Program Duration</FormLabel>
                  <Select value={formState.programDuration} onChange={handleChange('programDuration')}>
                    <option value="">Select duration</option>
                    {PROGRAM_DURATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <FormHelperText color="gray.600">
                    Duration determines the required number of courses for this cohort.
                  </FormHelperText>
                </FormControl>

                <FormControl>
                  <FormLabel>Cohort Start Date</FormLabel>
                  <Input type="date" value={formState.cohortStartDate} onChange={handleChange('cohortStartDate')} />
                  <FormHelperText color="gray.600">
                    This date can be updated later from the organization details page.
                  </FormHelperText>
                </FormControl>

                {renderCourseSelection()}

                <FormControl>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    value={formState.description}
                    onChange={handleChange('description')}
                    placeholder="Describe the organization"
                    rows={3}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Assign Transformation Partner</FormLabel>
                  <Select
                    placeholder="Select partner"
                    value={selectedPartnerId}
                    onChange={(event) => setSelectedPartnerId(event.target.value)}
                  >
                    {sortedPartners.map((partner) => (
                      <option key={partner.id} value={partner.id}>
                        {partner.name} {partner.email ? `(${partner.email})` : ''}
                      </option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl isDisabled={isLoadingLeads && mentors.length === 0}>
                  <FormLabel>Assign Mentor (optional)</FormLabel>
                  <Select
                    placeholder={isLoadingLeads ? 'Loading mentors…' : 'Select mentor'}
                    value={formState.assignedMentorId}
                    onChange={handleChange('assignedMentorId')}
                  >
                    <option value="">No mentor assigned</option>
                    {mentors.map((mentor) => (
                      <option key={mentor.id} value={mentor.id}>
                        {mentor.name}
                        {mentor.email ? ` (${mentor.email})` : ''}
                      </option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl isDisabled={isLoadingLeads && ambassadors.length === 0}>
                  <FormLabel>Assign Ambassador (optional)</FormLabel>
                  <Select
                    placeholder={isLoadingLeads ? 'Loading ambassadors…' : 'Select ambassador'}
                    value={formState.assignedAmbassadorId}
                    onChange={handleChange('assignedAmbassadorId')}
                  >
                    <option value="">No ambassador assigned</option>
                    {ambassadors.map((ambassador) => (
                      <option key={ambassador.id} value={ambassador.id}>
                        {ambassador.name}
                        {ambassador.email ? ` (${ambassador.email})` : ''}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              <Stack spacing={4}>
                {renderSectionHeader('2. ADD USERS',
                  'Invite learners now or generate one-time access codes for those without email. The total cannot exceed the cohort size.')}

                <Flex direction={{ base: 'column', sm: 'row' }} gap={2}>
                  <Button
                    onClick={handleAddInvite}
                    leftIcon={<AddIcon />}
                    variant="outline"
                    colorScheme="brand"
                    isDisabled={Boolean(teamSizeLimit && !canAddMoreInvites)}
                  >
                    Add manual entry
                  </Button>

                  <Button onClick={handleFileUploadClick} variant="outline" isLoading={isProcessingCsv}>
                    Upload CSV
                  </Button>

                  <Button variant="link" colorScheme="brand" onClick={handleDownloadTemplate}>
                    Download template
                  </Button>

                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    display="none"
                    onChange={handleCsvUpload}
                  />
                </Flex>

                <Stack spacing={3}>{inviteDrafts.map((invite) => renderInviteForm(invite))}</Stack>

                {renderInvitationSummary()}
              </Stack>
            </Stack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="brand" onClick={handleSubmit} isLoading={isSubmitting} isDisabled={isSubmitting}>
              Create Organization
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {renderInvitationResultsModal()}
    </>
  )
}
