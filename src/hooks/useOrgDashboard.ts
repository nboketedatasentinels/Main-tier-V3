/**
 * useOrgDashboard Hook
 * Phase 6: React hook for organization dashboard data and functionality
 */

import { useEffect, useState, useCallback } from 'react'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from './useAuth'
import { normalizeRole } from '@/utils/role'
import {
  getOrgConfiguration,
  updateOrgFeatures,
  updateOrgPassMarkConfig,
  addOrgRule,
  updateOrgRule,
  deleteOrgRule,
  assignLeadershipToOrg,
  removeLeadershipFromOrg,
} from '../services/orgConfigurationService'
import {
  getLeadershipRoster,
  getLeadershipStats,
} from '../services/leadershipService'
import {
  getHiddenActivitiesForOrg,
  getActivityVisibilitySummary,
  hideActivity,
  showActivity,
} from '../services/activityVisibilityService'
import {
  getPassMarkStatistics,
  getLearnersWithAdjustments,
} from '../services/dynamicPassMarkService'
import {
  OrganizationConfiguration,
  LeadershipAssignment,
  OrganizationRule,
  ActivityVisibility,
  PassMarkConfiguration,
  OrganizationFeatures,
} from '../types/organization'

interface UseOrgDashboardReturn {
  // Loading state
  loading: boolean
  error: string | null

  // Configuration
  orgConfig: OrganizationConfiguration | null
  getConfig: () => Promise<void>

  // Leadership
  leadership: LeadershipAssignment[]
  leadershipStats: {
    mentorUtilization: number | null
    ambassadorUtilization: number | null
    partnerUtilization: number | null
    capacityRemaining: {
      mentor: number | null
      ambassador: number | null
      partner: number | null
    }
    activeLeaders: number
  } | null
  assignLeader: (
    role: 'mentor' | 'ambassador' | 'partner',
    userId: string,
    name: string,
    email: string,
    capacity: number,
    skills?: string[]
  ) => Promise<void>
  removeLeader: (userId: string) => Promise<void>
  getLeadership: () => Promise<void>

  // Features
  updateFeatures: (features: Partial<OrganizationFeatures>) => Promise<void>

  // Pass marks
  passMarkStats: {
    avgBasePassmark: number
    avgFinalPassmark: number
    learnersAffected: number
    avgAdjustmentAmount: number
  } | null
  learnersWithAdjustments: Array<{
    learnerUserId: string
    adjustment: number
    reason: string
  }> | null
  updatePassMarks: (config: Partial<PassMarkConfiguration>) => Promise<void>
  getPassMarkStats: () => Promise<void>

  // Activities
  hiddenActivities: ActivityVisibility[]
  activityStats: {
    total: number
    visible: number
    hidden: number
  } | null
  hideActivity: (activityId: string, reason: string) => Promise<void>
  showActivity: (activityId: string) => Promise<void>
  getActivityStats: () => Promise<void>

