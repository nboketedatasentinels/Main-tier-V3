import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  Checkbox,
  Divider,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  Tooltip,
  useToast,
} from '@chakra-ui/react'
import { ChevronLeft, ChevronRight, Eye, Filter, Search, Trash2 } from 'lucide-react'
import { Link as RouterLink } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { usePartnerAdminSnapshot } from '@/hooks/partner/usePartnerAdminSnapshot'
import {
  ManagedUserRecord,
  ManagedUserRole,
  MembershipStatus,
  bulkUpdateMembershipStatus,
  bulkUpdateRole,
  deleteUserAccount,
  updateUserAccessWithAudit,
} from '@/services/userManagementService'
import { CreateOrganizationModal } from '@/components/super-admin/CreateOrganizationModal'
import { OrganizationAssignmentsPicker } from '@/components/super-admin/OrganizationAssignmentsPicker'
import { fetchAdminOrganizationsList } from '@/services/admin/adminUsersService'
import { formatAdminFirestoreError } from '@/services/admin/adminErrors'
import { assignOrganizations as assignAdminOrganizations } from '@/services/superAdminService'
import { OrganizationRecord } from '@/types/admin'
import { AccountStatus, TransformationTier } from '@/types'

const roleOptions: ManagedUserRole[] = ['user', 'partner', 'super_admin', 'mentor', 'ambassador']
const roleDescriptions: Record<ManagedUserRole, string> = {
  user: 'Standard learner access.',
  partner: 'Organization admin with multi-organization scope.',
  admin: 'Legacy admin role alias.',
  super_admin: 'Platform-wide administrative access.',
  team_leader: 'Legacy team leadership role.',
  mentor: 'Mentor access with organization assignments.',
  ambassador: 'Ambassador access with organization assignments.',
}
const multiOrganizationRoles = new Set<ManagedUserRole>(['partner', 'mentor', 'ambassador'])
const membershipOptions: MembershipStatus[] = ['free', 'paid', 'inactive']
const membershipLabels: Record<MembershipStatus, string> = {
  free: 'Free membership',
  paid: 'Paid membership',
  inactive: 'Inactive membership',
}
const accountStatusOptions: string[] = [
  AccountStatus.ACTIVE,
  AccountStatus.PENDING,
  AccountStatus.INACTIVE,
  AccountStatus.SUSPENDED,
]
const accountStatusLabels: Record<string, string> = {
  active: 'Active',
  pending: 'Pending',
  inactive: 'Inactive',
  suspended: 'Suspended',
}
const transformationTierOptions: string[] = [
  TransformationTier.INDIVIDUAL_FREE,
  TransformationTier.INDIVIDUAL_PAID,
  TransformationTier.CORPORATE_MEMBER,
  TransformationTier.CORPORATE_LEADER,
]
const transformationTierLabels: Record<string, string> = {
  [TransformationTier.INDIVIDUAL_FREE]: 'Individual Free',
  [TransformationTier.INDIVIDUAL_PAID]: 'Individual Paid',
  [TransformationTier.CORPORATE_MEMBER]: 'Corporate Member',
  [TransformationTier.CORPORATE_LEADER]: 'Corporate Leader',
}
const PAGE_SIZE = 25

type PromotionChange = {
  label: string
  before: string
  after: string
}

