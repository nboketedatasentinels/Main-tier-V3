import { useEffect, useMemo, useState } from 'react'
import { differenceInDays, subDays } from 'date-fns'
import {
  addDoc,
  collection,
  collectionGroup,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/services/firebase'
import {
  build14DayRegistrationTrend,
  calculateUserRiskStatus,
  getProgramWeekNumber,
  mapWeeklyPointsToProgress,
  WeeklyPointsRecord,
} from '@/utils/partnerProgress'

export type PartnerRiskLevel = 'engaged' | 'watch' | 'concern' | 'critical'

export interface PartnerOrganization {
  code: string
  name: string
  status: 'active' | 'watch' | 'paused'
  activeUsers: number
  newThisWeek: number
  lastActive?: string
  tags?: string[]
}

export interface PartnerUser {
  id: string
  name: string
  fullName?: string
  createdAt?: string
  lastActiveAt?: string
  programStartDate?: string
  email: string
  companyCode: string
  progressPercent: number
  currentWeek: number
  status: 'Active' | 'Paused' | 'Onboarding'
  lastActive: string
  riskStatus: PartnerRiskLevel | 'at_risk'
  weeklyEarned: number
  weeklyRequired: number
  role?: 'learner' | 'mentor' | 'team_leader'
  riskReasons?: string[]
  registrationDate?: string
  interventions?: number
}

export interface PartnerInterventionSummary {
  id: string
  name: string
  target: string
  reason: string
  status: 'active' | 'watch' | 'critical'
  deadline: string
  organizationCode?: string
  userId?: string
  partnerId?: string
}

interface UsePartnerDashboardDataOptions {
  selectedOrg?: string
}

const ORG_QUERY = query(collection(db, 'organizations'), where('status', '==', 'active'))
const USERS_QUERY = query(collection(db, 'users'), where('accountStatus', '==', 'active'))

const normalizeTimestamp = (value?: unknown): string | null => {
  if (!value) return null

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString()
  }

  if (typeof value === 'number') {
    const dateValue = new Date(value)
    return isNaN(dateValue.getTime()) ? null : dateValue.toISOString()
  }

  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const dateValue = (value as { toDate: () => Date }).toDate()
    return isNaN(dateValue.getTime()) ? null : dateValue.toISOString()
  }

  if (typeof value === 'string') {
    const dateValue = new Date(value)
    return isNaN(dateValue.getTime()) ? null : dateValue.toISOString()
  }

  return null
}

