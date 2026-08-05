import { Dispatch, MutableRefObject, SetStateAction, useCallback, useEffect, useRef, useState } from 'react'
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  QueryConstraint,
  where,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { UserProfile } from '@/types'
import { LeaderboardContext } from './useLeaderboardContext'
import { getOrgScope } from '@/utils/organizationScope'
import { listOrgPeers, listOrgPointsLedger } from '@/services/supabasePeerService'
import {
  finalizeExpiredChallengesAndAwardPoints,
  listMyChallenges,
} from '@/services/supabaseChallengeService'
import { supabase } from '@/services/supabase'
import { FULL_ACTIVITIES, resolveCanonicalActivityId, type JourneyType } from '@/config/pointsConfig'
import { useAuth } from '@/hooks/useAuth'

export interface PointsTransaction {
  id: string
  userId: string
  points: number
  category?: string
  createdAt: string
  companyId?: string
  companyCode?: string
  villageId?: string
  clusterId?: string
}

export interface ChallengeRecord {
  id: string
  opponentName: string
  opponentAvatar?: string
  opponentId?: string
  startDate: string
  endDate: string
  yourPoints: number
  opponentPoints: number
  status: 'active' | 'completed' | 'upcoming' | 'pending'
  result?: 'win' | 'loss' | 'draw'
  type?: 'competitive' | 'collaborative'
  isChallenger: boolean
}

interface LeaderboardDataState {
  profiles: UserProfile[]
  transactions: PointsTransaction[]
  challenges: ChallengeRecord[]
  profilesLoaded: boolean
  transactionsLoaded: boolean
  challengesLoaded: boolean
  errorMessage: string | null
}

const MAX_RETRY_ATTEMPTS = 3
const BASE_RETRY_DELAY_MS = 500

type FirestoreErrorLike = {
  code?: string
  message?: string
}

const getErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object') return undefined
  return (error as FirestoreErrorLike).code
}

const getErrorMessage = (error: unknown): string => {
  if (!error || typeof error !== 'object') return ''
  return (error as FirestoreErrorLike).message || ''
}

const isMissingIndexError = (error: unknown): boolean => {
  const code = getErrorCode(error)
  const message = getErrorMessage(error)
  return code === 'failed-precondition' && /requires an index/i.test(message)
}

const isRetryableSnapshotError = (error: unknown): boolean => {
  const code = getErrorCode(error)
  if (!code) return true
  return !['failed-precondition', 'permission-denied', 'invalid-argument', 'unauthenticated'].includes(code)
}

const buildProfilesConstraints = (context: LeaderboardContext | null): QueryConstraint[] | null => {
  if (!context) return null

  switch (context.type) {
    case 'admin_all':
      return []
    case 'organization':
      return null
    case 'village':
      return context.villageId ? [where('villageId', '==', context.villageId)] : null
    case 'cluster':
      return context.clusterId ? [where('clusterId', '==', context.clusterId)] : null
    case 'community':
      return [where('membershipStatus', '==', 'paid')]
    case 'free':
    default:
      return null
  }
}

const buildTransactionConstraints = (context: LeaderboardContext | null): QueryConstraint[] | null => {
  if (!context) return null

  const constraints: QueryConstraint[] = []
  switch (context.type) {
    case 'admin_all':
      break
    case 'organization':
      if (context.organizationId) {
        constraints.push(where('companyId', '==', context.organizationId))
      } else if (context.organizationCode) {
        constraints.push(where('companyCode', '==', context.organizationCode))
      } else {
        return null
      }
      break
    case 'village':
      if (!context.villageId) return null
      constraints.push(where('villageId', '==', context.villageId))
      constraints.push(orderBy('createdAt', 'desc'))
      constraints.push(limit(1000))
      break
    case 'cluster':
      if (!context.clusterId) return null
      constraints.push(where('clusterId', '==', context.clusterId))
      constraints.push(orderBy('createdAt', 'desc'))
      constraints.push(limit(1000))
      break
    case 'community':
    case 'free':
    default:
      return null
  }

  if (context.type === 'admin_all' || context.type === 'organization') {
    constraints.push(orderBy('createdAt', 'desc'))
    constraints.push(limit(500))
  }
  return constraints
}

