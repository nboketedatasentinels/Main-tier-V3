import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Progress,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  Text,
  Textarea,
  Tooltip,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { addDays, addHours, format, formatDistanceToNowStrict } from 'date-fns'
import {
  AlarmClockCheck,
  AlarmClockOff,
  AlertCircle,
  Calendar,
  Check,
  Clock3,
  Mail,
  MessageSquare,
  RefreshCcw,
  Search,
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
import { fetchOrgMembers, getOrgScope } from '@/utils/organizationScope'

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
  matchId: string
  peer: PeerProfile
  matchReason: string
  matchStatus: MatchStatus
  createdAt?: Date
  lastRefreshAt?: Date
  lastManualRefreshAt?: Date
  refreshCount?: number
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

type MatchRefreshPreference = 'weekly' | 'biweekly' | 'on-demand' | 'disabled'
type MatchNotificationPreference = 'email' | 'in_app' | 'both'
type MatchStatus = 'new' | 'viewed' | 'contacted' | 'completed' | 'expired'

type MatchPreferences = {
  refreshPreference: MatchRefreshPreference
  preferredMatchDay: number
  notificationPreference: MatchNotificationPreference
  timezone: string
}

type MatchWindow = {
  key: string
  label: string
  startDate?: Date
  endDate?: Date
  nextRefreshAt?: Date | null
  frequencyLabel: string
  durationDays?: number
}

const MANUAL_REFRESH_COOLDOWN_HOURS = 24
const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAY_SHORT_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
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

const getTimezoneDateParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const weekdayIndex = WEEKDAY_SHORT_MAP[lookup.weekday ?? 'Mon'] ?? 1
  const year = Number(lookup.year)
  const month = Number(lookup.month)
  const day = Number(lookup.day)
  return { year, month, day, weekdayIndex }
}

const createTimezoneDate = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day, 12))

