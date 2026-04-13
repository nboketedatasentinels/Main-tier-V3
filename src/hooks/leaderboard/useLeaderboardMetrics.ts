import { useMemo } from 'react'
import { LeaderboardTimeframe, TransformationTier, UserProfile } from '@/types'
import {
  ChallengeRecord,
  PointsTransaction,
} from './useLeaderboardData'
import { LeaderboardContext, normalizeLeaderboardTier } from './useLeaderboardContext'
import { getDisplayName } from '@/utils/displayName'
import { canViewerSeeCandidateOnLeaderboard } from '@/utils/leaderboardPrivacy'

export interface LeaderboardRow {
  user: UserProfile
  activePoints: number
  totalPoints: number
  badgeCount: number
  rank: number
}

interface LeaderboardMetricsInput {
  context: LeaderboardContext | null
  profiles: UserProfile[]
  transactions: PointsTransaction[]
  challenges: ChallengeRecord[]
  profile: UserProfile | null
  timeframe: LeaderboardTimeframe
  sortField: 'points' | 'name'
  sortDirection: 'asc' | 'desc'
  timeframeStart: Date | null
}

const isProfileInContext = (candidate: UserProfile, context: LeaderboardContext | null): boolean => {
  if (!context) return false
  switch (context.type) {
    case 'admin_all':
      return true
    case 'organization':
      if (context.organizationId) {
        return candidate.companyId === context.organizationId
      }
      if (context.organizationCode) {
        return candidate.companyCode === context.organizationCode
      }
      return false
    case 'village':
      return Boolean(context.villageId && candidate.villageId === context.villageId)
    case 'cluster':
      return Boolean(context.clusterId && candidate.clusterId === context.clusterId)
    case 'community': {
      const tier = normalizeLeaderboardTier(candidate.transformationTier)
      if (tier === TransformationTier.CORPORATE_MEMBER || tier === TransformationTier.CORPORATE_LEADER) {
        return false
      }
      return tier === TransformationTier.INDIVIDUAL_PAID || (!tier && candidate.membershipStatus === 'paid')
    }
    case 'free':
    default:
      return false
  }
}

