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
  status: 'active' | 'completed' | 'upcoming' | 'pending'
  result?: 'win' | 'loss' | 'draw'
  type?: 'competitive' | 'collaborative'
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

// FIX: Updated challenge constraints to query by participant, not by org
// Organization filtering is done client-side after fetching
const buildChallengeConstraints = (
  profileId: string | null | undefined
): QueryConstraint[] | null => {
  if (!profileId) return null

  const constraints: QueryConstraint[] = []

  // Query challenges where this user is a participant
  // Using 'participants' array field that includes both challenger_id and challenged_id
  constraints.push(where('participants', 'array-contains', profileId))
  constraints.push(orderBy('created_at', 'desc'))
  constraints.push(limit(50))

  return constraints
}

// FIX: Alternative query using challenger_id/challenged_id if participants array doesn't exist
const buildLegacyChallengeConstraints = (
  profileId: string | null | undefined,
  isChallenger: boolean
): QueryConstraint[] | null => {
  if (!profileId) return null

  const constraints: QueryConstraint[] = []
  const field = isChallenger ? 'challenger_id' : 'challenged_id'
  constraints.push(where(field, '==', profileId))
  constraints.push(orderBy('created_at', 'desc'))
  constraints.push(limit(25))

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
    const profilesQuery = query(collection(db, 'users'), ...constraints)
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

  // FIX: Completely rewritten challenge fetching logic
  // Now queries by participant and handles legacy data structures
  useEffect(() => {
    if (!profileId) {
      setChallenges([])
      setChallengesLoaded(true)
      console.log('[Leaderboard] No profileId, skipping challenges query.')
      return
    }

    setChallengesLoaded(false)
    console.log('[Leaderboard] Starting challenges query for profileId:', profileId)

    // Helper to convert Firestore data to ChallengeRecord
    const mapChallenge = (doc: any, currentUserId: string): ChallengeRecord => {
      const data = doc.data() as Record<string, unknown>
      
      // Determine if current user is challenger or challenged
      const isChallenger = data.challenger_id === currentUserId
      const opponentId = isChallenger ? data.challenged_id : data.challenger_id
      const opponentName = isChallenger 
        ? (data.challenged_name as string) || 'Opponent'
        : (data.challenger_name as string) || 'Opponent'
      
      // Get points for current user and opponent
      const metrics = data.metrics as Record<string, { total?: number }> | undefined
      const yourPoints = isChallenger 
        ? (metrics?.challenger?.total || 0)
        : (metrics?.challenged?.total || 0)
      const opponentPoints = isChallenger
        ? (metrics?.challenged?.total || 0)
        : (metrics?.challenger?.total || 0)

      // Parse dates
      const parseDate = (val: unknown): string => {
        if (!val) return new Date().toISOString()
        if (typeof val === 'string') return val
        if (val instanceof Date) return val.toISOString()
        if (typeof val === 'object' && 'toDate' in val) {
          return (val as { toDate: () => Date }).toDate().toISOString()
        }
        return new Date().toISOString()
      }

      // Determine result for completed challenges
      let result: ChallengeRecord['result'] | undefined
      if (data.status === 'completed') {
        if (yourPoints > opponentPoints) result = 'win'
        else if (yourPoints < opponentPoints) result = 'loss'
        else result = 'draw'
      }

      return {
        id: doc.id,
        opponentName,
        opponentId: opponentId as string | undefined,
        opponentAvatar: undefined, // Could be fetched separately if needed
        startDate: parseDate(data.start_date),
        endDate: parseDate(data.end_date),
        yourPoints,
        opponentPoints,
        status: (data.status as ChallengeRecord['status']) || 'pending',
        result,
        type: data.type as ChallengeRecord['type'],
      }
    }

    // Try the participants array query first
    const participantsConstraints = buildChallengeConstraints(profileId)
    
    if (participantsConstraints) {
      const challengeQuery = query(collection(db, 'challenges'), ...participantsConstraints)
      
      const unsubscribe = onSnapshot(
        challengeQuery,
        (snapshot) => {
          if (snapshot.docs.length > 0) {
            // participants array query worked
            const loadedChallenges = snapshot.docs.map((doc) => mapChallenge(doc, profileId))
            setChallenges(loadedChallenges)
            setChallengesLoaded(true)
            setErrorMessage(null)
            console.log('[Leaderboard] Challenges fetched via participants array', {
              count: loadedChallenges.length,
              statuses: loadedChallenges.map(c => c.status),
            })
          } else {
            // Fall back to legacy queries
            console.log('[Leaderboard] No results from participants query, trying legacy queries...')
            fetchLegacyChallenges()
          }
        },
        (error) => {
          console.error('[Leaderboard] Participants query error, trying legacy:', error)
          fetchLegacyChallenges()
        }
      )

      const fetchLegacyChallenges = async () => {
        try {
          // Query as challenger
          const challengerConstraints = buildLegacyChallengeConstraints(profileId, true)
          const challengedConstraints = buildLegacyChallengeConstraints(profileId, false)

          const challengerQuery = challengerConstraints 
            ? query(collection(db, 'challenges'), ...challengerConstraints)
            : null
          const challengedQuery = challengedConstraints
            ? query(collection(db, 'challenges'), ...challengedConstraints)
            : null

          const results: ChallengeRecord[] = []
          const seenIds = new Set<string>()

          if (challengerQuery) {
            onSnapshot(
              challengerQuery,
              (snapshot) => {
                snapshot.docs.forEach((doc) => {
                  if (!seenIds.has(doc.id)) {
                    seenIds.add(doc.id)
                    results.push(mapChallenge(doc, profileId))
                  }
                })
              },
              (error) => console.error('[Leaderboard] Challenger query error:', error)
            )
          }

          if (challengedQuery) {
            onSnapshot(
              challengedQuery,
              (snapshot) => {
                snapshot.docs.forEach((doc) => {
                  if (!seenIds.has(doc.id)) {
                    seenIds.add(doc.id)
                    results.push(mapChallenge(doc, profileId))
                  }
                })
                
                // Sort by created_at desc and update state
                results.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                setChallenges(results)
                setChallengesLoaded(true)
                console.log('[Leaderboard] Challenges fetched via legacy queries', {
                  count: results.length,
                })
              },
              (error) => {
                console.error('[Leaderboard] Challenged query error:', error)
                setChallenges([])
                setChallengesLoaded(true)
              }
            )
          }

          // If no queries, mark as loaded
          if (!challengerQuery && !challengedQuery) {
            setChallenges([])
            setChallengesLoaded(true)
          }
        } catch (error) {
          console.error('[Leaderboard] Legacy challenges fetch error:', error)
          setChallenges([])
          setChallengesLoaded(true)
        }
      }

      return () => {
        unsubscribe()
        if (challengesRetryTimeout.current) {
          clearTimeout(challengesRetryTimeout.current)
        }
      }
    }

    // No valid constraints
    setChallenges([])
    setChallengesLoaded(true)
    return undefined
  }, [profileId])

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
