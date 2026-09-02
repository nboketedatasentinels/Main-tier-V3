import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  Heading,
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
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { format, formatDistanceToNowStrict } from 'date-fns'
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
  Sword,
  Target,
  Trophy,
  Users,
  Video,
  X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { StartChallengeModal } from '@/components/modals/StartChallengeModal'
import { getOrgScope } from '@/utils/organizationScope'
import { getDisplayName } from '@/utils/displayName'
import { normalizeEmail } from '@/utils/email'
import { isLearnerRole } from '@/utils/role'
import {
  fetchSupabasePeerById,
  listOrgPeers,
  ensureCurrentPeerMatch,
  assignCurrentPeerMatch,
  replaceCurrentPeerMatch,
  updatePeerMatchStatus,
  type PeerWeeklyMatchRow,
} from '@/services/supabasePeerService'
import {
  createPeerSession,
  confirmSession,
  fetchUserInvitations,
  fetchUserSessions,
  processPeerSessionLifecycleForUser,
  reportNoShow as reportNoShowService,
  respondToInvitation,
  subscribeToUserSessions,
  subscribeToUserInvitations,
} from '@/services/peerSessionService'
import type { PeerSession as ServicePeerSession } from '@/services/peerSessionService'
import { DateTimePicker } from '@/components/scheduling/DateTimePicker'
import {
  buildMatchWindow,
  type MatchPreferencesForWindow,
  type MatchRefreshPreference,
} from './peerMatchingUtils'

