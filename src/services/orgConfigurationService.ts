/**
 * Organization Configuration Service
 * Phase 6: Manages org settings, leadership, and pass mark configuration
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
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import {
  OrganizationConfiguration,
  OrganizationLeadership,
  OrganizationFeatures,
  PassMarkConfiguration,
  DashboardConfiguration,
  LeadershipAssignment,
  OrganizationRule,
  ConfigurationChangeRecord,
} from '../types/organization'

/**
 * Get organization configuration
 */
export async function getOrgConfiguration(
  orgId: string
): Promise<OrganizationConfiguration | null> {
  try {
    const configDoc = await getDoc(doc(db, 'organization_configuration', orgId))

    if (!configDoc.exists()) {
      // Return default configuration
      return getDefaultOrgConfiguration(orgId)
    }

    return configDoc.data() as OrganizationConfiguration
  } catch (error) {
    console.error('Error getting org configuration:', error)
    throw error
  }
}

/**
 * Get default organization configuration
 */
export function getDefaultOrgConfiguration(orgId: string): OrganizationConfiguration {
  return {
    id: orgId,
    orgId,

    // Default: no leadership assigned
    leadership: {
      hasMentor: false,
      hasAmbassador: false,
      hasPartner: false,
      assignedLeadership: [],
      updatedAt: Timestamp.now(),
    },

    // Default: all features enabled
    features: {
      mentorshipRequired: false,
      peerMatchingEnabled: true,
      pointsVerificationRequired: false,
      cohortsEnabled: true,
      communityEnabled: true,
      leaderboardEnabled: true,
      customReportsEnabled: true,
      automatedNudgesEnabled: true,
      journeyCustomizationEnabled: true,
    },

    // Default: 70% pass mark
    passMark: {
      basePassMark: 70,
      minimumPassMark: 50,
      adjustments: {
        noMentorAvailable: -10,
        noAmbassadorAvailable: -5,
        noPartnerAvailable: -10,
        limitedCapacity: -5,
      },
      updatedAt: Timestamp.now(),
    },

    // Default dashboard
    dashboardConfig: {
      displayedMetrics: [
        'team_health',
        'engagement_score',
        'completion_rate',
        'leadership_utilization',
        'pass_mark_adjustments',
        'activity_visibility',
      ],
      enabledReports: ['daily_snapshot', 'weekly_summary', 'learner_progress'],
      reportSchedule: 'daily',
      reportTime: '06:00',
      adminNotificationsEnabled: true,
      criticalAlertsOnly: false,
      updatedAt: Timestamp.now(),
    },

    journeyRules: [],

    // Metadata
    configuredAt: Timestamp.now(),
    configuredBy: 'system',
    lastModified: Timestamp.now(),
    lastModifiedBy: 'system',
  }
}

/**
 * Update organization leadership
 */
