import { useEffect, useMemo, useRef, useState } from 'react'
import { differenceInDays, subDays } from 'date-fns'
import type { DataWarning } from '@/components/admin/RiskAnalysisCard'
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
import { listenToAssignedOrganizations, logOrganizationAccessAttempt } from '@/services/organizationService'
import { listenToOrganizationStatsUpdates, updateOrganizationStatisticsBatch } from '@/services/organizationStatsService'
import type { OrganizationRecord } from '@/types/admin'
import {
  build14DayRegistrationTrend,
  calculateUserRiskStatus,
  getProgramWeekNumber,
  mapWeeklyPointsToProgress,
  WeeklyPointsRecord,
} from '@/utils/partnerProgress'

export type PartnerRiskLevel = 'engaged' | 'watch' | 'concern' | 'critical'

export interface PartnerOrganization {
  id?: string
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
  organizationId?: string
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
  const lastAccessAttempt = useRef<string | null>(null)

  const organizationLookup = useMemo(() => {
    const mapping = new Map<string, string>()
    organizations.forEach((org) => {
      if (org.id && org.code) {
        mapping.set(org.id.toLowerCase(), org.code.toLowerCase())
        mapping.set(org.code.toLowerCase(), org.id.toLowerCase())
      } else if (org.id) {
        mapping.set(org.id.toLowerCase(), org.id.toLowerCase())
      } else if (org.code) {
        mapping.set(org.code.toLowerCase(), org.code.toLowerCase())
      }
    })
    return mapping
  }, [organizations])

  const assignedOrgKeys = useMemo(() => {
    const keys = new Set<string>()
    assignedOrganizations.forEach((org) => keys.add(org.toLowerCase()))
    organizations.forEach((org) => {
      if (org.id) keys.add(org.id.toLowerCase())
      if (org.code) keys.add(org.code.toLowerCase())
    })
    return keys
  }, [assignedOrganizations, organizations])

  const selectedOrgKeys = useMemo(() => {
    if (!selectedOrg || selectedOrg === 'all') return new Set<string>()
    const selected = selectedOrg.toLowerCase()
    const keys = new Set<string>([selected])
    const mapped = organizationLookup.get(selected)
    if (mapped) keys.add(mapped)
    return keys
  }, [organizationLookup, selectedOrg])

  useEffect(() => {
    if (!user?.uid) return
    if (!isSuperAdmin && !assignedOrganizations.length) {
      setOrganizations([])
      return
    }

    if (isSuperAdmin) {
      const unsubscribe = onSnapshot(
        query(collection(db, 'organizations'), where('status', '==', 'active')),
        (snapshot) => {
          const scoped = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Partial<PartnerOrganization>
            return {
              id: docSnap.id,
              code: data.code || docSnap.id,
              name: data.name || docSnap.id,
              status: (data.status as PartnerOrganization['status']) || 'active',
              activeUsers: data.activeUsers ?? 0,
              newThisWeek: data.newThisWeek ?? 0,
              lastActive: data.lastActive,
              tags: data.tags || [],
            }
          })
          setOrganizations(scoped)
        },
      )

      return () => unsubscribe()
    }

    const unsubscribe = listenToAssignedOrganizations(
      user.uid,
      (assignedOrgs) => {
        const scoped = assignedOrgs.map((org) => {
          const data = org as OrganizationRecord & Partial<PartnerOrganization>
          return {
            id: data.id,
            code: data.code || data.id || '',
            name: data.name || data.code || data.id || 'Unknown organization',
            status: (data.status as PartnerOrganization['status']) || 'active',
            activeUsers: data.activeUsers ?? 0,
            newThisWeek: data.newThisWeek ?? 0,
            lastActive: data.lastActive,
            tags: data.tags || [],
          }
        })
        setOrganizations(scoped)
      },
      { status: 'active' },
    )

