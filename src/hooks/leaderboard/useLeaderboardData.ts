import { Dispatch, MutableRefObject, SetStateAction, useEffect, useRef, useState } from 'react'
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
import { TransformationTier, UserProfile } from '@/types'
import { LeaderboardContext } from './useLeaderboardContext'
import { fetchOrgMembers, getOrgScope } from '@/utils/organizationScope'

export interface PointsTransaction {
  id: string
  userId: string
  points: number
  category?: string
  createdAt: string
  companyId?: string
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
  status: 'active' | 'completed' | 'upcoming'
  result?: 'win' | 'loss' | 'draw'
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

const ENABLE_ORG_TRANSACTION_QUERIES = false
const MAX_RETRY_ATTEMPTS = 3
const BASE_RETRY_DELAY_MS = 500

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
      return [where('transformationTier', '==', TransformationTier.INDIVIDUAL_PAID)]
    case 'free':
    default:
      return null
  }
}

const buildTransactionConstraints = (context: LeaderboardContext | null): QueryConstraint[] | null => {
  if (!context) return null

  const constraints: QueryConstraint[] = []
  if (context.type === 'organization') {
    if (context.organizationId) {
      constraints.push(where('companyId', '==', context.organizationId))
    } else if (context.organizationCode) {
      constraints.push(where('companyCode', '==', context.organizationCode))
    } else {
      return null
    }
  }

  constraints.push(orderBy('createdAt', 'desc'))
  constraints.push(limit(500))
  return constraints
}

export const useLeaderboardData = ({
  context,
  profileId,
}: {
  context: LeaderboardContext | null
  profileId?: string | null
}): LeaderboardDataState => {
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [transactions, setTransactions] = useState<PointsTransaction[]>([])
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([])
  const [profilesLoaded, setProfilesLoaded] = useState(false)
  const [transactionsLoaded, setTransactionsLoaded] = useState(false)
  const [challengesLoaded, setChallengesLoaded] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [profilesRetry, setProfilesRetry] = useState(0)
  const [transactionsRetry, setTransactionsRetry] = useState(0)
  const [challengesRetry, setChallengesRetry] = useState(0)

  const scheduleRetry = (
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
  }

  const profilesRetryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transactionsRetryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const challengesRetryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSnapshotError = (
    label: string,
    error: unknown,
    setLoaded: Dispatch<SetStateAction<boolean>>,
    retryCount: number,
    setRetry: Dispatch<SetStateAction<number>>,
    timeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
  ) => {
    console.error(`[Leaderboard] ${label} snapshot error`, error)
    setLoaded(true)
    setErrorMessage('Unable to load leaderboard data. Please refresh the page.')
    scheduleRetry(label, retryCount, setRetry, timeoutRef)
  }

  useEffect(() => {
    if (context?.type === 'organization') {
      const orgScope = getOrgScope({
        companyId: context.organizationId,
        organizationId: context.organizationId,
        companyCode: context.organizationCode,
        organizationCode: context.organizationCode,
      })
      if (!orgScope.isValid) {
        console.warn('[Leaderboard] Missing organization identifier for leaderboard query.')
        setProfiles([])
        setProfilesLoaded(true)
        return undefined
      }

      setProfilesLoaded(false)
      let isActive = true
      fetchOrgMembers(db, orgScope)
        .then((members) => {
          if (!isActive) return
          setProfiles(members as unknown as UserProfile[])
          setProfilesLoaded(true)
          console.log('[Leaderboard] Organization profiles fetched', {
            contextType: context?.type,
            count: members.length,
          })
        })
        .catch((error) => {
          console.error('[Leaderboard] Failed to load organization profiles', error)
          if (!isActive) return
          setProfiles([])
          setProfilesLoaded(true)
          setErrorMessage('Unable to load leaderboard data. Please refresh the page.')
        })

      return () => {
        isActive = false
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
      if (profilesRetryTimeout.current) {
        clearTimeout(profilesRetryTimeout.current)
      }
    }
  }, [context, profilesRetry])

  useEffect(() => {
    if (context?.type === 'organization' && !context.organizationId && !context.organizationCode) {
      console.warn('[Leaderboard] Missing organization identifier for transaction query.')
      setTransactions([])
      setTransactionsLoaded(true)
      return undefined
    }

    if (context?.type === 'organization' && !ENABLE_ORG_TRANSACTION_QUERIES) {
      console.warn('[Leaderboard] Organization transaction queries disabled; using profile totals.')
      setTransactions([])
      setTransactionsLoaded(true)
      return undefined
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
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          }
        })
        setTransactions(loadedTx)
        setTransactionsLoaded(true)
        setErrorMessage(null)
      },
      (error) => {
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
      if (transactionsRetryTimeout.current) {
        clearTimeout(transactionsRetryTimeout.current)
      }
    }
  }, [context, transactionsRetry])

  useEffect(() => {
    if (!profileId) {
      setChallenges([])
      setChallengesLoaded(true)
      return
    }

    const challengeQuery = query(
      collection(db, 'challenges'),
      where('participants', 'array-contains', profileId),
      orderBy('startDate', 'desc'),
      limit(25),
    )

    setChallengesLoaded(false)
    const unsubscribe = onSnapshot(
      challengeQuery,
      (snapshot) => {
        const loadedChallenges: ChallengeRecord[] = snapshot.docs.map((doc) => {
          const data = doc.data() as Record<string, unknown>
          return {
            id: doc.id,
            opponentName: (data.opponentName as string) || 'Peer Challenger',
            opponentAvatar: data.opponentAvatar as string | undefined,
            opponentId: data.opponentId as string | undefined,
            startDate: (data.startDate as string) || new Date().toISOString(),
            endDate: (data.endDate as string) || new Date().toISOString(),
            yourPoints: (data.yourPoints as number) || 0,
            opponentPoints: (data.opponentPoints as number) || 0,
            status: (data.status as ChallengeRecord['status']) || 'active',
            result: data.result as ChallengeRecord['result'],
          }
        })

        setChallenges(loadedChallenges)
        setChallengesLoaded(true)
        setErrorMessage(null)
      },
      (error) => {
        handleSnapshotError(
          'challenges',
          error,
          setChallengesLoaded,
          challengesRetry,
          setChallengesRetry,
          challengesRetryTimeout
        )
      }
    )

    return () => {
      unsubscribe()
      if (challengesRetryTimeout.current) {
        clearTimeout(challengesRetryTimeout.current)
      }
    }
  }, [profileId, challengesRetry])

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
