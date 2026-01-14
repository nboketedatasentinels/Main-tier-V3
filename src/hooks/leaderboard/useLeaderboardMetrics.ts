import { useMemo } from 'react'
import { UserProfile } from '@/types'
import {
  ChallengeRecord,
  PointsTransaction,
} from './useLeaderboardData'
import { LeaderboardContext } from './useLeaderboardContext'
import { getOrgScope, isProfileInOrg } from '@/utils/organizationScope'

export interface LeaderboardRow {
  user: UserProfile
  activePoints: number
  totalPoints: number
  level: number
  badgeCount: number
  rank: number
}

interface LeaderboardMetricsInput {
  context: LeaderboardContext | null
  profiles: UserProfile[]
  transactions: PointsTransaction[]
  challenges: ChallengeRecord[]
  profile: UserProfile | null
  sortField: 'points' | 'level' | 'name'
  sortDirection: 'asc' | 'desc'
}

export const useLeaderboardMetrics = ({
  context,
  profiles,
  transactions,
  challenges,
  profile,
  sortField,
  sortDirection,
}: LeaderboardMetricsInput) => {
  const orgScope = useMemo(() => getOrgScope(profile), [profile])
  const segmentProfiles = useMemo(() => {
    if (!context) return []
    if (context.type === 'free') return profile ? [profile] : []
    if (context.type === 'organization') {
      return profiles.filter((candidate) => isProfileInOrg(candidate, orgScope))
    }
    return []
  }, [context, orgScope, profile, profiles])

  const segmentProfileIds = useMemo(() => new Set(segmentProfiles.map((item) => item.id)), [segmentProfiles])

  const segmentTransactions = useMemo(() => {
    if (!profile?.id) return []
    return transactions.filter((tx) => tx.userId === profile.id)
  }, [profile?.id, transactions])

  const segmentChallenges = useMemo(() => {
    if (context?.type === 'free') return challenges
    if (!segmentProfileIds.size) return []
    return challenges.filter((challenge) => {
      if (!challenge.opponentId) return true
      return segmentProfileIds.has(challenge.opponentId)
    })
  }, [challenges, context?.type, segmentProfileIds])

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
      .filter((candidate) => candidate.privacySettings?.showOnLeaderboard !== false)
      .map((user) => ({
        user,
        rank: 0,
        totalPoints: user.totalPoints || 0,
        activePoints: user.activePoints || user.totalPoints || 0,
        level: user.level || 1,
        badgeCount: user.badges?.length || 0,
      }))

    const sorted = rows.sort((a, b) => {
      if (sortField === 'name') {
        const aName = a.user.fullName || a.user.firstName
        const bName = b.user.fullName || b.user.firstName
        return sortDirection === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName)
      }

      if (sortField === 'level') {
        return sortDirection === 'asc' ? a.level - b.level : b.level - a.level
      }

      return sortDirection === 'asc' ? a.totalPoints - b.totalPoints : b.totalPoints - a.totalPoints
    })

    return sorted.map((row, index) => ({ ...row, rank: index + 1 }))
  }, [segmentProfiles, sortDirection, sortField])

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
    return leaderboardRows.slice(0, 12).map((row) => ({
      ...row,
      delta: row.activePoints - currentPoints,
    }))
  }, [leaderboardRows, userRow])

  const cohortStats = useMemo(() => {
    const active = userRow?.activePoints || 0
    const total = userRow?.totalPoints || 0
    const level = userRow?.level || profile?.level || 1
    const maxActive = Math.max(...leaderboardRows.map((row) => row.activePoints), active)
    const maxTotal = Math.max(...leaderboardRows.map((row) => row.totalPoints), total)
    const maxLevel = Math.max(...leaderboardRows.map((row) => row.level), level)

    const avgActive = leaderboardRows.length
      ? Math.round(leaderboardRows.reduce((sum, row) => sum + row.activePoints, 0) / leaderboardRows.length)
      : 0
    const avgTotal = leaderboardRows.length
      ? Math.round(leaderboardRows.reduce((sum, row) => sum + row.totalPoints, 0) / leaderboardRows.length)
      : 0
    const avgLevel = leaderboardRows.length
      ? Math.round(leaderboardRows.reduce((sum, row) => sum + row.level, 0) / leaderboardRows.length)
      : 1

    return {
      active,
      total,
      level,
      maxActive: maxActive || active,
      maxTotal: maxTotal || total,
      maxLevel: maxLevel || level,
      avgActive,
      avgTotal,
      avgLevel,
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
    activeChallenges: segmentChallenges.filter((c) => c.status === 'active').length,
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