export async function updateOrgLeadership(
  orgId: string,
  leadership: Partial<OrganizationLeadership>,
  userId: string
): Promise<void> {
  try {
    const configRef = doc(db, 'organization_configuration', orgId)

    // Record the change
    await recordConfigurationChange(orgId, 'leadership_assigned', {}, leadership, userId)

    // Update
    await updateDoc(configRef, {
      'leadership.hasMentor': leadership.hasMentor ?? false,
      'leadership.hasAmbassador': leadership.hasAmbassador ?? false,
      'leadership.hasPartner': leadership.hasPartner ?? false,
      'leadership.assignedMentorId': leadership.assignedMentorId ?? null,
      'leadership.assignedAmbassadorId': leadership.assignedAmbassadorId ?? null,
      'leadership.transformationPartnerId': leadership.transformationPartnerId ?? null,
      'leadership.mentorCapacity': leadership.mentorCapacity ?? 0,
      'leadership.ambassadorCapacity': leadership.ambassadorCapacity ?? 0,
      'leadership.mentorUtilization': leadership.mentorUtilization ?? 0,
      'leadership.ambassadorUtilization': leadership.ambassadorUtilization ?? 0,
      'leadership.mentorSkills': leadership.mentorSkills ?? [],
      'leadership.ambassadorFocusAreas': leadership.ambassadorFocusAreas ?? [],
      'leadership.partnerProgramFocus': leadership.partnerProgramFocus ?? [],
      'leadership.updatedAt': serverTimestamp(),
      lastModified: serverTimestamp(),
      lastModifiedBy: userId,
    })

    // Update org document for quick access
    await updateDoc(doc(db, 'organizations', orgId), {
      'leadership.hasMentor': leadership.hasMentor ?? false,
      'leadership.hasAmbassador': leadership.hasAmbassador ?? false,
      'leadership.hasPartner': leadership.hasPartner ?? false,
      'leadership.assignedMentorId': leadership.assignedMentorId ?? null,
      'leadership.assignedAmbassadorId': leadership.assignedAmbassadorId ?? null,
      'leadership.transformationPartnerId': leadership.transformationPartnerId ?? null,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error updating org leadership:', error)
    throw error
  }
}

/**
 * Assign leadership to organization
 */
export async function assignLeadershipToOrg(
  orgId: string,
  role: 'mentor' | 'ambassador' | 'partner',
  userId: string,
  leadershipData: Omit<LeadershipAssignment, 'role' | 'userId'>,
  adminUserId: string
): Promise<void> {
  try {
    const config = await getOrgConfiguration(orgId)
    if (!config) throw new Error('Organization configuration not found')

    const newLeadership = { ...config.leadership }

    // Assign based on role
    if (role === 'mentor') {
      newLeadership.assignedMentorId = userId
      newLeadership.hasMentor = true
      newLeadership.mentorCapacity = leadershipData.capacity
      newLeadership.mentorSkills = leadershipData.skills
    } else if (role === 'ambassador') {
      newLeadership.assignedAmbassadorId = userId
      newLeadership.hasAmbassador = true
      newLeadership.ambassadorCapacity = leadershipData.capacity
      newLeadership.ambassadorFocusAreas = leadershipData.focusAreas
    } else if (role === 'partner') {
      newLeadership.transformationPartnerId = userId
      newLeadership.hasPartner = true
      newLeadership.partnerProgramFocus = leadershipData.focusAreas
    }

    // Add to roster
    const assignment: LeadershipAssignment = {
      userId,
      role,
      ...leadershipData,
      assignedSince: Timestamp.now(),
    }

    if (!newLeadership.assignedLeadership) {
      newLeadership.assignedLeadership = []
    }

    // Remove if already exists
    newLeadership.assignedLeadership = newLeadership.assignedLeadership.filter(
      (l) => l.userId !== userId
    )

    // Add new assignment
    newLeadership.assignedLeadership.push(assignment)
    newLeadership.updatedAt = Timestamp.now()

    // Update configuration
    await updateOrgLeadership(orgId, newLeadership, adminUserId)
  } catch (error) {
    console.error('Error assigning leadership:', error)
    throw error
  }
}

/**
 * Remove leadership from organization
 */
export async function removeLeadershipFromOrg(
  orgId: string,
  userId: string,
  adminUserId: string
): Promise<void> {
  try {
    const config = await getOrgConfiguration(orgId)
    if (!config) throw new Error('Organization configuration not found')

    const newLeadership = { ...config.leadership }

    // Find and remove
    if (newLeadership.assignedMentorId === userId) {
      newLeadership.assignedMentorId = null
      newLeadership.hasMentor = false
      newLeadership.mentorCapacity = 0
      newLeadership.mentorUtilization = 0
      newLeadership.mentorSkills = []
    } else if (newLeadership.assignedAmbassadorId === userId) {
      newLeadership.assignedAmbassadorId = null
      newLeadership.hasAmbassador = false
      newLeadership.ambassadorCapacity = 0
      newLeadership.ambassadorUtilization = 0
      newLeadership.ambassadorFocusAreas = []
    } else if (newLeadership.transformationPartnerId === userId) {
      newLeadership.transformationPartnerId = null
      newLeadership.hasPartner = false
    }

    // Remove from roster
    if (newLeadership.assignedLeadership) {
      newLeadership.assignedLeadership = newLeadership.assignedLeadership.filter(
        (l) => l.userId !== userId
      )
    }

    newLeadership.updatedAt = Timestamp.now()

    // Record the change
    await recordConfigurationChange(
      orgId,
      'leadership_removed',
      { userId },
      newLeadership,
      adminUserId
    )

    // Update
    await updateOrgLeadership(orgId, newLeadership, adminUserId)
  } catch (error) {
    console.error('Error removing leadership:', error)
    throw error
  }
}

/**
 * Update features configuration
 */
export async function updateOrgFeatures(
  orgId: string,
  features: Partial<OrganizationFeatures>,
  userId: string
): Promise<void> {
  try {
    const configRef = doc(db, 'organization_configuration', orgId)

    // Record change
    await recordConfigurationChange(orgId, 'feature_enabled', {}, features, userId)

    // Update
    await updateDoc(configRef, {
      'features.mentorshipRequired': features.mentorshipRequired,
      'features.peerMatchingEnabled': features.peerMatchingEnabled,
      'features.pointsVerificationRequired': features.pointsVerificationRequired,
      'features.cohortsEnabled': features.cohortsEnabled,
      'features.communityEnabled': features.communityEnabled,
      'features.leaderboardEnabled': features.leaderboardEnabled,
      'features.customReportsEnabled': features.customReportsEnabled,
      'features.automatedNudgesEnabled': features.automatedNudgesEnabled,
      'features.journeyCustomizationEnabled': features.journeyCustomizationEnabled,
      lastModified: serverTimestamp(),
      lastModifiedBy: userId,
    })
  } catch (error) {
    console.error('Error updating org features:', error)
    throw error
  }
}

/**
 * Update pass mark configuration
 */
export async function updateOrgPassMarkConfig(
  orgId: string,
  config: Partial<PassMarkConfiguration>,
  userId: string
): Promise<void> {
  try {
    const configRef = doc(db, 'organization_configuration', orgId)

    // Record change
    await recordConfigurationChange(orgId, 'pass_mark_updated', {}, config, userId)

    // Update
    await updateDoc(configRef, {
      'passMark.basePassMark': config.basePassMark,
      'passMark.minimumPassMark': config.minimumPassMark,
      'passMark.adjustments': config.adjustments,
      'passMark.activityOverrides': config.activityOverrides,
      'passMark.notes': config.notes,
      'passMark.updatedAt': serverTimestamp(),
      lastModified: serverTimestamp(),
      lastModifiedBy: userId,
    })
  } catch (error) {
    console.error('Error updating pass mark config:', error)
    throw error
  }
}

/**
 * Get pass mark adjustments for an org
 */
export async function getPassMarkAdjustments(orgId: string): Promise<{
  base: number
  adjustments: PassMarkConfiguration['adjustments']
}> {
  try {
    const config = await getOrgConfiguration(orgId)
    if (!config) {
      const defaultConfig = getDefaultOrgConfiguration(orgId)
      return {
        base: defaultConfig.passMark.basePassMark,
        adjustments: defaultConfig.passMark.adjustments,
      }
    }

    return {
      base: config.passMark.basePassMark,
      adjustments: config.passMark.adjustments,
    }
  } catch (error) {
    console.error('Error getting pass mark adjustments:', error)
    throw error
  }
}

/**
 * Update dashboard configuration
 */
export async function updateOrgDashboardConfig(
  orgId: string,
  config: Partial<DashboardConfiguration>,
  userId: string
): Promise<void> {
  try {
    const configRef = doc(db, 'organization_configuration', orgId)

    await updateDoc(configRef, {
      'dashboardConfig.displayedMetrics': config.displayedMetrics,
      'dashboardConfig.enabledReports': config.enabledReports,
      'dashboardConfig.reportSchedule': config.reportSchedule,
      'dashboardConfig.reportTime': config.reportTime,
      'dashboardConfig.reportRecipients': config.reportRecipients,
      'dashboardConfig.adminNotificationsEnabled': config.adminNotificationsEnabled,
      'dashboardConfig.criticalAlertsOnly': config.criticalAlertsOnly,
      'dashboardConfig.updatedAt': serverTimestamp(),
      lastModified: serverTimestamp(),
      lastModifiedBy: userId,
    })
  } catch (error) {
    console.error('Error updating dashboard config:', error)
    throw error
  }
}

/**
 * Add organization rule
 */
export async function addOrgRule(
  orgId: string,
  rule: Omit<OrganizationRule, 'id' | 'orgId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
  userId: string
): Promise<string> {
  try {
    const config = await getOrgConfiguration(orgId)
    if (!config) throw new Error('Organization configuration not found')

    const newRule: OrganizationRule = {
      ...rule,
      id: `rule_${Date.now()}`,
      orgId,
      createdAt: Timestamp.now(),
      createdBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    }

    const configRef = doc(db, 'organization_configuration', orgId)
    const rules = config.journeyRules || []
    rules.push(newRule)

    await updateDoc(configRef, {
      journeyRules: rules,
      lastModified: serverTimestamp(),
      lastModifiedBy: userId,
    })

    // Record change
    await recordConfigurationChange(
      orgId,
      'rule_created',
      {},
      { ruleName: newRule.name, ruleId: newRule.id },
      userId
    )

    return newRule.id
  } catch (error) {
    console.error('Error adding org rule:', error)
    throw error
  }
}

/**
 * Update organization rule
 */
export async function updateOrgRule(
  orgId: string,
  ruleId: string,
  updates: Partial<OrganizationRule>,
  userId: string
): Promise<void> {
  try {
    const config = await getOrgConfiguration(orgId)
    if (!config) throw new Error('Organization configuration not found')

    const rules = config.journeyRules || []
    const ruleIndex = rules.findIndex((r) => r.id === ruleId)

    if (ruleIndex === -1) throw new Error('Rule not found')

    const updatedRule = {
      ...rules[ruleIndex],
      ...updates,
      id: ruleId,
      orgId,
      createdAt: rules[ruleIndex].createdAt,
      createdBy: rules[ruleIndex].createdBy,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    }

    rules[ruleIndex] = updatedRule

    const configRef = doc(db, 'organization_configuration', orgId)
    await updateDoc(configRef, {
      journeyRules: rules,
      lastModified: serverTimestamp(),
      lastModifiedBy: userId,
    })

    // Record change
    await recordConfigurationChange(
      orgId,
      'rule_modified',
      { ruleName: rules[ruleIndex].name },
      { updates },
      userId
    )
  } catch (error) {
    console.error('Error updating org rule:', error)
    throw error
  }
}

/**
 * Delete organization rule
 */
export async function deleteOrgRule(
  orgId: string,
  ruleId: string,
  userId: string
): Promise<void> {
  try {
    const config = await getOrgConfiguration(orgId)
    if (!config) throw new Error('Organization configuration not found')

    const rules = config.journeyRules || []
    const ruleIndex = rules.findIndex((r) => r.id === ruleId)

    if (ruleIndex === -1) throw new Error('Rule not found')

    const deletedRule = rules[ruleIndex]
    rules.splice(ruleIndex, 1)

    const configRef = doc(db, 'organization_configuration', orgId)
    await updateDoc(configRef, {
      journeyRules: rules,
      lastModified: serverTimestamp(),
      lastModifiedBy: userId,
    })

    // Record change
    await recordConfigurationChange(
      orgId,
      'rule_modified',
      { deletedRule: deletedRule.name },
      {},
      userId
    )
  } catch (error) {
    console.error('Error deleting org rule:', error)
    throw error
  }
}

/**
 * Get all organization rules
 */
export async function getOrgRules(orgId: string): Promise<OrganizationRule[]> {
  try {
    const config = await getOrgConfiguration(orgId)
    return config?.journeyRules || []
  } catch (error) {
    console.error('Error getting org rules:', error)
    throw error
  }
}

/**
 * Record configuration change (audit trail)
 */
export async function recordConfigurationChange(
  orgId: string,
  changeType: ConfigurationChangeRecord['changeType'],
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  userId: string
): Promise<void> {
  try {
    const changeId = `change_${orgId}_${Date.now()}`
    const change: ConfigurationChangeRecord = {
      id: changeId,
      orgId,
      changeType,
      before: Object.keys(before).length > 0 ? before : undefined,
      after: Object.keys(after).length > 0 ? after : undefined,
      madeBy: userId,
      madeAt: Timestamp.now(),
    }

    await setDoc(doc(db, `organization_configuration/${orgId}/changes`, changeId), change)
  } catch (error) {
    console.error('Error recording configuration change:', error)
    // Don't throw - this is non-critical
  }
}

/**
 * Get configuration change history
 */
export async function getConfigurationChangeHistory(
  orgId: string,
  limit: number = 50
): Promise<ConfigurationChangeRecord[]> {
  try {
    const q = query(
      collection(db, `organization_configuration/${orgId}/changes`),
      where('orgId', '==', orgId)
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => doc.data() as ConfigurationChangeRecord).slice(0, limit)
  } catch (error) {
    console.error('Error getting configuration change history:', error)
    return []
  }
}

/**
 * Validate organization configuration
 */
export async function validateOrgConfiguration(
  orgId: string
): Promise<{ valid: boolean; errors: string[] }> {
  try {
    const config = await getOrgConfiguration(orgId)
    const errors: string[] = []

    if (!config) {
      return { valid: false, errors: ['No configuration found'] }
    }

    // Validate pass mark
    if (config.passMark.basePassMark < 0 || config.passMark.basePassMark > 100) {
      errors.push('Base pass mark must be between 0 and 100')
    }

    if (
      config.passMark.minimumPassMark &&
      config.passMark.minimumPassMark > config.passMark.basePassMark
    ) {
      errors.push('Minimum pass mark cannot exceed base pass mark')
    }

    // Validate adjustments
    Object.values(config.passMark.adjustments).forEach((adj) => {
      if (adj > 0 || adj < -30) {
        errors.push('Pass mark adjustments should be between -30 and 0')
      }
    })

    // Validate rules
    if (config.journeyRules) {
      config.journeyRules.forEach((rule, index) => {
        if (!rule.name) errors.push(`Rule ${index} has no name`)
        if (!rule.trigger) errors.push(`Rule ${index} has no trigger`)
        if (!rule.conditions || rule.conditions.length === 0) {
          errors.push(`Rule ${index} has no conditions`)
        }
        if (!rule.actions || rule.actions.length === 0) {
          errors.push(`Rule ${index} has no actions`)
        }
      })
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  } catch (error) {
    console.error('Error validating org configuration:', error)
    return {
      valid: false,
      errors: ['Validation error: ' + (error as Error).message],
    }
  }
}

/**
 * Create or initialize organization configuration
 */
export async function initializeOrgConfiguration(orgId: string, userId: string): Promise<void> {
  try {
    const configRef = doc(db, 'organization_configuration', orgId)
    const existing = await getDoc(configRef)

    if (!existing.exists()) {
      const defaultConfig = getDefaultOrgConfiguration(orgId)
      defaultConfig.configuredBy = userId
      defaultConfig.lastModifiedBy = userId

      await setDoc(configRef, defaultConfig)
    }
  } catch (error) {
    console.error('Error initializing org configuration:', error)
    throw error
  }
}