export const useLeaderboardMetrics = ({
  context,
  profiles,
  transactions,
  challenges,
  profile,
  timeframe,
  sortField,
  sortDirection,
  timeframeStart,
}: LeaderboardMetricsInput) => {
  const segmentProfiles = useMemo(() => {
    if (!context) return []
    if (context.type === 'free') return profile ? [profile] : []
    if (context.type === 'admin_all') return profiles
    return profiles.filter((candidate) => isProfileInContext(candidate, context))
  }, [context, profile, profiles])

  const segmentProfileIds = useMemo(() => new Set(segmentProfiles.map((item) => item.id)), [segmentProfiles])

  const segmentTransactions = useMemo(() => {
    if (context?.type === 'admin_all') return transactions
    if (!segmentProfileIds.size) return []
    return transactions.filter((tx) => segmentProfileIds.has(tx.userId))
  }, [context?.type, segmentProfileIds, transactions])

  const segmentChallenges = useMemo(() => {
    if (context?.type === 'admin_all') return challenges
    if (context?.type === 'free') return challenges
    if (!segmentProfileIds.size) return []
    return challenges.filter((challenge) => {
      if (!challenge.opponentId) return true
      return segmentProfileIds.has(challenge.opponentId)
    })
  }, [challenges, context?.type, segmentProfileIds])

  const aggregatedPoints = useMemo(() => {
    const totals: Record<string, number> = {}
    segmentTransactions.forEach((tx) => {
      const createdAt = tx.createdAt ? new Date(tx.createdAt) : null
      if (timeframeStart && createdAt && createdAt < timeframeStart) return
      totals[tx.userId] = (totals[tx.userId] || 0) + tx.points
    })
    return totals
  }, [segmentTransactions, timeframeStart])

  const weeklyPoints = useMemo(() => {
    if (!profile) return 0
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    return segmentTransactions.reduce((sum, tx) => {
      const createdAt = tx.createdAt ? new Date(tx.createdAt) : null
      if (tx.userId === profile.id && createdAt && createdAt >= start) {
        return sum + tx.points
      }
      return sum
    }, 0)
  }, [profile, segmentTransactions])

  const monthlyPoints = useMemo(() => {
    if (!profile) return 0
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    return segmentTransactions.reduce((sum, tx) => {
      const createdAt = tx.createdAt ? new Date(tx.createdAt) : null
      if (tx.userId === profile.id && createdAt && createdAt >= start) {
        return sum + tx.points
      }
      return sum
    }, 0)
  }, [profile, segmentTransactions])

  const segmentSize = useMemo(() => segmentProfiles.length, [segmentProfiles])

  const leaderboardRows: LeaderboardRow[] = useMemo(() => {
    const rows = segmentProfiles
      .filter((candidate) => canViewerSeeCandidateOnLeaderboard({
        viewer: profile,
        candidate,
        context,
      }))
      .map((user) => {
        const activePoints = timeframe === LeaderboardTimeframe.ALL_TIME
          ? user.totalPoints
          : aggregatedPoints[user.id] || 0
        const badgeCount = Math.max(
          1,
          Math.round((timeframe === LeaderboardTimeframe.ALL_TIME ? user.totalPoints : activePoints) / 500),
        )

        return {
          user,
          activePoints,
          totalPoints: user.totalPoints || 0,
          badgeCount,
          rank: 0,
        }
      })

    const rankedRows = [...rows]
      .sort((a, b) => {
        // Sort by totalPoints (real accumulated points) for ranking
        const pointDelta = b.totalPoints - a.totalPoints
        if (pointDelta !== 0) return pointDelta

        const aName = getDisplayName(a.user, '')
        const bName = getDisplayName(b.user, '')
        return aName.localeCompare(bName)
      })
      .map((row, index) => ({ ...row, rank: index + 1 }))

    if (sortField === 'name') {
      return [...rankedRows].sort((a, b) => {
        const aName = getDisplayName(a.user, '')
        const bName = getDisplayName(b.user, '')
        return sortDirection === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName)
      })
    }

    // Sort by totalPoints for the final display order
    return [...rankedRows].sort((a, b) =>
      sortDirection === 'asc' ? a.totalPoints - b.totalPoints : b.totalPoints - a.totalPoints
    )
  }, [aggregatedPoints, context, profile, segmentProfiles, sortDirection, sortField, timeframe])

  const percentile = useMemo(() => {
    if (!profile) return 'Top 100%'
    const currentRank = leaderboardRows.find((row) => row.user.id === profile.id)?.rank || leaderboardRows.length
    if (!leaderboardRows.length) return 'Top 100%'
    const pct = Math.round((currentRank / leaderboardRows.length) * 100)
    return `Top ${pct}%`
  }, [leaderboardRows, profile])

  const userRow = useMemo(() => leaderboardRows.find((row) => row.user.id === profile?.id), [leaderboardRows, profile])

  const peerRows = useMemo(() => {
    const currentPoints = userRow?.activePoints || 0
    const sortedRows = [...leaderboardRows].sort((a, b) => a.rank - b.rank)

    let comparisonWindow = sortedRows.slice(0, 12)
    if (userRow) {
      const currentIndex = sortedRows.findIndex((row) => row.user.id === userRow.user.id)
      if (currentIndex >= 0) {
        const windowSize = 12
        let start = Math.max(0, currentIndex - 5)
        let end = Math.min(sortedRows.length, start + windowSize)
        if (end - start < windowSize) {
          start = Math.max(0, end - windowSize)
        }
        comparisonWindow = sortedRows.slice(start, end)
      }
    }

    return comparisonWindow
      .map((row) => ({
      ...row,
      delta: row.activePoints - currentPoints,
    }))
  }, [leaderboardRows, userRow])

  const cohortStats = useMemo(() => {
    const active = userRow?.activePoints || 0
    const total = userRow?.totalPoints || 0
    const maxActive = Math.max(...leaderboardRows.map((row) => row.activePoints), active)
    const maxTotal = Math.max(...leaderboardRows.map((row) => row.totalPoints), total)

    const avgActive = leaderboardRows.length
      ? Math.round(leaderboardRows.reduce((sum, row) => sum + row.activePoints, 0) / leaderboardRows.length)
      : 0
    const avgTotal = leaderboardRows.length
      ? Math.round(leaderboardRows.reduce((sum, row) => sum + row.totalPoints, 0) / leaderboardRows.length)
      : 0

    return {
      active,
      total,
      maxActive: maxActive || active,
      maxTotal: maxTotal || total,
      avgActive,
      avgTotal,
    }
  }, [leaderboardRows, userRow])

  const breakdownByCategory = useMemo(() => {
    const categoryTotals: Record<string, number> = {}
    segmentTransactions.forEach((tx) => {
      if (tx.category) {
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.points
      }
    })

    return Object.entries(categoryTotals).map(([name, value]) => ({
      name,
      value,
      percent: userRow?.activePoints ? Math.round((value / userRow.activePoints) * 100) : 0,
    }))
  }, [segmentTransactions, userRow?.activePoints])

  const segmentStats = {
    weeklyPoints,
    monthlyPoints,
    activeChallenges: segmentChallenges.filter((c) => c.status === 'active' || c.status === 'pending').length,
    badgesEarned: userRow?.badgeCount || 0,
  }

  return {
    segmentProfiles,
    segmentTransactions,
    segmentChallenges,
    leaderboardRows,
    userRow,
    percentile,
    segmentSize,
    weeklyPoints,
    monthlyPoints,
    peerRows,
    cohortStats,
    breakdownByCategory,
    segmentStats,
  }
}
