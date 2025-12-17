import {
  Timestamp,
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

type TrendPoint = { label: string; value: number }

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

const buildDateBuckets = (days: number) => {
  const today = new Date()
  const buckets: Record<string, { label: string; start: number; end: number; value: number }> = {}

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today)
    date.setHours(0, 0, 0, 0)
    date.setDate(today.getDate() - i)
    const start = date.getTime()
    const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)

    buckets[label] = { label, start, end: endDate.getTime(), value: 0 }
  }

  return buckets
}

const timestampToMillis = (value?: unknown) => {
  if (!value) return 0
  if (value instanceof Timestamp) return value.toMillis()
  if (typeof value === 'number') return value
  const asDate = (value as { toDate?: () => Date })?.toDate?.()
  return asDate?.getTime() || 0
}

export const fetchRegistrationTrend = async (days = 14): Promise<TrendPoint[]> => {
  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - (days - 1))

  const registrationQuery = query(
    usersCollection,
    where('registrationDate', '>=', sinceDate),
    orderBy('registrationDate', 'asc'),
  )

  const snapshot = await getDocs(registrationQuery)
  const buckets = buildDateBuckets(days)

  snapshot.docs.forEach((docSnap) => {
    const millis = timestampToMillis((docSnap.data() as { registrationDate?: unknown }).registrationDate)
    Object.values(buckets).forEach((bucket) => {
      if (millis >= bucket.start && millis <= bucket.end) {
        buckets[bucket.label].value = (buckets[bucket.label].value || 0) + 1
      }
    })
  })

  return Object.values(buckets).map((bucket) => ({ label: bucket.label, value: bucket.value || 0 }))
}

export const fetchUserGrowthTrend = async (days = 30): Promise<TrendPoint[]> => {
  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - (days - 1))

  const userQuery = query(usersCollection, where('registrationDate', '>=', sinceDate), orderBy('registrationDate', 'asc'))
  const snapshot = await getDocs(userQuery)
  const buckets = buildDateBuckets(days)

  const byDay: Record<string, number> = {}
  snapshot.docs.forEach((docSnap) => {
    const millis = timestampToMillis((docSnap.data() as { registrationDate?: unknown }).registrationDate)
    const bucket = Object.values(buckets).find((range) => millis >= range.start && millis <= range.end)
    if (bucket) {
      byDay[bucket.label] = (byDay[bucket.label] || 0) + 1
    }
  })

  let runningTotal = 0
  return Object.values(buckets).map((bucket) => {
    runningTotal += byDay[bucket.label] || 0
    return { label: bucket.label, value: runningTotal }
  })
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
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as AdminActivityLogEntry
    return { ...data, id: docSnap.id }
  })
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
    onChange(
      snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as VerificationRequest
        return { ...data, id: docSnap.id }
      }),
    )
  })
}

export const listenToRegistrations = (onChange: (registrations: RegistrationRecord[]) => void) => {
  const registrationQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(8))
  return onSnapshot(registrationQuery, (snapshot) => {
    onChange(
      snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as RegistrationRecord
        return { ...data, id: docSnap.id }
      }),
    )
  })
}

export const listenToSystemAlerts = (onChange: (alerts: SystemAlertRecord[]) => void) => {
  const alertsQuery = query(collection(db, 'system_health_alerts'), orderBy('created_at', 'desc'), limit(8))
  return onSnapshot(alertsQuery, (snapshot) => {
    onChange(
      snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as SystemAlertRecord
        return { ...data, id: docSnap.id }
      }),
    )
  })
}

export const listenToTaskNotifications = (onChange: (tasks: TaskNotificationRecord[]) => void) => {
  const taskQuery = query(collection(db, 'task_notifications'), orderBy('created_at', 'desc'), limit(8))
  return onSnapshot(taskQuery, (snapshot) => {
    onChange(
      snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as TaskNotificationRecord
        return { ...data, id: docSnap.id }
      }),
    )
  })
}
