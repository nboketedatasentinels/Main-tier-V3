import { useMemo } from 'react'
import { subDays, differenceInDays } from 'date-fns'
import type { PartnerUser, PartnerRiskLevel, PartnerOrganization } from '@/hooks/partner/usePartnerAdminData'
import { build14DayRegistrationTrend } from '@/utils/partnerProgress'

interface UsePartnerMetricsOptions {
  users: PartnerUser[]
  organizations: PartnerOrganization[]
}

export const usePartnerMetrics = (options: UsePartnerMetricsOptions) => {
  const { users, organizations } = options

  const managedCompanies = organizations.length

  const metrics = useMemo(() => {
    const activeWindow = subDays(new Date(), 30)
    const newWindow = subDays(new Date(), 7)

    const activeMembers = users.filter(
      (user) => user.lastActive && new Date(user.lastActive) >= activeWindow
    ).length

    const engagementRate = Math.round(
      users.reduce((acc, user) => acc + user.progressPercent, 0) /
        Math.max(users.length, 1)
    )

    const newRegistrations = users.filter(
      (user) => user.registrationDate && new Date(user.registrationDate) >= newWindow
    ).length

    return {
      activeMembers,
      engagementRate,
      newRegistrations,
      managedCompanies,
      deltas: {
        activeMembers: `${activeMembers} active in 30d`,
        engagementRate: `${engagementRate}% avg progress`,
        newRegistrations: `${newRegistrations} in last 7d`,
        managedCompanies: `${managedCompanies} assigned`,
      },
    }
  }, [users, managedCompanies])

  const engagementTrend = useMemo(() => {
    return build14DayRegistrationTrend(users.map((user) => user.registrationDate))
  }, [users])

  const riskLevels = useMemo(() => {
    const levelCounts: Record<PartnerRiskLevel, number> = {
      engaged: 0,
      watch: 0,
      concern: 0,
      critical: 0,
    }

    users.forEach((user) => {
      if (user.riskStatus === 'at_risk') {
        levelCounts.concern += 1
      } else {
        levelCounts[user.riskStatus as PartnerRiskLevel] += 1
      }
    })

    return levelCounts
  }, [users])

  const atRiskUsers = useMemo(() => {
    // Only include truly at-risk users (concern, critical, at_risk)
    // 'watch' is a cautionary status, not truly at-risk
    return users.filter((user) =>
      ['concern', 'critical', 'at_risk'].includes(user.riskStatus)
    )
  }, [users])

  const managedBreakdown = useMemo(() => {
    const active = organizations.filter((org) => org.status === 'active').length
    const inactive = organizations.length - active
    return { active, inactive }
  }, [organizations])

  const daysUntil = (date: string) => differenceInDays(new Date(date), new Date())

  return {
    metrics,
    engagementTrend,
    riskLevels,
    atRiskUsers,
    managedBreakdown,
    daysUntil,
  }
}