const addDaysUtc = (date: Date, days: number) => {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

const getPreferredDayOnOrBefore = (date: Date, preferredDay: number) => {
  const currentWeekday = date.getUTCDay()
  const diff = (currentWeekday - preferredDay + 7) % 7
  return addDaysUtc(date, -diff)
}

const formatMatchDate = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(date)

const buildMatchWindow = (preferences: MatchPreferences): MatchWindow => {
  if (preferences.refreshPreference === 'disabled') {
    return {
      key: 'disabled',
      label: 'Matching disabled',
      nextRefreshAt: null,
      frequencyLabel: 'Disabled',
    }
  }

  if (preferences.refreshPreference === 'on-demand') {
    return {
      key: 'on-demand',
      label: 'On-demand match',
      nextRefreshAt: null,
      frequencyLabel: 'On-demand',
    }
  }

  const now = new Date()
  const { year, month, day } = getTimezoneDateParts(now, preferences.timezone)
  const todayInTimezone = createTimezoneDate(year, month, day)
  const weeklyStart = getPreferredDayOnOrBefore(todayInTimezone, preferences.preferredMatchDay)
  const cycleLength = preferences.refreshPreference === 'biweekly' ? 14 : 7

  let startDate = weeklyStart
  if (preferences.refreshPreference === 'biweekly') {
    const referenceAnchor = createTimezoneDate(2024, 1, 1)
    const referenceStart = getPreferredDayOnOrBefore(referenceAnchor, preferences.preferredMatchDay)
    const weeksSinceReference = Math.floor((weeklyStart.getTime() - referenceStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
    const cycleIndex = Math.floor(weeksSinceReference / 2)
    startDate = addDaysUtc(referenceStart, cycleIndex * 14)
  }

  const endDate = addDaysUtc(startDate, cycleLength - 1)
  const nextRefreshAt = addDaysUtc(startDate, cycleLength)
  const label = `${formatMatchDate(startDate, preferences.timezone)} - ${formatMatchDate(endDate, preferences.timezone)}`

  return {
    key: `${preferences.refreshPreference}-${startDate.toISOString().slice(0, 10)}`,
    label,
    startDate,
    endDate,
    nextRefreshAt,
    frequencyLabel: preferences.refreshPreference === 'biweekly' ? 'Every 2 weeks' : 'Weekly',
    durationDays: cycleLength,
  }
}

export const PeerConnectPage: React.FC = () => {
  const { user, profile } = useAuth()
  const toast = useToast()
  const challengeModal = useDisclosure()
  const sessionModal = useDisclosure()
  const viewedMatchRef = useRef<string | null>(null)

  const [availablePeers, setAvailablePeers] = useState<PeerProfile[]>([])
  const [weeklyMatch, setWeeklyMatch] = useState<WeeklyMatch | null>(null)
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([])
  const [sessions, setSessions] = useState<PeerSession[]>([])
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
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [preselectedUser, setPreselectedUser] = useState<PreselectedUser | null>(null)

  const matchPreferences = useMemo<MatchPreferences>(() => ({
    refreshPreference: (profile?.matchRefreshPreference as MatchRefreshPreference) || 'weekly',
    preferredMatchDay: typeof profile?.preferredMatchDay === 'number' ? profile.preferredMatchDay : 1,
    notificationPreference: (profile?.matchNotificationPreference as MatchNotificationPreference) || 'both',
    timezone: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  }), [profile?.matchNotificationPreference, profile?.matchRefreshPreference, profile?.preferredMatchDay, profile?.timezone])

  const matchWindow = useMemo(() => buildMatchWindow(matchPreferences), [matchPreferences])
  const matchDocId = useMemo(() => (user ? `${user.uid}-${matchWindow.key}` : null), [matchWindow.key, user])

  const fetchWeeklyMatch = useCallback(async () => {
    if (!user || !profile || !matchDocId) return
    if (matchPreferences.refreshPreference === 'disabled') {
      setWeeklyMatch(null)
      return
    }
    if (!availablePeers.length) {
      setWeeklyMatch(null)
      return
    }
    try {
      const matchRef = doc(db, 'peer_weekly_matches', matchDocId)
      const matchDoc = await getDoc(matchRef)
      if (matchDoc.exists()) {
        const data = matchDoc.data()
        const matchedPeer = availablePeers.find((peer) => peer.id === data.peerId)
        if (matchedPeer) {
          setWeeklyMatch({
            matchId: matchRef.id,
            peer: matchedPeer,
            matchReason: data.matchReason || 'Same company code',
            matchStatus: (data.matchStatus as MatchStatus) || 'new',
            createdAt: data.createdAt?.toDate?.(),
            lastRefreshAt: data.lastRefreshAt?.toDate?.(),
            lastManualRefreshAt: data.lastManualRefreshAt?.toDate?.(),
            refreshCount: data.refreshCount,
          })
          return
        }
      }
      const deterministicPeer = availablePeers[Math.abs(Number.parseInt(user.uid.slice(-3), 10)) % availablePeers.length]
      if (deterministicPeer) {
        const matchPayload = {
          peerId: deterministicPeer.id,
          userId: user.uid,
          matchKey: matchWindow.key,
          matchRefreshPreference: matchPreferences.refreshPreference,
          preferredMatchDay: matchPreferences.preferredMatchDay,
          matchReason: deterministicPeer.cohortIdentifier
            ? 'Shared cohort'
            : deterministicPeer.corporateVillageId
              ? 'Same corporate village'
              : 'Same company code',
          matchStatus: 'new',
          refreshCount: 1,
          createdAt: serverTimestamp(),
          lastRefreshAt: serverTimestamp(),
        }
        await Promise.all([
          setDoc(matchRef, matchPayload),
          updateDoc(doc(db, 'profiles', user.uid), { lastMatchRefreshDate: serverTimestamp(), updatedAt: serverTimestamp() }),
        ])
        setWeeklyMatch({
          matchId: matchRef.id,
          peer: deterministicPeer,
          matchReason: matchPayload.matchReason,
          matchStatus: 'new',
          refreshCount: matchPayload.refreshCount,
          createdAt: new Date(),
          lastRefreshAt: new Date(),
        })
      }
    } catch (error) {
      console.error('Error selecting weekly match', error)
    }
  }, [availablePeers, matchDocId, matchPreferences.preferredMatchDay, matchPreferences.refreshPreference, matchWindow.key, profile, user])

  const selectNextPeer = useCallback(
    (currentPeerId?: string | null, refreshCount = 0) => {
      if (!availablePeers.length) return null
      if (availablePeers.length === 1) return availablePeers[0]
      const seed = Math.abs(Number.parseInt(user?.uid.slice(-3) || '0', 10)) + refreshCount
      for (let offset = 0; offset < availablePeers.length; offset += 1) {
        const candidate = availablePeers[(seed + offset) % availablePeers.length]
        if (candidate.id !== currentPeerId) return candidate
      }
      return availablePeers[0]
    },
    [availablePeers, user?.uid]
  )

  const updateMatchStatus = useCallback(
    async (nextStatus: MatchStatus) => {
      if (!weeklyMatch || !matchDocId) return
      try {
        await updateDoc(doc(db, 'peer_weekly_matches', matchDocId), {
          matchStatus: nextStatus,
          lastStatusUpdatedAt: serverTimestamp(),
        })
        setWeeklyMatch((prev) => (prev ? { ...prev, matchStatus: nextStatus } : prev))
      } catch (error) {
        console.error('Unable to update match status', error)
      }
    },
    [matchDocId, weeklyMatch]
  )

  const handleManualRefresh = useCallback(async () => {
    if (!user || !profile || !matchDocId) return
    if (!availablePeers.length) return
    try {
      const currentPeerId = weeklyMatch?.peer.id
      const refreshCount = (weeklyMatch?.refreshCount ?? 0) + 1
      const nextPeer = selectNextPeer(currentPeerId, refreshCount)
      if (!nextPeer) return
      const matchPayload = {
        peerId: nextPeer.id,
        userId: user.uid,
        matchKey: matchWindow.key,
        matchRefreshPreference: matchPreferences.refreshPreference,
        preferredMatchDay: matchPreferences.preferredMatchDay,
        matchReason: nextPeer.cohortIdentifier
          ? 'Shared cohort'
          : nextPeer.corporateVillageId
            ? 'Same corporate village'
            : 'Same company code',
        matchStatus: 'new',
        refreshCount,
        createdAt: serverTimestamp(),
        lastManualRefreshAt: serverTimestamp(),
        lastRefreshAt: serverTimestamp(),
      }
      await Promise.all([
        setDoc(doc(db, 'peer_weekly_matches', matchDocId), matchPayload, { merge: true }),
        updateDoc(doc(db, 'profiles', user.uid), { lastMatchRefreshDate: serverTimestamp(), updatedAt: serverTimestamp() }),
      ])
      setWeeklyMatch({
        matchId: matchDocId,
        peer: nextPeer,
        matchReason: matchPayload.matchReason,
        matchStatus: 'new',
        refreshCount,
        createdAt: new Date(),
        lastRefreshAt: new Date(),
        lastManualRefreshAt: new Date(),
      })
      toast({
        title: 'New match requested',
        description: 'Your peer match has been refreshed.',
        status: 'success',
        position: 'top',
      })
    } catch (error) {
      console.error('Manual refresh failed', error)
      toast({
        title: 'Unable to refresh match',
        description: 'Please try again later.',
        status: 'error',
        position: 'top',
      })
    }
  }, [
    availablePeers.length,
    matchDocId,
    matchPreferences.preferredMatchDay,
    matchPreferences.refreshPreference,
    matchWindow.key,
    profile,
    selectNextPeer,
    toast,
    user,
    weeklyMatch?.peer.id,
    weeklyMatch?.refreshCount,
  ])

  const fetchInvitesAndSessions = useCallback(async () => {
    if (!user) return
    setLoadingSessions(true)
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
      setSessions(mappedSessions)
    } catch (error) {
      console.error('Error fetching sessions', error)
      setSessions([])
      setPendingInvites([])
      toast({
        title: 'Unable to load peer sessions',
        description: 'We could not retrieve invitations or sessions from Firestore. Please try again shortly.',
        status: 'error',
        position: 'top',
      })
    } finally {
      setLoadingSessions(false)
    }
  }, [toast, user])

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
      if (!profile?.id) return
      setLoadingPeers(true)
      try {
        const orgScope = getOrgScope(profile)
        if (!orgScope.isValid) {
          setAvailablePeers([])
          toast({
            title: 'No organisation assigned',
            description: 'You need to be linked to an organisation to see peers.',
            status: 'info',
            position: 'top',
          })
          return
        }

        const members = await fetchOrgMembers(db, orgScope, profile.id)
        const mappedPeers = members.map((data) => ({
          id: String(data.id),
          name: String(
            data.fullName
              || `${data.firstName || ''} ${data.lastName || ''}`.trim()
              || 'Unnamed User',
          ),
          email: String(data.email || ''),
          timezone: data.timezone as PeerProfile['timezone'],
          interests: data.interests as PeerProfile['interests'],
          goals: data.goals as PeerProfile['goals'],
          companyCode: data.companyCode ?? undefined,
          corporateVillageId: data.corporateVillageId as PeerProfile['corporateVillageId'],
          cohortIdentifier: data.cohortIdentifier as PeerProfile['cohortIdentifier'],
          calendarLink: data.calendarLink as PeerProfile['calendarLink'],
          identityTag: data.identityTag as PeerProfile['identityTag'],
          avatarUrl: data.avatarUrl as PeerProfile['avatarUrl'],
        }))
        setAvailablePeers(mappedPeers)
      } catch (error: unknown) {
        console.error('Error fetching peers', error)
        const errorMessage = error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : undefined
        toast({
          title: 'Unable to load peers',
          description:
            errorMessage === 'permission-denied'
              ? 'Permission denied. Your account cannot read peer profiles.'
              : 'We could not fetch your organisation peers from Firestore.',
          status: 'error',
          position: 'top',
        })
        setAvailablePeers([])
      } finally {
        setLoadingPeers(false)
      }
    }
    fetchPeers()
  }, [profile?.id, toast])

  useEffect(() => {
    fetchWeeklyMatch()
  }, [fetchWeeklyMatch])

  useEffect(() => {
    if (!weeklyMatch || weeklyMatch.matchStatus !== 'new') return
    if (viewedMatchRef.current === weeklyMatch.matchId) return
    viewedMatchRef.current = weeklyMatch.matchId
    void updateMatchStatus('viewed')
  }, [updateMatchStatus, weeklyMatch])

  useEffect(() => {
    fetchInvitesAndSessions()
  }, [fetchInvitesAndSessions])

  const filteredParticipants = useMemo(() => {
    const queryString = participantFilter.toLowerCase()
    return availablePeers.filter((peer) => peer.name.toLowerCase().includes(queryString) || peer.email.toLowerCase().includes(queryString))
  }, [availablePeers, participantFilter])

  const matchStatusLabel = useMemo(() => {
    if (!weeklyMatch) return 'Pending'
    const status = weeklyMatch.matchStatus || 'new'
    const labelMap: Record<MatchStatus, string> = {
      new: 'New',
      viewed: 'Viewed',
      contacted: 'Contacted',
      completed: 'Completed',
      expired: 'Expired',
    }
    return labelMap[status]
  }, [weeklyMatch])

  const matchStatusColor = useMemo(() => {
    if (!weeklyMatch) return 'gray'
    const status = weeklyMatch.matchStatus || 'new'
    const colorMap: Record<MatchStatus, string> = {
      new: 'purple',
      viewed: 'blue',
      contacted: 'teal',
      completed: 'green',
      expired: 'orange',
    }
    return colorMap[status]
  }, [weeklyMatch])

  const matchAgeLabel = useMemo(() => {
    if (!weeklyMatch) return 'No match yet'
    if (!weeklyMatch.createdAt) return 'Match just created'
    return formatDistanceToNowStrict(weeklyMatch.createdAt, { addSuffix: true })
  }, [weeklyMatch])

  const nextRefreshLabel = useMemo(() => {
    if (matchPreferences.refreshPreference === 'disabled') return 'Automatic refresh disabled'
    if (matchPreferences.refreshPreference === 'on-demand') return 'Manual refresh only'
    if (!matchWindow.nextRefreshAt) return 'Not scheduled'
    return formatDistanceToNowStrict(matchWindow.nextRefreshAt, { addSuffix: true })
  }, [matchPreferences.refreshPreference, matchWindow.nextRefreshAt])

  const cooldownEndsAt = useMemo(() => {
    if (!weeklyMatch?.lastManualRefreshAt) return null
    return addHours(weeklyMatch.lastManualRefreshAt, MANUAL_REFRESH_COOLDOWN_HOURS)
  }, [weeklyMatch?.lastManualRefreshAt])

  const cooldownLabel = useMemo(() => {
    if (!cooldownEndsAt) return null
    if (weeklyMatch?.matchStatus === 'completed') return null
    if (cooldownEndsAt <= new Date()) return null
    return formatDistanceToNowStrict(cooldownEndsAt, { addSuffix: true })
  }, [cooldownEndsAt, weeklyMatch?.matchStatus])

  const canManualRefresh = useMemo(() => {
    if (matchPreferences.refreshPreference === 'disabled') return false
    if (cooldownEndsAt && weeklyMatch?.matchStatus !== 'completed') {
      return cooldownEndsAt <= new Date()
    }
    return true
  }, [cooldownEndsAt, matchPreferences.refreshPreference, weeklyMatch?.matchStatus])

  const matchTimelineProgress = useMemo(() => {
    if (!matchWindow.startDate || !matchWindow.endDate) return null
    const now = new Date()
    const totalMs = matchWindow.endDate.getTime() - matchWindow.startDate.getTime()
    if (totalMs <= 0) return 0
    const elapsedMs = Math.min(Math.max(now.getTime() - matchWindow.startDate.getTime(), 0), totalMs)
    return Math.round((elapsedMs / totalMs) * 100)
  }, [matchWindow.endDate, matchWindow.startDate])

  const refreshBadgeLabel = useMemo(() => {
    if (matchPreferences.refreshPreference === 'disabled') return 'Matching paused'
    if (matchPreferences.refreshPreference === 'on-demand') return 'On-demand'
    const dayLabel = WEEKDAY_LABELS[matchPreferences.preferredMatchDay] || 'Monday'
    if (matchPreferences.refreshPreference === 'biweekly') {
      return `Every 2 weeks on ${dayLabel}`
    }
    return `Refreshes ${dayLabel}`
  }, [matchPreferences.preferredMatchDay, matchPreferences.refreshPreference])

  const matchDescription = useMemo(() => {
    if (matchPreferences.refreshPreference === 'disabled') {
      return 'Peer matching is currently disabled. Enable it in your profile settings to receive matches.'
    }
    if (matchPreferences.refreshPreference === 'on-demand') {
      return 'Request a new peer whenever you are ready. Matches stay active until you refresh manually.'
    }
    return `Deterministic selection refreshes ${matchPreferences.refreshPreference === 'biweekly' ? 'every two weeks' : 'weekly'} based on your preferred day.`
  }, [matchPreferences.refreshPreference])

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
                          {matchPreferences.refreshPreference === 'disabled'
                            ? 'Matching paused'
                            : `Match window ${matchWindow.label}`}
                        </Text>
                        <Heading size="md" color="brand.text">
                          {matchPreferences.refreshPreference === 'disabled' ? 'Peer Matching Paused' : 'Your Peer Match'}
                        </Heading>
                        <Text color="brand.subtleText">{matchDescription}</Text>
                      </Stack>
                      <Badge colorScheme="primary" variant="subtle" alignSelf="flex-start">
                        {refreshBadgeLabel}
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
                              <Badge colorScheme={matchStatusColor} variant="outline">
                                {matchStatusLabel}
                              </Badge>
                            </HStack>
                          </Stack>
                        </HStack>

                        <Stack spacing={2} align="flex-end">
                          <Button
                            as="a"
                            href={`mailto:${weeklyMatch.peer.email}?subject=${encodeURIComponent(`Peer Match for ${matchWindow.label}`)}&body=${encodeURIComponent(
                              `Hi ${weeklyMatch.peer.name},%0D%0A%0D%0AWe were paired for this match window (${matchWindow.label}). I'd love to lock in a time to connect. Feel free to grab a slot on my calendar or reply with your availability.%0D%0A%0D%0A- ${profile?.fullName || 'Your peer'}`
                            )}`}
                            leftIcon={<Mail size={18} />}
                            colorScheme="primary"
                            variant="solid"
                            target="_blank"
                            onClick={() => updateMatchStatus('contacted')}
                          >
                            Email your peer
                          </Button>
                          <Tooltip
                            label={cooldownLabel ? `Manual refresh available ${cooldownLabel}` : undefined}
                            isDisabled={canManualRefresh}
                          >
                            <Button
                              leftIcon={<RefreshCcw size={16} />}
                              variant="outline"
                              onClick={handleManualRefresh}
                              isDisabled={!canManualRefresh}
                            >
                              Request new match
                            </Button>
                          </Tooltip>
                          <Button
                            leftIcon={<Check size={16} />}
                            variant="ghost"
                            onClick={() => updateMatchStatus('completed')}
                            isDisabled={weeklyMatch.matchStatus === 'completed'}
                          >
                            Mark as completed
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
                        <Text>
                          {matchPreferences.refreshPreference === 'disabled'
                            ? 'Peer matching is disabled. Update your preferences to receive matches.'
                            : 'No peer match yet. We will generate a match once someone else joins your organisation.'}
                        </Text>
                      </Center>
                    )}

                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mt={6}>
                      <Box border="1px solid" borderColor="border.subtle" rounded="lg" p={3}>
                        <Text fontSize="xs" textTransform="uppercase" color="brand.subtleText" mb={1}>
                          Match age
                        </Text>
                        <Text fontWeight="semibold" color="brand.text">
                          {matchAgeLabel}
                        </Text>
                        <Text fontSize="xs" color="brand.subtleText">
                          {weeklyMatch?.createdAt ? `Created ${matchAgeLabel}` : 'New match is being prepared'}
                        </Text>
                      </Box>
                      <Box border="1px solid" borderColor="border.subtle" rounded="lg" p={3}>
                        <Text fontSize="xs" textTransform="uppercase" color="brand.subtleText" mb={1}>
                          Next refresh
                        </Text>
                        <Text fontWeight="semibold" color="brand.text">
                          {nextRefreshLabel}
                        </Text>
                        {cooldownLabel && (
                          <Text fontSize="xs" color="brand.subtleText">
                            Manual refresh available {cooldownLabel}
                          </Text>
                        )}
                      </Box>
                      <Box border="1px solid" borderColor="border.subtle" rounded="lg" p={3}>
                        <Text fontSize="xs" textTransform="uppercase" color="brand.subtleText" mb={1}>
                          Status
                        </Text>
                        <Tag colorScheme={matchStatusColor} size="md">
                          {matchStatusLabel}
                        </Tag>
                        <Text fontSize="xs" color="brand.subtleText" mt={1}>
                          Track your progress with this connection.
                        </Text>
                      </Box>
                    </SimpleGrid>

                    {matchTimelineProgress !== null && matchWindow.durationDays ? (
                      <Box mt={4}>
                        <HStack justify="space-between" mb={2}>
                          <Text fontSize="xs" color="brand.subtleText">
                            Match timeline
                          </Text>
                          <Text fontSize="xs" color="brand.subtleText">
                            {matchWindow.durationDays} days
                          </Text>
                        </HStack>
                        <Progress value={matchTimelineProgress} borderRadius="full" />
                      </Box>
                    ) : null}
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
                      {loadingSessions ? (
                        <Center py={6}>
                          <HStack spacing={2}>
                            <Spinner size="sm" />
                            <Text fontSize="sm" color="brand.subtleText">
                              Loading sessions...
                            </Text>
                          </HStack>
                        </Center>
                      ) : sessions.length ? (
                        sessions.map((session) => (
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
                        ))
                      ) : (
                        <Center py={6} flexDirection="column" gap={2} color="brand.subtleText" border="1px dashed" borderColor="border.subtle" borderRadius="xl">
                          <Icon as={AlarmClockCheck} w={5} h={5} />
                          <Text fontSize="sm">No sessions scheduled yet.</Text>
                          <Text fontSize="xs">Create a peer session or wait for an invite from your organisation.</Text>
                        </Center>
                      )}
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
                      {loadingPeers ? (
                        <Center py={4}>
                          <HStack spacing={2}>
                            <Spinner size="sm" />
                            <Text fontSize="sm" color="brand.subtleText">
                              Loading peers...
                            </Text>
                          </HStack>
                        </Center>
                      ) : (
                        <>
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
                              No peers found in your organisation yet. Invite teammates so you can start challenges and sessions.
                            </Text>
                          )}
                        </>
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
                        {loadingSessions ? (
                          <Center py={4}>
                            <HStack spacing={2}>
                              <Spinner size="sm" />
                              <Text fontSize="sm" color="brand.subtleText">
                                Loading sessions...
                              </Text>
                            </HStack>
                          </Center>
                        ) : sessions.length ? (
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
                          <Stack spacing={1} color="brand.subtleText">
                            <Text fontSize="sm">No sessions yet.</Text>
                            <Text fontSize="xs">Start a peer session to schedule your first group meetup.</Text>
                          </Stack>
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
