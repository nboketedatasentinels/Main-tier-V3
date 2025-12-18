import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  Heading,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tooltip,
  Tr,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { Building2, Calendar, Download, Edit3, Eye, ExternalLink, Plus, RefreshCcw, Search, Shield, Timer, Trash2, User, UserCircle2, UserSquare2, Users } from 'lucide-react'
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { format, formatDistanceToNow, isAfter, isValid, parseISO } from 'date-fns'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { UserProfile, UserRole } from '@/types'

interface LeadershipProfile extends UserProfile {
  availabilityStatus?: string
  companyCode?: string
  companyName?: string
  timezone?: string
  mentorId?: string
  ambassadorId?: string
  accountStatus?: string
  notes?: string
  lastActive?: string
  registrationDate?: string
  lastInteraction?: string
}

interface MentorshipSession {
  id: string
  mentorId: string
  learnerId: string
  scheduledAt: Date
  topic: string
  agenda?: string
  status: 'scheduled' | 'completed' | 'cancelled'
  meetingLink?: string
  createdAt?: Date
}

interface CompanyRecord {
  id: string
  name: string
  code?: string
}

interface PartnerProfile {
  id: string
  name: string
  title?: string
  bio?: string
  email?: string
  timezone?: string
  rating?: number
  ratingCount?: number
  sessionsConducted?: number
  nextSession?: string
  resources?: { label: string; url: string }[]
  expertise?: string[]
  hobbies?: string[]
  funFact?: string
  avatarUrl?: string
  officeLocation?: string
  xp?: number
  favoritePillar?: string
}

const formatDisplayDate = (date: Date) => format(date, 'EEE, MMM d')
const relativeTime = (date: Date) => {
  try {
    return formatDistanceToNow(date, { addSuffix: true })
  } catch (err) {
    return ''
  }
}