const formatDate = (date?: Date | null) => {
  if (!date) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

const formatDateTime = (date?: Date | null) => {
  if (!date) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

const normalizeValue = (value?: string | null) => value?.toString().trim().toLowerCase() || ''

const formatTokenLabel = (value?: string | null) => {
  const normalized = normalizeValue(value)
  if (!normalized) return 'Unknown'
  return normalized
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const formatRoleLabel = (role?: ManagedUserRole | string, membershipStatus?: MembershipStatus) => {
  if (!role) return 'Unknown'
  if (role === 'user') {
    if (membershipStatus === 'paid') return 'Paid Member'
    if (membershipStatus === 'inactive') return 'Inactive Member'
    return 'User'
  }
  return formatTokenLabel(role)
}

const formatMembershipLabel = (status?: MembershipStatus | string | null) => {
  if (!status) return 'Unknown'
  return membershipLabels[status as MembershipStatus] || formatTokenLabel(status)
}

const formatAccountStatusLabel = (status?: string | null) => {
  const normalized = normalizeValue(status) || 'active'
  return accountStatusLabels[normalized] || formatTokenLabel(normalized)
}

const formatTierLabel = (tier?: string | null) => {
  const normalized = normalizeValue(tier)
  if (!normalized) return 'Not set'
  return transformationTierLabels[normalized] || formatTokenLabel(normalized)
}

interface UsersManagementTabProps {
  users: ManagedUserRecord[]
  loading: boolean
}

export const UsersManagementTab = ({ users: propUsers, loading: propLoading }: UsersManagementTabProps) => {
  const toast = useToast()
  const { isAdmin, isSuperAdmin, profile } = useAuth()
  const adminDisplayName =
    profile?.fullName || [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() || undefined
  const adminId = profile?.id
  const { assignedOrganizationIds } = usePartnerAdminSnapshot({ enabled: isAdmin && !isSuperAdmin })
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string; code?: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null)
  const [promotionModalOpen, setPromotionModalOpen] = useState(false)
  const [promotionTarget, setPromotionTarget] = useState<ManagedUserRecord | null>(null)
  const [promotionRoleSelection, setPromotionRoleSelection] = useState<ManagedUserRole>('user')
  const [promotionStatusSelection, setPromotionStatusSelection] = useState<MembershipStatus>('free')
  const [promotionAccountStatusSelection, setPromotionAccountStatusSelection] = useState<string>(AccountStatus.ACTIVE)
  const [promotionTierSelection, setPromotionTierSelection] = useState<string>(TransformationTier.INDIVIDUAL_FREE)
  const [promotionAuditReason, setPromotionAuditReason] = useState('')
  const [promotionOrgIds, setPromotionOrgIds] = useState<string[]>([])
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false)
  const [promotionLoading, setPromotionLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    search: '',
    role: 'all',
    membershipStatus: 'all',
    accountStatus: 'all',
    transformationTier: 'all',
    organization: 'all',
    timeframe: 'all',
  })

  useEffect(() => {
    fetchAdminOrganizationsList()
      .then(setOrganizations)
      .catch((err) => {
        console.error(err)
        setError(formatAdminFirestoreError(err, 'Unable to load organizations.'))
      })
  }, [])

  useEffect(() => {
    setPage(1)
  }, [
    filters.search,
    filters.role,
    filters.membershipStatus,
    filters.accountStatus,
    filters.transformationTier,
    filters.organization,
    filters.timeframe,
  ])

  const visibleTimeframeFilter = useMemo(() => propUsers.some((user) => !!user.lastActive), [propUsers])

  const accessibleUsers = useMemo(() => {
    if (isSuperAdmin || !assignedOrganizationIds?.length) return propUsers
    return propUsers.filter((user) => {
      const organizationId = user.companyId
      if (!organizationId) return false
      return assignedOrganizationIds.includes(organizationId)
    })
  }, [assignedOrganizationIds, isSuperAdmin, propUsers])

  const visibleTierOptions = useMemo(() => {
    const known = new Set(transformationTierOptions)
    const extras = accessibleUsers
      .map((user) => normalizeValue(user.transformationTier))
      .filter((value) => value.length > 0 && !known.has(value))
    return [...transformationTierOptions, ...Array.from(new Set(extras))]
  }, [accessibleUsers])

  const filteredUsers = useMemo(() => {
    const now = new Date()
    return accessibleUsers.filter((user) => {
      const searchText = filters.search.toLowerCase()
      const matchesSearch =
        user.name.toLowerCase().includes(searchText) ||
        (user.email || '').toLowerCase().includes(searchText) ||
        (user.companyCode || '').toLowerCase().includes(searchText)

      const normalizedAccountStatus = normalizeValue(user.accountStatus) || 'active'
      const normalizedTier = normalizeValue(user.transformationTier)

      const matchesRole = filters.role === 'all' || user.role === filters.role
      const matchesMembership = filters.membershipStatus === 'all' || user.membershipStatus === filters.membershipStatus
      const matchesAccountStatus = filters.accountStatus === 'all' || normalizedAccountStatus === filters.accountStatus
      const matchesTier = filters.transformationTier === 'all' || normalizedTier === filters.transformationTier
      const matchesOrg = filters.organization === 'all' || user.companyId === filters.organization

      const matchesTimeframe = (() => {
        if (filters.timeframe === 'all') return true
        if (!user.lastActive) return false
        const days = Number(filters.timeframe)
        const diff = (now.getTime() - user.lastActive.getTime()) / (1000 * 60 * 60 * 24)
        return diff <= days
      })()

      return (
        matchesSearch &&
        matchesRole &&
        matchesMembership &&
        matchesAccountStatus &&
        matchesTier &&
        matchesOrg &&
        matchesTimeframe
      )
    })
  }, [
    accessibleUsers,
    filters.accountStatus,
    filters.membershipStatus,
    filters.organization,
    filters.role,
    filters.search,
    filters.timeframe,
    filters.transformationTier,
  ])

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredUsers.slice(start, start + PAGE_SIZE)
  }, [filteredUsers, page])

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE)

  const membershipBadgeColor: Record<MembershipStatus, string> = {
    free: 'orange',
    paid: 'green',
    inactive: 'gray',
  }

  const roleBadgeColor: Record<ManagedUserRole, string> = {
    user: 'gray',
    partner: 'purple',
    admin: 'teal',
    super_admin: 'pink',
    team_leader: 'orange',
    mentor: 'blue',
    ambassador: 'green',
  }

  const accountBadgeColor: Record<string, string> = {
    active: 'green',
    pending: 'yellow',
    inactive: 'gray',
    suspended: 'red',
  }

  const tierBadgeColor: Record<string, string> = {
    [TransformationTier.INDIVIDUAL_FREE]: 'orange',
    [TransformationTier.INDIVIDUAL_PAID]: 'blue',
    [TransformationTier.CORPORATE_MEMBER]: 'purple',
    [TransformationTier.CORPORATE_LEADER]: 'teal',
  }

  const currentPromotionRole = (promotionRoleSelection || 'user') as ManagedUserRole
  const currentPromotionStatus = (promotionStatusSelection || 'free') as MembershipStatus
  const isLeadershipRole = multiOrganizationRoles.has(currentPromotionRole)
  const isPaidUserRole = currentPromotionRole === 'user' && currentPromotionStatus === 'paid'
  const promotionRequiresOrganization = isLeadershipRole || isPaidUserRole

  const selectedPromotionOrgIds = useMemo(() => {
    const deduped = new Set(promotionOrgIds.filter(Boolean))
    return Array.from(deduped)
  }, [promotionOrgIds])

  const formatOrganizationLabelFromIds = (ids: string[]) => {
    if (!ids.length) return 'Independent'
    const names = ids.map((id) => organizations.find((org) => org.id === id)?.name || id)
    return names.join(', ')
  }

  const promotionChanges = useMemo<PromotionChange[]>(() => {
    if (!promotionTarget) return []

    const currentOrgIds = (() => {
      const assigned = promotionTarget.assignedOrganizations?.filter(Boolean) || []
      if (assigned.length) return assigned
      if (promotionTarget.companyId) return [promotionTarget.companyId]
      return []
    })()

    const nextOrgIds = (() => {
      if (!promotionRequiresOrganization) return []
      if (isLeadershipRole) return selectedPromotionOrgIds
      return selectedPromotionOrgIds.slice(0, 1)
    })()

    const currentRoleLabel = formatRoleLabel(promotionTarget.role, promotionTarget.membershipStatus)
    const nextRoleLabel = formatRoleLabel(promotionRoleSelection, promotionStatusSelection)
    const currentMembershipLabel = formatMembershipLabel(promotionTarget.membershipStatus)
    const nextMembershipLabel = formatMembershipLabel(promotionStatusSelection)
    const currentAccountLabel = formatAccountStatusLabel(promotionTarget.accountStatus)
    const nextAccountLabel = formatAccountStatusLabel(promotionAccountStatusSelection)
    const currentTierLabel = formatTierLabel(promotionTarget.transformationTier)
    const nextTierLabel = formatTierLabel(promotionTierSelection)
    const currentOrgLabel = formatOrganizationLabelFromIds(currentOrgIds)
    const nextOrgLabel = formatOrganizationLabelFromIds(nextOrgIds)

    const nextChanges: PromotionChange[] = []
    if (currentRoleLabel !== nextRoleLabel) nextChanges.push({ label: 'Role', before: currentRoleLabel, after: nextRoleLabel })
    if (currentMembershipLabel !== nextMembershipLabel) {
      nextChanges.push({ label: 'Membership', before: currentMembershipLabel, after: nextMembershipLabel })
    }
    if (currentAccountLabel !== nextAccountLabel) {
      nextChanges.push({ label: 'Account status', before: currentAccountLabel, after: nextAccountLabel })
    }
    if (currentTierLabel !== nextTierLabel) {
      nextChanges.push({ label: 'Transformation tier', before: currentTierLabel, after: nextTierLabel })
    }
    if (currentOrgLabel !== nextOrgLabel) {
      nextChanges.push({ label: 'Organization scope', before: currentOrgLabel, after: nextOrgLabel })
    }
    return nextChanges
  }, [
    isLeadershipRole,
    organizations,
    promotionAccountStatusSelection,
    promotionRequiresOrganization,
    promotionRoleSelection,
    promotionStatusSelection,
    promotionTarget,
    promotionTierSelection,
    selectedPromotionOrgIds,
  ])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const handleRoleSelectionChange = (newRole: ManagedUserRole) => {
    setPromotionRoleSelection(newRole)
    if (newRole !== 'user') {
      setPromotionStatusSelection('paid')
    }
  }

  const handleStatusSelectionChange = (newStatus: MembershipStatus) => {
    setPromotionStatusSelection(newStatus)
    if (newStatus !== 'paid') {
      setPromotionRoleSelection('user')
    }
  }

  const openPromotionModal = (user: ManagedUserRecord) => {
    setPromotionTarget(user)
    setPromotionRoleSelection(user.role)
    setPromotionStatusSelection(user.membershipStatus)
    setPromotionAccountStatusSelection(normalizeValue(user.accountStatus) || AccountStatus.ACTIVE)
    setPromotionTierSelection(
      normalizeValue(user.transformationTier) ||
        (user.membershipStatus === 'paid' ? TransformationTier.INDIVIDUAL_PAID : TransformationTier.INDIVIDUAL_FREE),
    )
    setPromotionAuditReason('')
    const assignedOrganizations = user.assignedOrganizations?.filter((id) => Boolean(id)) ?? []
    const initialOrgIds = user.companyId ? [user.companyId] : assignedOrganizations
    setPromotionOrgIds(initialOrgIds)
    setIsCreatingOrganization(false)
    setPromotionModalOpen(true)
  }

  const closePromotionModal = () => {
    setPromotionModalOpen(false)
    setPromotionTarget(null)
    setPromotionOrgIds([])
    setPromotionAuditReason('')
    setIsCreatingOrganization(false)
  }

  const handlePromotionModalClose = () => {
    if (promotionLoading) return
    closePromotionModal()
  }

  const handlePromotionSubmit = async () => {
    if (!promotionTarget || promotionLoading) return
    const selectedOrgIds = selectedPromotionOrgIds

    if (promotionRequiresOrganization && !selectedOrgIds.length) {
      toast({ title: 'Select an organization before continuing', status: 'warning' })
      return
    }

    if (!promotionChanges.length) {
      toast({ title: 'No access changes to apply', status: 'info' })
      return
    }

    const auditReason = promotionAuditReason.trim()
    if (auditReason.length < 8) {
      toast({
        title: 'Audit reason is required',
        description: 'Add at least 8 characters so future reviewers can understand why this change was made.',
        status: 'warning',
      })
      return
    }

    setPromotionLoading(true)

    try {
      const roleValue = (promotionRoleSelection || promotionTarget.role || 'user') as ManagedUserRole
      const membershipValue = (promotionStatusSelection || promotionTarget.membershipStatus || 'free') as MembershipStatus
      const accountStatusValue = normalizeValue(promotionAccountStatusSelection) || AccountStatus.ACTIVE
      const tierValue = normalizeValue(promotionTierSelection) || null
      const updates: Partial<ManagedUserRecord> = {
        role: roleValue,
        membershipStatus: membershipValue,
        accountStatus: accountStatusValue,
        transformationTier: tierValue,
      }

      const wasPartner = promotionTarget.role === 'partner' || promotionTarget.role === 'admin'
      const isPartner = roleValue === 'partner' || roleValue === 'admin'
      let partnerOrgIds: string[] | null = null

      if (isLeadershipRole) {
        updates.companyId = null
        updates.companyName = null
        updates.companyCode = null
        updates.assignedOrganizations = selectedOrgIds
        if (isPartner) {
          partnerOrgIds = selectedOrgIds
        }
      } else if (isPaidUserRole) {
        const orgId = selectedOrgIds[0] || null
        const organization = organizations.find((org) => org.id === orgId)
        updates.companyId = orgId
        updates.companyName = organization?.name || null
        updates.companyCode = organization?.code || null
        updates.assignedOrganizations = orgId ? [orgId] : []
      } else {
        updates.companyId = null
        updates.companyName = null
        updates.companyCode = null
        updates.assignedOrganizations = []
      }

      const beforeAssignedOrganizations =
        promotionTarget.assignedOrganizations?.filter((id) => Boolean(id)) ||
        (promotionTarget.companyId ? [promotionTarget.companyId] : [])
      const afterAssignedOrganizations =
        updates.assignedOrganizations?.filter((id) => Boolean(id)) || (updates.companyId ? [updates.companyId] : [])

      const beforeSnapshot: Partial<ManagedUserRecord> = {
        role: promotionTarget.role,
        membershipStatus: promotionTarget.membershipStatus,
        accountStatus: normalizeValue(promotionTarget.accountStatus) || AccountStatus.ACTIVE,
        transformationTier: normalizeValue(promotionTarget.transformationTier) || null,
        companyId: promotionTarget.companyId || null,
        companyName: promotionTarget.companyName || null,
        companyCode: promotionTarget.companyCode || null,
        assignedOrganizations: beforeAssignedOrganizations,
      }

      const afterSnapshot: Partial<ManagedUserRecord> = {
        role: roleValue,
        membershipStatus: membershipValue,
        accountStatus: accountStatusValue,
        transformationTier: tierValue,
        companyId: updates.companyId || null,
        companyName: updates.companyName || null,
        companyCode: updates.companyCode || null,
        assignedOrganizations: afterAssignedOrganizations,
      }

      if (wasPartner && !isPartner) {
        await assignAdminOrganizations(promotionTarget.id, [])
      }

      const actorName = adminDisplayName || profile?.email || null
      await updateUserAccessWithAudit({
        userId: promotionTarget.id,
        updates,
        before: beforeSnapshot,
        after: afterSnapshot,
        actorId: adminId,
        actorName,
        reason: auditReason,
        source: 'users_management_access_modal',
      })

      if (partnerOrgIds) {
        try {
          await assignAdminOrganizations(promotionTarget.id, partnerOrgIds)
        } catch (assignmentError) {
          try {
            await updateUserAccessWithAudit({
              userId: promotionTarget.id,
              updates: beforeSnapshot,
              before: afterSnapshot,
              after: beforeSnapshot,
              actorId: adminId,
              actorName,
              reason: auditReason,
              source: 'users_management_access_modal_rollback',
            })
          } catch (rollbackError) {
            console.error('[AdminUsers] rollback failed after partner org assignment failure', {
              userId: promotionTarget.id,
              adminId,
              assignmentError,
              rollbackError,
            })
          }

          const assignmentMessage =
            assignmentError instanceof Error ? assignmentError.message : 'Unknown assignment error'
          throw new Error(
            `role updated but org assignment failed: userId=${promotionTarget.id}, adminId=${adminId || 'unknown'}. ${assignmentMessage}`,
          )
        }
      }

      toast({
        title: 'Access updated',
        description: `${promotionChanges.length} changes applied and recorded in the audit trail.`,
        status: 'success',
      })
      closePromotionModal()
    } catch (err) {
      console.error(err)
      const description = err instanceof Error ? err.message : undefined
      toast({ title: 'Failed to update user access', description, status: 'error' })
    } finally {
      setPromotionLoading(false)
    }
  }

  const handleOrganizationCreated = async (organization: OrganizationRecord) => {
    const organizationId = organization.id
    if (!organizationId) {
      toast({
        title: 'Organization created but missing an ID',
        description: 'Please refresh and try again.',
        status: 'warning',
      })
      return
    }

    const organizationEntry = { id: organizationId, name: organization.name, code: organization.code }
    setOrganizations((prev) => [organizationEntry, ...prev.filter((org) => org.id !== organizationId)])
    setPromotionOrgIds((prev) => {
      if (promotionRoleSelection === 'user') {
        return [organizationId]
      }
      return prev.includes(organizationId) ? prev : [...prev, organizationId]
    })
  }

  const handleBulkRole = async (role: ManagedUserRole) => {
    if (!selectedIds.length) return
    try {
      setBulkLoading(true)
      const result = await bulkUpdateRole(selectedIds, role)
      if (result.failedIds.length && result.successfulIds.length) {
        console.warn('[AdminUsers] Bulk role update partially failed', { failedIds: result.failedIds })
        toast({
          title: 'Roles partially updated',
          description: `${result.successfulIds.length} of ${selectedIds.length} users updated. ${result.failedIds.length} failed.`,
          status: 'warning',
        })
        setSelectedIds(result.failedIds)
      } else if (result.failedIds.length) {
        console.error('[AdminUsers] Bulk role update failed', { failedIds: result.failedIds })
        toast({
          title: 'Unable to update roles',
          description: 'No users were updated. Please retry.',
          status: 'error',
        })
      } else {
        toast({ title: 'Roles updated', description: 'Selected users updated', status: 'success' })
        setSelectedIds([])
      }
    } catch (err) {
      console.error(err)
      toast({ title: 'Unable to update roles', status: 'error' })
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkStatus = async (status: MembershipStatus) => {
    if (!selectedIds.length) return
    try {
      setBulkLoading(true)
      const result = await bulkUpdateMembershipStatus(selectedIds, status)
      if (result.failedIds.length && result.successfulIds.length) {
        console.warn('[AdminUsers] Bulk membership update partially failed', { failedIds: result.failedIds })
        toast({
          title: 'Membership partially updated',
          description: `${result.successfulIds.length} of ${selectedIds.length} users updated. ${result.failedIds.length} failed.`,
          status: 'warning',
        })
        setSelectedIds(result.failedIds)
      } else if (result.failedIds.length) {
        console.error('[AdminUsers] Bulk membership update failed', { failedIds: result.failedIds })
        toast({
          title: 'Unable to update membership',
          description: 'No users were updated. Please retry.',
          status: 'error',
        })
      } else {
        toast({ title: 'Membership updated', status: 'success' })
        setSelectedIds([])
      }
    } catch (err) {
      console.error(err)
      toast({ title: 'Unable to update membership', status: 'error' })
    } finally {
      setBulkLoading(false)
    }
  }

  const handleDelete = async (userId: string) => {
    const user = propUsers.find((u) => u.id === userId)
    const confirmMessage = `Are you sure you want to delete ${user?.name || 'this user'}? This action cannot be undone.`
    if (!window.confirm(confirmMessage)) return

    try {
      setStatusChangingId(userId)
      await deleteUserAccount(userId)
      toast({ title: 'User deleted', status: 'success' })
      setSelectedIds((prev) => prev.filter((id) => id !== userId))
    } catch (err) {
      console.error(err)
      toast({ title: 'Failed to delete user', status: 'error' })
    } finally {
      setStatusChangingId(null)
    }
  }

  const headerCheckboxChecked = selectedIds.length > 0 && selectedIds.length === filteredUsers.length
  const headerCheckboxIndeterminate = selectedIds.length > 0 && selectedIds.length < filteredUsers.length

  return (
    <Stack spacing={6}>
      <Stack spacing={1}>
        <Text fontSize="3xl" fontWeight="semibold" color="gray.800">
          User Management
        </Text>
        <Text color="gray.600">Search, filter, and manage user access across the platform.</Text>
      </Stack>

      <Card border="1px solid" borderColor="border.control" borderRadius="2xl" bg="white">
        <CardBody>
          <Stack spacing={4}>
            <Stack spacing={3}>
              <InputGroup maxW={{ base: '100%', lg: '360px' }}>
                <InputLeftElement pointerEvents="none">
                  <Icon as={Search} color="text.muted" />
                </InputLeftElement>
                <Input
                  placeholder="Search by name, email, or code"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                />
              </InputGroup>

              <Flex gap={3} flexWrap="wrap" align="center">
                <Select maxW="190px" value={filters.role} onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}>
                  <option value="all">All roles</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {formatRoleLabel(role)}
                    </option>
                  ))}
                </Select>

                <Select
                  maxW="190px"
                  value={filters.membershipStatus}
                  onChange={(e) => setFilters((prev) => ({ ...prev, membershipStatus: e.target.value }))}
                >
                  <option value="all">All membership</option>
                  {membershipOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatMembershipLabel(status)}
                    </option>
                  ))}
                </Select>

                <Select
                  maxW="190px"
                  value={filters.accountStatus}
                  onChange={(e) => setFilters((prev) => ({ ...prev, accountStatus: e.target.value }))}
                >
                  <option value="all">All account status</option>
                  {accountStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatAccountStatusLabel(status)}
                    </option>
                  ))}
                </Select>

                <Select
                  maxW="210px"
                  value={filters.transformationTier}
                  onChange={(e) => setFilters((prev) => ({ ...prev, transformationTier: e.target.value }))}
                >
                  <option value="all">All transformation tiers</option>
                  {visibleTierOptions.map((tier) => (
                    <option key={tier} value={tier}>
                      {formatTierLabel(tier)}
                    </option>
                  ))}
                </Select>

                <Select
                  maxW="220px"
                  value={filters.organization}
                  onChange={(e) => setFilters((prev) => ({ ...prev, organization: e.target.value }))}
                >
                  <option value="all">All organizations</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </Select>

                {visibleTimeframeFilter && (
                  <Select
                    maxW="180px"
                    value={filters.timeframe}
                    onChange={(e) => setFilters((prev) => ({ ...prev, timeframe: e.target.value }))}
                  >
                    <option value="all">All time</option>
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                  </Select>
                )}

                <Button
                  leftIcon={<Icon as={Filter} boxSize={4} />}
                  variant="outline"
                  onClick={() =>
                    setFilters({
                      search: '',
                      role: 'all',
                      membershipStatus: 'all',
                      accountStatus: 'all',
                      transformationTier: 'all',
                      organization: 'all',
                      timeframe: 'all',
                    })
                  }
                >
                  Reset filters
                </Button>
              </Flex>
            </Stack>

            {selectedIds.length > 0 && (
              <Flex align="center" justify="space-between" bg="purple.50" border="1px solid" borderColor="purple.100" borderRadius="lg" p={3}>
                <Text fontWeight="medium" color="purple.700">
                  {selectedIds.length} selected
                </Text>
                <ButtonGroup size="sm" variant="solid" colorScheme="purple" isDisabled={bulkLoading || !isSuperAdmin}>
                  <Button onClick={() => handleBulkRole('partner')} isLoading={bulkLoading}>
                    Make Admin
                  </Button>
                  <Button onClick={() => handleBulkRole('user')} isLoading={bulkLoading}>
                    Make User
                  </Button>
                  <Button onClick={() => handleBulkStatus('inactive')} isLoading={bulkLoading}>
                    Deactivate
                  </Button>
                </ButtonGroup>
              </Flex>
            )}

            {!propLoading && !error && filteredUsers.length > 0 && (
              <Flex justify="space-between" align="center" py={3} px={4} bg="gray.50" borderRadius="md">
                <Text fontSize="sm" color="gray.600">
                  Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} users
                </Text>
                <HStack spacing={2}>
                  <IconButton
                    aria-label="Previous page"
                    icon={<ChevronLeft size={16} />}
                    size="sm"
                    variant="outline"
                    isDisabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  />
                  <Text fontSize="sm" fontWeight="medium" minW="80px" textAlign="center">
                    Page {page} of {totalPages || 1}
                  </Text>
                  <IconButton
                    aria-label="Next page"
                    icon={<ChevronRight size={16} />}
                    size="sm"
                    variant="outline"
                    isDisabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  />
                </HStack>
              </Flex>
            )}

            <Box border="1px solid" borderColor="border.control" borderRadius="xl" overflowX="auto">
              {propLoading ? (
                <Flex py={10} justify="center" align="center" gap={3}>
                  <Spinner color="purple.500" />
                  <Text color="gray.600">Loading users...</Text>
                </Flex>
              ) : error ? (
                <Flex py={6} justify="center" align="center">
                  <Text color="red.500">{error}</Text>
                </Flex>
              ) : (
                <Table size="sm" minW="1380px">
                  <Thead bg="gray.50">
                    <Tr>
                      <Th w="50px">
                        <Checkbox
                          isChecked={headerCheckboxChecked}
                          isIndeterminate={headerCheckboxIndeterminate}
                          onChange={(e) => setSelectedIds(e.target.checked ? filteredUsers.map((u) => u.id) : [])}
                          aria-label="Select all"
                        />
                      </Th>
                      <Th>User</Th>
                      <Th>Role</Th>
                      <Th>Membership</Th>
                      <Th>Account</Th>
                      <Th>Tier</Th>
                      <Th>Organization</Th>
                      <Th>Last Active</Th>
                      <Th>Audit Trail</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {paginatedUsers.map((user) => {
                      const normalizedAccountStatus = normalizeValue(user.accountStatus) || 'active'
                      const normalizedTier = normalizeValue(user.transformationTier)
                      return (
                        <Tr key={user.id} _hover={{ bg: 'gray.50' }}>
                          <Td>
                            <Checkbox
                              isChecked={selectedIds.includes(user.id)}
                              onChange={() => toggleSelect(user.id)}
                              aria-label={`Select ${user.name}`}
                            />
                          </Td>
                          <Td>
                            <Stack spacing={0}>
                              <Text fontWeight="semibold" color="gray.800">
                                {user.name}
                              </Text>
                              <Text fontSize="sm" color="gray.500">
                                {user.email || 'No email on file'}
                              </Text>
                            </Stack>
                          </Td>
                          <Td>
                            <Badge colorScheme={roleBadgeColor[user.role]} textTransform="capitalize">
                              {formatRoleLabel(user.role, user.membershipStatus)}
                            </Badge>
                          </Td>
                          <Td>
                            <Badge colorScheme={membershipBadgeColor[user.membershipStatus]} textTransform="capitalize">
                              {formatMembershipLabel(user.membershipStatus)}
                            </Badge>
                          </Td>
                          <Td>
                            <Badge colorScheme={accountBadgeColor[normalizedAccountStatus] || 'gray'}>
                              {formatAccountStatusLabel(normalizedAccountStatus)}
                            </Badge>
                          </Td>
                          <Td>
                            {normalizedTier ? (
                              <Badge colorScheme={tierBadgeColor[normalizedTier] || 'gray'}>{formatTierLabel(normalizedTier)}</Badge>
                            ) : (
                              <Text fontSize="xs" color="gray.500">
                                Not set
                              </Text>
                            )}
                          </Td>
                          <Td>
                            {user.companyName ? (
                              <Stack spacing={0}>
                                <Text fontWeight="medium" color="gray.800">
                                  {user.companyName}
                                </Text>
                                <Text fontSize="xs" color="gray.500">
                                  {user.companyCode || '-'}
                                </Text>
                              </Stack>
                            ) : (
                              <Badge colorScheme="purple" variant="subtle">
                                Independent
                              </Badge>
                            )}
                          </Td>
                          <Td>{formatDate(user.lastActive)}</Td>
                          <Td>
                            <Stack spacing={0}>
                              <Text fontSize="xs" color="gray.700" fontWeight="medium">
                                {formatDateTime(user.accessLastUpdatedAt)}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                {user.accessLastUpdatedByName || 'No actor recorded'}
                              </Text>
                              <Text fontSize="xs" color="gray.500" noOfLines={2}>
                                {user.accessLastReason || 'No reason recorded'}
                              </Text>
                            </Stack>
                          </Td>
                          <Td>
                            <HStack spacing={2} justify="flex-end">
                              <Tooltip label="View and edit profile">
                                <Button
                                  as={RouterLink}
                                  to={`${window.location.pathname.startsWith('/partner') ? '/partner' : '/admin'}/user/${user.id}`}
                                  size="sm"
                                  variant="outline"
                                  colorScheme="purple"
                                  leftIcon={<Eye size={16} />}
                                >
                                  View profile
                                </Button>
                              </Tooltip>
                              {isSuperAdmin && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    colorScheme="purple"
                                    onClick={() => openPromotionModal(user)}
                                    isLoading={promotionLoading && promotionTarget?.id === user.id}
                                  >
                                    Edit access
                                  </Button>
                                  <IconButton
                                    aria-label={`Delete ${user.name}`}
                                    icon={<Trash2 size={16} />}
                                    variant="outline"
                                    colorScheme="red"
                                    size="sm"
                                    onClick={() => handleDelete(user.id)}
                                    isLoading={statusChangingId === user.id}
                                  />
                                </>
                              )}
                            </HStack>
                          </Td>
                        </Tr>
                      )
                    })}

                    {!filteredUsers.length && (
                      <Tr>
                        <Td colSpan={10}>
                          <Flex py={10} direction="column" align="center" gap={2}>
                            <Text color="gray.700" fontWeight="medium">
                              No users found for the current filters.
                            </Text>
                            <Text color="gray.500" fontSize="sm">
                              Adjust your search and access filters to see more users.
                            </Text>
                          </Flex>
                        </Td>
                      </Tr>
                    )}
                  </Tbody>
                </Table>
              )}
            </Box>
          </Stack>
        </CardBody>
      </Card>

      <Modal isOpen={promotionModalOpen} onClose={handlePromotionModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Access for {promotionTarget?.name || 'this user'}</ModalHeader>
          <ModalCloseButton isDisabled={promotionLoading} />
          <ModalBody>
            <Stack spacing={4}>
              <Box border="1px solid" borderColor="border.control" borderRadius="lg" p={4}>
                <Text fontWeight="semibold" color="gray.800">
                  Access Controls
                </Text>
                <Stack spacing={4} mt={3}>
                  <FormControl>
                    <FormLabel>Role assignment</FormLabel>
                    <Select value={promotionRoleSelection} onChange={(event) => handleRoleSelectionChange(event.target.value as ManagedUserRole)}>
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {formatRoleLabel(role)}
                        </option>
                      ))}
                    </Select>
                    <FormHelperText>{roleDescriptions[currentPromotionRole]}</FormHelperText>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Membership status</FormLabel>
                    <Select value={promotionStatusSelection} onChange={(event) => handleStatusSelectionChange(event.target.value as MembershipStatus)}>
                      {membershipOptions.map((status) => (
                        <option key={status} value={status}>
                          {formatMembershipLabel(status)}
                        </option>
                      ))}
                    </Select>
                    <FormHelperText>Role and membership remain synchronized automatically.</FormHelperText>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Account status</FormLabel>
                    <Select
                      value={promotionAccountStatusSelection}
                      onChange={(event) => setPromotionAccountStatusSelection(event.target.value)}
                    >
                      {accountStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {formatAccountStatusLabel(status)}
                        </option>
                      ))}
                    </Select>
                    <FormHelperText>Controls sign-in and access posture for this account.</FormHelperText>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Transformation tier</FormLabel>
                    <Select value={promotionTierSelection} onChange={(event) => setPromotionTierSelection(event.target.value)}>
                      {transformationTierOptions.map((tier) => (
                        <option key={tier} value={tier}>
                          {formatTierLabel(tier)}
                        </option>
                      ))}
                    </Select>
                    <FormHelperText>Defines learner experience and dashboard routing context.</FormHelperText>
                  </FormControl>
                </Stack>
              </Box>

              {promotionRequiresOrganization && (
                <Box border="1px solid" borderColor="border.control" borderRadius="lg" p={4}>
                  <Text fontWeight="semibold" color="gray.800" mb={3}>
                    Organization Scope
                  </Text>
                  <FormControl isRequired>
                    <FormLabel>{isLeadershipRole ? 'Assign organizations' : 'Assign organization'}</FormLabel>
                    {isLeadershipRole ? (
                      organizations.length ? (
                        <OrganizationAssignmentsPicker
                          organizations={organizations}
                          value={promotionOrgIds}
                          onChange={setPromotionOrgIds}
                          helperText="Search and add one or more organizations."
                        />
                      ) : (
                        <Text color="gray.500" fontSize="sm">
                          No organizations available yet.
                        </Text>
                      )
                    ) : (
                      <Select
                        placeholder="Select existing organization"
                        value={promotionOrgIds[0] ?? ''}
                        onChange={(event) => {
                          const orgId = event.target.value
                          setPromotionOrgIds(orgId ? [orgId] : [])
                        }}
                      >
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name || org.code || org.id}
                            {org.code ? ` (${org.code})` : ''}
                          </option>
                        ))}
                      </Select>
                    )}
                    <FormHelperText>
                      {isLeadershipRole
                        ? 'Select one or more organizations or create a new one.'
                        : 'Choose one organization or create a new one below.'}
                    </FormHelperText>
                  </FormControl>

                  <Button size="sm" variant="outline" colorScheme="purple" mt={3} onClick={() => setIsCreatingOrganization(true)} isDisabled={promotionLoading}>
                    Create new organization
                  </Button>
                </Box>
              )}

              <Box border="1px solid" borderColor="border.control" borderRadius="lg" p={4}>
                <FormControl isRequired>
                  <FormLabel>Audit reason</FormLabel>
                  <Textarea
                    placeholder="Explain why this access change is needed."
                    value={promotionAuditReason}
                    onChange={(event) => setPromotionAuditReason(event.target.value)}
                    rows={3}
                  />
                  <FormHelperText>
                    Required for clear hindsight-safe audit trails (minimum 8 characters).
                  </FormHelperText>
                </FormControl>

                <Box mt={4}>
                  <Text fontWeight="semibold" color="gray.800" mb={2}>
                    Change Preview
                  </Text>
                  {promotionChanges.length ? (
                    <Stack spacing={2}>
                      {promotionChanges.map((change) => (
                        <Flex key={`${change.label}-${change.before}-${change.after}`} justify="space-between" gap={3}>
                          <Text fontSize="sm" color="gray.700" minW="140px">
                            {change.label}
                          </Text>
                          <Text fontSize="sm" color="gray.600" textAlign="right">
                            {change.before} to {change.after}
                          </Text>
                        </Flex>
                      ))}
                    </Stack>
                  ) : (
                    <Text fontSize="sm" color="gray.500">
                      No pending changes.
                    </Text>
                  )}
                </Box>
              </Box>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={closePromotionModal} isDisabled={promotionLoading}>
              Cancel
            </Button>
            <Button colorScheme="purple" onClick={handlePromotionSubmit} isLoading={promotionLoading}>
              Apply changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <CreateOrganizationModal
        isOpen={isCreatingOrganization}
        onClose={() => setIsCreatingOrganization(false)}
        onCreated={handleOrganizationCreated}
        adminId={adminId}
        adminName={adminDisplayName}
      />
      <Divider />
    </Stack>
  )
}
