import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import { ORG_COLLECTION } from '@/constants/organizations'
import type { OrganizationRecord } from '@/types/admin'
import type {
  CapacityAlertSeverity,
  CapacityThresholdLevel,
  OrganizationCapacityAlert,
  OrganizationCapacityMetrics,
} from '@/types/capacity'
import { sendCapacityAlert } from './notificationService'

const organizationsCollection = collection(db, ORG_COLLECTION)
const usersCollection = collection(db, 'users')
const capacityMetricsCollection = collection(db, 'organization_capacity_metrics')
const capacityAlertsCollection = collection(db, 'organization_capacity_alerts')
const adminActivityCollection = collection(db, 'admin_activity_log')

const LICENSE_CONSUMING_ROLES = new Set(['user', 'mentor', 'ambassador', 'team_leader'])

const isLicenseConsumingRole = (role?: string | null) => {
  if (!role) return false
  return LICENSE_CONSUMING_ROLES.has(role)
}

const isActiveAccountStatus = (status?: string | null) => {
  if (!status) return true
  const normalized = status.toLowerCase()
  return normalized !== 'suspended' && normalized !== 'inactive'
}

const resolveCapacityThresholds = (percentage: number): CapacityThresholdLevel | null => {
  if (percentage >= 100) return 100
  if (percentage >= 95) return 95
  if (percentage >= 90) return 90
  if (percentage >= 75) return 75
  return null
}

const resolveCapacitySeverity = (threshold: CapacityThresholdLevel): CapacityAlertSeverity => {
  if (threshold === 75) return 'info'
  if (threshold === 90) return 'warning'
  return 'critical'
}

const formatCapacityPercentage = (currentMembers: number, teamSize: number) => {
  if (!teamSize || teamSize <= 0) return 0
  return Math.round((currentMembers / teamSize) * 100)
}

const getActiveLicenseMemberCount = async (organizationId: string) => {
  const snapshot = await getDocs(query(usersCollection, where('assignedOrganizations', 'array-contains', organizationId)))
  return snapshot.docs.filter((docSnap) => {
    const data = docSnap.data() as { role?: string; accountStatus?: string | null }
    return isLicenseConsumingRole(data.role) && isActiveAccountStatus(data.accountStatus)
  }).length
}

const resolveAlertTargetRoles = (organization: OrganizationRecord) => {
  const targets: string[] = ['super_admin', 'admin']
  if (organization.transformationPartnerId) targets.push('partner')
  return targets
}

const recordAdminActivity = async (alert: OrganizationCapacityAlert, organizationCode?: string) => {
  await addDoc(adminActivityCollection, {
    action: 'capacity_alert_triggered',
    organizationName: alert.organizationName,
    organizationCode,
    severity: alert.severity,
    metadata: {
      threshold: alert.threshold,
      currentMembers: alert.currentMembers,
      teamSize: alert.teamSize,
      capacityPercentage: alert.capacityPercentage,
    },
    createdAt: serverTimestamp(),
  })
}

export const calculateOrganizationCapacity = async (organizationId: string) => {
  const orgSnap = await getDoc(doc(organizationsCollection, organizationId))
  if (!orgSnap.exists()) throw new Error('Organization not found.')
  const organization = { id: orgSnap.id, ...(orgSnap.data() as OrganizationRecord) }
  const currentMembers = await getActiveLicenseMemberCount(organizationId)
  const teamSize = organization.teamSize ?? 0
  const capacityPercentage = formatCapacityPercentage(currentMembers, teamSize)

  const payload: OrganizationCapacityMetrics = {
    organizationId,
    organizationName: organization.name || 'Unknown organization',
    currentMembers,
    teamSize,
    capacityPercentage,
    lastCalculated: Timestamp.now(),
  }

  await addDoc(capacityMetricsCollection, {
    ...payload,
    lastCalculated: serverTimestamp(),
  })

  return payload
}

export const checkCapacityThresholds = async (organizationId: string) => {
  const orgRef = doc(organizationsCollection, organizationId)
  const orgSnap = await getDoc(orgRef)
  if (!orgSnap.exists()) throw new Error('Organization not found.')
  const organization = { id: orgSnap.id, ...(orgSnap.data() as OrganizationRecord) }
  const currentMembers = await getActiveLicenseMemberCount(organizationId)
  const teamSize = organization.teamSize ?? 0
  const capacityPercentage = formatCapacityPercentage(currentMembers, teamSize)
  const nextThreshold = resolveCapacityThresholds(capacityPercentage)
  const lastThreshold = organization.capacityLastAlertThreshold as CapacityThresholdLevel | null | undefined

  const metrics: OrganizationCapacityMetrics = {
    organizationId,
    organizationName: organization.name || 'Unknown organization',
    currentMembers,
    teamSize,
    capacityPercentage,
    lastCalculated: Timestamp.now(),
  }

  await addDoc(capacityMetricsCollection, {
    ...metrics,
    lastCalculated: serverTimestamp(),
  })

  if (!nextThreshold) {
    if (lastThreshold) {
      await updateDoc(orgRef, {
        capacityLastAlertThreshold: null,
        updatedAt: serverTimestamp(),
      })
    }
    return { metrics, alert: null }
  }

  if (lastThreshold === nextThreshold) {
    return { metrics, alert: null }
  }

  await updateDoc(orgRef, {
    capacityLastAlertThreshold: nextThreshold,
    updatedAt: serverTimestamp(),
  })

  const triggeredAlert: OrganizationCapacityAlert = {
    id: '',
    organizationId,
    organizationName: organization.name || 'Unknown organization',
    currentMembers,
    teamSize,
    capacityPercentage,
    threshold: nextThreshold,
    severity: resolveCapacitySeverity(nextThreshold),
    createdAt: Timestamp.now(),
    resolvedAt: null,
  }

  await addDoc(capacityAlertsCollection, {
    organizationId,
    organizationName: organization.name || 'Unknown organization',
    currentMembers,
    teamSize,
    capacityPercentage,
    threshold: nextThreshold,
    severity: resolveCapacitySeverity(nextThreshold),
    createdAt: serverTimestamp(),
    resolvedAt: null,
  })

  await recordAdminActivity(triggeredAlert, organization.code)

  const targetRoles = resolveAlertTargetRoles(organization)
  await sendCapacityAlert({
    organizationId,
    organizationName: organization.name || 'Unknown organization',
    currentMembers,
    teamSize,
    capacityPercentage,
    threshold: nextThreshold,
    severity: resolveCapacitySeverity(nextThreshold),
    targetRoles,
  })

  return { metrics, alert: triggeredAlert }
}
