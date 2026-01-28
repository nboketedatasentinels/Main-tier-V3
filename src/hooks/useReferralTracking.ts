import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  subscribeToReferrals,
  subscribeToReferralStatus,
  getReferralStats,
  type ReferralWithDetails,
} from '@/services/referralService'
import { REFERRAL_POINTS } from '@/config/pointsConfig'
import { REWARD_TIERS } from '@/config/referralRewards'

export interface ReferralStats {
  totalReferrals: number
  pendingReferrals: number
  creditedReferrals: number
  rejectedReferrals: number
  totalPointsEarned: number
}

export interface UseReferralTrackingResult {
  // Referral data for referrers
  referrals: ReferralWithDetails[]
  stats: ReferralStats

  // Referral status for referred users
  myReferralStatus: 'pending' | 'credited' | 'rejected' | null
  wasReferred: boolean
  referrerUid: string | null

  // UI state
  loading: boolean
  error: Error | null

  // Computed values
  referralCode: string | null
  referralLink: string
  nextRewardTier: typeof REWARD_TIERS[number] | null
  progressToNextTier: number
  referralsNeededForNextTier: number

  // Actions
  refreshStats: () => Promise<void>
}

/**
 * Hook for real-time referral tracking.
 *
 * Provides:
 * - Real-time updates when referrals are created or credited
 * - Stats for referrers (total, pending, credited, rejected)
 * - Status tracking for referred users
 * - Progress toward reward tiers
 *
 * Usage:
 * ```tsx
 * const {
 *   referrals,
 *   stats,
 *   myReferralStatus,
 *   nextRewardTier,
 *   progressToNextTier,
 * } = useReferralTracking()
 * ```
 */
export function useReferralTracking(): UseReferralTrackingResult {
  const { profile, user } = useAuth()

  const [referrals, setReferrals] = useState<ReferralWithDetails[]>([])
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    pendingReferrals: 0,
    creditedReferrals: 0,
    rejectedReferrals: 0,
    totalPointsEarned: 0,
  })
  const [myReferralStatus, setMyReferralStatus] = useState<'pending' | 'credited' | 'rejected' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Subscribe to referrals made by this user (as referrer)
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false)
      return
    }

    setLoading(true)

    const unsubscribe = subscribeToReferrals(user.uid, (updatedReferrals) => {
      setReferrals(updatedReferrals)

      // Calculate stats from referrals
      let pending = 0
      let credited = 0
      let rejected = 0

      updatedReferrals.forEach((ref) => {
        switch (ref.status) {
          case 'pending':
            pending++
            break
          case 'credited':
            credited++
            break
          case 'rejected':
            rejected++
            break
        }
      })

      setStats({
        totalReferrals: updatedReferrals.length,
        pendingReferrals: pending,
        creditedReferrals: credited,
        rejectedReferrals: rejected,
        totalPointsEarned: credited * REFERRAL_POINTS,
      })

      setLoading(false)
    })

    return () => unsubscribe()
  }, [user?.uid])

  // Subscribe to this user's own referral status (if they were referred)
  useEffect(() => {
    if (!user?.uid || !profile?.referredBy) {
      return
    }

    const unsubscribe = subscribeToReferralStatus(user.uid, (referral) => {
      if (referral) {
        setMyReferralStatus(referral.status)
      }
    })

    return () => unsubscribe()
  }, [user?.uid, profile?.referredBy])

  // Refresh stats manually
  const refreshStats = useCallback(async () => {
    if (!user?.uid) return

    try {
      const freshStats = await getReferralStats(user.uid)
      setStats(freshStats)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh stats'))
    }
  }, [user?.uid])

  // Computed values
  const referralCode = useMemo(() => {
    return profile?.referralCode ?? user?.uid ?? null
  }, [profile?.referralCode, user?.uid])

  const referralLink = useMemo(() => {
    const baseUrl = import.meta.env.VITE_APP_BASE_URL || window.location.origin
    return referralCode ? `${baseUrl}/join?ref=${referralCode}` : ''
  }, [referralCode])

  const wasReferred = useMemo(() => {
    return !!profile?.referredBy
  }, [profile?.referredBy])

  const referrerUid = useMemo(() => {
    return profile?.referredBy ?? null
  }, [profile?.referredBy])

  // Calculate next reward tier and progress
  const { nextRewardTier, progressToNextTier, referralsNeededForNextTier } = useMemo(() => {
    // Use the greater of profile referralCount or calculated credited count
    const referralCount = Math.max(
      profile?.referralCount ?? 0,
      stats.creditedReferrals
    )

    const nextTier = REWARD_TIERS.find((tier) => referralCount < tier.required) ?? null

    if (!nextTier) {
      return {
        nextRewardTier: null,
        progressToNextTier: 100,
        referralsNeededForNextTier: 0,
      }
    }

    // Find the previous tier for progress calculation
    const prevTierIndex = REWARD_TIERS.findIndex((t) => t.id === nextTier.id) - 1
    const prevTierRequired = prevTierIndex >= 0 ? REWARD_TIERS[prevTierIndex].required : 0

    const progressRange = nextTier.required - prevTierRequired
    const currentProgress = referralCount - prevTierRequired
    const progress = progressRange > 0 ? Math.min((currentProgress / progressRange) * 100, 100) : 0

    return {
      nextRewardTier: nextTier,
      progressToNextTier: progress,
      referralsNeededForNextTier: nextTier.required - referralCount,
    }
  }, [profile?.referralCount, stats.creditedReferrals])

  return {
    referrals,
    stats,
    myReferralStatus,
    wasReferred,
    referrerUid,
    loading,
    error,
    referralCode,
    referralLink,
    nextRewardTier,
    progressToNextTier,
    referralsNeededForNextTier,
    refreshStats,
  }
}

/**
 * Hook to track if the current user has completed their first activity.
 * Useful for showing referred users their progress toward earning
 * points for their referrer.
 */
export function useFirstActivityStatus() {
  const { user, profile } = useAuth()
  const [hasFirstActivity, setHasFirstActivity] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false)
      return
    }

    // Check if user has any ledger entries
    import('@/services/referralService').then(({ hasCompletedFirstActivity }) => {
      hasCompletedFirstActivity(user.uid)
        .then(setHasFirstActivity)
        .finally(() => setLoading(false))
    })
  }, [user?.uid])

  return {
    hasFirstActivity,
    loading,
    wasReferred: !!profile?.referredBy,
    referralStatus: profile?.referralStatus ?? null,
  }
}
