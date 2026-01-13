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

const DEFAULT_ROLE_WEIGHTS: Record<string, number> = {
  user: 1,
  mentor: 1,
  ambassador: 1,
  team_leader: 1,
  partner: 0,
  admin: 0,
  super_admin: 0,
}

const isActiveAccountStatus = (status?: string | null) => {
  if (!status) return true
  const normalized = status.toLowerCase()
  return normalized !== 'suspended' && normalized !== 'inactive'
}

const resolveRoleWeights = (organization: OrganizationRecord) => ({
  ...DEFAULT_ROLE_WEIGHTS,
  ...(organization.roleBasedLicenseWeights ?? {}),
})

const resolveRoleWeight = (role: string | null | undefined, roleWeights: Record<string, number>) => {
  if (!role) return 1
  return roleWeights[role] ?? 1
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

const getActiveLicenseUsage = async (organizationId: string, roleWeights: Record<string, number>) => {
  const snapshot = await getDocs(query(usersCollection, where('assignedOrganizations', 'array-contains', organizationId)))
  const licenseAllocationByRole: Record<string, number> = {}
  let total = 0

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data() as { role?: string; accountStatus?: string | null }
    if (!isActiveAccountStatus(data.accountStatus)) return
    const role = data.role || 'user'
    const weight = resolveRoleWeight(role, roleWeights)
    licenseAllocationByRole[role] = (licenseAllocationByRole[role] ?? 0) + 1
    total += weight
  })

  return { total, licenseAllocationByRole }
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
  const roleWeights = resolveRoleWeights(organization)
  const { total, licenseAllocationByRole } = await getActiveLicenseUsage(organizationId, roleWeights)
  const currentMembers = total
  const teamSize = organization.teamSize ?? 0
  const availableLicenses = Math.max(teamSize - currentMembers, 0)
  const capacityPercentage = formatCapacityPercentage(currentMembers, teamSize)

  const payload: OrganizationCapacityMetrics = {
    organizationId,
    organizationName: organization.name || 'Unknown organization',
    currentMembers,
    teamSize,
    availableLicenses,
    licenseAllocationByRole,
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
  const roleWeights = resolveRoleWeights(organization)
  const { total, licenseAllocationByRole } = await getActiveLicenseUsage(organizationId, roleWeights)
  const currentMembers = total
  const teamSize = organization.teamSize ?? 0
  const availableLicenses = Math.max(teamSize - currentMembers, 0)
  const capacityPercentage = formatCapacityPercentage(currentMembers, teamSize)
  const nextThreshold = resolveCapacityThresholds(capacityPercentage)
  const lastThreshold = organization.capacityLastAlertThreshold as CapacityThresholdLevel | null | undefined

  const metrics: OrganizationCapacityMetrics = {
    organizationId,
    organizationName: organization.name || 'Unknown organization',
    currentMembers,
    teamSize,
    availableLicenses,
    licenseAllocationByRole,
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
        availableLicenses,
        licenseAllocationByRole,
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
    availableLicenses,
    licenseAllocationByRole,
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
