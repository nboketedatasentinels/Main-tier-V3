import { useEffect, useMemo, useState } from 'react'
import { addDays, differenceInDays, subDays } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'

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

interface UsePartnerDashboardDataOptions {
  selectedOrg?: string
}

export const usePartnerDashboardData = (options?: UsePartnerDashboardDataOptions) => {
  const { assignedOrganizations, profile } = useAuth()
  const [selectedOrg, setSelectedOrg] = useState<string>(options?.selectedOrg || 'all')
  const [users, setUsers] = useState<PartnerUser[]>([])
  const [organizations, setOrganizations] = useState<PartnerOrganization[]>([])
  const [notificationCount, setNotificationCount] = useState<number>(3)

  const scopedOrganizations = useMemo(() => {
    const orgs: PartnerOrganization[] = [
      { code: 'northwind', name: 'Northwind Holdings', status: 'active', activeUsers: 94, newThisWeek: 6 },
      { code: 'contoso', name: 'Contoso Labs', status: 'watch', activeUsers: 71, newThisWeek: 2 },
      { code: 'adventure', name: 'Adventure Works', status: 'active', activeUsers: 58, newThisWeek: 1 },
    ]

    if (!assignedOrganizations?.length) return orgs

    return orgs.filter(org => assignedOrganizations.map(code => code.toLowerCase()).includes(org.code))
  }, [assignedOrganizations])

  useEffect(() => {
    setOrganizations(scopedOrganizations)
  }, [scopedOrganizations])

  useEffect(() => {
    const now = new Date()
    const sampleUsers: PartnerUser[] = [
      {
        id: 'u1',
        name: 'Leah Kim',
        email: 'leah.kim@example.com',
        companyCode: 'northwind',
        progressPercent: 88,
        currentWeek: 5,
        status: 'Active',
        lastActive: subDays(now, 3).toISOString(),
        riskStatus: 'engaged',
        weeklyEarned: 42,
        weeklyRequired: 50,
        role: 'learner',
        riskReasons: ['Consistent check-ins'],
        registrationDate: subDays(now, 14).toISOString(),
        interventions: 1,
      },
      {
        id: 'u2',
        name: 'Derrick Shaw',
        email: 'derrick.shaw@example.com',
        companyCode: 'northwind',
        progressPercent: 61,
        currentWeek: 5,
        status: 'Active',
        lastActive: subDays(now, 8).toISOString(),
        riskStatus: 'watch',
        weeklyEarned: 31,
        weeklyRequired: 45,
        role: 'learner',
        riskReasons: ['Drop in activity'],
        registrationDate: subDays(now, 9).toISOString(),
        interventions: 2,
      },
      {
        id: 'u3',
        name: 'Mei Lin',
        email: 'mei.lin@example.com',
        companyCode: 'contoso',
        progressPercent: 33,
        currentWeek: 5,
        status: 'Paused',
        lastActive: subDays(now, 15).toISOString(),
        riskStatus: 'concern',
        weeklyEarned: 18,
        weeklyRequired: 45,
        role: 'learner',
        riskReasons: ['Inactivity 14+ days', 'Low engagement score'],
        registrationDate: subDays(now, 40).toISOString(),
        interventions: 3,
      },
      {
        id: 'u4',
        name: 'Ravi Patel',
        email: 'ravi.patel@example.com',
        companyCode: 'contoso',
        progressPercent: 74,
        currentWeek: 5,
        status: 'Active',
        lastActive: subDays(now, 2).toISOString(),
        riskStatus: 'engaged',
        weeklyEarned: 52,
        weeklyRequired: 50,
        role: 'mentor',
        riskReasons: ['Mentor responses trending down'],
        registrationDate: subDays(now, 25).toISOString(),
        interventions: 0,
      },
    ]

    setUsers(sampleUsers)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setNotificationCount(prev => (prev % 5) + 1)
    }, 12000)
    return () => clearInterval(interval)
  }, [])

  const filteredUsers = useMemo(() => {
    if (selectedOrg === 'all') return users
    return users.filter(user => user.companyCode === selectedOrg)
  }, [users, selectedOrg])

  const managedCompanies = organizations.length || scopedOrganizations.length

  const metrics = useMemo(() => {
    const activeWindow = subDays(new Date(), 30)
    const newWindow = subDays(new Date(), 7)

    const activeMembers = filteredUsers.filter(user => new Date(user.lastActive) >= activeWindow).length
    const engagementRate = Math.round(
      filteredUsers.reduce((acc, user) => acc + user.progressPercent, 0) / Math.max(filteredUsers.length, 1)
    )
    const newRegistrations = filteredUsers.filter(user => user.registrationDate && new Date(user.registrationDate) >= newWindow).length
    const managed = managedCompanies

    return {
      activeMembers,
      engagementRate,
      newRegistrations,
      managedCompanies: managed,
      deltas: {
        activeMembers: '+4.2% WoW',
        engagementRate: '+2.4% WoW',
        newRegistrations: '+12 vs prior 7d',
        managedCompanies: `${managed} assigned`,
      },
    }
  }, [filteredUsers, managedCompanies])

  const engagementTrend = useMemo(() => {
    const base = subDays(new Date(), 13)
    return Array.from({ length: 14 }).map((_, idx) => {
      const date = addDays(base, idx)
      const label = `${date.getMonth() + 1}/${date.getDate()}`
      const value = 10 + (idx % 5) * 3 + (selectedOrg === 'all' ? 4 : 2)
      return { label, value }
    })
  }, [selectedOrg])

  const riskLevels = useMemo(() => {
    const levelCounts: Record<PartnerRiskLevel, number> = {
      engaged: 0,
      watch: 0,
      concern: 0,
      critical: 0,
    }

    filteredUsers.forEach(user => {
      if (user.riskStatus === 'at_risk') {
        levelCounts.concern += 1
      } else {
        levelCounts[user.riskStatus as PartnerRiskLevel] += 1
      }
    })

    return levelCounts
  }, [filteredUsers])

  const atRiskUsers = useMemo(() => {
    return filteredUsers.filter(user => ['watch', 'concern', 'critical', 'at_risk'].includes(user.riskStatus))
  }, [filteredUsers])

  const assignedOrgCount = assignedOrganizations?.length || organizations.length

  const managedBreakdown = useMemo(() => {
    const active = organizations.filter(org => org.status === 'active').length
    const inactive = organizations.length - active
    return { active, inactive }
  }, [organizations])

  const updateUserPoints = (userId: string, delta: number, reason: string) => {
    setUsers(prev =>
      prev.map(user =>
        user.id === userId
          ? {
              ...user,
              weeklyEarned: Math.max(0, user.weeklyEarned + delta),
              riskReasons: [...(user.riskReasons ?? []), `Adjustment: ${reason}`],
            }
          : user,
      ),
    )
  }

  const getUserRiskStatus = (user: PartnerUser) => {
    const weekProgress = user.weeklyEarned / Math.max(user.weeklyRequired, 1)
    if (weekProgress >= 0.95) return { status: 'engaged' as PartnerRiskLevel, deficit: 0 }
    if (weekProgress >= 0.8) return { status: 'watch' as PartnerRiskLevel, deficit: 0 }
    if (weekProgress >= 0.6) return { status: 'concern' as PartnerRiskLevel, deficit: Math.max(0, user.weeklyRequired - user.weeklyEarned) }
    return { status: 'critical' as PartnerRiskLevel, deficit: Math.max(0, user.weeklyRequired - user.weeklyEarned) }
  }

  const dataQualityWarnings = useMemo(() => {
    const missingAssignments = users.filter(user => !user.companyCode).length
    if (!missingAssignments) return []
    return [
      {
        message: `${missingAssignments} learner${missingAssignments === 1 ? '' : 's'} missing organization assignment`,
        severity: 'warning' as const,
      },
    ]
  }, [users])

  const daysUntil = (date: string) => differenceInDays(new Date(date), new Date())

  const interventions = useMemo(
    () => [
      {
        id: 'i1',
        name: 'Active intervention',
        target: '6 learners',
        reason: 'Low weekly activity',
        status: 'watch' as const,
        deadline: addDays(new Date(), 2).toISOString(),
      },
      {
        id: 'i2',
        name: 'Mentor follow-up',
        target: '3 mentors',
        reason: 'Pending acknowledgement',
        status: 'active' as const,
        deadline: addDays(new Date(), 5).toISOString(),
      },
      {
        id: 'i3',
        name: 'Escalations',
        target: '2 accounts',
        reason: 'Overdue > 7 days',
        status: 'critical' as const,
        deadline: addDays(new Date(), -1).toISOString(),
      },
    ],
    [],
  )

  return {
    assignedOrgCount,
    assignedOrganizations: assignedOrganizations ?? [],
    atRiskUsers,
    dataQualityWarnings,
    engagementTrend,
    getUserRiskStatus,
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