    return () => unsubscribe()
  }, [assignedOrganizations, isSuperAdmin, user?.uid])

  useEffect(() => {
    if (!organizations.length) return undefined
    let isMounted = true

    const updateStats = async () => {
      try {
        await updateOrganizationStatisticsBatch(organizations)
      } catch (error) {
        console.error('Failed to update organization statistics', error)
      }
    }

    void updateStats()

    const unsubscribers = organizations.map((org) =>
      listenToOrganizationStatsUpdates(
        { id: org.id, code: org.code },
        {
          onError: (error) => {
            if (!isMounted) return
            console.error('Failed to refresh organization stats', error)
          },
        },
      ),
    )

    return () => {
      isMounted = false
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [organizations])

  useEffect(() => {
    if (isSuperAdmin || selectedOrg === 'all') return
    const selected = selectedOrg.toLowerCase()
    const hasAccess =
      assignedOrgKeys.size > 0 && Array.from(selectedOrgKeys).some((key) => assignedOrgKeys.has(key))
    if (hasAccess) return
    if (!user?.uid || lastAccessAttempt.current === selectedOrg) return

    lastAccessAttempt.current = selectedOrg
    void logOrganizationAccessAttempt({
      userId: user.uid,
      organizationCode: selectedOrg,
      reason: 'partner_dashboard_selection',
    })
  }, [assignedOrgKeys, isSuperAdmin, selectedOrg, selectedOrgKeys, user?.uid])

  useEffect(() => {
    if (selectedOrg === 'all') return
    const selected = selectedOrg.toLowerCase()
    const stillValid = organizations.some(
      (org) => org.code.toLowerCase() === selected || org.id?.toLowerCase() === selected,
    )
    if (!stillValid) {
      setSelectedOrg('all')
    }
  }, [organizations, selectedOrg])

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
    companyId?: string
    organizationId?: string
    lastActiveAt?: unknown
    last_active_at?: unknown
    lastActive?: unknown
    last_active?: unknown
    createdAt?: unknown
    created_at?: unknown
    role?: PartnerUser['role']
    totalPoints?: number
    nudgeResponseScore?: number
  }

  useEffect(() => {
    let isMounted = true

    const unsubscribe = onSnapshot(USERS_QUERY, async (snapshot) => {
      const seenUserIds = new Set<string>()
      const filteredDocs = snapshot.docs.filter((docSnap) => {
        if (seenUserIds.has(docSnap.id)) return false
        seenUserIds.add(docSnap.id)

        const data = docSnap.data() as FirestorePartnerUser
        const userOrgKeys = [
          data.companyCode,
          data.company_code,
          data.companyId,
          data.organizationId,
        ]
          .filter((value): value is string => !!value)
          .map((value) => value.toLowerCase())

        if (!isSuperAdmin && (!assignedOrgKeys.size || !userOrgKeys.some((key) => assignedOrgKeys.has(key)))) {
          return false
        }

        if (selectedOrg !== 'all' && selectedOrg && !userOrgKeys.some((key) => selectedOrgKeys.has(key))) {
          return false
        }

        return true
      })

      const userIds = filteredDocs.map((docSnap) => docSnap.id)
      const weeklyPoints = await fetchWeeklyPointsByUser(userIds)

      if (!isMounted) return

      const hydratedUsers: PartnerUser[] = filteredDocs.map((docSnap) => {
        const data = docSnap.data() as FirestorePartnerUser

        const rawCompanyCode = data.companyCode || data.company_code || ''
        const rawOrganizationId = data.companyId || data.organizationId || ''
        const companyCode =
          rawCompanyCode.trim().length > 0
            ? rawCompanyCode.toLowerCase()
            : rawOrganizationId
              ? organizationLookup.get(rawOrganizationId.toLowerCase()) || rawOrganizationId.toLowerCase()
              : ''
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
          data.nudgeResponseScore,
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
          organizationId: rawOrganizationId ? rawOrganizationId.toLowerCase() : undefined,
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
            data.nudgeResponseScore && data.nudgeResponseScore >= 0.7
              ? 'Responds well to nudges'
              : undefined,
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
  }, [assignedOrgKeys, isSuperAdmin, organizationLookup, selectedOrg, selectedOrgKeys])

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
            if (
              !isSuperAdmin &&
              (!assignedOrgKeys.size || (orgCode && !assignedOrgKeys.has(orgCode)))
            )
              return false
            if (selectedOrg !== 'all' && selectedOrg && orgCode && !selectedOrgKeys.has(orgCode)) return false
            return true
          })

        setInterventions(scoped)
      },
    )

    return () => unsubscribe()
  }, [assignedOrgKeys, isSuperAdmin, selectedOrg, selectedOrgKeys, user?.uid])

  const filteredUsers = useMemo(() => {
    if (selectedOrg === 'all') return users
    return users.filter((user) => {
      const userKeys = [user.companyCode, user.organizationId].filter(Boolean).map((value) => value.toLowerCase())
      return userKeys.some((key) => selectedOrgKeys.has(key))
    })
  }, [selectedOrg, selectedOrgKeys, users])

  const managedCompanies = isSuperAdmin ? organizations.length : assignedOrganizations.length

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

  const assignedOrgCount = isSuperAdmin ? organizations.length : assignedOrganizations?.length || 0

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
      actor_id: profile?.id ?? null,
      actor_name: profile?.fullName ?? null,
      timestamp: serverTimestamp(),
      user_id: userId,
      delta,
    })
  }

  const dataQualityWarnings = useMemo(() => {
    const warnings = [] as DataWarning[]

    if (!isSuperAdmin && !assignedOrganizations.length) {
      warnings.push({
        message: 'No organizations are assigned to this account yet.',
        severity: 'warning',
      })
    }

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
  }, [assignedOrganizations, isSuperAdmin, users])

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