// Types
type PeerProfile = {
  id: string
  name: string
  email: string
  allowPeerMatching?: boolean
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

const normalizeAccountStatus = (status: unknown) => (typeof status === 'string' ? status.trim().toLowerCase() : '')

const hasSignedInMarkers = (record: Record<string, unknown>) => {
  if (typeof record.totalPoints === 'number') return true
  if (typeof record.level === 'number') return true
  if (typeof record.journeyType === 'string' && record.journeyType.trim().length > 0) return true
  if (typeof record.onboardingComplete === 'boolean') return true
  return false
}

const isEligiblePeerRecord = (record: Record<string, unknown>) => {
  if (record.mergedInto) return false
  if (!isLearnerRole(record.role)) return false

  const status = normalizeAccountStatus(record.accountStatus ?? record.status)
  if (status && status !== 'active') return false

  const privacy = record.privacySettings as { allowPeerMatching?: boolean } | undefined
  if (privacy?.allowPeerMatching === false) return false

  const email = typeof record.email === 'string' ? record.email : ''
  if (!normalizeEmail(email)) return false

  return hasSignedInMarkers(record)
}

const mapRecordToPeerProfile = (record: Record<string, unknown>): PeerProfile => {
  const id = String(record.id)
  const email = typeof record.email === 'string' ? record.email : ''
  const privacy = record.privacySettings as { allowPeerMatching?: boolean } | undefined
  const displayInput = {
    ...record,
    email,
    uid: id,
  }
  return {
    id,
    name: getDisplayName(displayInput, 'Member'),
    email,
    allowPeerMatching: privacy?.allowPeerMatching,
    timezone: record.timezone as PeerProfile['timezone'],
    interests: record.interests as PeerProfile['interests'],
    goals: record.goals as PeerProfile['goals'],
    companyCode: typeof record.companyCode === 'string' ? record.companyCode : undefined,
    corporateVillageId: record.corporateVillageId as PeerProfile['corporateVillageId'],
    cohortIdentifier: record.cohortIdentifier as PeerProfile['cohortIdentifier'],
    calendarLink: record.calendarLink as PeerProfile['calendarLink'],
    identityTag: record.identityTag as PeerProfile['identityTag'],
    avatarUrl: record.avatarUrl as PeerProfile['avatarUrl'],
  }
}

type PeerProfileLookupResult =
  | { status: 'ok'; profile: PeerProfile }
  | { status: 'not_found' | 'ineligible' | 'permission_denied' | 'error'; code?: string }

const getUnavailableMatchMessage = (status: PeerProfileLookupResult['status']) => {
  if (status === 'permission_denied') {
    return 'Your match exists, but the peer profile is not visible with your current access. A new match will appear in the next cycle.'
  }
  if (status === 'not_found' || status === 'ineligible') {
    return 'Your previous match is no longer available. A new match will appear automatically in the next cycle.'
  }
  return 'We could not load your matched peer right now. Please refresh or try again shortly.'
}

const fetchPeerProfileById = async (peerId: string): Promise<PeerProfileLookupResult> => {
  if (!peerId) return { status: 'not_found' }
  try {
    const result = await fetchSupabasePeerById(peerId)
    if (result.status === 'ok') {
      if (!isEligiblePeerRecord(result.record)) return { status: 'ineligible' }
      return { status: 'ok', profile: mapRecordToPeerProfile(result.record) }
    }
    if (result.status === 'permission_denied') {
      return { status: 'permission_denied', code: result.code }
    }
    if (result.status === 'not_found') return { status: 'not_found' }
    return { status: 'error', code: result.code }
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : undefined
    if (code === 'permission-denied') {
      return { status: 'permission_denied', code }
    }
    console.warn('[PeerMatch] Failed to fetch peer profile', peerId, code ?? error)
    return { status: 'error', code }
  }
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
  refreshCount?: number
}

type PeerSession = {
  id: string
  title: string
  description?: string
  scheduledAt: Date
  timezone: string
  platform: 'Zoom' | 'Google Meet' | 'Zoho Meet'
  participants: string[]
  link?: string
  status: 'pending' | 'confirmed' | 'scheduled' | 'in_progress' | 'completed' | 'no_show'
  confirmationDeadline: Date
  youConfirmed: boolean
  peerConfirmed: boolean
}

const mapServiceSessionToPeerSession = (
  session: ServicePeerSession,
  options?: { currentUserId?: string; timezoneFallback?: string },
): PeerSession => {
  const currentUserId = options?.currentUserId
  const timezone = session.timezone || options?.timezoneFallback || 'UTC'
  const confirmations = session.confirmations || {}

  const youConfirmed = currentUserId ? Boolean(confirmations[currentUserId]) : false
  const peerConfirmed = Object.entries(confirmations).some(
    ([participantId, confirmed]) => participantId !== currentUserId && confirmed,
  )

  return {
    id: session.id,
    title: session.title || 'Weekly Peer Date',
    description: session.description,
    scheduledAt: session.scheduledAt,
    timezone,
    platform: session.platform,
    participants: session.participants || [],
    link: session.meetingLink,
    status: session.status as PeerSession['status'],
    confirmationDeadline: session.confirmationDeadline,
    youConfirmed,
    peerConfirmed,
  }
}

type Invitation = {
  id: string
  fromName: string
  fromEmail: string
}

type MatchNotificationPreference = 'email' | 'in_app' | 'both'
type MatchStatus = 'new' | 'viewed' | 'contacted' | 'completed' | 'expired'

type MatchPreferences = MatchPreferencesForWindow & {
  notificationPreference: MatchNotificationPreference
}

const defaultSessionDescription =
  'Work through a practical together — shared insight on the same exercise, not a free-form chat.'
const ACTIVE_SESSION_WINDOW_MS = 2 * 60 * 60 * 1000

const buildWeeklyMatchFromRow = (row: PeerWeeklyMatchRow, peer: PeerProfile): WeeklyMatch => ({
  matchId: row.id,
  peer,
  matchReason: row.match_reason || 'Automatic match for this week',
  matchStatus: (row.match_status as MatchStatus) || 'new',
  createdAt: row.created_at ? new Date(row.created_at) : undefined,
  lastRefreshAt: row.last_refresh_at ? new Date(row.last_refresh_at) : undefined,
  refreshCount: typeof row.refresh_count === 'number' ? row.refresh_count : undefined,
})

const resolvePeerForMatch = async (
  peerId: string,
  availablePeers: PeerProfile[],
): Promise<PeerProfileLookupResult> => {
  const fromList = availablePeers.find((peer) => peer.id === peerId)
  if (fromList) return { status: 'ok', profile: fromList }
  const fetched = await fetchPeerProfileById(peerId)
  return fetched
}

export const PeerConnectPage: React.FC = () => {
  const { user, profile, loading, profileLoading, updateProfile } = useAuth()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const challengeModal = useDisclosure()
  const sessionModal = useDisclosure()
  const viewedMatchRef = useRef<string | null>(null)

  // Determine initial tab from URL param (0 = Peer Matching, 1 = Practical)
  const initialTabIndex =
    searchParams.get('tab') === 'sessions' || searchParams.get('tab') === 'practical' ? 1 : 0
  const [tabIndex, setTabIndex] = useState(initialTabIndex)

  const [availablePeers, setAvailablePeers] = useState<PeerProfile[]>([])
  const [weeklyMatch, setWeeklyMatch] = useState<WeeklyMatch | null>(null)
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([])
  const [sessions, setSessions] = useState<PeerSession[]>([])
  const [sessionForm, setSessionForm] = useState<{
    title: string
    description: string
    platform: string
    meetingLink: string
    timezone: string
    rememberTimezone: boolean
    participants: string[]
    date: Date | null
    time: string
  }>({
    title: 'Practical meetup',
    description: defaultSessionDescription,
    platform: 'Zoom',
    meetingLink: 'https://zoom.us/',
    timezone: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    rememberTimezone: true,
    participants: [],
    date: null,
    time: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [creatingSession, setCreatingSession] = useState(false)
  const [participantFilter, setParticipantFilter] = useState('')
  const [loadingPeers, setLoadingPeers] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [preselectedUser, setPreselectedUser] = useState<PreselectedUser | null>(null)
  const [matchAvailabilityMessage, setMatchAvailabilityMessage] = useState<string | null>(null)
  const unavailablePeerLogRef = useRef<string | null>(null)
  const rematchAttemptRef = useRef<Set<string>>(new Set())

  const matchPreferences = useMemo<MatchPreferences>(() => ({
    refreshPreference: (profile?.matchRefreshPreference as MatchRefreshPreference) || 'weekly',
    preferredMatchDay: typeof profile?.preferredMatchDay === 'number' ? profile.preferredMatchDay : 1,
    notificationPreference: (profile?.matchNotificationPreference as MatchNotificationPreference) || 'both',
    timezone: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  }), [profile?.matchNotificationPreference, profile?.matchRefreshPreference, profile?.preferredMatchDay, profile?.timezone])

  const matchWindow = useMemo(() => buildMatchWindow(matchPreferences), [matchPreferences])
  const matchDocId = useMemo(() => (user ? `${user.uid}-${matchWindow.key}` : null), [matchWindow.key, user])

  useEffect(() => {
    rematchAttemptRef.current.clear()
  }, [matchDocId])

  const attemptAutomaticRematch = useCallback(
    async (params: {
      unavailablePeerId: string
      reason: Exclude<PeerProfileLookupResult['status'], 'ok'>
    }) => {
      if (!user?.uid || matchWindow.key === 'disabled') return false

      const attemptKey = `${matchWindow.key}:${params.unavailablePeerId}:${params.reason}`
      if (rematchAttemptRef.current.has(attemptKey)) return false
      rematchAttemptRef.current.add(attemptKey)

      try {
        const result = await replaceCurrentPeerMatch({
          matchKey: matchWindow.key,
          unavailablePeerId: params.unavailablePeerId,
        })
        if (!result.ok) {
          rematchAttemptRef.current.delete(attemptKey)
          return false
        }

        const peerResult = await resolvePeerForMatch(result.match.peer_uid, availablePeers)
        if (peerResult.status !== 'ok') {
          rematchAttemptRef.current.delete(attemptKey)
          return false
        }

        setWeeklyMatch(buildWeeklyMatchFromRow(result.match, peerResult.profile))
        setMatchAvailabilityMessage(null)
        unavailablePeerLogRef.current = null
        console.log('[PeerMatch] Automatic replacement peer assigned:', {
          oldPeerId: params.unavailablePeerId,
          newPeerId: result.match.peer_uid,
          reason: params.reason,
        })
        return true
      } catch (error) {
        rematchAttemptRef.current.delete(attemptKey)
        console.warn('[PeerMatch] Automatic replacement failed:', {
          oldPeerId: params.unavailablePeerId,
          reason: params.reason,
          error,
        })
        return false
      }
    },
    [availablePeers, matchWindow.key, user?.uid],
  )

  const fetchWeeklyMatch = useCallback(async () => {
    if (!user || !profile || !matchDocId) return
    if (matchPreferences.refreshPreference === 'disabled') {
      setWeeklyMatch(null)
      setMatchAvailabilityMessage(null)
      return
    }
    // Wait for the org peer list so we can force-assign if auto-select misses.
    if (loadingPeers) return

    try {
      console.log('[PeerMatch] Ensuring match for window:', matchWindow.key)

      let result = await ensureCurrentPeerMatch({
        matchKey: matchWindow.key,
        refreshPreference: matchPreferences.refreshPreference,
        preferredMatchDay: matchPreferences.preferredMatchDay,
      })

      if (!result.ok && result.error === 'no_eligible_peers' && availablePeers.length > 0) {
        const fallbackPeer =
          availablePeers[Math.floor(Math.random() * availablePeers.length)] ?? availablePeers[0]
        result = await assignCurrentPeerMatch({
          matchKey: matchWindow.key,
          peerUid: fallbackPeer.id,
          refreshPreference: matchPreferences.refreshPreference,
          preferredMatchDay: matchPreferences.preferredMatchDay,
        })
      }

      if (!result.ok) {
        setWeeklyMatch(null)
        if (result.error === 'matching_disabled') {
          setMatchAvailabilityMessage('Peer matching is currently disabled.')
        } else if (result.error === 'no_eligible_peers') {
          setMatchAvailabilityMessage(
            availablePeers.length > 0
              ? 'We found peers in your organisation but could not lock a match yet. Refresh to try again.'
              : 'No other learners are in your organisation or village yet. You will be matched the moment someone joins.',
          )
        } else {
          setMatchAvailabilityMessage('We could not create your peer match right now. Please refresh and try again.')
        }
        return
      }

      const peerResult = await resolvePeerForMatch(result.match.peer_uid, availablePeers)
      if (peerResult.status === 'ok') {
        setWeeklyMatch(buildWeeklyMatchFromRow(result.match, peerResult.profile))
        setMatchAvailabilityMessage(null)
        unavailablePeerLogRef.current = null
        if (result.created) {
          toast({
            title: `You're matched with ${peerResult.profile.name}`,
            description:
              'Gain more points than them this week to earn 1,000 points. If you don’t outscore them, you get nothing.',
            status: 'success',
            position: 'top',
            duration: 8000,
          })
        }
        return
      }

      const rematched = await attemptAutomaticRematch({
        unavailablePeerId: result.match.peer_uid,
        reason: peerResult.status,
      })
      if (rematched) return

      // Last resort: if we still have org peers, force a different known peer.
      const alternate = availablePeers.find((peer) => peer.id !== result.match.peer_uid)
      if (alternate) {
        const forced = await replaceCurrentPeerMatch({
          matchKey: matchWindow.key,
          unavailablePeerId: result.match.peer_uid,
        })
        if (forced.ok) {
          const forcedPeer = await resolvePeerForMatch(forced.match.peer_uid, availablePeers)
          if (forcedPeer.status === 'ok') {
            setWeeklyMatch(buildWeeklyMatchFromRow(forced.match, forcedPeer.profile))
            setMatchAvailabilityMessage(null)
            return
          }
        }
      }

      setWeeklyMatch(null)
      setMatchAvailabilityMessage(getUnavailableMatchMessage(peerResult.status))
    } catch (error) {
      console.error('[PeerMatch] Error in fetchWeeklyMatch:', error)
      setWeeklyMatch(null)
      setMatchAvailabilityMessage('We could not load your peer match right now. Please refresh and try again.')
    }
  }, [
    attemptAutomaticRematch,
    availablePeers,
    loadingPeers,
    matchDocId,
    matchPreferences.preferredMatchDay,
    matchPreferences.refreshPreference,
    matchWindow.key,
    profile,
    toast,
    user,
  ])


  const updateMatchStatus = useCallback(
    async (nextStatus: MatchStatus) => {
      if (!weeklyMatch) return
      try {
        await updatePeerMatchStatus({ matchId: weeklyMatch.matchId, status: nextStatus })
        setWeeklyMatch((prev) => (prev ? { ...prev, matchStatus: nextStatus } : prev))
      } catch (error) {
        console.error('Unable to update match status', error)
      }
    },
    [weeklyMatch]
  )


  const loadSessionsAndInvites = useCallback(async () => {
    if (!user) return
    try {
      const [initialSessions, initialInvites] = await Promise.all([
        fetchUserSessions(user.uid),
        fetchUserInvitations(user.uid),
      ])
      setSessions(
        initialSessions.map((session) =>
          mapServiceSessionToPeerSession(session, {
            currentUserId: user?.uid,
            timezoneFallback: profile?.timezone,
          }),
        ),
      )
      setPendingInvites(
        initialInvites.map((invite) => ({
          id: invite.id,
          fromName: invite.fromName,
          fromEmail: invite.fromEmail,
        })),
      )
    } catch (error) {
      console.warn('[PeerConnect] Initial session/invite fetch failed:', error)
    }
  }, [user, profile?.timezone])

  // Live refresh for practicals and invitations (Supabase)
  useEffect(() => {
    if (!user || loading || profileLoading) return

    setLoadingSessions(true)
    const unsubscribeSessions = subscribeToUserSessions(user.uid, (sessionData) => {
      const mappedSessions: PeerSession[] = sessionData.map((session) =>
        mapServiceSessionToPeerSession(session, {
          currentUserId: user.uid,
          timezoneFallback: profile?.timezone,
        }),
      )
      setSessions(mappedSessions)
      setLoadingSessions(false)
    })

    const unsubscribeInvites = subscribeToUserInvitations(user.uid, (inviteData) => {
      const mappedInvites: Invitation[] = inviteData.map((invite) => {
        const email = typeof invite.fromEmail === 'string' ? invite.fromEmail : ''
        return {
          id: invite.id,
          fromName: getDisplayName({ name: invite.fromName, email }, 'Peer'),
          fromEmail: email || 'peer@example.com',
        }
      })
      setPendingInvites(mappedInvites)
    })

    void loadSessionsAndInvites()

    return () => {
      unsubscribeSessions()
      unsubscribeInvites()
    }
  }, [loading, loadSessionsAndInvites, profile?.timezone, profileLoading, user])

  const onChallengeCreated = () => {
    fetchWeeklyMatch()
    // Sessions and invitations update automatically via real-time listeners
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

        const members = await listOrgPeers()
        const mappedPeers = members.map((data) => mapRecordToPeerProfile(data))
        setAvailablePeers(mappedPeers)
      } catch (error: unknown) {
        console.error('Error fetching peers', error)
        const errorMessage =
          error && typeof error === 'object' && 'code' in error
            ? (error as { code?: string }).code
            : undefined
        toast({
          title: 'Unable to load peers',
          description:
            errorMessage === 'permission-denied'
              ? 'Permission denied. Your account cannot read peer profiles.'
              : errorMessage === 'no-organization'
                ? 'You need to be linked to an organisation to see peers.'
                : 'We could not fetch your organisation peers. If this persists, ask an admin to apply the Peer Connect migration.',
          status: 'error',
          position: 'top',
        })
        setAvailablePeers([])
      } finally {
        setLoadingPeers(false)
      }
    }
    fetchPeers()
  }, [profile, user?.uid, toast])

  useEffect(() => {
    fetchWeeklyMatch()
  }, [fetchWeeklyMatch])

  useEffect(() => {
    if (!weeklyMatch || weeklyMatch.matchStatus !== 'new') return
    if (viewedMatchRef.current === weeklyMatch.matchId) return
    viewedMatchRef.current = weeklyMatch.matchId
    void updateMatchStatus('viewed')
  }, [updateMatchStatus, weeklyMatch])

  // Sessions and invitations are now handled by real-time subscriptions above

  const filteredParticipants = useMemo(() => {
    const queryString = participantFilter.toLowerCase()
    return availablePeers.filter((peer) => peer.name.toLowerCase().includes(queryString) || peer.email.toLowerCase().includes(queryString))
  }, [availablePeers, participantFilter])

  const upcomingSessions = useMemo(() => {
    const nowMs = Date.now()
    return sessions.filter(
      (session) =>
        !['completed', 'no_show'].includes(session.status) &&
        session.scheduledAt.getTime() >= nowMs - ACTIVE_SESSION_WINDOW_MS,
    )
  }, [sessions])

  const pastSessions = useMemo(() => {
    const nowMs = Date.now()
    return sessions.filter(
      (session) =>
        ['completed', 'no_show'].includes(session.status) ||
        session.scheduledAt.getTime() < nowMs - ACTIVE_SESSION_WINDOW_MS,
    )
  }, [sessions])

  useEffect(() => {
    if (!user?.uid || sessions.length === 0) return undefined

    let cancelled = false
    let isRunning = false

    const runLifecycleCheck = async () => {
      if (cancelled || isRunning) return
      isRunning = true

      try {
        const openSessions = sessions.filter((session) => !['completed', 'no_show'].includes(session.status))
        if (!openSessions.length) return

        const results = await Promise.allSettled(
          openSessions.map((session) =>
            processPeerSessionLifecycleForUser(
              {
                id: session.id,
                title: session.title,
                status: session.status,
                scheduledAt: session.scheduledAt,
                timezone: session.timezone,
                participants: session.participants,
                createdBy: user.uid,
              },
              user.uid,
            ),
          ),
        )

        const markedMissedCount = results.reduce((count, result) => {
          if (result.status === 'fulfilled' && result.value.markedMissed) {
            return count + 1
          }
          return count
        }, 0)

        if (!cancelled && markedMissedCount > 0) {
          toast({
            title: markedMissedCount === 1 ? 'Session marked as missed' : 'Sessions marked as missed',
            description: 'You can reschedule from your session history.',
            status: 'info',
            position: 'top',
          })
        }
      } finally {
        isRunning = false
      }
    }

    void runLifecycleCheck()
    const timer = window.setInterval(() => {
      void runLifecycleCheck()
    }, 60_000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [sessions, toast, user?.uid])

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
    if (matchPreferences.refreshPreference === 'biweekly') return 'New match every 2 weeks'
    return 'New match every 7 days'
  }, [matchPreferences.refreshPreference])

  const matchDescription = useMemo(() => {
    if (matchPreferences.refreshPreference === 'disabled') {
      return 'Peer matching is currently disabled. Enable it in your profile settings to receive matches.'
    }
    if (matchPreferences.refreshPreference === 'on-demand') {
      return 'Request a new peer whenever you are ready. Matches stay active until you refresh manually.'
    }
    return 'From the day you join, you are auto-matched every 7 days. Outscore your match that week to earn 1,000 points — otherwise you get nothing.'
  }, [matchPreferences.refreshPreference])

  const peerDisplayName = useMemo(() => {
    if (!weeklyMatch) return 'Peer'
    return getDisplayName(weeklyMatch.peer, 'Peer')
  }, [weeklyMatch])

  const senderDisplayName = useMemo(() => getDisplayName(profile, 'Your peer'), [profile])

  const confirmMeeting = async (sessionId: string) => {
    if (!user) return
    try {
      const result = await confirmSession(sessionId, user.uid)

      // Note: UI will update automatically via real-time listener

      if (!result.pointsAwarded) {
        toast({
          title: 'Meetup confirmed',
          description: '50 points will unlock when your peer also confirms before the deadline.',
          status: 'success',
          position: 'top',
        })
      }
    } catch (error) {
      console.error('Confirmation failed:', error)
      toast({
        title: 'Confirmation failed',
        description: 'We could not record your confirmation. Please try again.',
        status: 'error',
        position: 'top',
      })
    }
  }

  const reportNoShow = async (sessionId: string) => {
    if (!user) return
    try {
      const pointsAwarded = await reportNoShowService(sessionId, user.uid)

      // Note: UI will update automatically via real-time listener

      if (!pointsAwarded) {
        toast({
          title: 'No-show reported',
          description: 'Your peer will be notified about the missed session.',
          status: 'info',
          position: 'top',
        })
      }
    } catch (error) {
      console.error('No-show report failed:', error)
      toast({
        title: 'Could not report',
        description: 'Please try again later.',
        status: 'error',
        position: 'top',
      })
    }
  }

  const rescheduleSession = async (session: PeerSession) => {
    if (!user || !profile) return

    const participantIds = session.participants.filter((participantId) => participantId !== user.uid)
    if (!participantIds.length) {
      toast({
        title: 'Unable to reschedule',
        description: 'This session has no participants to invite.',
        status: 'error',
        position: 'top',
      })
      return
    }

    const now = Date.now()
    const minimumLeadMs = 3 * 60 * 60 * 1000
    let nextScheduledAt = new Date(session.scheduledAt.getTime() + 7 * 24 * 60 * 60 * 1000)
    while (nextScheduledAt.getTime() <= now + minimumLeadMs) {
      nextScheduledAt = new Date(nextScheduledAt.getTime() + 7 * 24 * 60 * 60 * 1000)
    }

    const creatorName = getDisplayName(profile, 'Peer')
    const creatorEmail = profile.email || user.email || ''
    if (!creatorEmail) {
      toast({
        title: 'Unable to reschedule',
        description: 'Add an email address to your profile before rescheduling.',
        status: 'error',
        position: 'top',
      })
      return
    }

    try {
      await createPeerSession({
        title: `${session.title} (Rescheduled)`,
        description: session.description || defaultSessionDescription,
        platform: session.platform,
        meetingLink: session.link,
        timezone: session.timezone,
        participants: participantIds,
        scheduledAt: nextScheduledAt,
        createdBy: user.uid,
        creatorName,
        creatorEmail,
      })

      toast({
        title: 'Session rescheduled',
        description: `New invite sent for ${format(nextScheduledAt, 'EEE, MMM d, p')} (${session.timezone}).`,
        status: 'success',
        position: 'top',
      })
    } catch (error) {
      console.error('Reschedule failed:', error)
      toast({
        title: 'Could not reschedule',
        description: 'Please try again.',
        status: 'error',
        position: 'top',
      })
    }
  }

  const respondToInvite = async (inviteId: string, accepted: boolean) => {
    if (!user) return
    try {
      await respondToInvitation(inviteId, accepted)

      // Note: UI will update automatically via real-time listener

      toast({
        title: accepted ? 'Invitation accepted' : 'Invitation declined',
        status: accepted ? 'success' : 'info',
        position: 'top',
      })
      await loadSessionsAndInvites()
    } catch (error) {
      console.error('Invitation response failed:', error)
      toast({
        title: 'Unable to update invitation',
        description: 'Please try again.',
        status: 'error',
        position: 'top',
      })
    }
  }

  const getTimeZoneOffsetMinutes = (timeZone: string, referenceDate: Date) => {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'shortOffset',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      const parts = formatter.formatToParts(referenceDate)
      const tzPart = parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
      const cleaned = tzPart.replace(/GMT|UTC/g, '')
      const match = cleaned.match(/([+-])(\d{1,2})(?::?(\d{2}))?/)
      if (!match) return 0
      const sign = match[1] === '+' ? 1 : -1
      const hours = Number(match[2]) || 0
      const minutes = Number(match[3] ?? 0)
      return sign * (hours * 60 + minutes)
    } catch (error) {
      console.warn('Unable to determine timezone offset for', timeZone, error)
      return 0
    }
  }

  const getScheduledAtFromForm = (date: Date | null, time: string, timeZone: string) => {
    if (!date || !time || !timeZone) return null
    const [hours, minutes] = time.split(':').map((value) => Number(value))
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
    const year = date.getFullYear()
    const month = date.getMonth()
    const day = date.getDate()
    const naiveUtc = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0))
    const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, naiveUtc)
    return new Date(naiveUtc.getTime() - offsetMinutes * 60 * 1000)
  }

  const validateSessionForm = () => {
    const errors: Record<string, string> = {}
    if (!sessionForm.title.trim()) errors.title = 'Please provide a practical title'
    if (!sessionForm.date) errors.date = 'Please select a date'
    if (!sessionForm.time) errors.time = 'Please select a time'
    if (!sessionForm.timezone) errors.timezone = 'Please select a time zone'
    if (sessionForm.participants.length < 1)
      errors.participants = 'Select at least 1 peer so you can host a practical together.'

    // Validate that date/time is in the future
    if (sessionForm.date && sessionForm.time && sessionForm.timezone) {
      const scheduledAt = getScheduledAtFromForm(sessionForm.date, sessionForm.time, sessionForm.timezone)
      if (scheduledAt && scheduledAt <= new Date()) {
        errors.date = 'Session must be scheduled in the future'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const getCreateErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message.trim()) return error.message
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: unknown }).message
      if (typeof message === 'string' && message.trim()) return message
    }
    if (typeof error === 'string' && error.trim()) return error
    return 'Please try again.'
  }

  const createSession = async () => {
    if (!user || !profile || creatingSession) return
    if (!validateSessionForm()) return
    if (!sessionForm.date) return

    setCreatingSession(true)
    try {
      // Construct scheduled date from date, time, and timezone
      const scheduledAt = getScheduledAtFromForm(sessionForm.date, sessionForm.time, sessionForm.timezone)
      if (!scheduledAt) {
        throw new Error('Unable to parse the scheduled session time')
      }

      // Use the atomic service to create session and invitations together
      await createPeerSession({
        title: sessionForm.title,
        description: sessionForm.description,
        platform: sessionForm.platform as 'Zoom' | 'Google Meet' | 'Zoho Meet',
        meetingLink: sessionForm.meetingLink || undefined,
        timezone: sessionForm.timezone,
        participants: sessionForm.participants,
        scheduledAt,
        createdBy: user.uid,
        creatorName: profile.fullName || 'Peer',
        creatorEmail: profile.email || '',
      })

      // Update timezone preference if user enabled it (Supabase profiles.data)
      if (sessionForm.rememberTimezone) {
        await updateProfile({ timezone: sessionForm.timezone })
      }

      // Note: UI will update automatically via real-time listener

      toast({
        title: 'Practical created',
        description: 'Your peers will be notified.',
        status: 'success',
        position: 'top',
        icon: <Check size={18} />,
      })

      // Reset form and close modal
      setSessionForm({
        title: 'Practical meetup',
        description: defaultSessionDescription,
        platform: 'Zoom',
        meetingLink: 'https://zoom.us/',
        timezone: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        rememberTimezone: true,
        participants: [],
        date: null,
        time: '',
      })

      setTimeout(() => sessionModal.onClose(), 500)
    } catch (error) {
      console.error('Session creation failed:', error)
      toast({
        title: 'Could not create practical',
        description: getCreateErrorMessage(error),
        status: 'error',
        position: 'top',
      })
    } finally {
      setCreatingSession(false)
    }
  }

  const toggleParticipant = (peerId: string) => {
    if (sessionForm.participants.includes(peerId)) {
      setSessionForm((prev) => ({ ...prev, participants: prev.participants.filter((id) => id !== peerId) }))
      return
    }
    if (sessionForm.participants.length >= 10) {
      setFormErrors((prev) => ({ ...prev, participants: 'You already selected 10 participants. Deselect someone to invite a different peer.' }))
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
      completed: 'green',
      no_show: 'warning',
    }
    const labelMap: Record<PeerSession['status'], string> = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      completed: 'Completed',
      no_show: 'Missed',
    }
    return <Badge colorScheme={colorMap[status]}>{labelMap[status]}</Badge>
  }

  const disableNoShow = (session: PeerSession) => {
    const now = new Date()
    return ['no_show', 'completed'].includes(session.status) || !session.youConfirmed || session.peerConfirmed || now < session.confirmationDeadline
  }

  return (
    <Stack spacing={6} pb={12}>
      <Box
        bg="white"
        p={6}
        borderRadius="xl"
        boxShadow="0 2px 8px rgba(0,0,0,0.04)"
        position="relative"
        overflow="hidden"
      >
        <Box position="absolute" top={0} right={0} w="90px" h="90px" bg="purple.50" borderRadius="0 0 0 100%" />
        <Stack spacing={4} position="relative" zIndex={1}>
          <HStack spacing={3} align="center">
            <Flex
              w={10}
              h={10}
              bg="#350e6f"
              borderRadius="xl"
              align="center"
              justify="center"
              boxShadow="0 4px 12px rgba(53, 14, 111, 0.3)"
              flexShrink={0}
            >
              <Icon as={MessageSquare} w={5} h={5} color="white" />
            </Flex>
            <Stack spacing={0}>
              <Heading size="md" color="gray.800">
                Peer Connect
              </Heading>
              <Text fontSize="sm" color="gray.500">
                Weekly Peer Match is automatic: you race your match for 1,000 points. Practicals are
                knowledge sessions you organise with friends you choose.
              </Text>
            </Stack>
          </HStack>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            <Link
              href="#peer-tracks"
              onClick={(e) => {
                e.preventDefault()
                setTabIndex(0)
                window.requestAnimationFrame(() => {
                  document.getElementById('peer-tracks')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  })
                })
              }}
              _hover={{ textDecoration: 'none' }}
              display="block"
            >
              <Box
                p={4}
                borderRadius="lg"
                border="1px solid"
                borderColor="purple.100"
                bg="purple.50"
                cursor="pointer"
                _hover={{ borderColor: 'purple.300', transform: 'translateY(-1px)' }}
                transition="all 0.2s"
              >
                <HStack spacing={3}>
                  <Flex
                    w={9}
                    h={9}
                    bg="purple.500"
                    borderRadius="lg"
                    align="center"
                    justify="center"
                    flexShrink={0}
                  >
                    <Icon as={MessageSquare} w={4} h={4} color="white" />
                  </Flex>
                  <Stack spacing={0}>
                    <Text fontWeight="bold" color="gray.800">
                      Weekly Peer Match
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      Auto-paired every 7 days · outscore them for 1,000 points
                    </Text>
                  </Stack>
                </HStack>
              </Box>
            </Link>
            <Link
              href="#peer-tracks"
              onClick={(e) => {
                e.preventDefault()
                setTabIndex(1)
                window.requestAnimationFrame(() => {
                  document.getElementById('peer-tracks')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  })
                })
              }}
              _hover={{ textDecoration: 'none' }}
              display="block"
            >
              <Box
                p={4}
                borderRadius="lg"
                border="1px solid"
                borderColor="blue.100"
                bg="blue.50"
                cursor="pointer"
                _hover={{ borderColor: 'blue.300', transform: 'translateY(-1px)' }}
                transition="all 0.2s"
              >
                <HStack spacing={3}>
                  <Flex
                    w={9}
                    h={9}
                    bg="blue.500"
                    borderRadius="lg"
                    align="center"
                    justify="center"
                    flexShrink={0}
                  >
                    <Icon as={Users} w={4} h={4} color="white" />
                  </Flex>
                  <Stack spacing={0}>
                    <Text fontWeight="bold" color="gray.800">
                      Practical / knowledge session
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      You choose friends and organise the session yourself
                    </Text>
                  </Stack>
                </HStack>
              </Box>
            </Link>
          </SimpleGrid>
        </Stack>
      </Box>

      <Box
        bg="white"
        p={{ base: 5, md: 6 }}
        borderRadius="xl"
        boxShadow="0 2px 8px rgba(0,0,0,0.04)"
        _hover={{ transform: 'translateY(-2px)', boxShadow: '0 8px 25px rgba(244, 84, 12, 0.15)' }}
        transition="all 0.3s ease"
        position="relative"
        overflow="hidden"
      >
        <Box position="absolute" top={0} right={0} w="90px" h="90px" bg="orange.50" borderRadius="0 0 0 100%" />
        <Flex
          direction={{ base: 'column', md: 'row' }}
          gap={{ base: 5, md: 8 }}
          align={{ base: 'stretch', md: 'center' }}
          position="relative"
          zIndex={1}
        >
          <Stack spacing={3} flex={2} minW={0}>
            <HStack spacing={3} align="center">
              <Flex
                w={10}
                h={10}
                bg="linear-gradient(135deg, #f4540c 0%, #c2410c 100%)"
                borderRadius="xl"
                align="center"
                justify="center"
                boxShadow="0 4px 12px rgba(244, 84, 12, 0.3)"
                flexShrink={0}
              >
                <Icon as={Video} w={5} h={5} color="white" />
              </Flex>
              <Stack spacing={0}>
                <Text
                  fontSize="xs"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                  color="gray.500"
                >
                  Peer Learning
                </Text>
                <Heading size="sm" color="gray.800">
                  Two different tracks
                </Heading>
              </Stack>
            </HStack>
            <Text fontSize="sm" color="gray.600" lineHeight="1.6">
              Peer Match pairs you automatically every week for a points race. Practicals are knowledge
              sessions you set up with people you pick. Watch the walkthrough, then use the tabs below.
            </Text>
          </Stack>

          <Box flex={3} w={{ base: '100%', md: 'auto' }} maxW={{ base: 'none', md: '560px' }}>
            <Box
              as="video"
              controls
              preload="metadata"
              playsInline
              src="/media/peer-to-peer.mp4"
              w="100%"
              borderRadius="lg"
              bg="black"
              sx={{ aspectRatio: '16 / 9' }}
              boxShadow="0 4px 16px rgba(0,0,0,0.08)"
            />
          </Box>
        </Flex>
      </Box>

      <Box id="peer-tracks" sx={{ scrollMarginTop: '24px' }}>
      <Tabs variant="soft-rounded" colorScheme="primary" index={tabIndex} onChange={setTabIndex} isFitted>
        <TabList bg="white" p={2} borderRadius="full" border="1px solid" borderColor="gray.100">
          <Tab>
            <HStack spacing={2}>
              <Icon as={MessageSquare} w={4} h={4} />
              <Text>Peer Matching</Text>
            </HStack>
          </Tab>
          <Tab>
            <HStack spacing={2}>
              <Icon as={Users} w={4} h={4} />
              <Text>Practical</Text>
            </HStack>
          </Tab>
        </TabList>

        <TabPanels pt={4}>
          <TabPanel px={0} id="peer-matching" scrollMarginTop="80px">
            <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={4} alignItems="start">
              <GridItem colSpan={{ base: 1, xl: 2 }}>
                <Stack spacing={4}>
                  <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="gray.100" boxShadow="sm">
                    <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4} mb={4} direction={{ base: 'column', md: 'row' }}>
                      <Stack spacing={1}>
                        <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" fontWeight="semibold" color="gray.500">
                          {matchPreferences.refreshPreference === 'disabled'
                            ? 'Matching paused'
                            : `Match window ${matchWindow.label}`}
                        </Text>
                        <Heading size="md" color="gray.800">
                          {matchPreferences.refreshPreference === 'disabled' ? 'Peer Matching Paused' : 'Your Peer Match'}
                        </Heading>
                        <Text fontSize="sm" color="gray.500">{matchDescription}</Text>
                      </Stack>
                      <Badge colorScheme="purple" variant="subtle" alignSelf="flex-start">
                        {refreshBadgeLabel}
                      </Badge>
                    </Flex>

                    {weeklyMatch ? (
                      <Box>
                        <Box
                          mb={4}
                          p={4}
                          borderRadius="lg"
                          border="1px solid"
                          borderColor="purple.100"
                          bg="purple.50"
                        >
                          <Text fontWeight="semibold" color="gray.800" mb={1}>
                            This week’s race vs {peerDisplayName}
                          </Text>
                          <Text fontSize="sm" color="gray.700">
                            Gain more points than {peerDisplayName} during this 7-day window to earn{' '}
                            <Text as="span" fontWeight="bold">
                              1,000 points
                            </Text>
                            . If you don’t outscore them, you get nothing for Peer Match.
                          </Text>
                        </Box>
                        <Flex gap={4} align={{ base: 'flex-start', md: 'center' }} direction={{ base: 'column', md: 'row' }} mb={4}>
                          <HStack spacing={3} flex={1} minW={0}>
                            <Avatar name={peerDisplayName} src={weeklyMatch.peer.avatarUrl} size="md" flexShrink={0} />
                            <Stack spacing={0} minW={0}>
                              <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" fontWeight="semibold" color="gray.500">
                                You are matched with
                              </Text>
                              <Text fontWeight="semibold" color="gray.800" noOfLines={1}>
                                {peerDisplayName}
                              </Text>
                              <Text fontSize="sm" color="gray.500" noOfLines={1}>
                                {weeklyMatch.peer.email}
                              </Text>
                              <HStack spacing={2} pt={1} flexWrap="wrap">
                                <Badge colorScheme="purple" variant="subtle" display="flex" alignItems="center" gap={1}>
                                  <Icon as={Clock3} w={3} h={3} />
                                  {weeklyMatch.peer.timezone || 'Timezone not set'}
                                </Badge>
                                <Badge colorScheme="orange" variant="solid">
                                  1,000 pts if you win the week
                                </Badge>
                                <Badge colorScheme={matchStatusColor} variant="outline">
                                  {matchStatusLabel}
                                </Badge>
                              </HStack>
                            </Stack>
                          </HStack>

                          <HStack spacing={2} flexShrink={0} flexWrap="wrap">
                            <Button
                              as="a"
                              href={`mailto:${weeklyMatch.peer.email}?subject=${encodeURIComponent(`Peer Match for ${matchWindow.label}`)}&body=${encodeURIComponent(
                                `Hi ${peerDisplayName},%0D%0A%0D%0AWe were paired for this match window (${matchWindow.label}). I'd love to lock in a time to connect. Feel free to grab a slot on my calendar or reply with your availability.%0D%0A%0D%0A- ${senderDisplayName}`
                              )}`}
                              leftIcon={<Mail size={16} />}
                              bg="#350e6f"
                              color="white"
                              _hover={{ bg: '#4a1499' }}
                              size="sm"
                              target="_blank"
                              onClick={() => updateMatchStatus('contacted')}
                            >
                              Email peer
                            </Button>
                            {weeklyMatch.peer.calendarLink && (
                              <Button
                                as="a"
                                href={weeklyMatch.peer.calendarLink}
                                target="_blank"
                                rel="noreferrer"
                                leftIcon={<Calendar size={16} />}
                                size="sm"
                                variant="outline"
                                borderColor="gray.200"
                              >
                                Calendar
                              </Button>
                            )}
                            <Button
                              leftIcon={<Check size={14} />}
                              size="sm"
                              variant="outline"
                              borderColor="gray.200"
                              onClick={() => updateMatchStatus('completed')}
                              isDisabled={weeklyMatch.matchStatus === 'completed'}
                            >
                              Mark complete
                            </Button>
                          </HStack>
                        </Flex>
                      </Box>
                    ) : (
                      <Center py={10} flexDirection="column" gap={4} color="gray.500">
                        <Icon as={AlertCircle} w={5} h={5} color="orange.400" />
                        <Stack spacing={3} align="center" textAlign="center" maxW="md">
                          <Text fontWeight="medium" color="gray.800" fontSize="lg">
                            {matchPreferences.refreshPreference === 'disabled'
                              ? 'Peer Matching Disabled'
                              : loadingPeers || availablePeers.length > 0
                                ? 'Finding your peer match…'
                                : 'Waiting for company peers'}
                          </Text>
                          <Text fontSize="sm">
                            {matchAvailabilityMessage
                              ? matchAvailabilityMessage
                              : matchPreferences.refreshPreference === 'disabled'
                              ? 'Peer matching is currently disabled.'
                              : loadingPeers || availablePeers.length > 0
                                ? 'Anyone in your organisation is matched automatically for this 7-day window. Hang tight while we lock yours in.'
                                : 'As soon as another learner joins your organisation or village, you will be matched automatically.'}
                          </Text>
                          {matchPreferences.refreshPreference === 'disabled' && (
                            <Button
                              as="a"
                              href="/app/profile?tab=account"
                              size="sm"
                              colorScheme="purple"
                              leftIcon={<Icon as={Users} w={4} h={4} />}
                            >
                              Enable in Account Settings
                            </Button>
                          )}
                          {matchPreferences.refreshPreference !== 'disabled' && (
                            <Text fontSize="xs" color="gray.500" fontStyle="italic">
                              Matches refresh every 7 days. Opening Peer Connect assigns your current-week peer
                              immediately when one is available.
                              {availablePeers.length < 2 ? ' Invite teammates to expand your peer pool.' : ''}
                            </Text>
                          )}
                        </Stack>
                      </Center>
                    )}

                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mt={6}>
                      <Box border="1px solid" borderColor="gray.100" rounded="lg" p={3}>
                        <Text fontSize="xs" textTransform="uppercase" color="gray.500" mb={1}>
                          Match age
                        </Text>
                        <Text fontWeight="semibold" color="gray.800">
                          {matchAgeLabel}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {weeklyMatch?.createdAt ? `Created ${matchAgeLabel}` : 'New match is being prepared'}
                        </Text>
                      </Box>
                      <Box border="1px solid" borderColor="gray.100" rounded="lg" p={3}>
                        <Text fontSize="xs" textTransform="uppercase" color="gray.500" mb={1}>
                          Next refresh
                        </Text>
                        <Text fontWeight="semibold" color="gray.800">
                          {nextRefreshLabel}
                        </Text>
                      </Box>
                      <Box border="1px solid" borderColor="gray.100" rounded="lg" p={3}>
                        <Text fontSize="xs" textTransform="uppercase" color="gray.500" mb={1}>
                          Status
                        </Text>
                        <Tag colorScheme={matchStatusColor} size="md">
                          {matchStatusLabel}
                        </Tag>
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          Track your progress with this connection.
                        </Text>
                      </Box>
                    </SimpleGrid>

                    {matchTimelineProgress !== null && matchWindow.durationDays ? (
                      <Box mt={4}>
                        <HStack justify="space-between" mb={2}>
                          <Text fontSize="xs" color="gray.500">
                            Match timeline
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            {matchWindow.durationDays} days
                          </Text>
                        </HStack>
                        <Progress value={matchTimelineProgress} borderRadius="full" />
                      </Box>
                    ) : null}
                  </Box>

                  <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="gray.100" boxShadow="sm">
                    <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={3} mb={4} direction={{ base: 'column', md: 'row' }}>
                      <Stack spacing={1}>
                        <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" fontWeight="semibold" color="gray.500">
                          Practical meetups
                        </Text>
                        <Heading size="sm" color="gray.800">
                          Scheduled practicals
                        </Heading>
                        <Text fontSize="sm" color="gray.500">
                          Confirmed and upcoming practical meetups. Confirm early to unlock points. Report
                          no-shows after the confirmation deadline.
                        </Text>
                      </Stack>
                      <Badge colorScheme="green" variant="outline">
                        {upcomingSessions.length} scheduled
                      </Badge>
                    </Flex>

                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                      {loadingSessions ? (
                        <Center py={6}>
                          <HStack spacing={2}>
                            <Spinner size="sm" />
                            <Text fontSize="sm" color="gray.500">
                              Loading sessions...
                            </Text>
                          </HStack>
                        </Center>
                      ) : upcomingSessions.length ? (
                        upcomingSessions.map((session) => (
                          <Box key={session.id} p={4} borderRadius="xl" border="1px solid" borderColor="gray.100" bg="white" boxShadow="xs">
                            <HStack justify="space-between" align="flex-start" mb={2}>
                              <Stack spacing={0}>
                                <Text fontWeight="semibold" color="gray.800">
                                  {session.title}
                                </Text>
                                <Text fontSize="sm" color="gray.500">
                                  {format(session.scheduledAt, 'EEE, MMM d')} - {format(session.scheduledAt, 'p')} {session.timezone}
                                </Text>
                              </Stack>
                              {renderStatusBadge(session.status)}
                            </HStack>
                            <Stack spacing={2} mb={3}>
                              <HStack spacing={3} color="gray.500" fontSize="sm">
                                <Icon as={Video} w={4} h={4} />
                                <Text>{session.platform}</Text>
                              </HStack>
                              {session.link ? (
                                <Box p={2} borderRadius="md" bg="gray.50" border="1px solid" borderColor="gray.100">
                                  <Text fontSize="xs" fontWeight="semibold" color="gray.500" mb={1}>
                                    Meeting link
                                  </Text>
                                  <Link href={session.link} isExternal color="brand.primary" fontSize="sm" wordBreak="break-all">
                                    {session.link}
                                  </Link>
                                </Box>
                              ) : (
                                <Text fontSize="xs" color="gray.500">
                                  Meeting link not added yet.
                                </Text>
                              )}
                            </Stack>
                            <HStack spacing={2} mb={3}>
                              <Badge colorScheme={session.youConfirmed ? 'green' : 'yellow'} variant="subtle">
                                {session.youConfirmed ? 'You confirmed' : 'Awaiting your confirmation'}
                              </Badge>
                              <Badge colorScheme={session.peerConfirmed ? 'green' : 'yellow'} variant="outline">
                                {session.peerConfirmed ? 'Peer confirmed' : 'Peer pending'}
                              </Badge>
                            </HStack>
                            <Flex gap={2} wrap="wrap">
                              {session.link && (
                                <Button
                                  leftIcon={<Video size={14} />}
                                  as="a"
                                  href={session.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  size="sm"
                                  bg="#350e6f"
                                  color="white"
                                  _hover={{ bg: '#4a1499' }}
                                >
                                  Join practical
                                </Button>
                              )}
                              <Button
                                leftIcon={<Check size={14} />}
                                size="sm"
                                bg={session.youConfirmed ? 'white' : '#350e6f'}
                                color={session.youConfirmed ? 'gray.700' : 'white'}
                                border={session.youConfirmed ? '1px solid' : 'none'}
                                borderColor="gray.200"
                                _hover={{ bg: session.youConfirmed ? 'gray.50' : '#4a1499' }}
                                onClick={() => confirmMeeting(session.id)}
                                isDisabled={session.youConfirmed}
                              >
                                {session.youConfirmed ? 'Confirmed' : 'Confirm Meeting'}
                              </Button>
                              <Button
                                leftIcon={<AlarmClockOff size={14} />}
                                size="sm"
                                variant="outline"
                                borderColor="gray.200"
                                color="orange.600"
                                onClick={() => reportNoShow(session.id)}
                                isDisabled={disableNoShow(session)}
                              >
                                Report No-Show
                              </Button>
                            </Flex>
                            <Text fontSize="xs" color="gray.500" mt={3}>
                              Confirmation deadline: {format(session.confirmationDeadline, 'MMM d, p')}
                            </Text>
                          </Box>
                        ))
                      ) : (
                        <Center py={6} flexDirection="column" gap={2} color="gray.500" border="1px dashed" borderColor="gray.100" borderRadius="xl">
                          <Icon as={AlarmClockCheck} w={5} h={5} />
                          <Text fontSize="sm">No scheduled practicals yet.</Text>
                          <Text fontSize="xs">
                            Accept an invitation from the sidebar or start a practical meetup to get started.
                          </Text>
                        </Center>
                      )}
                    </SimpleGrid>
                  </Box>
                  <Box bg="white" p={6} borderRadius="2xl" border="1px solid" borderColor="gray.100" boxShadow="sm" mt={4}>
                    <Flex justify="space-between" align="center" mb={3}>
                      <Heading size="sm" color="gray.800">
                        Past practicals
                      </Heading>
                      <Badge colorScheme="primary" variant="outline">
                        {pastSessions.length} recorded
                      </Badge>
                    </Flex>
                    {loadingSessions ? (
                      <Center py={6}>
                        <HStack spacing={2}>
                          <Spinner size="sm" />
                          <Text fontSize="sm" color="gray.500">
                            Loading session history...
                          </Text>
                        </HStack>
                      </Center>
                    ) : pastSessions.length ? (
                      <Stack spacing={3}>
                        {pastSessions.map((session) => (
                          <Box key={session.id} p={3} borderRadius="lg" border="1px solid" borderColor="gray.100" bg="gray.50">
                            <Stack spacing={1}>
                              <HStack justify="space-between" align="center">
                                <Text fontWeight="semibold" color="gray.800">
                                  {session.title}
                                </Text>
                                {renderStatusBadge(session.status)}
                              </HStack>
                              <Text fontSize="sm" color="gray.500">
                                {format(session.scheduledAt, 'EEE, MMM d - p')} {session.timezone}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                Confirmation deadline: {format(session.confirmationDeadline, 'MMM d, p')}
                              </Text>
                              {session.status === 'no_show' && (
                                <>
                                  <Text fontSize="xs" color="orange.500">
                                    This session was missed. Reschedule to keep your peer momentum.
                                  </Text>
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    colorScheme="primary"
                                    leftIcon={<Calendar size={14} />}
                                    alignSelf="flex-start"
                                    onClick={() => rescheduleSession(session)}
                                  >
                                    Reschedule practical
                                  </Button>
                                </>
                              )}
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Text fontSize="sm" color="gray.500">
                        No past practicals yet. Start one to build your history.
                      </Text>
                    )}
                  </Box>
                </Stack>
              </GridItem>

              <GridItem>
                    <Box bg="white" p={6} borderRadius="2xl" border="1px solid" borderColor="gray.100" boxShadow="sm" position="sticky" top={4}>
                  <Flex justify="space-between" align="center" mb={2}>
                    <Heading size="sm" color="gray.800">
                      Pending Invitations
                    </Heading>
                    <Badge colorScheme={pendingInvites.length > 0 ? 'orange' : 'gray'} variant="solid">
                      {pendingInvites.length}
                    </Badge>
                  </Flex>
                  <Text fontSize="xs" color="gray.500" mb={4}>
                    Respond to practical invitations from peers. Real-time updates.
                  </Text>
                  <Stack spacing={3}>
                    {pendingInvites.length ? (
                      pendingInvites.map((invite) => (
                        <Box key={invite.id} p={4} borderRadius="lg" border="1px dashed" borderColor="orange.300" bg="orange.50">
                          <Text fontWeight="semibold" color="gray.800">
                            {invite.fromName}
                          </Text>
                          <Text fontSize="sm" color="gray.500">
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
                      <Box p={3} borderRadius="lg" border="1px solid" borderColor="gray.100" bg="gray.50">
                        <Icon as={AlarmClockCheck} w={4} h={4} color="green.500" mb={2} />
                        <Text fontSize="sm" color="gray.500">
                          All caught up! No pending invitations at the moment.
                        </Text>
                      </Box>
                    )}
                  </Stack>
                </Box>
              </GridItem>
            </SimpleGrid>
          </TabPanel>

          <TabPanel px={0} id="peer-sessions" scrollMarginTop="80px">
            <Stack spacing={4}>
              <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={3}>
                <Stack spacing={1}>
                  <Heading size="md" color="gray.800">
                    Knowledge sessions (Practical)
                  </Heading>
                  <Text color="gray.500">
                    This is not auto-matching. Pick friends, schedule a practical / knowledge session, and
                    work through it together. You can also start a separate 7-day challenge from here.
                  </Text>
                </Stack>
                <HStack spacing={2}>
                  <Button variant="outline" leftIcon={<Sword size={16} />} onClick={challengeModal.onOpen}>
                    Challenge a friend
                  </Button>
                  <Button colorScheme="primary" leftIcon={<Users size={16} />} onClick={sessionModal.onOpen}>
                    Organise a knowledge session
                  </Button>
                </HStack>
              </Flex>

              <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4} alignItems="start">
                <GridItem colSpan={{ base: 1, lg: 1 }}>
                  <Box bg="white" p={6} borderRadius="2xl" border="1px solid" borderColor="gray.100" boxShadow="sm">
                    <Flex justify="space-between" align="center" mb={3}>
                      <Heading size="sm" color="gray.800">
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
                            <Text fontSize="sm" color="gray.500">
                              Loading peers...
                            </Text>
                          </HStack>
                        </Center>
                      ) : (
                        <>
                          {availablePeers.slice(0, 4).map((peer) => (
                            <Flex key={peer.id} align="center" justify="space-between" p={3} borderRadius="xl" border="1px solid" borderColor="gray.100" boxShadow="xs" gap={3}>
                              <HStack spacing={3} minW={0} flex={1}>
                                <Avatar name={peer.name} src={peer.avatarUrl} size="sm" flexShrink={0} />
                                <Stack spacing={0} minW={0}>
                                  <Text fontWeight="semibold" color="gray.800" noOfLines={1}>
                                    {peer.name}
                                  </Text>
                                  <Text fontSize="sm" color="gray.500" noOfLines={1}>
                                    {peer.email}
                                  </Text>
                                </Stack>
                              </HStack>
                              <Button
                                size="sm"
                                bg="#350e6f"
                                color="white"
                                _hover={{ bg: '#4a1499' }}
                                leftIcon={<Trophy size={14} />}
                                flexShrink={0}
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
                            <Text fontSize="sm" color="gray.500">
                              No peers found in your organisation yet. Invite teammates so you can start
                              challenges and practicals.
                            </Text>
                          )}
                        </>
                      )}
                    </Stack>
                  </Box>
                </GridItem>

                <GridItem colSpan={{ base: 1, lg: 2 }}>
                    <Box bg="white" p={6} borderRadius="2xl" border="1px solid" borderColor="gray.100" boxShadow="sm">
                      <Flex justify="space-between" align="center" mb={3}>
                        <Heading size="sm" color="gray.800">
                          Your practicals
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
                              <Text fontSize="sm" color="gray.500">
                                Loading sessions...
                              </Text>
                            </HStack>
                          </Center>
                        ) : sessions.length ? (
                          sessions.map((session) => (
                            <Box key={session.id} p={3} borderRadius="lg" border="1px solid" borderColor="gray.100">
                              <HStack justify="space-between" align="flex-start" mb={1}>
                                <Stack spacing={0}>
                                  <Text fontWeight="semibold" color="gray.800">
                                    {session.title}
                                  </Text>
                                  <Text fontSize="sm" color="gray.500">
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
                          <Stack spacing={1} color="gray.500">
                            <Text fontSize="sm">No practicals scheduled yet.</Text>
                            <Text fontSize="xs">Start a practical meetup to schedule your first group work session.</Text>
                          </Stack>
                        )}
                      </Stack>
                    </Box>
                </GridItem>
              </SimpleGrid>
            </Stack>
          </TabPanel>
        </TabPanels>
      </Tabs>
      </Box>

      <Modal isOpen={sessionModal.isOpen} onClose={sessionModal.onClose} size="5xl" isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader display="flex" alignItems="center" gap={2}>
            <Users size={18} /> Start a practical meetup
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <Stack spacing={3}>
                <FormControl isInvalid={Boolean(formErrors.title)}>
                  <FormLabel>Practical title</FormLabel>
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

                <Checkbox
                  isChecked={sessionForm.rememberTimezone}
                  onChange={(e) => setSessionForm((prev) => ({ ...prev, rememberTimezone: e.target.checked }))}
                >
                  Remember this time zone for future practicals
                </Checkbox>
              </Stack>

              <Stack spacing={3}>
                <FormControl isInvalid={Boolean(formErrors.participants)}>
                  <FormLabel>Select participants (minimum 1)</FormLabel>
                  <InputGroup mb={2}>
                    <InputLeftElement pointerEvents="none">
                      <Search size={16} opacity={0.65} />
                    </InputLeftElement>
                    <Input placeholder="Search peers" value={participantFilter} onChange={(e) => setParticipantFilter(e.target.value)} />
                  </InputGroup>
                  <Text fontSize="xs" color="gray.500" mb={2}>
                    {sessionForm.participants.length} selected
                  </Text>
                  <Stack spacing={2} maxH="220px" overflowY="auto" border="1px solid" borderColor="gray.100" borderRadius="lg" p={2}>
                    {filteredParticipants.map((peer) => (
                      <Flex key={peer.id} align="center" justify="space-between" p={2} borderRadius="md" _hover={{ bg: 'surface.subtle' }}>
                        <HStack spacing={3}>
                          <Avatar name={peer.name} src={peer.avatarUrl} size="sm" />
                          <Stack spacing={0}>
                            <Text fontWeight="semibold">{peer.name}</Text>
                            <Text fontSize="xs" color="gray.500">
                              {peer.identityTag || peer.timezone || 'Peer'}
                            </Text>
                          </Stack>
                        </HStack>
                        <Checkbox
                          isChecked={sessionForm.participants.includes(peer.id)}
                          onChange={() => toggleParticipant(peer.id)}
                          isDisabled={!sessionForm.participants.includes(peer.id) && sessionForm.participants.length >= 10}
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

                <DateTimePicker
                  selectedDate={sessionForm.date}
                  selectedTime={sessionForm.time}
                  selectedTimezone={sessionForm.timezone}
                  onDateChange={(date) => setSessionForm((prev) => ({ ...prev, date }))}
                  onTimeChange={(time) => setSessionForm((prev) => ({ ...prev, time }))}
                  onTimezoneChange={(timezone) => setSessionForm((prev) => ({ ...prev, timezone }))}
                  dateError={formErrors.date}
                  timeError={formErrors.time}
                  timezoneError={formErrors.timezone}
                  dateLabel="Practical date"
                  timeLabel="Practical time"
                  timezoneLabel="Time Zone"
                  isRequired
                />

                <Box borderRadius="lg" border="1px dashed" borderColor="gray.100" p={3} bg="gray.50">
                  <HStack align="center" spacing={2}>
                    <Icon as={Target} w={4} h={4} color="brand.primary" />
                    <Text fontSize="sm" color="gray.500">
                      Invite at least one peer so you can host a practical together (you plus your guests).
                    </Text>
                  </HStack>
                </Box>
              </Stack>
            </SimpleGrid>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={sessionModal.onClose} leftIcon={<X size={16} />} isDisabled={creatingSession}>
              Cancel
            </Button>
            <Button
              colorScheme="primary"
              leftIcon={<Check size={16} />}
              onClick={createSession}
              isLoading={creatingSession}
              loadingText="Creating…"
            >
              Create practical
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


