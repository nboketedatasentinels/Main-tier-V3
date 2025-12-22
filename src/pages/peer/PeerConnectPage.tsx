import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Center,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  GridItem,
  HStack,
  Icon,
  IconButton,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  Text,
  Textarea,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { format, addDays, startOfWeek } from 'date-fns'
import {
  AlarmClockCheck,
  AlarmClockOff,
  AlertCircle,
  Calendar,
  Check,
  Clock3,
  Mail,
  MessageSquare,
  Search,
  ShieldCheck,
  Sword,
  Target,
  Trophy,
  Users,
  Video,
  X,
} from 'lucide-react'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { StartChallengeModal } from '@/components/modals/StartChallengeModal'
import { removeUndefinedFields } from '@/utils/firestore'

// Types
type PeerProfile = {
  id: string
  name: string
  email: string
  timezone?: string
  interests?: string
  goals?: string
  companyCode?: string
  corporateVillageId?: string
  cohortIdentifier?: string
  calendarLink?: string
  identityTag?: string
  avatarUrl?: string
}

interface PreselectedUser {
  id: string
  name: string
  email: string
}

type WeeklyMatch = {
  peer: PeerProfile
  matchReason: string
}

type PeerSession = {
  id: string
  title: string
  scheduledAt: Date
  timezone: string
  platform: 'Zoom' | 'Google Meet' | 'Zoho Meet'
  link?: string
  status: 'pending' | 'confirmed' | 'scheduled' | 'in_progress' | 'no_show'
  confirmationDeadline: Date
  youConfirmed: boolean
  peerConfirmed: boolean
}

type Invitation = {
  id: string
  fromName: string
  fromEmail: string
}

const timezoneOptions = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Australia/Sydney',
]

const defaultSessionDescription =
  'Bring together exactly three peers for a transformation dialogue that sparks shared insight and collaborative momentum.'