export const useLeaderboardData = ({
  context,
  profileId,
}: {
  context: LeaderboardContext | null
  profileId?: string | null
}): LeaderboardDataState => {
  const { profile } = useAuth()
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [transactions, setTransactions] = useState<PointsTransaction[]>([])
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([])
  const [profilesLoaded, setProfilesLoaded] = useState(false)
  const [transactionsLoaded, setTransactionsLoaded] = useState(false)
  const [challengesLoaded, setChallengesLoaded] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [profilesRetry, setProfilesRetry] = useState(0)
  const [transactionsRetry, setTransactionsRetry] = useState(0)

  const scheduleRetry = useCallback((
    label: string,
    retryCount: number,
    setRetry: Dispatch<SetStateAction<number>>,
    timeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
  ) => {
    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      console.error(`[Leaderboard] ${label} query failed after ${MAX_RETRY_ATTEMPTS} retries.`)
      return
    }
    const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCount)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setRetry((prev) => prev + 1)
    }, delay)
  }, [])

  const profilesRetryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transactionsRetryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSnapshotError = useCallback((
    label: string,
    error: unknown,
    setLoaded: Dispatch<SetStateAction<boolean>>,
    retryCount: number,
    setRetry: Dispatch<SetStateAction<number>>,
    timeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
  ) => {
    console.error(`[Leaderboard] ${label} snapshot error`, error)
    setLoaded(true)
    if (isMissingIndexError(error)) {
      setErrorMessage('Leaderboard data is temporarily unavailable while a required index is being created.')
      return
    }
    setErrorMessage('Unable to load leaderboard data. Please refresh the page.')
    if (isRetryableSnapshotError(error)) {
      scheduleRetry(label, retryCount, setRetry, timeoutRef)
    }
  }, [scheduleRetry])

  const clearRetryTimeout = useCallback((timeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
    if (!timeoutRef.current) return
    clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }, [])

  useEffect(() => {
    if (context?.type === 'organization') {
      let cancelled = false
      setProfilesLoaded(false)

      void (async () => {
        try {
          const orgScope = getOrgScope({
            companyId: context.organizationId,
            organizationId: context.organizationId,
            companyCode: context.organizationCode,
            organizationCode: context.organizationCode,
          })
          if (!orgScope.isValid) {
            console.warn('[Leaderboard] Missing organization identifier for leaderboard query.')
            if (!cancelled) {
              setProfiles([])
              setProfilesLoaded(true)
            }
            return
          }

          const members = await listOrgPeers({ includeSelf: true })
          if (cancelled) return
          setProfiles(members as unknown as UserProfile[])
          setProfilesLoaded(true)
          setErrorMessage(null)
          console.log('[Leaderboard] Organization profiles loaded (Supabase)', {
            contextType: context.type,
            count: members.length,
          })
        } catch (error) {
          if (cancelled) return
          handleSnapshotError(
            'organization_profiles',
            error,
            setProfilesLoaded,
            profilesRetry,
            setProfilesRetry,
            profilesRetryTimeout,
          )
        }
      })()

      return () => {
        cancelled = true
        clearRetryTimeout(profilesRetryTimeout)
      }
    }

    if (context?.type === 'admin_all') {
      let cancelled = false
      setProfilesLoaded(false)

      void (async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('total_points', { ascending: false })
            .limit(500)
          if (error) throw new Error(error.message)
          if (cancelled) return
          const loaded = (data ?? []).map((row) => {
            const raw = row as Record<string, unknown>
            const jsonb = (raw.data as Record<string, unknown> | null) ?? {}
            return {
              ...jsonb,
              id: raw.id,
              email: raw.email,
              fullName: raw.full_name ?? jsonb.fullName,
              firstName: raw.first_name ?? jsonb.firstName,
              lastName: raw.last_name ?? jsonb.lastName,
              companyId: raw.company_id ?? jsonb.companyId,
              companyCode: raw.company_code ?? jsonb.companyCode,
              organizationId: raw.organization_id ?? jsonb.organizationId,
              totalPoints: raw.total_points ?? jsonb.totalPoints ?? 0,
              level: raw.level ?? jsonb.level ?? 0,
              membershipStatus: raw.membership_status ?? jsonb.membershipStatus,
              journeyType: raw.journey_type ?? jsonb.journeyType,
              privacySettings: jsonb.privacySettings,
              leaderboardVisibility: jsonb.leaderboardVisibility,
            } as UserProfile
          })
          setProfiles(loaded)
          setProfilesLoaded(true)
          setErrorMessage(null)
        } catch (error) {
          if (cancelled) return
          handleSnapshotError(
            'profiles',
            error,
            setProfilesLoaded,
            profilesRetry,
            setProfilesRetry,
            profilesRetryTimeout,
          )
        }
      })()

      return () => {
        cancelled = true
        clearRetryTimeout(profilesRetryTimeout)
      }
    }

    const constraints = buildProfilesConstraints(context)
    if (!constraints) {
      setProfiles([])
      const contextType = context?.type
      setProfilesLoaded(Boolean(contextType))
      if (contextType === 'free') {
        console.log('[Leaderboard] Free context: skipping profiles query.')
      }
      return undefined
    }

    // Village / community / cluster still use Firestore until those scopes are
    // migrated. Soft-fail permission errors so the page does not toast forever
    // after the Supabase auth cutover (no Firebase session).
    setProfilesLoaded(false)
    console.log('[Leaderboard] Profiles query constraints', { contextType: context?.type, constraints })
    const profilesQuery = query(collection(db, 'profiles'), ...constraints)
    const unsubscribe = onSnapshot(
      profilesQuery,
      (snapshot) => {
        const loadedProfiles: UserProfile[] = snapshot.docs.map((doc) => doc.data() as UserProfile)
        setProfiles(loadedProfiles)
        setProfilesLoaded(true)
        setErrorMessage(null)
        console.log('[Leaderboard] Profiles fetched', {
          contextType: context?.type,
          count: loadedProfiles.length,
        })
      },
      (error) => {
        if (getErrorCode(error) === 'permission-denied' || getErrorCode(error) === 'unauthenticated') {
          console.warn('[Leaderboard] Firestore profiles unavailable after auth cutover', error)
          setProfiles([])
          setProfilesLoaded(true)
          setErrorMessage(
            'Leaderboard scope for this account still needs a Supabase migration. Organisation boards work; village/community scopes are next.',
          )
          return
        }
        handleSnapshotError(
          'profiles',
          error,
          setProfilesLoaded,
          profilesRetry,
          setProfilesRetry,
          profilesRetryTimeout
        )
      }
    )

    return () => {
      unsubscribe()
      clearRetryTimeout(profilesRetryTimeout)
    }
  }, [clearRetryTimeout, context, handleSnapshotError, profilesRetry])

  useEffect(() => {
    if (context?.type === 'organization') {
      let cancelled = false
      setTransactionsLoaded(false)

      void (async () => {
        try {
          const rows = await listOrgPointsLedger()
          if (cancelled) return

          const activityCategory = new Map<string, string>(
            FULL_ACTIVITIES.map((activity) => [activity.id, activity.category || 'Other']),
          )

          const loadedTx: PointsTransaction[] = rows.map((row) => {
            const canonical = row.activityId
              ? resolveCanonicalActivityId(row.activityId)
              : null
            const category = canonical
              ? activityCategory.get(canonical) || row.category || 'Other'
              : row.category || 'Other'
            return {
              id: row.id,
              userId: row.userId,
              points: row.points,
              category,
              createdAt: row.createdAt,
              companyId: context.organizationId || undefined,
              companyCode: context.organizationCode || undefined,
            }
          })

          setTransactions(loadedTx)
          setTransactionsLoaded(true)
          setErrorMessage(null)
        } catch (error) {
          if (cancelled) return
          // Profiles + total_points are enough for all-time rank; don't hard-fail.
          console.warn('[Leaderboard] Org points ledger unavailable; using profile totals', error)
          setTransactions([])
          setTransactionsLoaded(true)
        }
      })()

      return () => {
        cancelled = true
        clearRetryTimeout(transactionsRetryTimeout)
      }
    }

    const constraints = buildTransactionConstraints(context)
    if (!constraints || context?.type === 'free') {
      setTransactions([])
      const contextType = context?.type
      setTransactionsLoaded(Boolean(contextType))
      if (contextType === 'free') {
        console.log('[Leaderboard] Free context: skipping transactions query.')
      }
      return undefined
    }

    setTransactionsLoaded(false)
    console.log('[Leaderboard] Transactions query constraints', { contextType: context?.type, constraints })
    const txQuery = query(collection(db, 'points_transactions'), ...constraints)
    const unsubscribe = onSnapshot(
      txQuery,
      (snapshot) => {
        const loadedTx: PointsTransaction[] = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            userId: data.userId,
            points: data.points || 0,
            category: data.category,
            companyId: data.companyId,
            companyCode: data.companyCode,
            villageId: data.villageId,
            clusterId: data.clusterId,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          }
        })
        setTransactions(loadedTx)
        setTransactionsLoaded(true)
        setErrorMessage(null)
      },
      (error) => {
        if (getErrorCode(error) === 'permission-denied' || getErrorCode(error) === 'unauthenticated') {
          console.warn('[Leaderboard] Firestore transactions unavailable after auth cutover', error)
          setTransactions([])
          setTransactionsLoaded(true)
          return
        }
        handleSnapshotError(
          'transactions',
          error,
          setTransactionsLoaded,
          transactionsRetry,
          setTransactionsRetry,
          transactionsRetryTimeout
        )
      }
    )

    return () => {
      unsubscribe()
      clearRetryTimeout(transactionsRetryTimeout)
    }
  }, [clearRetryTimeout, context, handleSnapshotError, transactionsRetry])

  // Robust challenge fetch via Supabase (Firestore challenges fail after auth cutover).
  // Also finalizes expired active challenges and awards checklist points only then.
  useEffect(() => {
    if (!profileId) {
      setChallenges([])
      setChallengesLoaded(true)
      return undefined
    }

    let cancelled = false
    setChallengesLoaded(false)

    const load = async () => {
      try {
        const journeyType = (profile?.journeyType as JourneyType | undefined) || '6W'
        const weekNumber = typeof profile?.currentWeek === 'number' ? profile.currentWeek : 1
        await finalizeExpiredChallengesAndAwardPoints({
          currentUserId: profileId,
          journeyType,
          weekNumber,
        })
        if (cancelled) return
        const loaded = await listMyChallenges(profileId)
        if (cancelled) return
        setChallenges(loaded)
        setChallengesLoaded(true)
        setErrorMessage(null)
      } catch (error) {
        if (cancelled) return
        console.error('[Leaderboard] Challenges load error:', error)
        setChallenges([])
        setChallengesLoaded(true)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [profileId, profile?.journeyType, profile?.currentWeek])

  return {
    profiles,
    transactions,
    challenges,
    profilesLoaded,
    transactionsLoaded,
    challengesLoaded,
    errorMessage,
  }
}
