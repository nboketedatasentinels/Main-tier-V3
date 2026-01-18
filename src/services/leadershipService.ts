/**
 * Leadership Management Service
 * Phase 6: Manages mentor, ambassador, and partner assignments
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  collection,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { LeadershipAssignment, LeadershipRole } from '../types/organization'
import { getOrgConfiguration, recordConfigurationChange } from './orgConfigurationService'
import { normalizeRole } from '@/utils/role'

/**
 * Get leadership roster for organization
 */
export async function getLeadershipRoster(
  orgId: string
): Promise<LeadershipAssignment[]> {
  try {
    const config = await getOrgConfiguration(orgId)
    return config?.leadership.assignedLeadership || []
  } catch (error) {
    console.error('Error getting leadership roster:', error)
    return []
  }
}

/**
 * Get mentor for organization
 */
export async function getOrgMentor(orgId: string): Promise<LeadershipAssignment | null> {
  try {
    const roster = await getLeadershipRoster(orgId)
    return roster.find((l) => normalizeRole(l.role) === 'mentor') || null
  } catch (error) {
    console.error('Error getting org mentor:', error)
    return null
  }
}

/**
 * Get ambassador for organization
 */
export async function getOrgAmbassador(orgId: string): Promise<LeadershipAssignment | null> {
  try {
    const roster = await getLeadershipRoster(orgId)
    return roster.find((l) => normalizeRole(l.role) === 'ambassador') || null
  } catch (error) {
    console.error('Error getting org ambassador:', error)
    return null
  }
}

/**
 * Get partner for organization
 */
export async function getOrgPartner(orgId: string): Promise<LeadershipAssignment | null> {
  try {
    const roster = await getLeadershipRoster(orgId)
    return roster.find((l) => normalizeRole(l.role) === 'partner') || null
  } catch (error) {
    console.error('Error getting org partner:', error)
    return null
  }
}

/**
 * Check if leadership role is available
 */
export async function isLeadershipAvailable(
  orgId: string,
  role: LeadershipRole
): Promise<boolean> {
  try {
    const config = await getOrgConfiguration(orgId)
    if (!config) return false

    switch (role) {
      case 'mentor':
        return config.leadership.hasMentor === true
      case 'ambassador':
        return config.leadership.hasAmbassador === true
      case 'partner':
        return config.leadership.hasPartner === true
    }
  } catch (error) {
    console.error('Error checking leadership availability:', error)
    return false
  }
}

/**
 * Toggle leadership availability
 */
export async function toggleLeadershipAvailability(
  orgId: string,
  role: LeadershipRole,
  available: boolean,
  userId: string
): Promise<void> {
  try {
    const config = await getOrgConfiguration(orgId)
    if (!config) throw new Error('Configuration not found')

    const updateData: Record<string, unknown> = {}

    if (role === 'mentor') {
      updateData['leadership.hasMentor'] = available
    } else if (role === 'ambassador') {
      updateData['leadership.hasAmbassador'] = available
    } else if (role === 'partner') {
      updateData['leadership.hasPartner'] = available
    }

    updateData['leadership.updatedAt'] = serverTimestamp()
    updateData['lastModified'] = serverTimestamp()
    updateData['lastModifiedBy'] = userId

    const configRef = doc(db, 'organization_configuration', orgId)
    await updateDoc(configRef, updateData)

    // Also update org document
    const orgRef = doc(db, 'organizations', orgId)
    await updateDoc(orgRef, {
      [`leadership.has${role.charAt(0).toUpperCase()}${role.slice(1)}`]: available,
      updatedAt: serverTimestamp(),
    })

    // Record change
    await recordConfigurationChange(
      orgId,
      'leadership_assigned',
      { [role]: !available },
      { [role]: available },
      userId
    )
  } catch (error) {
    console.error('Error toggling leadership availability:', error)
    throw error
  }
}

/**
 * Update leadership capacity
 */
export async function updateLeadershipCapacity(
  orgId: string,
  role: LeadershipRole,
  capacity: number,
  userId: string
): Promise<void> {
  try {
    const configRef = doc(db, 'organization_configuration', orgId)
    const capacityField = role === 'mentor' ? 'mentorCapacity' : `${role}Capacity`

    await updateDoc(configRef, {
      [`leadership.${capacityField}`]: capacity,
      'leadership.updatedAt': serverTimestamp(),
      lastModified: serverTimestamp(),
      lastModifiedBy: userId,
    })

    // Record change
    await recordConfigurationChange(
      orgId,
      'leadership_assigned',
      { capacity: -1 },
      { [role + 'Capacity']: capacity },
      userId
    )
  } catch (error) {
    console.error('Error updating leadership capacity:', error)
    throw error
  }
}