  // Rules
  rules: OrganizationRule[]
  addRule: (rule: Omit<OrganizationRule, 'id' | 'orgId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<string>
  updateRule: (ruleId: string, updates: Partial<OrganizationRule>) => Promise<void>
  deleteRule: (ruleId: string) => Promise<void>
  getRules: () => Promise<void>

  // Refresh all
  refresh: () => Promise<void>
}

/**
 * Hook for organization dashboard
 */
export function useOrgDashboard(orgId?: string): UseOrgDashboardReturn {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Configuration
  const [orgConfig, setOrgConfig] = useState<OrganizationConfiguration | null>(null)

  // Leadership
  const [leadership, setLeadership] = useState<LeadershipAssignment[]>([])
  const [leadershipStats, setLeadershipStats] = useState<UseOrgDashboardReturn['leadershipStats']>(null)

  // Pass marks
  const [passMarkStats, setPassMarkStats] = useState<UseOrgDashboardReturn['passMarkStats']>(null)
  const [learnersWithAdjustments, setLearnersWithAdjustments] = useState<
    UseOrgDashboardReturn['learnersWithAdjustments']
  >(null)

  // Activities
  const [hiddenActivities, setHiddenActivities] = useState<ActivityVisibility[]>([])
  const [activityStats, setActivityStats] = useState<UseOrgDashboardReturn['activityStats']>(null)

  // Rules
  const [rules, setRules] = useState<OrganizationRule[]>([])

  // Get org ID from profile or parameter
  const currentOrgId = orgId || profile?.companyId

  /**
   * Get org configuration
   */
  const getConfig = useCallback(async () => {
    if (!currentOrgId) return

    try {
      setLoading(true)
      setError(null)

      const config = await getOrgConfiguration(currentOrgId)
      setOrgConfig(config)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load configuration'
      setError(message)
      console.error('Error loading org config:', err)
    } finally {
      setLoading(false)
    }
  }, [currentOrgId])

  /**
   * Get leadership roster and stats
   */
  const getLeadership = useCallback(async () => {
    if (!currentOrgId) return

    try {
      setLoading(true)
      setError(null)

      const roster = await getLeadershipRoster(currentOrgId)
      setLeadership(roster)

      const stats = await getLeadershipStats(currentOrgId)
      setLeadershipStats(stats)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load leadership'
      setError(message)
      console.error('Error loading leadership:', err)
    } finally {
      setLoading(false)
    }
  }, [currentOrgId])

  /**
   * Assign leader
   */
  const assignLeader = useCallback(
    async (
      role: 'mentor' | 'ambassador' | 'partner',
      userId: string,
      name: string,
      email: string,
      capacity: number,
      skills?: string[]
    ) => {
      if (!currentOrgId || !user?.uid) return

      try {
        setLoading(true)
        setError(null)

        await assignLeadershipToOrg(
          currentOrgId,
          role,
          userId,
          {
            name,
            email,
            capacity,
            skills: skills || [],
            available: true,
            utilized: 0,
            assignedSince: Timestamp.now(),
          },
          user.uid
        )

        await getLeadership()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to assign leader'
        setError(message)
        console.error('Error assigning leader:', err)
      } finally {
        setLoading(false)
      }
    },
    [currentOrgId, user?.uid, getLeadership]
  )

  /**
   * Remove leader
   */
  const removeLeader = useCallback(
    async (userId: string) => {
      if (!currentOrgId || !user?.uid) return

      try {
        setLoading(true)
        setError(null)

        await removeLeadershipFromOrg(currentOrgId, userId, user.uid)

        await getLeadership()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove leader'
        setError(message)
        console.error('Error removing leader:', err)
      } finally {
        setLoading(false)
      }
    },
    [currentOrgId, user?.uid, getLeadership]
  )

  /**
   * Update features
   */
  const updateFeatures = useCallback(
    async (features: Partial<OrganizationFeatures>) => {
      if (!currentOrgId || !user?.uid) return

      try {
        setLoading(true)
        setError(null)

        await updateOrgFeatures(currentOrgId, features, user.uid)

        await getConfig()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update features'
        setError(message)
        console.error('Error updating features:', err)
      } finally {
        setLoading(false)
      }
    },
    [currentOrgId, user?.uid, getConfig]
  )

  /**
   * Get pass mark statistics
   */
  const getPassMarkStats = useCallback(async () => {
    if (!currentOrgId) return

    try {
      setLoading(true)
      setError(null)

      const stats = await getPassMarkStatistics(currentOrgId)
      setPassMarkStats(stats)

      const adjustments = await getLearnersWithAdjustments(currentOrgId)
      setLearnersWithAdjustments(adjustments)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load pass mark stats'
      setError(message)
      console.error('Error loading pass mark stats:', err)
    } finally {
      setLoading(false)
    }
  }, [currentOrgId])

  /**
   * Update pass marks
   */
  const updatePassMarks = useCallback(
    async (config: Partial<PassMarkConfiguration>) => {
      if (!currentOrgId || !user?.uid) return

      try {
        setLoading(true)
        setError(null)

        await updateOrgPassMarkConfig(currentOrgId, config, user.uid)

        await getPassMarkStats()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update pass marks'
        setError(message)
        console.error('Error updating pass marks:', err)
      } finally {
        setLoading(false)
      }
    },
    [currentOrgId, user?.uid, getPassMarkStats]
  )

  /**
   * Get activity statistics
   */
  const getActivityStats = useCallback(async () => {
    if (!currentOrgId) return

    try {
      setLoading(true)
      setError(null)

      const hidden = await getHiddenActivitiesForOrg(currentOrgId)
      setHiddenActivities(hidden)

      const summary = await getActivityVisibilitySummary(currentOrgId)
      setActivityStats({
        total: summary.total,
        visible: summary.visible,
        hidden: summary.hidden,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load activity stats'
      setError(message)
      console.error('Error loading activity stats:', err)
    } finally {
      setLoading(false)
    }
  }, [currentOrgId])

  /**
   * Hide activity
   */
  const hideActivityFn = useCallback(
    async (activityId: string, reason: string) => {
      if (!currentOrgId || !user?.uid) return

      try {
        setLoading(true)
        setError(null)

        await hideActivity(currentOrgId, activityId, reason, undefined, user.uid)

        await getActivityStats()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to hide activity'
        setError(message)
        console.error('Error hiding activity:', err)
      } finally {
        setLoading(false)
      }
    },
    [currentOrgId, user?.uid, getActivityStats]
  )

  /**
   * Show activity
   */
  const showActivityFn = useCallback(
    async (activityId: string) => {
      if (!currentOrgId || !user?.uid) return

      try {
        setLoading(true)
        setError(null)

        await showActivity(currentOrgId, activityId, user.uid)

        await getActivityStats()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to show activity'
        setError(message)
        console.error('Error showing activity:', err)
      } finally {
        setLoading(false)
      }
    },
    [currentOrgId, user?.uid, getActivityStats]
  )

  /**
   * Get rules
   */
  const getRules = useCallback(async () => {
    if (!currentOrgId) return

    try {
      setLoading(true)
      setError(null)

      if (!orgConfig) {
        await getConfig()
        return
      }

      setRules(orgConfig.journeyRules || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load rules'
      setError(message)
      console.error('Error loading rules:', err)
    } finally {
      setLoading(false)
    }
  }, [currentOrgId, orgConfig, getConfig])

  /**
   * Add rule
   */
  const addRuleFn = useCallback(
    async (
      rule: Omit<
        OrganizationRule,
        'id' | 'orgId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'
      >
    ): Promise<string> => {
      if (!currentOrgId || !user?.uid) throw new Error('Missing org or user')

      try {
        setLoading(true)
        setError(null)

        const ruleId = await addOrgRule(currentOrgId, rule, user.uid)

        await getRules()

        return ruleId
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add rule'
        setError(message)
        console.error('Error adding rule:', err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [currentOrgId, user?.uid, getRules]
  )

  /**
   * Update rule
   */
  const updateRuleFn = useCallback(
    async (ruleId: string, updates: Partial<OrganizationRule>) => {
      if (!currentOrgId || !user?.uid) return

      try {
        setLoading(true)
        setError(null)

        await updateOrgRule(currentOrgId, ruleId, updates, user.uid)

        await getRules()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update rule'
        setError(message)
        console.error('Error updating rule:', err)
      } finally {
        setLoading(false)
      }
    },
    [currentOrgId, user?.uid, getRules]
  )

  /**
   * Delete rule
   */
  const deleteRuleFn = useCallback(
    async (ruleId: string) => {
      if (!currentOrgId || !user?.uid) return

      try {
        setLoading(true)
        setError(null)

        await deleteOrgRule(currentOrgId, ruleId, user.uid)

        await getRules()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete rule'
        setError(message)
        console.error('Error deleting rule:', err)
      } finally {
        setLoading(false)
      }
    },
    [currentOrgId, user?.uid, getRules]
  )

  /**
   * Refresh all data
   */
  const refresh = useCallback(async () => {
    await Promise.all([getConfig(), getLeadership(), getPassMarkStats(), getActivityStats()])
  }, [getConfig, getLeadership, getPassMarkStats, getActivityStats])

  // Initial load
  useEffect(() => {
    if (currentOrgId) {
      refresh()
    }
  }, [currentOrgId, refresh])

  return {
    // Loading
    loading,
    error,

    // Configuration
    orgConfig,
    getConfig,

    // Leadership
    leadership,
    leadershipStats,
    assignLeader,
    removeLeader,
    getLeadership,

    // Features
    updateFeatures,

    // Pass marks
    passMarkStats,
    learnersWithAdjustments,
    updatePassMarks,
    getPassMarkStats,

    // Activities
    hiddenActivities,
    activityStats,
    hideActivity: hideActivityFn,
    showActivity: showActivityFn,
    getActivityStats,

    // Rules
    rules,
    addRule: addRuleFn,
    updateRule: updateRuleFn,
    deleteRule: deleteRuleFn,
    getRules,

    // Refresh
    refresh,
  }
}

/**
 * useLeadershipRoster Hook
 * For viewing and managing leadership roster
 */
export function useLeadershipRoster(orgId?: string) {
  const { profile } = useAuth()
  const [roster, setRoster] = useState<LeadershipAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentOrgId = orgId || profile?.companyId

  const getRoster = useCallback(async () => {
    if (!currentOrgId) return

    try {
      setLoading(true)
      setError(null)

      const data = await getLeadershipRoster(currentOrgId)
      setRoster(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load roster'
      setError(message)
      console.error('Error loading roster:', err)
    } finally {
      setLoading(false)
    }
  }, [currentOrgId])

  const getMentors = useCallback(
    () => roster.filter((l) => normalizeRole(l.role) === 'mentor'),
    [roster]
  )

  const getAmbassadors = useCallback(
    () => roster.filter((l) => normalizeRole(l.role) === 'ambassador'),
    [roster]
  )

  const getPartners = useCallback(
    () => roster.filter((l) => normalizeRole(l.role) === 'partner'),
    [roster]
  )

  const getAvailableLeaders = useCallback(
    () => roster.filter((l) => l.available),
    [roster]
  )

  useEffect(() => {
    getRoster()
  }, [currentOrgId])

  return {
    roster,
    loading,
    error,
    getRoster,
    getMentors,
    getAmbassadors,
    getPartners,
    getAvailableLeaders,
  }
}
