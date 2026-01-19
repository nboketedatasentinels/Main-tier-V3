import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePartnerAdminSnapshot } from '@/hooks/partner/usePartnerAdminSnapshot'
import {
  checkOrganizationAccess,
  fetchAvailableCourses,
  fetchOrganizationByCode,
  fetchOrganizationEngagementStats,
  fetchOrganizationUsers,
  logOrganizationAccessAttempt,
} from '@/services/organizationService'
import { fetchUserProfileById } from '@/services/userProfileService'
import type {
  OrganizationAccountStatusFilter,
  OrganizationDetailView,
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

const pageSize = 50

export const useOrganizationDetails = (organizationId?: string) => {
  const { user, isAdmin, isSuperAdmin } = useAuth()
  const { assignedOrganizationIds, assignedOrganizationCodes } = usePartnerAdminSnapshot({
    enabled: isAdmin && !isSuperAdmin,
  })
  const [organization, setOrganization] = useState<OrganizationDetailView | null>(null)
  const [users, setUsers] = useState<OrganizationUserProfile[]>([])
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
      const orgRecord = await fetchOrganizationByCode(organizationId)
      if (!orgRecord) {
        setError('not_found')
        setLoading(false)
        return
      }

      const accessResult = await checkOrganizationAccess(user.uid, organizationId, orgRecord.code)
      const normalizedOrganizationId = organizationId.trim().toLowerCase()
      const normalizedAssignedCodes = assignedOrganizationCodes.map((code) => code.toLowerCase())
      const normalizedOrgCode = orgRecord.code?.trim().toLowerCase()
      const matchesAssignedOrg =
        assignedOrganizationIds.includes(organizationId) ||
        (orgRecord.id ? assignedOrganizationIds.includes(orgRecord.id) : false) ||
        (normalizedOrganizationId ? normalizedAssignedCodes.includes(normalizedOrganizationId) : false) ||
        (normalizedOrgCode ? normalizedAssignedCodes.includes(normalizedOrgCode) : false)

      if (!isSuperAdmin && !accessResult.authorized && !matchesAssignedOrg) {
        if (user?.uid) {
          void logOrganizationAccessAttempt({
            userId: user.uid,
            organizationId: orgRecord.id,
            organizationCode: orgRecord.code,
            reason: 'organization_details',
          })
        }
        setError('unauthorized')
        setLoading(false)
        return
      }

      const orgKey = orgRecord.id || organizationId
      const [userList, stats, mentorProfile, ambassadorProfile, partnerProfile] = await Promise.all([
        fetchOrganizationUsers(orgKey),
        fetchOrganizationEngagementStats(orgKey),
        orgRecord.assignedMentorId ? fetchUserProfileById(orgRecord.assignedMentorId) : Promise.resolve(null),
        orgRecord.assignedAmbassadorId ? fetchUserProfileById(orgRecord.assignedAmbassadorId) : Promise.resolve(null),
        orgRecord.transformationPartnerId ? fetchUserProfileById(orgRecord.transformationPartnerId) : Promise.resolve(null),
      ])

      const getDisplayName = (profile: typeof mentorProfile) => {
        if (!profile) return null
        const fullName = profile.fullName || `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
        return fullName || profile.email || null
      }

      let titleList: string[] = []
      if (orgRecord.courseAssignments?.length) {
        const courses = await fetchAvailableCourses()
        const courseMap = new Map(courses.map((course) => [course.id, course.title]))
        titleList = orgRecord.courseAssignments.map((courseId) => courseMap.get(courseId) || courseId)
      }

      setOrganization(
        buildDetailView({
          ...orgRecord,
          assignedMentorName: getDisplayName(mentorProfile),
          assignedMentorEmail: mentorProfile?.email ?? null,
          assignedAmbassadorName: getDisplayName(ambassadorProfile),
          assignedAmbassadorEmail: ambassadorProfile?.email ?? null,
          assignedPartnerName: getDisplayName(partnerProfile),
          assignedPartnerEmail: partnerProfile?.email ?? null,
        }),
      )
      setUsers(userList)
      setStatistics(stats)
      setCourseTitles(titleList)
    } catch (err) {
      console.error(err)
      setError('network')
    } finally {
      setLoading(false)
    }
  }, [
    assignedOrganizationCodes,
    assignedOrganizationIds,
    isAdmin,
    isSuperAdmin,
    organizationId,
    user?.uid,
  ])

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