const useWeekRange = () => {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 })
  const end = addDays(start, 6)
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`
}

export const PeerConnectPage: React.FC = () => {
  const { user, profile } = useAuth()
  const toast = useToast()
  const weekRange = useWeekRange()
  const challengeModal = useDisclosure()
  const sessionModal = useDisclosure()

  const [search, setSearch] = useState('')
  const [availablePeers, setAvailablePeers] = useState<PeerProfile[]>([])
  const [weeklyMatch, setWeeklyMatch] = useState<WeeklyMatch | null>(null)
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([])
  const [sessions, setSessions] = useState<PeerSession[]>([])
  const [preferences, setPreferences] = useState({
    interests: '',
    goals: '',
    timezonePreference: 'any',
  })
  const [sessionForm, setSessionForm] = useState({
    title: 'Group Transformation Session',
    description: defaultSessionDescription,
    platform: 'Zoom',
    meetingLink: 'https://zoom.us/',
    timezone: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    rememberTimezone: true,
    participants: [] as string[],
    date: '',
    time: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [participantFilter, setParticipantFilter] = useState('')
  const [loadingPeers, setLoadingPeers] = useState(false)
  const [preselectedUser, setPreselectedUser] = useState<PreselectedUser | null>(null)

  const fetchWeeklyMatch = useCallback(async () => {
    if (!user || !profile || !availablePeers.length) return
    try {
      const matchRef = doc(db, 'peer_weekly_matches', `${user.uid}-${weekRange}`)
      const matchDoc = await getDoc(matchRef)
      if (matchDoc.exists()) {
        const data = matchDoc.data()
        const matchedPeer = availablePeers.find((peer) => peer.id === data.peerId)
        if (matchedPeer) {
          setWeeklyMatch({
            peer: matchedPeer,
            matchReason: data.matchReason || 'Same company code',
          })
          return
        }
      }
      const deterministicPeer = availablePeers[Math.abs(Number.parseInt(user.uid.slice(-3), 10)) % availablePeers.length]
      if (deterministicPeer) {
        const matchPayload = {
          peerId: deterministicPeer.id,
          matchReason: deterministicPeer.cohortIdentifier
            ? 'Shared cohort'
            : deterministicPeer.corporateVillageId
              ? 'Same corporate village'
              : 'Same company code',
          createdAt: serverTimestamp(),
        }
        await setDoc(matchRef, matchPayload)
        setWeeklyMatch({ peer: deterministicPeer, matchReason: matchPayload.matchReason })
      }
    } catch (error) {
      console.error('Error selecting weekly match', error)
    }
  }, [availablePeers, profile, user, weekRange])

  const fetchInvitesAndSessions = useCallback(async () => {
    if (!user) return
    try {
      const inviteRef = collection(db, 'peer_session_requests')
      const inviteSnapshot = await getDocs(query(inviteRef, where('toUserId', '==', user.uid)))
      const mappedInvites: Invitation[] = inviteSnapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          fromName: data.fromName || 'Peer',
          fromEmail: data.fromEmail || 'peer@example.com',
        }
      })
      setPendingInvites(mappedInvites)
      const sessionRef = collection(db, 'peer_sessions')
      const sessionSnapshot = await getDocs(query(sessionRef, where('participants', 'array-contains', user.uid)))
      const mappedSessions: PeerSession[] = sessionSnapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          title: data.title || 'Weekly Peer Date',
          scheduledAt: data.scheduledAt?.toDate?.() || new Date(),
          timezone: data.timezone || profile?.timezone || 'UTC',
          platform: (data.platform as PeerSession['platform']) || 'Zoom',
          link: data.meetingLink,
          status: (data.status as PeerSession['status']) || 'pending',
          confirmationDeadline: data.confirmationDeadline?.toDate?.() || addDays(new Date(), 1),
          youConfirmed: Boolean(data.confirmations?.[user.uid]),
          peerConfirmed: Boolean(Object.keys(data.confirmations || {}).length > 1),
        }
      })
      setSessions(
        mappedSessions.length
          ? mappedSessions
          : [
              {
                id: 'demo-session',
                title: 'Weekly Peer Date',
                scheduledAt: addDays(new Date(), 2),
                timezone: profile?.timezone || 'America/New_York',
                platform: 'Zoom',
                link: 'https://zoom.us/',
                status: 'pending',
                confirmationDeadline: addDays(new Date(), 1),
                youConfirmed: false,
                peerConfirmed: true,
              },
            ]
      )
    } catch (error) {
      console.error('Error fetching sessions', error)
    }
  }, [profile?.timezone, user])

  const onChallengeCreated = () => {
    fetchWeeklyMatch()
    fetchInvitesAndSessions()
    toast({
      title: 'Challenge created',
      description: `Your opponent will receive a Firebase-backed notification.`,
      status: 'success',
      position: 'top',
      icon: <Trophy size={18} />,
    })
  }

  useEffect(() => {
    const fetchPeers = async () => {
    if (!profile) return
      setLoadingPeers(true)
      try {
        const peersRef = collection(db, 'profiles')
        const peerQuery = query(
          peersRef,
          where('companyCode', '==', profile.companyCode || ''),
          orderBy('firstName', 'asc')
        )
        const snapshot = await getDocs(peerQuery)
        const mappedPeers: PeerProfile[] = snapshot.docs
          .filter((docSnap) => docSnap.id !== profile.id)
          .map((docSnap) => {
            const data = docSnap.data()
            return {
              id: docSnap.id,
              name: data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
              email: data.email,
              timezone: data.timezone,
              interests: data.interests,
              goals: data.goals,
              companyCode: data.companyCode,
              corporateVillageId: data.corporateVillageId,
              cohortIdentifier: data.cohortIdentifier,
              calendarLink: data.calendarLink,
              identityTag: data.identityTag,
              avatarUrl: data.avatarUrl,
            }
          })

        setAvailablePeers(mappedPeers)

        if (!mappedPeers.length) {
          setAvailablePeers([
            {
              id: 'demo-1',
              name: 'Alex Transformation',
              email: 'alex@example.com',
              timezone: 'America/New_York',
              interests: 'Product strategy, Communication',
              goals: 'Grow leadership, Improve communication',
              companyCode: profile.companyCode,
              corporateVillageId: profile.corporateVillageId,
              cohortIdentifier: profile.cohortIdentifier,
              calendarLink: 'https://cal.com/alex',
              identityTag: 'Village Captain',
            },
            {
              id: 'demo-2',
              name: 'Jordan Impact',
              email: 'jordan@example.com',
              timezone: 'Europe/London',
              interests: 'Marketing, Storytelling',
              goals: 'Improve communication',
              companyCode: profile.companyCode,
              corporateVillageId: profile.corporateVillageId,
              cohortIdentifier: profile.cohortIdentifier,
              calendarLink: 'https://meet.jit.si/jordan',
              identityTag: 'Cohort 5',
            },
            {
              id: 'demo-3',
              name: 'Sam Collaboration',
              email: 'sam@example.com',
              timezone: 'Asia/Singapore',
              interests: 'Leadership, Coaching',
              goals: 'Grow leadership',
              companyCode: profile.companyCode,
              corporateVillageId: profile.corporateVillageId,
              cohortIdentifier: profile.cohortIdentifier,
              calendarLink: 'https://cal.com/sam',
              identityTag: 'People Lead',
            },
          ])
        }
      } catch (error) {
        console.error('Error fetching peers', error)
        toast({
          title: 'Unable to load peers',
          description: 'We could not fetch your organisation peers from Firestore.',
          status: 'error',
          position: 'top',
        })
      } finally {
        setLoadingPeers(false)
      }
    }
    fetchPeers()
  }, [profile, toast])

  useEffect(() => {
    fetchWeeklyMatch()
  }, [fetchWeeklyMatch])

  useEffect(() => {
    fetchInvitesAndSessions()
  }, [fetchInvitesAndSessions])

  const filteredPeers = useMemo(() => {
    const queryString = search.toLowerCase()
    return availablePeers.filter((peer) => {
      return (
        peer.name.toLowerCase().includes(queryString) ||
        peer.email.toLowerCase().includes(queryString) ||
        (peer.identityTag || '').toLowerCase().includes(queryString)
      )
    })
  }, [availablePeers, search])

  const filteredParticipants = useMemo(() => {
    const queryString = participantFilter.toLowerCase()
    return availablePeers.filter((peer) => peer.name.toLowerCase().includes(queryString) || peer.email.toLowerCase().includes(queryString))
  }, [availablePeers, participantFilter])

  const updatePreference = (key: keyof typeof preferences, value: string) => {
    setPreferences((prev) => ({ ...prev, [key]: value }))
  }

  const persistPreferences = async () => {
    if (!user) return
    try {
      await setDoc(
        doc(db, 'peer_preferences', user.uid),
        removeUndefinedFields({
          ...preferences,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
      toast({
        title: 'Preferences saved',
        description: 'We will prioritise peers who match these preferences when creating weekly matches.',
        status: 'success',
        position: 'top',
      })
    } catch (error) {
      toast({
        title: 'Could not save preferences',
        description: 'Firebase rejected the update. Please try again.',
        status: 'error',
        position: 'top',
      })
      console.error('Preference update failed', error)
    }
  }

  const confirmMeeting = async (sessionId: string) => {
    if (!user) return
    try {
      const sessionRef = doc(db, 'peer_sessions', sessionId)
      await updateDoc(sessionRef, {
        [`confirmations.${user.uid}`]: true,
        updatedAt: serverTimestamp(),
      })
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                youConfirmed: true,
                status: session.peerConfirmed ? 'confirmed' : session.status,
              }
            : session
        )
      )
      toast({
        title: 'Meetup confirmed',
        description: '50 points unlock when both peers confirm before the deadline.',
        status: 'success',
        position: 'top',
      })
    } catch (error) {
      toast({
        title: 'Confirmation failed',
        description: 'We could not record your confirmation in Firestore.',
        status: 'error',
        position: 'top',
      })
    }
  }

  const reportNoShow = async (sessionId: string) => {
    if (!user) return
    try {
      const sessionRef = doc(db, 'peer_sessions', sessionId)
      await updateDoc(sessionRef, {
        status: 'no_show',
        [`noShows.${user.uid}`]: true,
        updatedAt: serverTimestamp(),
      })
      setSessions((prev) => prev.map((session) => (session.id === sessionId ? { ...session, status: 'no_show' } : session)))
      toast({
        title: 'No-show reported',
        description: 'You earn 25 points for accountability. Your peer will be notified.',
        status: 'info',
        position: 'top',
      })
    } catch (error) {
      toast({
        title: 'Could not report',
        description: 'Firebase did not accept the update. Try again later.',
        status: 'error',
        position: 'top',
      })
    }
  }

  const respondToInvite = async (inviteId: string, accepted: boolean) => {
    if (!user) return
    try {
      const inviteRef = doc(db, 'peer_session_requests', inviteId)
      await updateDoc(inviteRef, {
        status: accepted ? 'accepted' : 'declined',
        respondedAt: serverTimestamp(),
      })
      setPendingInvites((prev) => prev.filter((invite) => invite.id !== inviteId))
      toast({
        title: accepted ? 'Invitation accepted' : 'Invitation declined',
        status: accepted ? 'success' : 'info',
        position: 'top',
      })
    } catch (error) {
      toast({
        title: 'Unable to update invitation',
        description: 'A Firebase error occurred while updating your invitation.',
        status: 'error',
        position: 'top',
      })
    }
  }

  const validateSessionForm = () => {
    const errors: Record<string, string> = {}
    if (!sessionForm.title.trim()) errors.title = 'Please provide a session title'
    if (!sessionForm.date) errors.date = 'Please select a date'
    if (!sessionForm.time) errors.time = 'Please select a time'
    if (!sessionForm.timezone) errors.timezone = 'Please select a time zone'
    if (sessionForm.participants.length !== 3)
      errors.participants = 'Select exactly 3 participants for your group session so you can host a four-person conversation.'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const createSession = async () => {
    if (!user || !profile) return
    if (!validateSessionForm()) return

    try {
      const scheduledAt = Timestamp.fromDate(new Date(`${sessionForm.date}T${sessionForm.time}:00`))
      const sessionPayload = removeUndefinedFields({
        title: sessionForm.title,
        description: sessionForm.description,
        platform: sessionForm.platform,
        ...(sessionForm.meetingLink ? { meetingLink: sessionForm.meetingLink } : {}),
        timezone: sessionForm.timezone,
        participants: [user.uid, ...sessionForm.participants],
        status: 'scheduled',
        scheduledAt,
        confirmationDeadline: Timestamp.fromDate(addDays(scheduledAt.toDate(), -1)),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        confirmations: { [user.uid]: true },
      })

      const sessionRef = await addDoc(collection(db, 'peer_sessions'), sessionPayload)

      await Promise.all(
        sessionForm.participants.map((peerId) =>
          addDoc(
            collection(db, 'peer_session_requests'),
            removeUndefinedFields({
              sessionId: sessionRef.id,
              fromUserId: user.uid,
              fromName: profile.fullName,
              fromEmail: profile.email,
              toUserId: peerId,
              status: 'pending',
              createdAt: serverTimestamp(),
            })
          )
        )
      )

      if (sessionForm.rememberTimezone) {
        await updateDoc(doc(db, 'profiles', user.uid), { timezone: sessionForm.timezone, updatedAt: serverTimestamp() })
      }

      setSessions((prev) => [
        {
          id: sessionRef.id,
          title: sessionForm.title,
          scheduledAt: scheduledAt.toDate(),
          timezone: sessionForm.timezone,
          platform: sessionForm.platform as PeerSession['platform'],
          link: sessionForm.meetingLink,
          status: 'scheduled',
          confirmationDeadline: addDays(scheduledAt.toDate(), -1),
          youConfirmed: true,
          peerConfirmed: false,
        },
        ...prev,
      ])

      toast({
        title: 'Session Created!',
        description: 'Your peers will be notified.',
        status: 'success',
        position: 'top',
        icon: <Check size={18} />,
      })

      setTimeout(() => sessionModal.onClose(), 500)
    } catch (error) {
      toast({
        title: 'Could not create session',
        description: 'Firebase prevented us from saving this session. Please try again.',
        status: 'error',
        position: 'top',
      })
      console.error('Session creation failed', error)
    }
  }

  const toggleParticipant = (peerId: string) => {
    if (sessionForm.participants.includes(peerId)) {
      setSessionForm((prev) => ({ ...prev, participants: prev.participants.filter((id) => id !== peerId) }))
      return
    }
    if (sessionForm.participants.length >= 3) {
      setFormErrors((prev) => ({ ...prev, participants: 'You already selected 3 participants. Deselect someone to invite a different peer.' }))
      return
    }
    setFormErrors((prev) => ({ ...prev, participants: '' }))
    setSessionForm((prev) => ({ ...prev, participants: [...prev.participants, peerId] }))
  }

  const renderStatusBadge = (status: PeerSession['status']) => {
    const colorMap: Record<PeerSession['status'], string> = {
      pending: 'secondary',
      confirmed: 'success',
      scheduled: 'primary',
      in_progress: 'primary',
      no_show: 'warning',
    }
    const labelMap: Record<PeerSession['status'], string> = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      no_show: 'No-Show',
    }
    return <Badge colorScheme={colorMap[status]}>{labelMap[status]}</Badge>
  }

  const disableNoShow = (session: PeerSession) => {
    const now = new Date()
    return session.status === 'no_show' || !session.youConfirmed || session.peerConfirmed || now < session.confirmationDeadline
  }

  return (
    <Stack spacing={6} pb={12}>
      <Box bg="surface.default" p={6} borderRadius="2xl" border="1px solid" borderColor="border.subtle" boxShadow="sm">
        <Stack spacing={2}>
          <Heading size="lg" color="brand.text">
            Peer Connect
          </Heading>
          <Text color="brand.subtleText">
            Automated weekly matching pairs you one-on-one, while peer-to-peer sessions are partner-supervised group experiences—all anchored in Firebase so
            your connections stay in sync.
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} pt={1}>
            <Box p={3} borderRadius="lg" border="1px solid" borderColor="brand.border" bg="gray.50">
              <HStack spacing={2} mb={1}>
                <Badge colorScheme="purple" variant="subtle">
                  Peer Matching
                </Badge>
                <Icon as={MessageSquare} w={4} h={4} color="purple.500" />
              </HStack>
              <Text fontSize="sm" color="brand.subtleText">
                System-automated, one-on-one pairing so you can connect directly with a matched peer each week.
              </Text>
            </Box>
            <Box p={3} borderRadius="lg" border="1px solid" borderColor="brand.border" bg="gray.50">
              <HStack spacing={2} mb={1}>
                <Badge colorScheme="blue" variant="subtle">
                  Peer to Peer
                </Badge>
                <Icon as={Users} w={4} h={4} color="blue.500" />
              </HStack>
              <Text fontSize="sm" color="brand.subtleText">
                Group-oriented activities with partner oversight to keep sessions structured, monitored, and collaborative.
              </Text>
            </Box>
          </SimpleGrid>
        </Stack>
      </Box>

      <Tabs variant="soft-rounded" colorScheme="primary" defaultIndex={0} isFitted>
        <TabList bg="surface.default" p={2} borderRadius="full" border="1px solid" borderColor="border.subtle">
          <Tab>
            <HStack spacing={2}>
              <Icon as={MessageSquare} w={4} h={4} />
              <Text>Peer Matching</Text>
            </HStack>
          </Tab>
          <Tab>
            <HStack spacing={2}>
              <Icon as={Users} w={4} h={4} />
              <Text>Peer Sessions</Text>
            </HStack>
          </Tab>
        </TabList>

        <TabPanels pt={4}>
          <TabPanel px={0}>
            <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={4} alignItems="start">
              <GridItem colSpan={{ base: 1, xl: 2 }}>
                <Stack spacing={4}>
                  <Box bg="surface.default" p={6} borderRadius="2xl" border="1px solid" borderColor="border.subtle" boxShadow="sm">
                    <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4} mb={4} direction={{ base: 'column', md: 'row' }}>
                      <Stack spacing={1}>
                        <Text fontSize="sm" color="brand.subtleText">
                          Week of {weekRange}
                        </Text>
                        <Heading size="md" color="brand.text">
                          Automatic Weekly Match
                        </Heading>
                        <Text color="brand.subtleText">Deterministic selection refreshes every Monday. No setup required.</Text>
                      </Stack>
                      <Badge colorScheme="primary" variant="subtle" alignSelf="flex-start">
                        Refreshes Monday
                      </Badge>
                    </Flex>

                    {weeklyMatch ? (
                      <Flex gap={4} align={{ base: 'flex-start', md: 'center' }} direction={{ base: 'column', md: 'row' }}>
                        <HStack spacing={3} flex={1}>
                          <Avatar name={weeklyMatch.peer.name} src={weeklyMatch.peer.avatarUrl} size="md" />
                          <Stack spacing={0}>
                            <Text fontWeight="semibold" color="brand.text">
                              {weeklyMatch.peer.name}
                            </Text>
                            <Text fontSize="sm" color="brand.subtleText">
                              {weeklyMatch.peer.email}
                            </Text>
                            <HStack spacing={2} pt={1}>
                              <Badge colorScheme="primary" variant="subtle" display="flex" alignItems="center" gap={1}>
                                <Icon as={Clock3} w={3} h={3} />
                                {weeklyMatch.peer.timezone || 'Timezone TBD'}
                              </Badge>
                              <Badge colorScheme="primary" variant="solid">
                                {weeklyMatch.matchReason}
                              </Badge>
                            </HStack>
                          </Stack>
                        </HStack>

                        <Stack spacing={2} align="flex-end">
                          <Button
                            as="a"
                            href={`mailto:${weeklyMatch.peer.email}?subject=${encodeURIComponent(`Peer Match for ${weekRange}`)}&body=${encodeURIComponent(
                              `Hi ${weeklyMatch.peer.name},%0D%0A%0D%0AWe were paired for this week's Peer Connect. I'd love to lock in a time to connect. Feel free to grab a slot on my calendar or reply with your availability.%0D%0A%0D%0A- ${profile?.fullName || 'Your peer'}`
                            )}`}
                            leftIcon={<Mail size={18} />}
                            colorScheme="primary"
                            variant="solid"
                            target="_blank"
                          >
                            Email your peer
                          </Button>
                          <Button
                            leftIcon={<Check size={16} />}
                            colorScheme="success"
                            variant="outline"
                            onClick={() => weeklyMatch && confirmMeeting('demo-session')}
                          >
                            Confirm meetup
                          </Button>
                          {weeklyMatch.peer.calendarLink && (
                            <Button
                              as="a"
                              href={weeklyMatch.peer.calendarLink}
                              target="_blank"
                              rel="noreferrer"
                              leftIcon={<Calendar size={16} />}
                              variant="ghost"
                            >
                              Calendar link
                            </Button>
                          )}
                        </Stack>
                      </Flex>
                    ) : (
                      <Center py={10} flexDirection="column" gap={3} color="brand.subtleText">
                        <Icon as={AlertCircle} w={5} h={5} color="orange.400" />
                        <Text>No peer available yet. We are still fetching your organisation pool from Firebase.</Text>
                      </Center>
                    )}
                  </Box>

                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <Box bg="surface.default" p={6} borderRadius="2xl" border="1px solid" borderColor="border.subtle" boxShadow="sm">
                      <Heading size="sm" mb={2} color="brand.text">
                        Matching preferences
                      </Heading>
                      <Text fontSize="sm" color="brand.subtleText" mb={4}>
                        Soft filters to prioritise peers with aligned interests, goals, and work hours.
                      </Text>
                      <Stack spacing={4}>
                        <FormControl>
                          <FormLabel fontSize="sm">Interests (comma-separated)</FormLabel>
                          <Input
                            value={preferences.interests}
                            onChange={(e) => updatePreference('interests', e.target.value)}
                            placeholder="Product strategy, Marketing"
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel fontSize="sm">Goals (comma-separated)</FormLabel>
                          <Input value={preferences.goals} onChange={(e) => updatePreference('goals', e.target.value)} placeholder="Grow leadership, Improve communication" />
                        </FormControl>
                        <FormControl>
                          <FormLabel fontSize="sm">Timezone preference</FormLabel>
                          <Select value={preferences.timezonePreference} onChange={(e) => updatePreference('timezonePreference', e.target.value)}>
                            <option value="any">Any timezone</option>
                            <option value="same">Same timezone</option>
                            <option value="compatible">Compatible working hours</option>
                          </Select>
                        </FormControl>
                        <Button colorScheme="primary" leftIcon={<ShieldCheck size={16} />} onClick={persistPreferences} isLoading={loadingPeers}>
                          Apply preferences
                        </Button>
                      </Stack>
                    </Box>

                    <Box bg="surface.default" p={6} borderRadius="2xl" border="1px solid" borderColor="border.subtle" boxShadow="sm">
                      <Flex justify="space-between" align="center" mb={3}>
                        <Heading size="sm" color="brand.text">
                          Pending peer invitations
                        </Heading>
                        <Badge colorScheme="primary" variant="outline">
                          {pendingInvites.length} pending
                        </Badge>
                      </Flex>
                      <Stack spacing={3}>
                        {pendingInvites.length ? (
                          pendingInvites.map((invite) => (
                            <Box key={invite.id} p={3} borderRadius="lg" border="1px dashed" borderColor="border.subtle">
                              <HStack justify="space-between" align="flex-start">
                                <Stack spacing={0}>
                                  <Text fontWeight="semibold" color="brand.text">
                                    {invite.fromName}
                                  </Text>
                                  <Text fontSize="sm" color="brand.subtleText">
                                    {invite.fromEmail}
                                  </Text>
                                </Stack>
                                <HStack spacing={2}>
                                  <IconButton
                                    aria-label="Decline invitation"
                                    icon={<X size={16} />}
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => respondToInvite(invite.id, false)}
                                  />
                                  <IconButton
                                    aria-label="Accept invitation"
                                    icon={<Check size={16} />}
                                    size="sm"
                                    colorScheme="success"
                                    variant="solid"
                                    onClick={() => respondToInvite(invite.id, true)}
                                  />
                                </HStack>
                              </HStack>
                            </Box>
                          ))
                        ) : (
                          <Text fontSize="sm" color="brand.subtleText">
                            No pending peer invitations right now.
                          </Text>
                        )}
                      </Stack>
                    </Box>
                  </SimpleGrid>

                  <Box bg="surface.default" p={6} borderRadius="2xl" border="1px solid" borderColor="border.subtle" boxShadow="sm">
                    <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={3} mb={4} direction={{ base: 'column', md: 'row' }}>
                      <Stack spacing={1}>
                        <Heading size="sm" color="brand.text">
                          Available matches pool
                        </Heading>
                        <Text fontSize="sm" color="brand.subtleText">
                          Filtered to your company, village, and cohort. Search by name, email, or identity tag.
                        </Text>
                      </Stack>
                      <Badge colorScheme="primary" variant="outline">
                        Showing {filteredPeers.length} members
                      </Badge>
                    </Flex>

                    <InputGroup mb={4} maxW={{ base: '100%', md: '320px' }}>
                      <InputLeftElement pointerEvents="none">
                        <Search size={16} opacity={0.65} />
                      </InputLeftElement>
                      <Input placeholder="Search peers" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </InputGroup>

                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
                      {filteredPeers.map((peer) => (
                        <Box key={peer.id} p={4} borderRadius="lg" border="1px solid" borderColor="border.subtle" bg="surface.default" boxShadow="xs">
                          <HStack spacing={3} mb={2} align="flex-start">
                            <Avatar name={peer.name} src={peer.avatarUrl} size="sm" />
                            <Stack spacing={1} flex={1}>
                              <HStack justify="space-between">
                                <Text fontWeight="semibold" color="brand.text">
                                  {peer.name}
                                </Text>
                                {peer.identityTag && (
                                  <Badge colorScheme="primary" variant="subtle">
                                    {peer.identityTag}
                                  </Badge>
                                )}
                              </HStack>
                              <Text fontSize="sm" color="brand.subtleText">
                                {peer.email}
                              </Text>
                              <HStack spacing={2} wrap="wrap">
                                <Tag size="sm" colorScheme="primary" variant="subtle" display="flex" alignItems="center" gap={1}>
                                  <Clock3 size={14} />
                                  {peer.timezone || 'Timezone TBD'}
                                </Tag>
                                <Tag size="sm" colorScheme="success" variant="outline">
                                  {peer.cohortIdentifier ? 'Shared cohort' : peer.corporateVillageId ? 'Corporate village' : 'Company match'}
                                </Tag>
                              </HStack>
                              {peer.calendarLink && (
                                <Button
                                  as="a"
                                  href={peer.calendarLink}
                                  size="sm"
                                  variant="link"
                                  colorScheme="primary"
                                  leftIcon={<Calendar size={14} />}
                                  target="_blank"
                                >
                                  Calendar link
                                </Button>
                              )}
                            </Stack>
                          </HStack>
                        </Box>
                      ))}
                    </SimpleGrid>
                  </Box>

                  <Box bg="surface.default" p={6} borderRadius="2xl" border="1px solid" borderColor="border.subtle" boxShadow="sm">
                    <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={3} mb={4} direction={{ base: 'column', md: 'row' }}>
                      <Stack spacing={1}>
                        <Heading size="sm" color="brand.text">
                          Your upcoming peer matching
                        </Heading>
                        <Text fontSize="sm" color="brand.subtleText">
                          Confirm early to unlock points. Report no-shows after the confirmation deadline.
                        </Text>
                      </Stack>
                      <Badge colorScheme="primary" variant="outline">
                        {sessions.length} sessions
                      </Badge>
                    </Flex>

                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                      {sessions.map((session) => (
                            <Box key={session.id} p={4} borderRadius="xl" border="1px solid" borderColor="border.subtle" bg="surface.default" boxShadow="xs">
                          <HStack justify="space-between" align="flex-start" mb={2}>
                            <Stack spacing={0}>
                              <Text fontWeight="semibold" color="brand.text">
                                {session.title}
                              </Text>
                              <Text fontSize="sm" color="brand.subtleText">
                                {format(session.scheduledAt, 'EEE, MMM d')} • {format(session.scheduledAt, 'p')} {session.timezone}
                              </Text>
                            </Stack>
                            {renderStatusBadge(session.status)}
                          </HStack>
                          <HStack spacing={3} color="brand.subtleText" fontSize="sm" mb={3}>
                            <Icon as={Video} w={4} h={4} />
                            <Text>{session.platform}</Text>
                            {session.link && (
                              <Button as="a" href={session.link} target="_blank" rel="noreferrer" size="xs" colorScheme="primary" variant="ghost">
                                Join session
                              </Button>
                            )}
                          </HStack>
                          <HStack spacing={2} mb={3}>
                            <Badge colorScheme={session.youConfirmed ? 'green' : 'yellow'} variant="subtle">
                              {session.youConfirmed ? 'You confirmed' : 'Awaiting your confirmation'}
                            </Badge>
                            <Badge colorScheme={session.peerConfirmed ? 'green' : 'yellow'} variant="outline">
                              {session.peerConfirmed ? 'Peer confirmed' : 'Peer pending'}
                            </Badge>
                          </HStack>
                          <Flex gap={2} wrap="wrap">
                            <Button
                              leftIcon={<Check size={14} />}
                              size="sm"
                              colorScheme="success"
                              variant={session.youConfirmed ? 'outline' : 'solid'}
                              onClick={() => confirmMeeting(session.id)}
                              isDisabled={session.youConfirmed}
                            >
                              {session.youConfirmed ? 'Confirmed' : 'Confirm Meeting'}
                            </Button>
                            <Button
                              leftIcon={<AlarmClockOff size={14} />}
                              size="sm"
                              variant="outline"
                              colorScheme="warning"
                              onClick={() => reportNoShow(session.id)}
                              isDisabled={disableNoShow(session)}
                            >
                              Report No-Show
                            </Button>
                          </Flex>
                          <Text fontSize="xs" color="brand.subtleText" mt={3}>
                            Confirmation deadline: {format(session.confirmationDeadline, 'MMM d, p')}
                          </Text>
                        </Box>
                      ))}
                    </SimpleGrid>
                  </Box>
                </Stack>
              </GridItem>

              <GridItem>
                    <Box bg="surface.default" p={6} borderRadius="2xl" border="1px solid" borderColor="border.subtle" boxShadow="sm" position="sticky" top={4}>
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="sm" color="brand.text">
                      Peer session invites
                    </Heading>
                    <Icon as={AlarmClockCheck} w={5} h={5} color="green.500" />
                  </Flex>
                  <Stack spacing={3}>
                    {pendingInvites.length ? (
                      pendingInvites.map((invite) => (
                        <Box key={invite.id} p={4} borderRadius="lg" border="1px solid" borderColor="border.subtle" bg="surface.subtle">
                          <Text fontWeight="semibold" color="brand.text">
                            {invite.fromName}
                          </Text>
                          <Text fontSize="sm" color="brand.subtleText">
                            {invite.fromEmail}
                          </Text>
                          <HStack spacing={2} mt={3}>
                            <Button size="sm" variant="ghost" leftIcon={<X size={14} />} onClick={() => respondToInvite(invite.id, false)}>
                              Decline
                            </Button>
                            <Button size="sm" colorScheme="primary" leftIcon={<Check size={14} />} onClick={() => respondToInvite(invite.id, true)}>
                              Accept
                            </Button>
                          </HStack>
                        </Box>
                      ))
                    ) : (
                      <Text fontSize="sm" color="brand.subtleText">
                        No new peer session invitations. You will see real-time notifications here.
                      </Text>
                    )}
                  </Stack>
                </Box>
              </GridItem>
            </SimpleGrid>
          </TabPanel>

          <TabPanel px={0}>
            <Stack spacing={4}>
              <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={3}>
                <Stack spacing={1}>
                  <Heading size="md" color="brand.text">
                    Peer sessions
                  </Heading>
                  <Text color="brand.subtleText">Create group sessions, challenge peers, and manage invitations in one place.</Text>
                </Stack>
                <HStack spacing={2}>
                  <Button variant="outline" leftIcon={<Sword size={16} />} onClick={challengeModal.onOpen}>
                    Challenge a friend
                  </Button>
                  <Button colorScheme="primary" leftIcon={<Users size={16} />} onClick={sessionModal.onOpen}>
                    Start Peer Session
                  </Button>
                </HStack>
              </Flex>

              <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4} alignItems="start">
                <GridItem colSpan={{ base: 1, lg: 1 }}>
                  <Box bg="surface.default" p={6} borderRadius="2xl" border="1px solid" borderColor="border.subtle" boxShadow="sm">
                    <Flex justify="space-between" align="center" mb={3}>
                      <Heading size="sm" color="brand.text">
                        Your peer connections
                      </Heading>
                      <Badge colorScheme="primary" variant="subtle">
                        Smart list
                      </Badge>
                    </Flex>
                    <Stack spacing={3}>
                      {availablePeers.slice(0, 4).map((peer) => (
                        <Flex key={peer.id} align="center" justify="space-between" p={3} borderRadius="lg" border="1px solid" borderColor="border.subtle">
                          <HStack spacing={3}>
                            <Avatar name={peer.name} src={peer.avatarUrl} size="sm" />
                            <Stack spacing={0}>
                              <Text fontWeight="semibold" color="brand.text">
                                {peer.name}
                              </Text>
                              <Text fontSize="sm" color="brand.subtleText">
                                {peer.email}
                              </Text>
                            </Stack>
                          </HStack>
                          <Button
                            size="sm"
                            variant="outline"
                            leftIcon={<Trophy size={14} />}
                            onClick={() => {
                              setPreselectedUser(peer)
                              challengeModal.onOpen()
                            }}
                          >
                            Challenge
                          </Button>
                        </Flex>
                      ))}
                      {!availablePeers.length && (
                        <Text fontSize="sm" color="brand.subtleText">
                          Once peers load from Firebase, you'll be able to start challenges instantly.
                        </Text>
                      )}
                    </Stack>
                  </Box>
                </GridItem>

                <GridItem colSpan={{ base: 1, lg: 2 }}>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <Box bg="surface.default" p={6} borderRadius="2xl" border="1px solid" borderColor="border.subtle" boxShadow="sm">
                      <Flex justify="space-between" align="center" mb={3}>
                        <Heading size="sm" color="brand.text">
                          Your sessions
                        </Heading>
                        <Badge colorScheme="primary" variant="outline">
                          Active
                        </Badge>
                      </Flex>
                      <Stack spacing={3}>
                        {sessions.length ? (
                          sessions.map((session) => (
                            <Box key={session.id} p={3} borderRadius="lg" border="1px solid" borderColor="border.subtle">
                              <HStack justify="space-between" align="flex-start" mb={1}>
                                <Stack spacing={0}>
                                  <Text fontWeight="semibold" color="brand.text">
                                    {session.title}
                                  </Text>
                                  <Text fontSize="sm" color="brand.subtleText">
                                    {format(session.scheduledAt, 'MMM d, p')} ({session.timezone})
                                  </Text>
                                </Stack>
                                {renderStatusBadge(session.status)}
                              </HStack>
                              <HStack spacing={2} mt={2}>
                                {session.link && (
                                  <Button size="sm" variant="outline" leftIcon={<Video size={14} />} as="a" href={session.link} target="_blank" rel="noreferrer">
                                    Join meeting
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  colorScheme="success"
                                  variant="ghost"
                                  leftIcon={<Check size={14} />}
                                  onClick={() => confirmMeeting(session.id)}
                                >
                                  Mark complete
                                </Button>
                              </HStack>
                            </Box>
                          ))
                        ) : (
                          <Text fontSize="sm" color="brand.subtleText">
                            Create your first peer session to see it here.
                          </Text>
                        )}
                      </Stack>
                    </Box>

                    <Box bg="surface.default" p={6} borderRadius="2xl" border="1px solid" borderColor="border.subtle" boxShadow="sm">
                      <Flex justify="space-between" align="center" mb={3}>
                        <Heading size="sm" color="brand.text">
                          Peer session invites
                        </Heading>
                        <Badge colorScheme="primary" variant="subtle">
                          Inbox
                        </Badge>
                      </Flex>
                      <Stack spacing={3}>
                        {pendingInvites.length ? (
                          pendingInvites.map((invite) => (
                            <Box key={invite.id} p={3} borderRadius="lg" border="1px solid" borderColor="border.subtle">
                              <Text fontWeight="semibold" color="brand.text">
                                {invite.fromName}
                              </Text>
                              <Text fontSize="sm" color="brand.subtleText">
                                {invite.fromEmail}
                              </Text>
                              <HStack spacing={2} mt={2}>
                                <Button size="sm" variant="ghost" leftIcon={<X size={14} />} onClick={() => respondToInvite(invite.id, false)}>
                                  Decline
                                </Button>
                                <Button size="sm" colorScheme="primary" leftIcon={<Check size={14} />} onClick={() => respondToInvite(invite.id, true)}>
                                  Accept
                                </Button>
                              </HStack>
                            </Box>
                          ))
                        ) : (
                          <Text fontSize="sm" color="brand.subtleText">
                            No new invitations. New requests appear instantly via Firebase.
                          </Text>
                        )}
                      </Stack>
                    </Box>
                  </SimpleGrid>
                </GridItem>
              </SimpleGrid>
            </Stack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <Modal isOpen={sessionModal.isOpen} onClose={sessionModal.onClose} size="5xl" isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader display="flex" alignItems="center" gap={2}>
            <Users size={18} /> Start a Group Transformation Session
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <Stack spacing={3}>
                <FormControl isInvalid={Boolean(formErrors.title)}>
                  <FormLabel>Session Title</FormLabel>
                  <Input value={sessionForm.title} onChange={(e) => setSessionForm((prev) => ({ ...prev, title: e.target.value }))} />
                  {formErrors.title && (
                    <Text fontSize="xs" color="red.500" mt={1}>
                      {formErrors.title}
                    </Text>
                  )}
                </FormControl>

                <FormControl>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    value={sessionForm.description}
                    onChange={(e) => setSessionForm((prev) => ({ ...prev, description: e.target.value }))}
                    minH="120px"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Meeting Platform</FormLabel>
                  <Select
                    value={sessionForm.platform}
                    onChange={(e) => {
                      const platform = e.target.value
                      const defaultLinks: Record<string, string> = {
                        Zoom: 'https://zoom.us/',
                        'Google Meet': 'https://meet.google.com/',
                        'Zoho Meet': 'https://meeting.zoho.com/',
                      }
                      setSessionForm((prev) => ({ ...prev, platform, meetingLink: defaultLinks[platform] }))
                    }}
                  >
                    <option value="Zoom">Zoom</option>
                    <option value="Google Meet">Google Meet</option>
                    <option value="Zoho Meet">Zoho Meet</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Meeting Link (optional)</FormLabel>
                  <Input
                    value={sessionForm.meetingLink}
                    onChange={(e) => setSessionForm((prev) => ({ ...prev, meetingLink: e.target.value }))}
                    placeholder="Paste your meeting link"
                  />
                </FormControl>

                <FormControl isInvalid={Boolean(formErrors.timezone)}>
                  <FormLabel>Time Zone</FormLabel>
                  <Select
                    value={sessionForm.timezone}
                    onChange={(e) => setSessionForm((prev) => ({ ...prev, timezone: e.target.value }))}
                  >
                    <option value="">Select a timezone</option>
                    {timezoneOptions.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </Select>
                  <Checkbox
                    mt={2}
                    isChecked={sessionForm.rememberTimezone}
                    onChange={(e) => setSessionForm((prev) => ({ ...prev, rememberTimezone: e.target.checked }))}
                  >
                    Remember this time zone
                  </Checkbox>
                  {formErrors.timezone && (
                    <Text fontSize="xs" color="red.500" mt={1}>
                      {formErrors.timezone}
                    </Text>
                  )}
                </FormControl>
              </Stack>

              <Stack spacing={3}>
                <FormControl isInvalid={Boolean(formErrors.participants)}>
                  <FormLabel>Select 3 participants</FormLabel>
                  <InputGroup mb={2}>
                    <InputLeftElement pointerEvents="none">
                      <Search size={16} opacity={0.65} />
                    </InputLeftElement>
                    <Input placeholder="Search peers" value={participantFilter} onChange={(e) => setParticipantFilter(e.target.value)} />
                  </InputGroup>
                  <Text fontSize="xs" color="brand.subtleText" mb={2}>
                    {sessionForm.participants.length} of 3 selected
                  </Text>
                  <Stack spacing={2} maxH="220px" overflowY="auto" border="1px solid" borderColor="border.subtle" borderRadius="lg" p={2}>
                    {filteredParticipants.map((peer) => (
                      <Flex key={peer.id} align="center" justify="space-between" p={2} borderRadius="md" _hover={{ bg: 'surface.subtle' }}>
                        <HStack spacing={3}>
                          <Avatar name={peer.name} src={peer.avatarUrl} size="sm" />
                          <Stack spacing={0}>
                            <Text fontWeight="semibold">{peer.name}</Text>
                            <Text fontSize="xs" color="brand.subtleText">
                              {peer.identityTag || peer.timezone || 'Peer'}
                            </Text>
                          </Stack>
                        </HStack>
                        <Checkbox
                          isChecked={sessionForm.participants.includes(peer.id)}
                          onChange={() => toggleParticipant(peer.id)}
                          isDisabled={!sessionForm.participants.includes(peer.id) && sessionForm.participants.length >= 3}
                        />
                      </Flex>
                    ))}
                  </Stack>
                  {formErrors.participants && (
                    <Text fontSize="xs" color="red.500" mt={1}>
                      {formErrors.participants}
                    </Text>
                  )}
                </FormControl>

                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                  <FormControl isInvalid={Boolean(formErrors.date)}>
                    <FormLabel>Date</FormLabel>
                    <Input type="date" value={sessionForm.date} onChange={(e) => setSessionForm((prev) => ({ ...prev, date: e.target.value }))} />
                    {formErrors.date && (
                      <Text fontSize="xs" color="red.500" mt={1}>
                        {formErrors.date}
                      </Text>
                    )}
                  </FormControl>
                  <FormControl isInvalid={Boolean(formErrors.time)}>
                    <FormLabel>Time</FormLabel>
                    <Input type="time" value={sessionForm.time} onChange={(e) => setSessionForm((prev) => ({ ...prev, time: e.target.value }))} />
                    {formErrors.time && (
                      <Text fontSize="xs" color="red.500" mt={1}>
                        {formErrors.time}
                      </Text>
                    )}
                  </FormControl>
                </SimpleGrid>

                <Box borderRadius="lg" border="1px dashed" borderColor="border.subtle" p={3} bg="surface.subtle">
                  <HStack align="center" spacing={2}>
                    <Icon as={Target} w={4} h={4} color="brand.primary" />
                    <Text fontSize="sm" color="brand.subtleText">
                      Exactly 3 participants are required so you host a four-person conversation including you.
                    </Text>
                  </HStack>
                </Box>
              </Stack>
            </SimpleGrid>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={sessionModal.onClose} leftIcon={<X size={16} />}>
              Cancel
            </Button>
            <Button colorScheme="primary" leftIcon={<Check size={16} />} onClick={createSession}>
              Create Session
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <StartChallengeModal
        isOpen={challengeModal.isOpen}
        onClose={() => {
          challengeModal.onClose()
          setPreselectedUser(null)
        }}
        onChallengeCreated={onChallengeCreated}
        preselectedUser={preselectedUser}
      />
    </Stack>
  )
}
