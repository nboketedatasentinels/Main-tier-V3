import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { fetchAvailableCourses } from '@/services/organizationService'
import { fetchOrganizations, fetchOrganizationMembers } from '@/services/supabaseSuperAdminService'
import type { OrgMemberRecord } from '@/services/supabaseSuperAdminService'
import { normalizeEmail } from '@/utils/email'
import type {
  AdminRole,
  OrganizationAccountStatusFilter,
  OrganizationDetailView,
  OrganizationInvitationProfile,
  OrganizationMembershipFilter,
  OrganizationStatistics,
  OrganizationUserProfile,
  OrganizationUserRoleFilter,
  OrganizationUserSortDirection,
  OrganizationUserSortKey,
} from '@/types/admin'

export type OrganizationDetailsError = 'invalid' | 'not_found' | 'unauthorized' | 'network'

const normalizeDate = (value?: string | Date | { toDate?: () => Date }) => {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  if ('toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  return ''
}

const buildDetailView = (organization: {
  id?: string
  name?: string
  code?: string
  status?: string
  teamSize?: number
  village?: string
  cluster?: string
  programStart?: string
  programEnd?: string
  cohortStartDate?: string | Date | { toDate?: () => Date }
  programDuration?: number
  description?: string
  createdAt?: string | Date | { toDate?: () => Date }
  updatedAt?: string | Date | { toDate?: () => Date }
  transformationPartnerId?: string | null
  leadershipUpdatedAt?: string | Date | { toDate?: () => Date }
  leadershipUpdatedBy?: string
  assignedMentorId?: string | null
  assignedAmbassadorId?: string | null
  assignedMentorName?: string | null
  assignedMentorEmail?: string | null
  assignedAmbassadorName?: string | null
  assignedAmbassadorEmail?: string | null
  assignedPartnerName?: string | null
  assignedPartnerEmail?: string | null
  courseAssignments?: string[]
}): OrganizationDetailView => ({
  id: organization.id || '',
  name: organization.name || 'Unknown organization',
  code: organization.code || 'N/A',
  status: (organization.status || 'inactive') as OrganizationDetailView['status'],
  teamSize: organization.teamSize,
  village: organization.village,
  cluster: organization.cluster,
  programStart: organization.programStart,
  programEnd: organization.programEnd,
  cohortStartDate: normalizeDate(organization.cohortStartDate as string | Date | undefined),
  programDuration: organization.programDuration,
  description: organization.description,
  transformationPartnerId: organization.transformationPartnerId ?? null,
  leadershipUpdatedAt: normalizeDate(organization.leadershipUpdatedAt as string | Date | undefined),
  leadershipUpdatedBy: organization.leadershipUpdatedBy,
  assignedMentorId: organization.assignedMentorId ?? null,
  assignedAmbassadorId: organization.assignedAmbassadorId ?? null,
  assignedMentorName: organization.assignedMentorName ?? null,
  assignedMentorEmail: organization.assignedMentorEmail ?? null,
  assignedAmbassadorName: organization.assignedAmbassadorName ?? null,
  assignedAmbassadorEmail: organization.assignedAmbassadorEmail ?? null,
  assignedPartnerName: organization.assignedPartnerName ?? null,
  assignedPartnerEmail: organization.assignedPartnerEmail ?? null,
  createdAt: normalizeDate(organization.createdAt as string | Date | undefined),
  updatedAt: normalizeDate(organization.updatedAt as string | Date | undefined),
  courseAssignments: organization.courseAssignments || [],
})

const toProfileRole = (role?: string | null): AdminRole | 'user' => {
  const r = (role || '').toLowerCase()
  if (r === 'super_admin' || r === 'partner' || r === 'mentor' || r === 'ambassador') {
    return r as AdminRole
  }
  return 'user'
}

const toMembershipStatus = (member: OrgMemberRecord): 'free' | 'paid' | 'inactive' => {
  const status = (member.membershipStatus || '').toLowerCase()
  if (status === 'paid' || status === 'inactive') return status
  const role = (member.role || '').toLowerCase()
  if (['paid_member', 'partner', 'mentor', 'ambassador', 'super_admin'].includes(role)) return 'paid'
  return 'free'
}

const mapMemberToProfile = (
  member: OrgMemberRecord,
  orgId: string,
  orgCode?: string | null,
): OrganizationUserProfile => ({
  id: member.id,
  name: member.name,
  email: member.email,
  role: toProfileRole(member.role),
  membershipStatus: toMembershipStatus(member),
  accountStatus: 'active',
  lastActive: member.lastActiveAt ? new Date(member.lastActiveAt) : null,
  points: member.totalPoints ?? 0,
  createdAt: member.createdAt ? new Date(member.createdAt) : null,
  avatarUrl: null,
  organizationId: orgId,
  companyCode: orgCode ?? null,
})

const pageSize = 50

export const useOrganizationDetails = (organizationId?: string) => {
  const { user, isAdmin } = useAuth()
  const [organization, setOrganization] = useState<OrganizationDetailView | null>(null)
  const [users, setUsers] = useState<OrganizationUserProfile[]>([])
  const [invitationRecords, setInvitationRecords] = useState<OrganizationInvitationProfile[]>([])
  const [statistics, setStatistics] = useState<OrganizationStatistics | null>(null)
  const [courseTitles, setCourseTitles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<OrganizationDetailsError | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<OrganizationUserRoleFilter>('all')
  const [membershipFilter, setMembershipFilter] = useState<OrganizationMembershipFilter>('all')
  const [accountStatusFilter, setAccountStatusFilter] = useState<OrganizationAccountStatusFilter>('all')
  const [sortKey, setSortKey] = useState<OrganizationUserSortKey>('name')
  const [sortDirection, setSortDirection] = useState<OrganizationUserSortDirection>('asc')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const loadDetails = useCallback(async () => {
    if (!organizationId || !organizationId.trim()) {
      setError('invalid')
      setLoading(false)
      return
    }
    if (!user?.uid || !isAdmin) {
      setError('unauthorized')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      // Resolve the org from Supabase (the route param is the org code, id as
      // fallback). Firestore is no longer readable under Supabase auth.
      const orgs = await fetchOrganizations()
      const key = organizationId.trim()
      const keyLower = key.toLowerCase()
      const orgRecord =
        orgs.find((o) => o.id === key) ||
        orgs.find((o) => (o.code || '').toLowerCase() === keyLower) ||
        null
      if (!orgRecord) {
        setError('not_found')
        setLoading(false)
        return
      }

      const orgKey = orgRecord.id || key

      // Members (learners + leadership) linked to the org in Supabase profiles.
      const memberRecords = await fetchOrganizationMembers({ id: orgRecord.id, code: orgRecord.code })
      const userList = memberRecords.map((m) => mapMemberToProfile(m, orgKey, orgRecord.code))

      const partnerMember = memberRecords.find((m) => (m.role || '').toLowerCase() === 'partner') ?? null
      const mentorMember = memberRecords.find((m) => (m.role || '').toLowerCase() === 'mentor') ?? null
      const ambassadorMember = memberRecords.find((m) => (m.role || '').toLowerCase() === 'ambassador') ?? null

      // Course titles from the org's assignments (mapping-driven catalog).
      let titleList: string[] = []
      const courseIds = orgRecord.courseAssignments?.filter(Boolean) ?? []
      if (courseIds.length) {
        try {
          const courses = await fetchAvailableCourses()
          const courseMap = new Map(courses.map((course) => [course.id, course.title]))
          titleList = courseIds.map((courseId) => courseMap.get(courseId) || courseId)
        } catch {
          titleList = courseIds
        }
      }

      const now = Date.now()
      const weekMs = 7 * 24 * 60 * 60 * 1000
      const stats: OrganizationStatistics = {
        totalMembers: userList.length,
        activeMembers: userList.filter((u) => u.accountStatus === 'active').length,
        paidMembers: userList.filter((u) => u.membershipStatus === 'paid').length,
        newMembersThisWeek: userList.filter((u) => u.createdAt && now - u.createdAt.getTime() <= weekMs).length,
        averageEngagementRate: 0,
      }

      setOrganization(
        buildDetailView({
          ...orgRecord,
          assignedMentorId: mentorMember?.id ?? null,
          assignedAmbassadorId: ambassadorMember?.id ?? null,
          transformationPartnerId: partnerMember?.id ?? orgRecord.transformationPartnerId ?? null,
          assignedMentorName: mentorMember?.name ?? null,
          assignedMentorEmail: mentorMember?.email ?? null,
          assignedAmbassadorName: ambassadorMember?.name ?? null,
          assignedAmbassadorEmail: ambassadorMember?.email ?? null,
          assignedPartnerName: partnerMember?.name ?? null,
          assignedPartnerEmail: partnerMember?.email ?? orgRecord.assignedPartnerEmail ?? null,
        }),
      )
      setUsers(userList)
      setInvitationRecords([])
      setStatistics(stats)
      setCourseTitles(titleList)
    } catch (err) {
      console.error(err)
      setError('network')
    } finally {
      setLoading(false)
    }
  }, [isAdmin, organizationId, user?.uid])

  useEffect(() => {
    loadDetails()
  }, [loadDetails])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, roleFilter, membershipFilter, accountStatusFilter])

  const filteredUsers = useMemo(() => {
    const query = debouncedSearch.toLowerCase()
    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.name.toLowerCase().includes(query) ||
        (user.email || '').toLowerCase().includes(query)
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesMembership = membershipFilter === 'all' || user.membershipStatus === membershipFilter
      const matchesAccount = accountStatusFilter === 'all' || user.accountStatus === accountStatusFilter
      return matchesSearch && matchesRole && matchesMembership && matchesAccount
    })
  }, [accountStatusFilter, debouncedSearch, membershipFilter, roleFilter, users])

  const invitations = useMemo(() => {
    if (!invitationRecords.length) return []

    const existingMemberEmails = new Set(
      users
        .map((member) => normalizeEmail(member.email || ''))
        .filter((email) => email.length > 0),
    )
    if (!existingMemberEmails.size) return invitationRecords

    return invitationRecords.filter((invite) => {
      if (invite.method !== 'email') return true
      const email = normalizeEmail(invite.email || '')
      if (!email) return true
      return !existingMemberEmails.has(email)
    })
  }, [invitationRecords, users])

  const sortedUsers = useMemo(() => {
    const sorted = [...filteredUsers]
    sorted.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1
      const valueA = a[sortKey]
      const valueB = b[sortKey]
      if (valueA instanceof Date || valueB instanceof Date) {
        const timeA = valueA instanceof Date ? valueA.getTime() : 0
        const timeB = valueB instanceof Date ? valueB.getTime() : 0
        return timeA > timeB ? direction : timeA < timeB ? -direction : 0
      }
      if (typeof valueA === 'number' || typeof valueB === 'number') {
        const numA = typeof valueA === 'number' ? valueA : 0
        const numB = typeof valueB === 'number' ? valueB : 0
        return numA > numB ? direction : numA < numB ? -direction : 0
      }
      const safeA = (valueA || '').toString().toLowerCase()
      const safeB = (valueB || '').toString().toLowerCase()
      if (safeA === safeB) return 0
      return safeA > safeB ? direction : -direction
    })
    return sorted
  }, [filteredUsers, sortDirection, sortKey])

  const totalCount = users.length
  const filteredCount = filteredUsers.length
  const pageCount = Math.max(1, Math.ceil(filteredCount / pageSize))
  const currentPage = Math.min(page, pageCount)
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedUsers.slice(start, start + pageSize)
  }, [currentPage, sortedUsers])

  const handleSort = (key: OrganizationUserSortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDirection((prevDirection) => (prevDirection === 'asc' ? 'desc' : 'asc'))
        return prevKey
      }
      setSortDirection('asc')
      return key
    })
  }

  const activeFilters = useMemo(() => {
    const filters: Array<{ label: string; value: string }> = []
    if (roleFilter !== 'all') filters.push({ label: 'Role', value: roleFilter })
    if (membershipFilter !== 'all') filters.push({ label: 'Membership', value: membershipFilter })
    if (accountStatusFilter !== 'all') filters.push({ label: 'Account', value: accountStatusFilter })
    return filters
  }, [accountStatusFilter, membershipFilter, roleFilter])

  const clearFilters = () => {
    setRoleFilter('all')
    setMembershipFilter('all')
    setAccountStatusFilter('all')
  }

  return {
    organization,
    users,
    invitations,
    statistics,
    courseTitles,
    loading,
    error,
    reload: loadDetails,
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    roleFilter,
    setRoleFilter,
    membershipFilter,
    setMembershipFilter,
    accountStatusFilter,
    setAccountStatusFilter,
    sortKey,
    sortDirection,
    handleSort,
    page: currentPage,
    setPage,
    pageCount,
    pageSize,
    paginatedUsers,
    totalCount,
    filteredCount,
    activeFilters,
    clearFilters,
  }
}