export const usePartnerDashboardData = (options?: UsePartnerDashboardDataOptions) => {
  const { assignedOrganizations = [], profile, isSuperAdmin, user } = useAuth()
  const [selectedOrg, setSelectedOrg] = useState<string>(options?.selectedOrg || 'all')
  const [users, setUsers] = useState<PartnerUser[]>([])
  const [organizations, setOrganizations] = useState<PartnerOrganization[]>([])
  const [notificationCount, setNotificationCount] = useState<number>(0)
  const [interventions, setInterventions] = useState<PartnerInterventionSummary[]>([])

  const assignedSet = useMemo(() => new Set(assignedOrganizations.map((code) => code.toLowerCase())), [assignedOrganizations])

  useEffect(() => {
    const unsubscribe = onSnapshot(ORG_QUERY, (snapshot) => {
      const scoped = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data() as Partial<PartnerOrganization>
          return {
            code: data.code || docSnap.id,
            name: data.name || docSnap.id,
            status: (data.status as PartnerOrganization['status']) || 'active',
            activeUsers: data.activeUsers ?? 0,
            newThisWeek: data.newThisWeek ?? 0,
            lastActive: data.lastActive,
            tags: data.tags || [],
          }
        })
        .filter((org) => (isSuperAdmin || !assignedSet.size ? true : assignedSet.has(org.code.toLowerCase())))

      setOrganizations(scoped)
    })

    return () => unsubscribe()
  }, [assignedSet, isSuperAdmin])

  const fetchWeeklyPointsByUser = async (userIds: string[]) => {
    const pointsByUser: Record<string, WeeklyPointsRecord[]> = {}
    const batches = []
    for (let i = 0; i < userIds.length; i += 10) {
      batches.push(userIds.slice(i, i + 10))
    }

    for (const batch of batches) {
      const weeklyQuery = query(collectionGroup(db, 'weekly_points'), where('user_id', 'in', batch))
      const weeklySnapshot = await getDocs(weeklyQuery)
      weeklySnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as WeeklyPointsRecord
        if (!data.user_id) return
        pointsByUser[data.user_id] = [...(pointsByUser[data.user_id] || []), data]
      })
    }

    if (!Object.keys(pointsByUser).length && userIds.length) {
      // Fallback to top-level weekly_points collection for legacy data
      for (const batch of batches) {
        const legacyQuery = query(collection(db, 'weekly_points'), where('user_id', 'in', batch))
        const legacySnapshot = await getDocs(legacyQuery)
        legacySnapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as WeeklyPointsRecord
          if (!data.user_id) return
          pointsByUser[data.user_id] = [...(pointsByUser[data.user_id] || []), data]
        })
      }
    }

    return pointsByUser
  }

  type FirestorePartnerUser = Partial<PartnerUser> & {
    full_name?: string
    companyCode?: string
    company_code?: string
    accountStatus?: string
    registrationDate?: unknown
    registration_date?: unknown
    programStartDate?: unknown
    program_start_date?: unknown
    lastActiveAt?: unknown
    last_active_at?: unknown
    lastActive?: unknown
    last_active?: unknown
    createdAt?: unknown
    created_at?: unknown
    role?: PartnerUser['role']
    totalPoints?: number
  }

  useEffect(() => {
    let isMounted = true

    const unsubscribe = onSnapshot(USERS_QUERY, async (snapshot) => {
      const seenUserIds = new Set<string>()
      const filteredDocs = snapshot.docs.filter((docSnap) => {
        if (seenUserIds.has(docSnap.id)) return false
        seenUserIds.add(docSnap.id)

        const data = docSnap.data() as FirestorePartnerUser
        const companyCode = (data.companyCode || data.company_code || '').toLowerCase()

        if (!isSuperAdmin && assignedSet.size && companyCode && !assignedSet.has(companyCode)) {
          return false
        }

        if (selectedOrg !== 'all' && selectedOrg && companyCode !== selectedOrg.toLowerCase()) {
          return false
        }

        return true
      })

      const userIds = filteredDocs.map((docSnap) => docSnap.id)
      const weeklyPoints = await fetchWeeklyPointsByUser(userIds)

      if (!isMounted) return

      const hydratedUsers: PartnerUser[] = filteredDocs.map((docSnap) => {
        const data = docSnap.data() as FirestorePartnerUser

        const companyCode = (data.companyCode || data.company_code || '').toLowerCase()
        const normalizedCreatedAt = normalizeTimestamp(data.createdAt || data.created_at)
        const normalizedRegistrationDate =
          normalizeTimestamp(
            data.registrationDate || data.registration_date || data.createdAt || data.created_at,
          ) || undefined
        const normalizedProgramStart =
          normalizeTimestamp(
            data.programStartDate || data.program_start_date || normalizedRegistrationDate,
          ) || normalizedRegistrationDate
        const normalizedLastActive =
          normalizeTimestamp(
            data.lastActiveAt ||
              data.last_active_at ||
              data.lastActive ||
              data.last_active ||
              normalizedRegistrationDate,
          ) || new Date().toISOString()
        const currentWeek = getProgramWeekNumber(normalizedProgramStart || undefined)
        const progress = mapWeeklyPointsToProgress(weeklyPoints[docSnap.id] || [], currentWeek)
        const riskResult = calculateUserRiskStatus(
          progress.current_week,
          progress.earned_points,
          progress.required_points,
        )

        const weeklyRequirement = progress.required_points[currentWeek] || 0
        const weeklyEarned = progress.earned_points[currentWeek] || 0
        const progressPercent = weeklyRequirement
          ? Math.min(100, Math.round((weeklyEarned / weeklyRequirement) * 100))
          : data.progressPercent || 0

        const riskStatus: PartnerRiskLevel | 'at_risk' =
          riskResult.status === 'at_risk'
            ? 'at_risk'
            : progressPercent >= 95
              ? 'engaged'
              : progressPercent >= 80
                ? 'watch'
                : progressPercent >= 60
                  ? 'concern'
                  : 'critical'

        return {
          id: docSnap.id,
          name: data.name || data.fullName || data.full_name || 'Unknown User',
          fullName: data.fullName || data.full_name || data.name,
          createdAt: normalizedCreatedAt || undefined,
          lastActiveAt: normalizeTimestamp(data.lastActiveAt || data.last_active_at) || undefined,
          programStartDate: normalizedProgramStart || undefined,
          email: data.email || '',
          companyCode,
          progressPercent,
          currentWeek,
          status: (data.accountStatus as PartnerUser['status']) || 'Active',
          lastActive: normalizedLastActive,
          riskStatus,
          weeklyEarned,
          weeklyRequired: weeklyRequirement,
          role: data.role,
          riskReasons: [
            ...(data.riskReasons || []),
            ...(riskResult.reason ? [riskResult.reason] : []),
          ].filter(Boolean),
          registrationDate: normalizedRegistrationDate || undefined,
          interventions: data.interventions || 0,
        }
      })

      setUsers(hydratedUsers)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [assignedSet, isSuperAdmin, selectedOrg])

  useEffect(() => {
    if (!profile?.id) return

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('user_id', '==', profile.id),
      where('is_read', '==', false),
    )

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      setNotificationCount(snapshot.size)
    })

    return () => unsubscribe()
  }, [profile?.id])

  useEffect(() => {
    if (!user?.uid) return

    const unsubscribe = onSnapshot(
      query(collection(db, 'interventions'), orderBy('opened_at', 'desc')),
      (snapshot) => {
        const scoped = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as Partial<PartnerInterventionSummary> & {
              partner_id?: string
              organization_code?: string
              opened_at?: string
            }

            return {
              id: docSnap.id,
              name: data.name || 'Intervention',
              target: data.target || 'Assigned learner',
              reason: data.reason || 'Intervention in progress',
              status: (data.status as PartnerInterventionSummary['status']) || 'active',
              deadline: data.deadline || data.opened_at || new Date().toISOString(),
              organizationCode: data.organizationCode || data.organization_code,
              userId: data.userId,
              partnerId: data.partner_id,
            }
          })
          .filter((item) => {
            const orgCode = item.organizationCode?.toLowerCase()
            if (!isSuperAdmin && item.partnerId && item.partnerId !== user.uid) return false
            if (!isSuperAdmin && assignedSet.size && orgCode && !assignedSet.has(orgCode)) return false
            if (selectedOrg !== 'all' && selectedOrg && orgCode && orgCode !== selectedOrg.toLowerCase()) return false
            return true
          })

        setInterventions(scoped)
      },
    )

    return () => unsubscribe()
  }, [assignedSet, isSuperAdmin, selectedOrg, user?.uid])

  const filteredUsers = useMemo(() => {
    if (selectedOrg === 'all') return users
    return users.filter((user) => user.companyCode === selectedOrg)
  }, [users, selectedOrg])

  const managedCompanies = organizations.length || assignedOrganizations.length

  const metrics = useMemo(() => {
    const activeWindow = subDays(new Date(), 30)
    const newWindow = subDays(new Date(), 7)

    const activeMembers = filteredUsers.filter((user) => new Date(user.lastActive) >= activeWindow).length
    const engagementRate = Math.round(
      filteredUsers.reduce((acc, user) => acc + user.progressPercent, 0) / Math.max(filteredUsers.length, 1),
    )
    const newRegistrations = filteredUsers.filter(
      (user) => user.registrationDate && new Date(user.registrationDate) >= newWindow,
    ).length
    const managed = managedCompanies

    return {
      activeMembers,
      engagementRate,
      newRegistrations,
      managedCompanies: managed,
      deltas: {
        activeMembers: `${activeMembers} active in 30d`,
        engagementRate: `${engagementRate}% avg progress`,
        newRegistrations: `${newRegistrations} in last 7d`,
        managedCompanies: `${managed} assigned`,
      },
    }
  }, [filteredUsers, managedCompanies])

  const engagementTrend = useMemo(() => {
    return build14DayRegistrationTrend(filteredUsers.map((user) => user.registrationDate))
  }, [filteredUsers])

  const riskLevels = useMemo(() => {
    const levelCounts: Record<PartnerRiskLevel, number> = {
      engaged: 0,
      watch: 0,
      concern: 0,
      critical: 0,
    }

    filteredUsers.forEach((user) => {
      if (user.riskStatus === 'at_risk') {
        levelCounts.concern += 1
      } else {
        levelCounts[user.riskStatus as PartnerRiskLevel] += 1
      }
    })

    return levelCounts
  }, [filteredUsers])

  const atRiskUsers = useMemo(() => {
    return filteredUsers.filter((user) => ['watch', 'concern', 'critical', 'at_risk'].includes(user.riskStatus))
  }, [filteredUsers])

  const assignedOrgCount = assignedOrganizations?.length || organizations.length

  const managedBreakdown = useMemo(() => {
    const active = organizations.filter((org) => org.status === 'active').length
    const inactive = organizations.length - active
    return { active, inactive }
  }, [organizations])

  const updateUserPoints = async (userId: string, delta: number, reason: string) => {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId
          ? {
              ...user,
              weeklyEarned: Math.max(0, user.weeklyEarned + delta),
              riskReasons: [...(user.riskReasons ?? []), `Adjustment: ${reason}`],
            }
          : user,
      ),
    )

    await addDoc(collection(db, 'users', userId, 'engagement_actions'), {
      action_type: 'manual_adjustment',
      action_label: reason,
      actor_id: profile?.id,
      actor_name: profile?.fullName,
      timestamp: serverTimestamp(),
      user_id: userId,
      delta,
    })
  }

  const dataQualityWarnings = useMemo(() => {
    const warnings = [] as { message: string; severity: 'warning' | 'error' }[]

    const missingAssignments = users.filter((user) => !user.companyCode).length
    if (missingAssignments) {
      warnings.push({
        message: `${missingAssignments} learner${missingAssignments === 1 ? '' : 's'} missing organization assignment`,
        severity: 'warning',
      })
    }

    const missingPoints = users.filter((user) => !user.weeklyRequired && !user.weeklyEarned).length
    if (missingPoints) {
      warnings.push({
        message: `${missingPoints} learner${missingPoints === 1 ? ' is' : 's are'} missing weekly points data`,
        severity: 'warning',
      })
    }

    return warnings
  }, [users])

  const daysUntil = (date: string) => differenceInDays(new Date(date), new Date())

  return {
    assignedOrgCount,
    assignedOrganizations: assignedOrganizations ?? [],
    atRiskUsers,
    dataQualityWarnings,
    engagementTrend,
    managedBreakdown,
    metrics,
    notificationCount,
    organizations,
    profile,
    riskLevels,
    selectedOrg,
    setSelectedOrg,
    updateUserPoints,
    users,
    interventions,
    daysUntil,
  }
}

export type PartnerDashboardData = ReturnType<typeof usePartnerDashboardData>