/**
 * Update leadership utilization
 */
export async function updateLeadershipUtilization(
  orgId: string,
  role: LeadershipRole,
  utilizationPercent: number,
  userId: string
): Promise<void> {
  try {
    if (utilizationPercent < 0 || utilizationPercent > 100) {
      throw new Error('Utilization must be between 0 and 100')
    }

    const configRef = doc(db, 'organization_configuration', orgId)
    const utilizationField =
      role === 'mentor' ? 'mentorUtilization' : `${role}Utilization`

    await updateDoc(configRef, {
      [`leadership.${utilizationField}`]: utilizationPercent,
      'leadership.updatedAt': serverTimestamp(),
      lastModified: serverTimestamp(),
      lastModifiedBy: userId,
    })
  } catch (error) {
    console.error('Error updating leadership utilization:', error)
    throw error
  }
}

/**
 * Update leadership skills
 */
export async function updateLeadershipSkills(
  orgId: string,
  role: LeadershipRole,
  skills: string[],
  userId: string
): Promise<void> {
  try {
    const configRef = doc(db, 'organization_configuration', orgId)

    if (role === 'mentor') {
      await updateDoc(configRef, {
        'leadership.mentorSkills': skills,
        'leadership.updatedAt': serverTimestamp(),
        lastModified: serverTimestamp(),
        lastModifiedBy: userId,
      })
    } else if (role === 'ambassador' || role === 'partner') {
      const focusField = role === 'ambassador' ? 'ambassadorFocusAreas' : 'partnerProgramFocus'
      await updateDoc(configRef, {
        [`leadership.${focusField}`]: skills,
        'leadership.updatedAt': serverTimestamp(),
        lastModified: serverTimestamp(),
        lastModifiedBy: userId,
      })
    }

    // Record change
    await recordConfigurationChange(
      orgId,
      'leadership_assigned',
      {},
      { [role + 'Skills']: skills },
      userId
    )
  } catch (error) {
    console.error('Error updating leadership skills:', error)
    throw error
  }
}

/**
 * Get leadership statistics
 */
export async function getLeadershipStats(
  orgId: string
): Promise<{
  mentorUtilization: number | null
  ambassadorUtilization: number | null
  partnerUtilization: number | null
  capacityRemaining: {
    mentor: number | null
    ambassador: number | null
    partner: number | null
  }
  activeLeaders: number
}> {
  try {
    const config = await getOrgConfiguration(orgId)
    if (!config) {
      return {
        mentorUtilization: null,
        ambassadorUtilization: null,
        partnerUtilization: null,
        capacityRemaining: { mentor: null, ambassador: null, partner: null },
        activeLeaders: 0,
      }
    }

    const leadership = config.leadership

    return {
      mentorUtilization: leadership.mentorUtilization || 0,
      ambassadorUtilization: leadership.ambassadorUtilization || 0,
      partnerUtilization: 0, // Partner doesn't track utilization same way
      capacityRemaining: {
        mentor: leadership.mentorCapacity
          ? Math.max(
              0,
              leadership.mentorCapacity -
                Math.floor(((leadership.mentorUtilization || 0) / 100) * (leadership.mentorCapacity || 0))
            )
          : null,
        ambassador: leadership.ambassadorCapacity
          ? Math.max(
              0,
              leadership.ambassadorCapacity -
                Math.floor(
                  ((leadership.ambassadorUtilization || 0) / 100) *
                    (leadership.ambassadorCapacity || 0)
                )
            )
          : null,
        partner: null,
      },
      activeLeaders: (leadership.assignedLeadership || []).filter((l) => l.available).length,
    }
  } catch (error) {
    console.error('Error getting leadership stats:', error)
    throw error
  }
}

/**
 * Check if leadership has capacity
 */
export async function leadershipHasCapacity(
  orgId: string,
  role: LeadershipRole
): Promise<boolean> {
  try {
    const stats = await getLeadershipStats(orgId)

    if (role === 'mentor') {
      return stats.capacityRemaining.mentor !== null && stats.capacityRemaining.mentor > 0
    } else if (role === 'ambassador') {
      return (
        stats.capacityRemaining.ambassador !== null && stats.capacityRemaining.ambassador > 0
      )
    }

    return true // Partner doesn't track capacity same way
  } catch (error) {
    console.error('Error checking leadership capacity:', error)
    return false
  }
}

/**
 * Get leaders by skill
 */