const initialsFromName = (name: string) => {
  const [first = '', last = ''] = name.split(' ')
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

const badgeColor = (status?: string) => {
  if (!status) return 'gray'
  const value = status.toLowerCase()
  if (value.includes('active') || value.includes('available')) return 'green'
  if (value.includes('limited')) return 'yellow'
  if (value.includes('leave')) return 'red'
  return 'blue'
}

export const LeadershipCouncilPage: React.FC = () => {
  const { profile, user } = useAuth()
  const toast = useToast()

  const [mentorProfile, setMentorProfile] = useState<LeadershipProfile | null>(null)
  const [ambassadorProfile, setAmbassadorProfile] = useState<LeadershipProfile | null>(null)
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null)
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null)

  const [sessions, setSessions] = useState<MentorshipSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)

  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleTopic, setScheduleTopic] = useState('')
  const [scheduleAgenda, setScheduleAgenda] = useState('')
  const [scheduleNotes, setScheduleNotes] = useState('')
  const [scheduleLink, setScheduleLink] = useState('')
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false)

  const sessionsModal = useDisclosure()
  const scheduleModal = useDisclosure()

  const [leadershipTab, setLeadershipTab] = useState<'mentor' | 'ambassador'>('mentor')
  const [adminLoading, setAdminLoading] = useState(false)
  const [mentors, setMentors] = useState<LeadershipProfile[]>([])
  const [ambassadors, setAmbassadors] = useState<LeadershipProfile[]>([])
  const [availableUsers, setAvailableUsers] = useState<LeadershipProfile[]>([])
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [promoteModalRole, setPromoteModalRole] = useState<'mentor' | 'ambassador'>('mentor')
  const promoteModal = useDisclosure()

  const [editTarget, setEditTarget] = useState<LeadershipProfile | null>(null)
  const editModal = useDisclosure()
  const [editCompany, setEditCompany] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [mutatingId, setMutatingId] = useState<string | null>(null)

  const isAdmin = profile?.role === UserRole.COMPANY_ADMIN || profile?.role === UserRole.SUPER_ADMIN
  const isSuperAdmin = profile?.role === UserRole.SUPER_ADMIN

  const loadAssignments = useCallback(async () => {
    if (!profile?.id) return
    setAssignmentsLoading(true)
    setAssignmentsError(null)

    const unsubscribers: (() => void)[] = []

    try {
      const profileRef = doc(db, 'profiles', profile.id)
      const profileSnap = await getDoc(profileRef)
      const data = (profileSnap.data() || {}) as LeadershipProfile
      const mentorId = (data.mentorId || (profile as LeadershipProfile).mentorId) as string | undefined
      const ambassadorId = (data.ambassadorId || (profile as LeadershipProfile).ambassadorId) as string | undefined

      if (mentorId) {
        const mentorRef = doc(db, 'profiles', mentorId)
        const unsub = onSnapshot(mentorRef, (snap) => {
          const mentorData = snap.data() as LeadershipProfile | undefined
          if (mentorData) {
            setMentorProfile({
              ...mentorData,
              id: mentorId,
              fullName: mentorData.fullName || `${mentorData.firstName} ${mentorData.lastName}`,
            })
          }
        })
        unsubscribers.push(unsub)
      } else {
        setMentorProfile(null)
      }

      if (ambassadorId) {
        const ambassadorRef = doc(db, 'profiles', ambassadorId)
        const unsub = onSnapshot(ambassadorRef, (snap) => {
          const ambassadorData = snap.data() as LeadershipProfile | undefined
          if (ambassadorData) {
            setAmbassadorProfile({
              ...ambassadorData,
              id: ambassadorId,
              fullName: ambassadorData.fullName || `${ambassadorData.firstName} ${ambassadorData.lastName}`,
            })
          }
        })
        unsubscribers.push(unsub)
      } else {
        setAmbassadorProfile(null)
      }

      const partnerRef = doc(db, 'transformation_partners', 'primary')
      const partnerSnap = await getDoc(partnerRef)
      if (partnerSnap.exists()) {
        const partnerData = partnerSnap.data() as PartnerProfile
        setPartnerProfile({ ...partnerData, id: partnerSnap.id })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load leadership assignments.'
      setAssignmentsError(message)
    } finally {
      setAssignmentsLoading(false)
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [profile])

  const loadSessions = useCallback(() => {
    if (!profile?.id) return () => undefined
    setSessionsLoading(true)
    setSessionsError(null)

    const sessionsQuery = query(
      collection(db, 'mentorship_sessions'),
      where('learner_id', '==', profile.id),
      where('status', '==', 'scheduled'),
      orderBy('scheduled_at', 'asc'),
    )

    const unsubscribe = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        const loadedSessions = snapshot.docs
          .reduce<MentorshipSession[]>((acc, docSnapshot) => {
            const data = docSnapshot.data()
            const scheduledAt = data.scheduled_at?.toDate?.() || (data.scheduled_at ? new Date(data.scheduled_at) : null)
            if (!scheduledAt || !isValid(scheduledAt)) return acc

            const session: MentorshipSession = {
              id: docSnapshot.id,
              mentorId: data.mentor_id,
              learnerId: data.learner_id,
              scheduledAt,
              topic: data.topic || 'Mentorship session',
              agenda: data.agenda || undefined,
              status: data.status || 'scheduled',
              meetingLink: data.meeting_link || undefined,
              createdAt: data.created_at?.toDate?.(),
            }

            if (isAfter(scheduledAt, new Date(Date.now() - 5 * 60 * 1000))) {
              acc.push(session)
            }
            return acc
          }, [])
          .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())

        setSessions(loadedSessions)
        setSessionsLoading(false)
      },
      (error) => {
        setSessionsError(error.message)
        setSessionsLoading(false)
      },
    )

    return unsubscribe
  }, [profile?.id])

  const loadLeadershipData = useCallback(async () => {
    if (!isAdmin) return
    setAdminLoading(true)
    try {
      const [profilesSnap, companiesSnap] = await Promise.all([
        getDocs(collection(db, 'profiles')),
        getDocs(collection(db, 'companies')),
      ])

      const loadedProfiles: LeadershipProfile[] = profilesSnap.docs
        .map((docSnapshot) => ({ ...(docSnapshot.data() as LeadershipProfile), id: docSnapshot.id }))
        .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''))

      setMentors(loadedProfiles.filter((p) => p.role === UserRole.MENTOR))
      setAmbassadors(loadedProfiles.filter((p) => p.role === UserRole.AMBASSADOR))
      setAvailableUsers(loadedProfiles.filter((p) => ![UserRole.MENTOR, UserRole.AMBASSADOR].includes(p.role)))

      const loadedCompanies: CompanyRecord[] = companiesSnap.docs
        .map((docSnapshot) => {
          const data = docSnapshot.data() as CompanyRecord
          return { id: docSnapshot.id, name: data.name, code: data.code }
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      setCompanies(loadedCompanies)
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Check your connection and try again.'
      toast({
        title: 'Unable to load leadership data',
        description,
        status: 'error',
      })
    } finally {
      setAdminLoading(false)
    }
  }, [isAdmin, toast])

  useEffect(() => {
    const cleanupRef: { fn?: () => void } = {}
    loadAssignments().then((cleanup) => {
      cleanupRef.fn = cleanup || undefined
    })

    return () => {
      cleanupRef.fn?.()
    }
  }, [loadAssignments])

  useEffect(() => {
    const unsubscribe = loadSessions()
    return () => unsubscribe && unsubscribe()
  }, [loadSessions])

  useEffect(() => {
    loadLeadershipData()
  }, [loadLeadershipData])

  const handleScheduleSession = async () => {
    if (!mentorProfile?.id) {
      toast({ title: 'Could not verify mentor assignment', status: 'error' })
      return
    }

    if (!scheduleDate || !scheduleTime || !scheduleTopic.trim()) {
      toast({ title: 'Please complete required fields', status: 'error' })
      return
    }

    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`)
    if (!isValid(scheduledAt) || scheduledAt.getTime() < Date.now()) {
      toast({ title: 'Please choose a future date and time', status: 'error' })
      return
    }

    if (scheduleLink && !/^https?:\/\//i.test(scheduleLink)) {
      toast({ title: 'Meeting link must be a valid URL', status: 'error' })
      return
    }

    setScheduleSubmitting(true)
    try {
      await addDoc(collection(db, 'mentorship_sessions'), {
        learner_id: profile?.id,
        mentor_id: mentorProfile.id,
        scheduled_at: Timestamp.fromDate(scheduledAt),
        topic: scheduleTopic.trim(),
        agenda: scheduleAgenda.trim() || null,
        notes: scheduleNotes.trim() || null,
        meeting_link: scheduleLink.trim() || null,
        status: 'scheduled',
        created_at: serverTimestamp(),
        created_by: 'learner',
      })

      toast({
        title: 'Session scheduled',
        description: `Your session with ${mentorProfile.firstName || mentorProfile.fullName} is set for ${formatDisplayDate(
          scheduledAt,
        )} at ${format(scheduledAt, 'h:mm a')}.`,
        status: 'success',
      })

      setScheduleDate('')
      setScheduleTime('')
      setScheduleTopic('')
      setScheduleAgenda('')
      setScheduleNotes('')
      setScheduleLink('')
      scheduleModal.onClose()
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Try again in a moment.'
      toast({
        title: 'Failed to create session',
        description,
        status: 'error',
      })
    } finally {
      setScheduleSubmitting(false)
    }
  }

  const downloadIcs = (session: MentorshipSession) => {
    const start = session.scheduledAt
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `SUMMARY:Mentorship session with ${mentorProfile?.fullName || 'Mentor'}`,
      `DTSTART:${format(start, "yyyyMMdd'T'HHmmss")}`,
      `DTEND:${format(end, "yyyyMMdd'T'HHmmss")}`,
      `DESCRIPTION:${session.topic}${session.agenda ? `\\n${session.agenda}` : ''}`,
      session.meetingLink ? `LOCATION:${session.meetingLink}` : 'LOCATION:Virtual meeting',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n')

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'mentorship-session.ics'
    link.click()
    URL.revokeObjectURL(url)
  }

  const filteredLeadership = useMemo(() => {
    const pool = leadershipTab === 'mentor' ? mentors : ambassadors
    if (!searchTerm.trim()) return pool
    const lower = searchTerm.toLowerCase()
    return pool.filter((member) =>
      [member.fullName, member.email, member.companyCode, member.companyName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(lower)),
    )
  }, [ambassadors, leadershipTab, mentors, searchTerm])

  const openPromoteModal = (role: 'mentor' | 'ambassador') => {
    setPromoteModalRole(role)
    promoteModal.onOpen()
  }

  const handlePromote = async (form: { userId: string; companyId?: string; notes?: string }) => {
    setMutatingId('promote')
    try {
      const company = companies.find((c) => c.id === form.companyId)
      await updateDoc(doc(db, 'profiles', form.userId), {
        role: promoteModalRole === 'mentor' ? UserRole.MENTOR : UserRole.AMBASSADOR,
        accountStatus: 'active',
        companyId: form.companyId || null,
        companyCode: company?.code || null,
        companyName: company?.name || null,
        isActiveAmbassador: promoteModalRole === 'ambassador',
        notes: form.notes || null,
      })

      await addDoc(collection(db, 'notifications'), {
        user_id: form.userId,
        type: 'role_assignment',
        message: `You have been assigned the role of ${promoteModalRole}.`,
        is_read: false,
        created_at: serverTimestamp(),
        metadata: {
          notes: form.notes,
          companyName: company?.name,
          companyCode: company?.code,
        },
      })

      toast({ title: 'Leadership role assigned', status: 'success' })
      promoteModal.onClose()
      loadLeadershipData()
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Unable to promote member'
      toast({ title: 'Unable to promote member', description, status: 'error' })
    } finally {
      setMutatingId(null)
    }
  }

  const openEdit = (member: LeadershipProfile) => {
    setEditTarget(member)
    setEditCompany(member.companyId || '')
    setEditStatus(member.accountStatus || '')
    setEditNotes(member.notes || '')
    editModal.onOpen()
  }

  const handleEditSave = async () => {
    if (!editTarget) return
    setMutatingId(editTarget.id)
    try {
      const company = companies.find((c) => c.id === editCompany)
      await updateDoc(doc(db, 'profiles', editTarget.id), {
        companyId: editCompany || null,
        companyCode: company?.code || null,
        companyName: company?.name || null,
        accountStatus: editStatus || null,
        isActiveAmbassador: editTarget.role === UserRole.AMBASSADOR ? editStatus === 'active' : undefined,
        notes: editNotes || null,
      })
      toast({ title: 'Leadership profile updated.', status: 'success' })
      editModal.onClose()
      setEditTarget(null)
      loadLeadershipData()
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Unable to update member'
      toast({ title: 'Unable to update member', description, status: 'error' })
    } finally {
      setMutatingId(null)
    }
  }

  const handleRemove = async (member: LeadershipProfile) => {
    const confirmed = window.confirm(`Remove ${member.fullName || member.email} from the Leadership Council?`)
    if (!confirmed) return
    setMutatingId(member.id)
    try {
      await updateDoc(doc(db, 'profiles', member.id), {
        role: UserRole.PAID_MEMBER,
        companyId: null,
        companyCode: null,
        companyName: null,
        isActiveAmbassador: false,
      })
      toast({ title: `${member.fullName || 'Member'} has been removed from the council.`, status: 'success' })
      loadLeadershipData()
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Unable to remove member'
      toast({ title: 'Unable to remove member', description, status: 'error' })
    } finally {
      setMutatingId(null)
    }
  }

  const renderSessionCards = (limitCount?: number) => {
    const items = limitCount ? sessions.slice(0, limitCount) : sessions
    return (
      <Stack spacing={3}>
        {items.map((session) => (
          <Flex
            key={session.id}
            p={4}
            border="1px dashed"
            borderColor="gray.200"
            rounded="lg"
            align="center"
            gap={4}
            bg="white"
          >
            <Box p={3} bg="blue.50" rounded="lg" display="inline-flex">
              <Icon as={Calendar} color="blue.600" />
            </Box>
            <Box flex="1">
              <HStack justify="space-between" align="start" mb={1} spacing={3} flexWrap="wrap">
                <HStack spacing={2}>
                  <Text fontWeight="bold" color="gray.800">
                    {formatDisplayDate(session.scheduledAt)}
                  </Text>
                  <Text color="gray.500">{format(session.scheduledAt, 'h:mm a')}</Text>
                  <Badge colorScheme="green">{session.status}</Badge>
                </HStack>
                <Badge colorScheme="green" variant="subtle">
                  {relativeTime(session.scheduledAt).replace('about ', '')}
                </Badge>
              </HStack>
              <Text color="gray.700">{session.topic}</Text>
              {session.agenda && (
                <Text fontSize="sm" color="gray.500" mt={1}>
                  {session.agenda}
                </Text>
              )}
            </Box>
            <Button size="sm" variant="ghost" leftIcon={<Download size={16} />} onClick={() => downloadIcs(session)}>
              Download
            </Button>
          </Flex>
        ))}
      </Stack>
    )
  }

  const adminActionLocked = !isSuperAdmin

  const mentorSessionsSummary = useMemo(() => {
    if (sessionsLoading) return 'Checking your schedule...'
    if (sessions.length === 0) return 'No sessions scheduled yet. Use the schedule button to plan your next conversation.'
    return `Your next ${sessions.length} session(s) with ${mentorProfile?.firstName || mentorProfile?.fullName || 'your mentor'} at a glance`
  }, [sessions.length, sessionsLoading, mentorProfile?.firstName, mentorProfile?.fullName])

  if (!user) {
    return (
      <Card bg="surface.default" borderColor="border.subtle" borderWidth="1px">
        <CardBody>
          <Stack spacing={3} align="center" textAlign="center">
            <Icon as={UserCircle2} boxSize={10} color="text.muted" />
            <Heading size="md">Sign in to view your Leadership Council</Heading>
            <Text color="text.secondary">Create an account or sign in to connect with your mentor and ambassador.</Text>
          </Stack>
        </CardBody>
      </Card>
    )
  }

  return (
    <Stack spacing={6}>
      <Card bgGradient="linear(to-r, blue.50, surface.default)" border="1px solid" borderColor="border.subtle">
        <CardBody>
          <Stack spacing={2}>
            <Badge colorScheme="blue" width="fit-content" rounded="full" px={3} py={1} fontWeight="semibold">
              Leadership Council
            </Badge>
            <Heading size="lg">Stay connected with the people supporting your transformation journey.</Heading>
            <Text color="text.secondary">
              Your dedicated mentor, ambassador, and transformation partner are highlighted below. Schedule sessions,
              review upcoming meetings, and explore your leadership network.
            </Text>
          </Stack>
        </CardBody>
      </Card>

      <Grid templateColumns={{ base: '1fr', xl: '2fr 1.2fr' }} gap={6} alignItems="start">
        <GridItem>
          <Stack spacing={6}>
            <Card borderColor="border.subtle" borderWidth="1px" bg="surface.default">
              <CardHeader pb={0}>
                <HStack justify="space-between" align="start">
                  <Box>
                    <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="semibold">
                      Mentor Assignment
                    </Text>
                    <Heading size="md" color="text.primary">
                      {mentorProfile?.fullName || mentorProfile?.firstName ? mentorProfile.fullName || mentorProfile.firstName : 'No mentor assigned'}
                    </Heading>
                    <HStack spacing={2} color="text.muted" mt={2}>
                      <Icon as={Building2} />
                      <Text>
                        {mentorProfile?.companyCode
                          ? `Supporting company code ${mentorProfile.companyCode}`
                          : 'Supporting your organization'}
                      </Text>
                    </HStack>
                  </Box>
                  <VStack spacing={3} align="end">
                    <Avatar
                      size="lg"
                      name={mentorProfile?.fullName}
                      src={mentorProfile?.avatarUrl}
                      bg="indigo.500"
                    >
                      {!mentorProfile?.avatarUrl && mentorProfile?.fullName && initialsFromName(mentorProfile.fullName)}
                    </Avatar>
                    {mentorProfile?.availabilityStatus && (
                      <Badge colorScheme={badgeColor(mentorProfile.availabilityStatus)} variant="subtle">
                        {mentorProfile.availabilityStatus}
                      </Badge>
                    )}
                  </VStack>
                </HStack>
              </CardHeader>
              <CardBody pt={4}>
                {assignmentsLoading && (
                  <Flex direction="column" gap={3} p={4} border="1px dashed" borderColor="border.subtle" rounded="xl">
                    <Spinner />
                    <Text color="text.secondary">Loading your mentor assignment...</Text>
                  </Flex>
                )}

                {assignmentsError && (
                  <Alert status="error" rounded="lg" mb={4}>
                    <AlertIcon />
                    <Box>
                      <AlertTitle>We couldn't load your mentor right now.</AlertTitle>
                      <AlertDescription>{assignmentsError}</AlertDescription>
                    </Box>
                    <Button size="sm" leftIcon={<RefreshCcw size={16} />} ml={4} onClick={loadAssignments}>
                      Try again
                    </Button>
                  </Alert>
                )}

                {!assignmentsLoading && !mentorProfile && !assignmentsError && (
                  <Flex direction="column" align="center" textAlign="center" p={6} gap={3}>
                    <Icon as={User} boxSize={10} color="text.muted" />
                    <Heading size="sm">No mentor assigned yet</Heading>
                    <Text color="text.secondary">Please contact your administrator for support.</Text>
                  </Flex>
                )}

                {mentorProfile && (
                  <Stack spacing={4}>
                    <HStack spacing={3} flexWrap="wrap">
                      <Tooltip
                        label={mentorProfile ? 'Schedule with your assigned mentor' : 'You are only able to schedule with your assigned mentor'}
                        placement="top"
                      >
                        <Button
                          leftIcon={<Calendar size={18} />}
                          variant="outline"
                          isDisabled={!mentorProfile || scheduleSubmitting}
                          onClick={scheduleModal.onOpen}
                        >
                          Schedule a session
                        </Button>
                      </Tooltip>
                      <Button
                        leftIcon={<Eye size={18} />}
                        variant="outline"
                        onClick={sessionsModal.onOpen}
                        isDisabled={sessionsLoading}
                      >
                        {sessionsLoading ? 'Loading...' : 'View calendar'}
                      </Button>
                    </HStack>

                    <Box p={4} border="1px solid" borderColor="border.subtle" rounded="lg" bg="surface.subtle">
                      <HStack justify="space-between" align="start" mb={3}>
                        <Text fontWeight="bold" color="text.primary">
                          Your mentor sessions
                        </Text>
                        {sessions.length > 3 && (
                          <Link color="indigo.600" fontWeight="semibold" onClick={sessionsModal.onOpen}>
                            View all upcoming sessions
                          </Link>
                        )}
                      </HStack>

                      <Text color="text.secondary" mb={3}>
                        {mentorSessionsSummary}
                      </Text>

                      {sessionsLoading && (
                        <Flex
                          align="center"
                          gap={3}
                          p={4}
                          border="1px dashed"
                          borderColor="border.subtle"
                          rounded="lg"
                          bg="surface.default"
                        >
                          <Spinner />
                          <Text>Checking for upcoming sessions...</Text>
                        </Flex>
                      )}

                      {sessionsError && (
                        <Alert status="error" colorScheme="red" rounded="lg">
                          <AlertIcon />
                          <Box>
                            <AlertTitle>We couldn't load your upcoming sessions.</AlertTitle>
                            <AlertDescription>{sessionsError}</AlertDescription>
                          </Box>
                        </Alert>
                      )}

                      {!sessionsLoading && !sessionsError && sessions.length === 0 && (
                        <Flex
                          direction="column"
                          align="center"
                          textAlign="center"
                          p={5}
                          gap={2}
                          border="1px dashed"
                          borderColor="border.subtle"
                          rounded="lg"
                          bg="surface.default"
                        >
                          <Icon as={Calendar} color="text.muted" />
                          <Text>No sessions scheduled yet.</Text>
                          <Text fontSize="sm" color="text.secondary">
                            Use the schedule button to plan your next conversation.
                          </Text>
                        </Flex>
                      )}

                      {!sessionsLoading && !sessionsError && sessions.length > 0 && renderSessionCards(3)}

                      {mentorProfile?.lastInteraction && (
                        <Text mt={3} fontSize="sm" color="text.muted">
                          Last interaction: {format(parseISO(mentorProfile.lastInteraction), 'PPP')}
                        </Text>
                      )}
                    </Box>
                  </Stack>
                )}
              </CardBody>
            </Card>

            <Card borderColor="border.subtle" borderWidth="1px" bg="surface.default">
              <CardHeader pb={0}>
                <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="semibold">
                  Ambassador Assignment
                </Text>
                <Heading size="md" color="text.primary" mt={1}>
                  {ambassadorProfile?.fullName || 'Your ambassador is here to champion your progress'}
                </Heading>
              </CardHeader>
              <CardBody>
                {assignmentsLoading && (
                  <Flex align="center" gap={3} p={4} border="1px dashed" borderColor="gray.200" rounded="xl">
                    <Spinner />
                    <Text color="gray.600">Loading your ambassador assignment...</Text>
                  </Flex>
                )}

                {assignmentsError && (
                  <Alert status="warning" rounded="lg" mb={4}>
                    <AlertIcon />
                    <Box>
                      <AlertTitle>We couldn't load your ambassador right now.</AlertTitle>
                      <AlertDescription>{assignmentsError}</AlertDescription>
                    </Box>
                    <Button size="sm" leftIcon={<RefreshCcw size={16} />} ml={4} onClick={loadAssignments}>
                      Try again
                    </Button>
                  </Alert>
                )}

                {!assignmentsLoading && !ambassadorProfile && !assignmentsError && (
                  <Flex direction="column" align="center" textAlign="center" p={6} gap={3}>
                    <Icon as={User} boxSize={10} color="gray.400" />
                    <Heading size="sm">No ambassador assigned yet</Heading>
                    <Text color="gray.600">
                      Your community hasn't been paired with an ambassador. Please contact your administrator for support.
                    </Text>
                  </Flex>
                )}

                {ambassadorProfile && (
                  <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" gap={4} align="center">
                    <Box>
                      <Text color="gray.700">
                        Your ambassador is here to champion your progress and connect you with new opportunities.
                      </Text>
                      <HStack spacing={3} mt={3} color="gray.600">
                        <Icon as={Users} />
                        <Text>
                          {ambassadorProfile.companyName || 'Organization-wide'}
                          {ambassadorProfile.companyCode ? ` (${ambassadorProfile.companyCode})` : ''}
                        </Text>
                      </HStack>
                    </Box>
                    <VStack spacing={3} align="center">
                      <Avatar
                        size="lg"
                        name={ambassadorProfile.fullName}
                        src={ambassadorProfile.avatarUrl}
                        bg="indigo.500"
                      >
                        {!ambassadorProfile.avatarUrl && ambassadorProfile.fullName &&
                          initialsFromName(ambassadorProfile.fullName)}
                      </Avatar>
                      {ambassadorProfile.availabilityStatus && (
                        <Badge colorScheme={badgeColor(ambassadorProfile.availabilityStatus)} variant="subtle">
                          {ambassadorProfile.availabilityStatus}
                        </Badge>
                      )}
                    </VStack>
                  </Flex>
                )}
              </CardBody>
            </Card>

            <Card borderColor="gray.200" borderWidth="1px">
              <CardHeader pb={2}>
                <HStack spacing={3} align="center">
                  <Icon as={Shield} color="indigo.500" />
                  <Box>
                    <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold">
                      Transformation Partner
                    </Text>
                    <Heading size="md">Program support & resources</Heading>
                  </Box>
                </HStack>
              </CardHeader>
              <CardBody>
                {partnerProfile ? (
                  <Stack spacing={4}>
                    <HStack justify="space-between" align="start" spacing={4} flexWrap="wrap">
                      <HStack spacing={3} align="start">
                        <Avatar size="lg" name={partnerProfile.name} src={partnerProfile.avatarUrl} bg="blue.500">
                          {!partnerProfile.avatarUrl && initialsFromName(partnerProfile.name)}
                        </Avatar>
                        <Box>
                          <Heading size="sm">{partnerProfile.name}</Heading>
                          <Text color="gray.600">{partnerProfile.title || 'Transformation Partner'}</Text>
                          <Text color="gray.500" fontSize="sm">
                            {partnerProfile.officeLocation || partnerProfile.timezone || 'Global support'}
                          </Text>
                        </Box>
                      </HStack>
                      <HStack spacing={3}>
                        {partnerProfile.rating && (
                          <Badge colorScheme="yellow" variant="subtle">
                            ⭐ {partnerProfile.rating.toFixed(1)} / 5 ({partnerProfile.ratingCount || 0} reviews)
                          </Badge>
                        )}
                        {partnerProfile.xp && (
                          <Badge colorScheme="purple" variant="subtle">
                            XP {partnerProfile.xp.toLocaleString()}
                          </Badge>
                        )}
                      </HStack>
                    </HStack>

                    <Text color="gray.700">{partnerProfile.bio || 'Dedicated program partner supporting your transformation journey.'}</Text>

                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                      <Box p={4} border="1px solid" borderColor="gray.200" rounded="lg" bg="gray.50">
                        <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold">
                          Session statistics
                        </Text>
                        <Text fontWeight="bold" color="gray.800" mt={2}>
                          {partnerProfile.sessionsConducted || 0} sessions
                        </Text>
                        {partnerProfile.nextSession && (
                          <Text fontSize="sm" color="gray.600">Next: {partnerProfile.nextSession}</Text>
                        )}
                      </Box>
                      <Box p={4} border="1px solid" borderColor="gray.200" rounded="lg" bg="gray.50">
                        <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold">
                          Expertise
                        </Text>
                        <Text mt={2} color="gray.700">
                          {partnerProfile.expertise?.join(', ') || 'Leadership, change management, growth.'}
                        </Text>
                      </Box>
                      <Box p={4} border="1px solid" borderColor="gray.200" rounded="lg" bg="gray.50">
                        <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold">
                          Resources shared
                        </Text>
                        <VStack align="start" spacing={2} mt={2}>
                          {(partnerProfile.resources || []).map((resource) => (
                            <Link key={resource.url} href={resource.url} color="indigo.600" isExternal>
                              {resource.label}
                            </Link>
                          ))}
                          {(!partnerProfile.resources || partnerProfile.resources.length === 0) && (
                            <Text color="gray.600">Guides and templates coming soon.</Text>
                          )}
                        </VStack>
                      </Box>
                    </SimpleGrid>

                    <Divider />

                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                      <Box>
                        <HStack spacing={2}>
                          <Icon as={Timer} color="gray.500" />
                          <Text color="gray.600">Local time: {partnerProfile.timezone || 'Not provided'}</Text>
                        </HStack>
                        {partnerProfile.email && (
                          <HStack spacing={2} mt={2}>
                            <Icon as={ExternalLink} color="gray.500" />
                            <Link href={`mailto:${partnerProfile.email}`} color="indigo.600">
                              {partnerProfile.email}
                            </Link>
                          </HStack>
                        )}
                      </Box>
                      <Stack spacing={2}>
                        {partnerProfile.hobbies && partnerProfile.hobbies.length > 0 && (
                          <Text color="gray.600">Hobbies: {partnerProfile.hobbies.join(', ')}</Text>
                        )}
                        {partnerProfile.funFact && <Text color="gray.600">Fun fact: {partnerProfile.funFact}</Text>}
                        {partnerProfile.favoritePillar && (
                          <Text color="gray.600">Favorite LIFT pillar: {partnerProfile.favoritePillar}</Text>
                        )}
                      </Stack>
                    </SimpleGrid>
                  </Stack>
                ) : (
                  <Flex direction="column" align="center" gap={3} p={6}>
                    <Spinner />
                    <Text color="gray.600">Loading transformation partner...</Text>
                  </Flex>
                )}
              </CardBody>
            </Card>
          </Stack>
        </GridItem>

        <GridItem>
          <Card borderColor="purple.200" borderWidth="1px" bgGradient="linear(to-b, purple.50, white)">
            <CardHeader pb={3}>
              <Stack spacing={2}>
                <HStack spacing={3} align="center">
                  <Icon as={UserSquare2} color="purple.600" />
                  <Box>
                    <Text fontSize="xs" textTransform="uppercase" color="purple.600" fontWeight="semibold">
                      Leadership Council
                    </Text>
                    <Heading size="md">Mentor & Ambassador oversight</Heading>
                    <Text color="gray.600" mt={1}>
                      Promote trusted members, track their organization alignment, and ensure our leadership network has the right support.
                    </Text>
                  </Box>
                </HStack>
                {!isAdmin && (
                  <Alert status="warning" variant="subtle" rounded="lg">
                    <AlertIcon />
                    <Box>
                      <AlertTitle>Admin access required</AlertTitle>
                      <AlertDescription>
                        You need admin permissions to view leadership assignments. Contact a super admin if you need access.
                      </AlertDescription>
                    </Box>
                  </Alert>
                )}
              </Stack>
            </CardHeader>
            {isAdmin && (
              <CardBody>
                <SimpleGrid columns={2} spacing={3} mb={4}>
                  <Box p={4} bg="white" border="1px solid" borderColor="gray.200" rounded="lg" boxShadow="sm">
                    <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="bold">
                      Active mentors
                    </Text>
                    <Heading size="lg" mt={2}>{mentors.length}</Heading>
                  </Box>
                  <Box p={4} bg="white" border="1px solid" borderColor="gray.200" rounded="lg" boxShadow="sm">
                    <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="bold">
                      Active ambassadors
                    </Text>
                    <Heading size="lg" mt={2}>{ambassadors.length}</Heading>
                  </Box>
                </SimpleGrid>

                <HStack spacing={3} mb={4} align="center">
                  <Box
                    display="inline-flex"
                    p={1}
                    rounded="full"
                    bg={leadershipTab === 'mentor' ? 'white' : 'gray.100'}
                    border="1px solid"
                    borderColor="gray.200"
                  >
                    <Button
                      size="sm"
                      variant={leadershipTab === 'mentor' ? 'solid' : 'ghost'}
                      colorScheme="purple"
                      rounded="full"
                      onClick={() => setLeadershipTab('mentor')}
                    >
                      Mentor
                    </Button>
                    <Button
                      size="sm"
                      variant={leadershipTab === 'ambassador' ? 'solid' : 'ghost'}
                      colorScheme="purple"
                      rounded="full"
                      onClick={() => setLeadershipTab('ambassador')}
                    >
                      Ambassador
                    </Button>
                  </Box>

                  <InputGroup maxW="260px" bg="white" borderRadius="md" boxShadow="sm">
                    <InputLeftElement pointerEvents="none">
                      <Icon as={Search} color="gray.400" />
                    </InputLeftElement>
                    <Input
                      placeholder={`Search ${leadershipTab === 'mentor' ? 'mentors' : 'ambassadors'}`}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </InputGroup>

                  {isSuperAdmin && (
                    <Button
                      size="sm"
                      leftIcon={<Plus size={16} />}
                      colorScheme="purple"
                      onClick={() => openPromoteModal(leadershipTab)}
                    >
                      Add {leadershipTab === 'mentor' ? 'Mentor' : 'Ambassador'}
                    </Button>
                  )}
                </HStack>

                <Box border="1px solid" borderColor="gray.200" rounded="lg" overflow="hidden" bg="white">
                  <Table size="sm">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>Name</Th>
                        <Th>Email</Th>
                        <Th>Company</Th>
                        <Th>Status</Th>
                        <Th>Last Active</Th>
                        <Th>Joined</Th>
                        <Th textAlign="right">Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {adminLoading && (
                        <Tr>
                          <Td colSpan={7}>
                            <Flex align="center" gap={3} py={4} justify="center">
                              <Spinner color="purple.500" />
                              <Text color="gray.600">Loading leadership records...</Text>
                            </Flex>
                          </Td>
                        </Tr>
                      )}

                      {!adminLoading && filteredLeadership.length === 0 && (
                        <Tr>
                          <Td colSpan={7}>
                            <Flex direction="column" align="center" py={6} gap={2} color="gray.500">
                              <Icon as={Users} />
                              <Text>
                                No {leadershipTab === 'mentor' ? 'mentors' : 'ambassadors'} found. Use 'Add {leadershipTab === 'mentor' ? 'Mentor' : 'Ambassador'}' to promote a member.
                              </Text>
                            </Flex>
                          </Td>
                        </Tr>
                      )}

                      {filteredLeadership.map((member) => (
                        <Tr key={member.id} _hover={{ bg: 'gray.50' }} transition="background 0.2s ease">
                          <Td>
                            <Stack spacing={0}>
                              <Text fontWeight="semibold">{member.fullName || `${member.firstName} ${member.lastName}`}</Text>
                              <Text fontSize="xs" color="gray.500">
                                ID: {member.id}
                              </Text>
                            </Stack>
                          </Td>
                          <Td>{member.email}</Td>
                          <Td>
                            <Stack spacing={0}>
                              <Text fontWeight="semibold">{member.companyName || '—'}</Text>
                              <Text fontSize="xs" color="gray.500">
                                {member.companyCode ? member.companyCode.toUpperCase() : '—'}
                              </Text>
                            </Stack>
                          </Td>
                          <Td>
                            <Badge
                              colorScheme={
                                member.accountStatus === 'active'
                                  ? 'green'
                                  : member.accountStatus === 'suspended'
                                    ? 'red'
                                    : 'gray'
                              }
                              rounded="full"
                            >
                              {member.accountStatus || 'unknown'}
                            </Badge>
                          </Td>
                          <Td>{member.lastActive ? relativeTime(parseISO(member.lastActive)) : '—'}</Td>
                          <Td>{member.registrationDate ? relativeTime(parseISO(member.registrationDate)) : '—'}</Td>
                          <Td textAlign="right">
                            <HStack spacing={2} justify="flex-end">
                              <Tooltip label={adminActionLocked ? 'Super admin only' : 'Edit member'}>
                                <IconButton
                                  aria-label="Edit"
                                  size="sm"
                                  icon={<Edit3 size={16} />}
                                  onClick={() => openEdit(member)}
                                  isDisabled={adminActionLocked}
                                />
                              </Tooltip>
                              <Tooltip label={adminActionLocked ? 'Super admin only' : 'Remove from council'}>
                                <IconButton
                                  aria-label="Remove"
                                  size="sm"
                                  colorScheme="red"
                                  variant="outline"
                                  icon={<Trash2 size={16} />}
                                  onClick={() => handleRemove(member)}
                                  isLoading={mutatingId === member.id}
                                  isDisabled={adminActionLocked}
                                />
                              </Tooltip>
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              </CardBody>
            )}
          </Card>
        </GridItem>
      </Grid>

      <Modal isOpen={sessionsModal.isOpen} onClose={sessionsModal.onClose} size="xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <HStack spacing={3}>
              <Box p={2} bg="blue.50" rounded="lg">
                <Icon as={Calendar} color="blue.600" />
              </Box>
              <Box>
                <Heading size="md">Upcoming mentor sessions</Heading>
                <Text color="gray.600">Your scheduled time with {mentorProfile?.fullName || 'your mentor'}</Text>
              </Box>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {sessions.length === 0 ? (
              <Flex
                direction="column"
                align="center"
                gap={2}
                p={6}
                border="1px dashed"
                borderColor="gray.200"
                rounded="lg"
                bg="gray.50"
              >
                <Icon as={Calendar} color="gray.400" />
                <Heading size="sm">No sessions scheduled yet</Heading>
                <Text color="gray.600" textAlign="center">
                  Use the schedule button to book your next conversation with your mentor.
                </Text>
              </Flex>
            ) : (
              <Stack spacing={4} maxH="60vh" overflowY="auto" pr={2}>
                {renderSessionCards()}
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={sessionsModal.onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={scheduleModal.isOpen} onClose={scheduleModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader bg="blue.600" color="white" borderTopRadius="lg">
            <HStack spacing={3}>
              <Icon as={Calendar} />
              <Box>
                <Heading size="md">Schedule a mentorship session</Heading>
                <Text color="blue.50" fontSize="sm">
                  Your time: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </Text>
              </Box>
            </HStack>
          </ModalHeader>
          <ModalCloseButton color="white" />
          <ModalBody pt={4}>
            <Stack spacing={4}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <FormControl isRequired>
                  <FormLabel>Date</FormLabel>
                  <Input type="date" min={format(new Date(), 'yyyy-MM-dd')} value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Time</FormLabel>
                  <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                </FormControl>
              </SimpleGrid>

              <FormControl isRequired>
                <FormLabel>Topic</FormLabel>
                <Input
                  placeholder="What would you like to discuss?"
                  value={scheduleTopic}
                  onChange={(e) => setScheduleTopic(e.target.value)}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Agenda (optional)</FormLabel>
                <Textarea
                  placeholder="Optional: Add details about what you'd like to cover"
                  value={scheduleAgenda}
                  onChange={(e) => setScheduleAgenda(e.target.value)}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Notes (optional)</FormLabel>
                <Textarea
                  placeholder="Optional: Any additional context for your mentor"
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Meeting link (optional)</FormLabel>
                <Input
                  type="url"
                  placeholder="Optional: Zoom, Teams, or other meeting link"
                  value={scheduleLink}
                  onChange={(e) => setScheduleLink(e.target.value)}
                />
                <FormHelperText>Include https:// to enable quick join.</FormHelperText>
              </FormControl>

              {mentorProfile?.availabilityStatus && (
                <Alert status="info" variant="subtle" rounded="lg">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Availability</AlertTitle>
                    <AlertDescription>
                      Mentor is typically available {mentorProfile.availabilityStatus}. Availability is informational only and does not block scheduling.
                    </AlertDescription>
                  </Box>
                </Alert>
              )}
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={scheduleModal.onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleScheduleSession} isLoading={scheduleSubmitting}>
              Schedule Session
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={promoteModal.isOpen} onClose={promoteModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Heading size="md">Promote a {promoteModalRole === 'mentor' ? 'Mentor' : 'Ambassador'}</Heading>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Select member</FormLabel>
                <Select placeholder="Choose a member" id="promote-member-select">
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName || user.email} — {user.email} ({user.role})
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Assign company (optional)</FormLabel>
                <Select placeholder="Optional company assignment" id="promote-company-select">
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name} {company.code ? `(${company.code})` : ''}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Notes (optional)</FormLabel>
                <Textarea placeholder="Share context for the new leadership assignment" id="promote-notes-input" />
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={promoteModal.onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="purple"
              isLoading={mutatingId === 'promote'}
              onClick={() => {
                const memberSelect = document.getElementById('promote-member-select') as HTMLSelectElement | null
                const companySelect = document.getElementById('promote-company-select') as HTMLSelectElement | null
                const notesInput = document.getElementById('promote-notes-input') as HTMLTextAreaElement | null
                const memberId = memberSelect?.value
                if (!memberId) {
                  toast({ title: 'Choose a member to promote', status: 'error' })
                  return
                }
                handlePromote({ userId: memberId, companyId: companySelect?.value, notes: notesInput?.value })
              }}
              isDisabled={adminActionLocked}
            >
              Promote
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={editModal.isOpen} onClose={editModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Heading size="md">Update {editTarget?.fullName || 'member'}</Heading>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl>
                <FormLabel>Company alignment</FormLabel>
                <Select value={editCompany} onChange={(e) => setEditCompany(e.target.value)} placeholder="Select a company">
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name} {company.code ? `(${company.code})` : ''}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Account status</FormLabel>
                <Select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} placeholder="Choose status">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Internal notes</FormLabel>
                <Textarea
                  placeholder="Document changes or context for other admins"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={editModal.onClose}>
              Cancel
            </Button>
            <Button colorScheme="purple" onClick={handleEditSave} isLoading={mutatingId === editTarget?.id} isDisabled={adminActionLocked}>
              Save changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  )
}
