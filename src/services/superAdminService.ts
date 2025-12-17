import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  AdminActivityLogEntry,
  EngagementRiskAggregate,
  OrganizationRecord,
  RegistrationRecord,
  SuperAdminDashboardMetrics,
  SystemAlertRecord,
  TaskNotificationRecord,
  VerificationRequest,
} from '@/types/admin'

const orgCollection = collection(db, 'organizations')
const usersCollection = collection(db, 'users')
const auditCollection = collection(db, 'admin_activity_log')
const engagementCollection = collection(db, 'user_engagement_scores')

export const fetchDashboardMetrics = async (
  filters?: Partial<{ organizationCodes: string[]; organizationIds: string[]; trendDays: number }>,
): Promise<SuperAdminDashboardMetrics> => {
  const orgQuery = filters?.organizationCodes?.length
    ? query(orgCollection, where('code', 'in', filters.organizationCodes))
    : orgCollection

  const [orgSnapshot, userSnapshot] = await Promise.all([getDocs(orgQuery), getDocs(usersCollection)])

  const organizationCount = orgSnapshot.size
  const paidMembers = userSnapshot.docs.filter((docSnap) => (docSnap.data() as { membershipStatus?: string }).membershipStatus === 'paid').length

  const activeMembers = userSnapshot.docs.filter((docSnap) => (docSnap.data() as { accountStatus?: string }).accountStatus === 'active').length
  const newRegistrations = userSnapshot.docs.filter((docSnap) => !!(docSnap.data() as { registrationDate?: unknown }).registrationDate).length

  return {
    organizationCount,
    managedCompanies: organizationCount,
    paidMembers,
    activeMembers,
    engagementRate: 0.76,
    newRegistrations,
  }
}

export const fetchOrganizations = async (): Promise<OrganizationRecord[]> => {
  const snapshot = await getDocs(query(orgCollection, orderBy('createdAt', 'desc')))
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<OrganizationRecord, 'id'>) }))
}

export const createOrganization = async (organization: OrganizationRecord) => {
  const payload = {
    ...organization,
    createdAt: organization.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const docRef = await addDoc(orgCollection, payload)
  return docRef.id
}

export const updateOrganization = async (id: string, updates: Partial<OrganizationRecord>) => {
  const orgRef = doc(db, 'organizations', id)
  await updateDoc(orgRef, { ...updates, updatedAt: serverTimestamp() })
}

export const deleteOrganization = async (id: string) => {
  const orgRef = doc(db, 'organizations', id)
  await deleteDoc(orgRef)
}

export const assignPartner = async (id: string, partnerId: string | null) => {
  const orgRef = doc(db, 'organizations', id)
  await updateDoc(orgRef, {
    partnerId,
    updatedAt: serverTimestamp(),
  })
}

export const fetchEngagementRiskAggregates = async (): Promise<EngagementRiskAggregate> => {
  const snapshot = await getDocs(engagementCollection)
  const byRisk: Record<string, number> = {}
  snapshot.docs.forEach((docSnap) => {
    const riskLevel = (docSnap.data() as { riskLevel?: string }).riskLevel || 'unknown'
    byRisk[riskLevel] = (byRisk[riskLevel] || 0) + 1
  })

  return {
    total: snapshot.size,
    riskBuckets: byRisk,
  }
}

export const fetchAdminActivityLog = async (limitCount = 10): Promise<AdminActivityLogEntry[]> => {
  const snapshot = await getDocs(query(auditCollection, orderBy('createdAt', 'desc'), limit(limitCount)))
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as AdminActivityLogEntry) }))
}

export const logAdminAction = async (entry: Omit<AdminActivityLogEntry, 'id' | 'createdAt'>) => {
  await addDoc(auditCollection, {
    ...entry,
    createdAt: serverTimestamp(),
  })
}

export const listenToVerificationRequests = (onChange: (requests: VerificationRequest[]) => void) => {
  const verificationQuery = query(
    collection(db, 'points_verification_requests'),
    orderBy('created_at', 'desc'),
    limit(10),
  )
  return onSnapshot(verificationQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as VerificationRequest) })))
  })
}

export const listenToRegistrations = (onChange: (registrations: RegistrationRecord[]) => void) => {
  const registrationQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(8))
  return onSnapshot(registrationQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as RegistrationRecord) })))
  })
}

export const listenToSystemAlerts = (onChange: (alerts: SystemAlertRecord[]) => void) => {
  const alertsQuery = query(collection(db, 'system_health_alerts'), orderBy('created_at', 'desc'), limit(8))
  return onSnapshot(alertsQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as SystemAlertRecord) })))
  })
}

export const listenToTaskNotifications = (onChange: (tasks: TaskNotificationRecord[]) => void) => {
  const taskQuery = query(collection(db, 'task_notifications'), orderBy('created_at', 'desc'), limit(8))
  return onSnapshot(taskQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as TaskNotificationRecord) })))
  })
}
