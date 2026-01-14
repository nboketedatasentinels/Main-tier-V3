import { useEffect, useState } from 'react'
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
      return [where('transformationTier', '==', TransformationTier.INDIVIDUAL_PAID)]
    case 'free':
    default:
      return null
  }
}

const buildTransactionConstraints = (profileId?: string | null): QueryConstraint[] | null => {
  if (!profileId) return null

  const constraints: QueryConstraint[] = [where('userId', '==', profileId), orderBy('createdAt', 'desc'), limit(500)]
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
          setProfiles(members as UserProfile[])
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
    const unsubscribe = onSnapshot(profilesQuery, (snapshot) => {
      const loadedProfiles: UserProfile[] = snapshot.docs.map((doc) => doc.data() as UserProfile)
      setProfiles(loadedProfiles)
      setProfilesLoaded(true)
      console.log('[Leaderboard] Profiles fetched', {
        contextType: context?.type,
        count: loadedProfiles.length,
      })
    })

    return () => unsubscribe()
  }, [context?.type, profileId])

  useEffect(() => {
    const constraints = buildTransactionConstraints(profileId)
    if (!constraints) {
      setTransactions([])
      setTransactionsLoaded(Boolean(context?.type))
      return undefined
    }

    setTransactionsLoaded(false)
    console.log('[Leaderboard] Transactions query constraints', { contextType: context?.type, constraints })
    const txQuery = query(collection(db, 'points_transactions'), ...constraints)
    const unsubscribe = onSnapshot(txQuery, (snapshot) => {
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
    })

    return () => unsubscribe()
  }, [context?.type, profileId])

  useEffect(() => {
    if (!profileId) {
      setChallenges([])
      setChallengesLoaded(false)
      return
    }

    const challengeQuery = query(
      collection(db, 'challenges'),
      where('participants', 'array-contains', profileId),
      orderBy('startDate', 'desc'),
      limit(25),
    )

    setChallengesLoaded(false)
    const unsubscribe = onSnapshot(challengeQuery, (snapshot) => {
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
    })

    return () => unsubscribe()
  }, [profileId])

  return {
    profiles,
    transactions,
    challenges,
    profilesLoaded,
    transactionsLoaded,
    challengesLoaded,
  }
}