export async function getLeadersBySkill(
  orgId: string,
  skill: string,
  role?: LeadershipRole
): Promise<LeadershipAssignment[]> {
  try {
    const roster = await getLeadershipRoster(orgId)

    return roster.filter((leader) => {
      const hasSkill = (leader.skills || []).includes(skill)
      const matchesRole = !role || leader.role === role
      return hasSkill && matchesRole
    })
  } catch (error) {
    console.error('Error getting leaders by skill:', error)
    return []
  }
}

/**
 * Get availability period for leadership
 */
export function getLeadershipAvailabilityPeriod(
  leader: LeadershipAssignment
): { from: Date; to?: Date } | null {
  if (!leader.availability) return null

  return {
    from: leader.availability.startDate.toDate(),
    to: leader.availability.endDate?.toDate(),
  }
}

/**
 * Check if leader is currently available (considering time period)
 */
export function isLeaderCurrentlyAvailable(leader: LeadershipAssignment): boolean {
  if (!leader.available) return false
  if (!leader.availability) return true

  const now = new Date()
  const from = leader.availability.startDate.toDate()
  const to = leader.availability.endDate?.toDate()

  return now >= from && (!to || now <= to)
}

/**
 * Get leader who is available now
 */
export async function getAvailableLeader(
  orgId: string,
  role: LeadershipRole
): Promise<LeadershipAssignment | null> {
  try {
    const roster = await getLeadershipRoster(orgId)

    const availableLeaders = roster.filter(
      (l) => l.role === role && isLeaderCurrentlyAvailable(l)
    )

    return availableLeaders.length > 0 ? availableLeaders[0] : null
  } catch (error) {
    console.error('Error getting available leader:', error)
    return null
  }
}

/**
 * Update leader availability period
 */
export async function updateLeaderAvailabilityPeriod(
  orgId: string,
  leaderId: string,
  startDate: Date,
  endDate?: Date,
  userId: string = 'system'
): Promise<void> {
  try {
    const config = await getOrgConfiguration(orgId)
    if (!config) throw new Error('Configuration not found')

    const roster = config.leadership.assignedLeadership || []
    const leaderIndex = roster.findIndex((l) => l.userId === leaderId)

    if (leaderIndex === -1) throw new Error('Leader not found')

    roster[leaderIndex].availability = {
      startDate: Timestamp.fromDate(startDate),
      endDate: endDate ? Timestamp.fromDate(endDate) : undefined,
    }

    const configRef = doc(db, 'organization_configuration', orgId)
    await updateDoc(configRef, {
      'leadership.assignedLeadership': roster,
      'leadership.updatedAt': serverTimestamp(),
      lastModified: serverTimestamp(),
      lastModifiedBy: userId,
    })

    // Record change
    await recordConfigurationChange(
      orgId,
      'leadership_assigned',
      { leadership: 'updated' },
      { leaderAvailability: `${startDate} to ${endDate}` },
      userId
    )
  } catch (error) {
    console.error('Error updating leader availability period:', error)
    throw error
  }
}

/**
 * Log leadership activity (for audit)
 */
export async function logLeadershipActivity(
  orgId: string,
  leaderId: string,
  activity: 'approved_activity' | 'rejected_activity' | 'provided_feedback' | 'guided_learner',
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const activityId = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const activityLog = {
      id: activityId,
      orgId,
      leaderId,
      activity,
      details: details || {},
      timestamp: Timestamp.now(),
    }

    await setDoc(doc(db, `organizations/${orgId}/leadership_activity`, activityId), activityLog)
  } catch (error) {
    console.error('Error logging leadership activity:', error)
    // Non-critical, don't throw
  }
}

/**
 * Get leadership activity summary
 */
export async function getLeadershipActivitySummary(
  orgId: string,
  role: LeadershipRole,
  daysBack: number = 7
): Promise<{
  totalActivities: number
  activitiesApproved: number
  activitiesRejected: number
  feedbackProvided: number
  learnersGuided: number
}> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysBack)

    const q = query(
      collection(db, `organizations/${orgId}/leadership_activity`),
      where('timestamp', '>=', Timestamp.fromDate(cutoffDate))
    )

    const snapshot = await getDocs(q)
    const activities = snapshot.docs.map((d) => d.data())

    return {
      totalActivities: activities.length,
      activitiesApproved: activities.filter((a) => a.activity === 'approved_activity').length,
      activitiesRejected: activities.filter((a) => a.activity === 'rejected_activity').length,
      feedbackProvided: activities.filter((a) => a.activity === 'provided_feedback').length,
      learnersGuided: activities.filter((a) => a.activity === 'guided_learner').length,
    }
  } catch (error) {
    console.error('Error getting leadership activity summary:', error)
    return {
      totalActivities: 0,
      activitiesApproved: 0,
      activitiesRejected: 0,
      feedbackProvided: 0,
      learnersGuided: 0,
    }
  }
}
