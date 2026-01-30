import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  FormControl,
  FormLabel,
  HStack,
  Input,
  InputGroup,
  InputRightElement,
  SimpleGrid,
  Stack,
  Text,
  VStack,
  Skeleton,
  SkeletonText,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Code,
  useToast,
} from '@chakra-ui/react'
import { formatDistanceToNow, isValid } from 'date-fns'
import { AlertTriangle, Bell, Building2, ClipboardCheck, Eye, EyeOff, Gauge, Key, Mail, Save, Sparkles, User, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { auth } from '@/services/firebase'
import { OrganizationCard } from '@/components/admin/OrganizationCard'
import PartnerLayout from '@/layouts/PartnerLayout'
import { DashboardErrorBoundary } from '@/components/ui/DashboardErrorBoundary'
import { AtRiskCommandPanel } from '@/components/partner/AtRiskCommandPanel'
import { PartnerUserManagement } from '@/components/partner/PartnerUserManagement'
import { usePointsApprovalQueue } from '@/hooks/partner/usePointsApprovalQueue'
import { usePartnerDashboardData } from '@/hooks/usePartnerDashboardData'
import { useAuth } from '@/hooks/useAuth'
import { logOrganizationAccessAttempt } from '@/services/organizationService'
import { recordEngagementAction } from '@/services/engagementService'
import { generatePartnerDigest, sendPartnerDigestEmail } from '@/services/partnerDigestService'
import { buildPartnerNavItems } from '@/utils/navigationItems'
import { logger, type MismatchSample } from '@/utils/partnerDashboardUtils'
import { PageTransitionLoader } from '@/components/PageTransitionLoader'

export const PartnerDashboard: React.FC = () => {
  const navigate = useNavigate()
  const {
    isSuperAdmin,
    user,
    profile,
    canAccessOrganization,
    refreshProfile,
    profileStatus,
  } = useAuth()
  const toast = useToast()
  const [debugMode, setDebugMode] = useState(false)
  const [partnerOrgAccess, setPartnerOrgAccess] = useState<boolean | null>(null)
  const {
    assignedOrgCount,
    assignedOrganizations,
    organizationsError,
    organizationsLoading,
    organizationsReady,
    selectedOrg,
    setSelectedOrg,
    updateUserPoints,
    usersError,
    usersLoading,
    dataQualityWarnings,
    interventions,
    notificationCount,
    notifications,
    notificationsLoading,
    notificationsError,
    debugInfo,
    snapshot,
    adminDataLoading,
  } = usePartnerDashboardData({ debugMode })
  const { organizations, users, analytics } = snapshot
  const {
    metrics,
    engagementTrend,
    riskLevels,
    atRiskUsers,
  } = analytics || {}
  const partnerId = user?.uid ?? null
  const snapshotUsers = snapshot?.users ?? []

  type PartnerPageKey = 'overview' | 'users' | 'organization-management' | 'at-risk' | 'reports' | 'settings' | 'support' | 'profile'
  const [activePage, setActivePage] = useState<PartnerPageKey>('overview')
  const [showAllNotifications, setShowAllNotifications] = useState(false)

  // Profile page state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const snapshotOrganizations = useMemo(
    () => snapshot?.organizations ?? [],
    [snapshot?.organizations],
  )

  // Extract organization IDs for server-side approval filtering
  const partnerOrganizationIds = useMemo(
    () => snapshotOrganizations.map((org) => org.id).filter(Boolean) as string[],
    [snapshotOrganizations],
  )

  const { approvalQueue: pendingApprovals } = usePointsApprovalQueue(
    snapshotUsers,
    activePage === 'overview' || activePage === 'users',
    {
      organizationIds: partnerOrganizationIds,
      enabled: true,
    },
  )
  const snapshotLoading = adminDataLoading
  const enableProfileRealtime = import.meta.env.VITE_ENABLE_PROFILE_REALTIME === 'true'
  const supportEmail = 'support@transformation4leaders.com'
  const formatDistanceToNowSafe = (
    value: Date | string | number | null | undefined,
    fallback: string,
    options?: Parameters<typeof formatDistanceToNow>[1],
  ) => {
    if (!value) {
      return fallback
    }

    const dateValue = value instanceof Date ? value : new Date(value)
    if (!isValid(dateValue)) {
      return fallback
    }

    return formatDistanceToNow(dateValue, options)
  }

  const [refreshingOrganizations, setRefreshingOrganizations] = useState(false)
  const [digestSending, setDigestSending] = useState(false)
  const [digestStatusMessage, setDigestStatusMessage] = useState<string | null>(null)
  const initialRefreshRef = useRef(false)
  const selectedOrgId = useMemo(() => {
    if (!selectedOrg || selectedOrg === 'all') return null
    const selectedNormalized = selectedOrg.toLowerCase()
    const match = organizations.find((org) =>
      [org.id, org.code].some(
        (value) => value?.toLowerCase() === selectedNormalized
      )
    )
    return match?.id || null
  }, [organizations, selectedOrg])

  useEffect(() => {
    if (profile?.role !== 'partner' || !selectedOrgId) {
      setPartnerOrgAccess(true)
      return
    }

    let isMounted = true
    setPartnerOrgAccess(null)
    void canAccessOrganization(selectedOrgId)
      .then((allowed) => {
        if (isMounted) setPartnerOrgAccess(allowed)
      })
      .catch(() => {
        if (isMounted) setPartnerOrgAccess(false)
      })

    return () => {
      isMounted = false
    }
  }, [canAccessOrganization, profile?.role, selectedOrgId])

  const refreshIfVisible = useCallback((reason: string) => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      console.log('[PartnerDashboard] Skipping refresh because tab is hidden', { reason })
      return
    }
    void refreshProfile({ reason })
  }, [refreshProfile])

  const refreshOrganizations = useCallback(async () => {
    setRefreshingOrganizations(true)
    try {
      await refreshProfile({ reason: 'partner-dashboard-org-refresh', isManual: true })
    } finally {
      setRefreshingOrganizations(false)
    }
  }, [refreshProfile])

  useEffect(() => {
    if (enableProfileRealtime) return
    console.warn(
      '[PartnerDashboard] VITE_ENABLE_PROFILE_REALTIME is disabled. Manual or scheduled refresh is required.'
    )
    if (!initialRefreshRef.current) {
      initialRefreshRef.current = true
      refreshIfVisible('partner-dashboard-initial')
    }
    const interval = window.setInterval(() => {
      refreshIfVisible('partner-dashboard-interval')
    }, 60 * 1000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshIfVisible('partner-dashboard-visible')
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enableProfileRealtime, refreshIfVisible])

  useEffect(() => {
    console.debug('[PartnerDashboard] Partner assignments', assignedOrganizations)
  }, [assignedOrganizations])

  const navSections = useMemo(() => buildPartnerNavItems(), [])

  const groupedNotifications = useMemo(() => {
    const groups = new Map<string, {
      id: string
      title: string
      message: string
      count: number
      unreadCount: number
      latestNotification: typeof notifications[number]
      latestTimestamp: number
    }>()

    notifications.forEach((notification) => {
      const title = notification.title || 'General'
      const message = notification.message || ''
      const key = `${title}::${message}`
      const createdAt = notification.created_at ? new Date(notification.created_at).getTime() : Date.now()
      const isUnread = !notification.is_read && !notification.read

      if (!groups.has(key)) {
        groups.set(key, {
          id: notification.id,
          title,
          message,
          count: 1,
          unreadCount: isUnread ? 1 : 0,
          latestNotification: notification,
          latestTimestamp: createdAt,
        })
        return
      }

      const existing = groups.get(key)
      if (!existing) return
      existing.count += 1
      existing.unreadCount += isUnread ? 1 : 0
      if (createdAt >= existing.latestTimestamp) {
        existing.latestNotification = notification
        existing.latestTimestamp = createdAt
      }
    })

    return Array.from(groups.values()).sort((a, b) => b.latestTimestamp - a.latestTimestamp)
  }, [notifications])
  const scopedDigestOrgIds = useMemo(() => {
    const scoped = assignedOrganizations.length
      ? assignedOrganizations
      : organizations.map(org => org.id || org.code || '').filter(Boolean)
    return Array.from(new Set(scoped))
  }, [assignedOrganizations, organizations])

  const riskReasons = useMemo(() => {
    const counts: Record<string, number> = {}
    atRiskUsers.forEach(user => {
      const reasons = user.riskReasons?.length ? user.riskReasons : ['Behind on weekly points target']
      reasons.forEach(reason => {
        counts[reason] = (counts[reason] || 0) + 1
      })
    })

    const palette: Array<'orange' | 'red' | 'yellow' | 'purple' | 'green'> = ['orange', 'red', 'yellow', 'purple', 'green']
    return Object.entries(counts).map(([label, count], idx) => ({
      label,
      count,
      color: palette[idx % palette.length],
    }))
  }, [atRiskUsers])

  const riskLevelList = [
    { label: 'Engaged', color: 'green' as const, count: riskLevels.engaged },
    { label: 'Watch', color: 'yellow' as const, count: riskLevels.watch },
    { label: 'Concern', color: 'orange' as const, count: riskLevels.concern },
    { label: 'Critical', color: 'red' as const, count: riskLevels.critical },
  ]

  const orgCards = organizations.map(org => ({
    name: org.name || org.code || org.id || 'Unknown organization',
    status: org.status,
    activeUsers: org.activeUsers,
    newThisWeek: org.newThisWeek,
    admins: 1,
    change: `+${org.newThisWeek}`,
  }))

  const organizationSummary = useMemo(() => {
    return organizations.reduce(
      (acc, org) => {
        acc.totalActiveUsers += org.activeUsers
        switch (org.status) {
          case 'active':
            acc.active += 1
            break
          case 'watch':
            acc.watch += 1
            break
          case 'paused':
            acc.paused += 1
            break
          default:
            break
        }
        return acc
      },
      { active: 0, watch: 0, paused: 0, totalActiveUsers: 0 },
    )
  }, [organizations])


  const handleViewOrganization = (orgCode: string) => {
    const normalized = orgCode.toLowerCase()
    const allowed =
      isSuperAdmin ||
      organizations.some(org => org.code?.toLowerCase() === normalized || org.id?.toLowerCase() === normalized)
    if (!allowed && user?.uid) {
      void logOrganizationAccessAttempt({
        userId: user.uid,
        organizationCode: normalized,
        reason: 'partner_dashboard_navigation',
      })
      return
    }
    navigate(`/partner/organization/${orgCode}`)
  }

  const handleSendDigest = useCallback(async () => {
    if (digestSending) return

    if (!user?.uid) {
      toast({
        title: 'Unable to send digest',
        description: 'Please sign in again before sending a partner digest.',
        status: 'error',
        duration: 6000,
        isClosable: true,
      })
      return
    }

    if (scopedDigestOrgIds.length === 0) {
      toast({
        title: 'No organisations assigned yet',
        description: 'Assign at least one organization before sending a digest.',
        status: 'error',
        duration: 6000,
        isClosable: true,
      })
      return
    }

    setDigestSending(true)
    setDigestStatusMessage(null)

    try {
      const results = await Promise.all(
        scopedDigestOrgIds.map(async (orgId) => {
          const digest = await generatePartnerDigest(user.uid, user.email ?? '', orgId)
          if (!digest) {
            return { orgId, status: 'failed' as const }
          }
          const sent = await sendPartnerDigestEmail(digest)
          return { orgId, status: sent ? 'sent' as const : 'failed' as const }
        }),
      )

      const sentCount = results.filter(result => result.status === 'sent').length
      const failedCount = results.length - sentCount

      if (sentCount > 0) {
        setDigestStatusMessage(
          `Digest sent to ${sentCount} organization${sentCount === 1 ? '' : 's'} just now.`,
        )
      }

      if (failedCount > 0) {
        toast({
          title: 'Some digests failed',
          description: `We couldn't send ${failedCount} digest${failedCount === 1 ? '' : 's'}. Try again or contact support.`,
          status: 'error',
          duration: 7000,
          isClosable: true,
        })
      } else {
        toast({
          title: 'Digest sent',
          description: 'Partner digest email sent successfully.',
          status: 'success',
          duration: 4000,
          isClosable: true,
        })
      }
    } catch (error) {
      console.error('Failed to send partner digest', error)
      toast({
        title: 'Digest send failed',
        description: error instanceof Error ? error.message : 'Unexpected error while sending the digest.',
        status: 'error',
        duration: 7000,
        isClosable: true,
      })
    } finally {
      setDigestSending(false)
    }
  }, [digestSending, scopedDigestOrgIds, toast, user?.email, user?.uid])

  const renderOverview = () => {
    const learnersAtRiskCount = riskLevels.critical + riskLevels.concern
    const overdueCheckinsCount = interventions.length
    const pendingApprovalsCount = pendingApprovals.length
    const scopeSummary = `${assignedOrgCount} organization${assignedOrgCount === 1 ? '' : 's'} · ${users.length} learner${users.length === 1 ? '' : 's'} in scope · Transformation Partner · Engagement tracking active`
    const isEmptyState =
      metrics.activeMembers === 0
      && metrics.engagementRate === 0
      && metrics.newRegistrations === 0
      && metrics.managedCompanies === 0
    const managedCompanyLabel = metrics.managedCompanies === 1 ? 'company' : 'companies'

    const alertCards = [
      {
        key: 'risk',
        count: learnersAtRiskCount,
        label: learnersAtRiskCount === 1 ? 'Learner at risk' : 'Learners at risk',
        color: 'red',
        icon: Users,
        onClick: () => setActivePage('at-risk'),
      },
      {
        key: 'checkins',
        count: overdueCheckinsCount,
        label: overdueCheckinsCount === 1 ? 'Overdue check-in' : 'Overdue check-ins',
        color: 'yellow',
        icon: Bell,
        onClick: () => setActivePage('at-risk'),
      },
      {
        key: 'approvals',
        count: pendingApprovalsCount,
        label: pendingApprovalsCount === 1 ? 'Approval pending' : 'Approvals pending',
        color: 'green',
        icon: ClipboardCheck,
        onClick: () => setActivePage('users'),
      },
    ]

    const activityMetrics = [
      { label: 'Active members (30d)', value: metrics.activeMembers.toString(), icon: Users },
      { label: 'Engagement rate', value: `${metrics.engagementRate}%`, icon: Gauge },
      { label: 'New registrations (7d)', value: metrics.newRegistrations.toString(), icon: Sparkles },
      { label: `Managed ${managedCompanyLabel}`, value: metrics.managedCompanies.toString(), icon: Building2 },
    ]

    const visibleNotifications = showAllNotifications ? groupedNotifications : groupedNotifications.slice(0, 4)

    return (
      <Stack spacing={8}>
        <VStack align="flex-start" spacing={1}>
          <Text fontSize="sm" color="brand.subtleText">
            Partner Dashboard
          </Text>
          <Text fontSize="3xl" fontWeight="bold" color="brand.text">
            Partner Overview
          </Text>
          <Text color="brand.subtleText">
            Your active learners, risks, and interventions today
          </Text>
        </VStack>

        <Card bg="white" border="1px solid" borderColor="brand.border">
          <CardBody py={3}>
            <Text fontSize="sm" color="brand.subtleText">
              {scopeSummary}
            </Text>
          </CardBody>
        </Card>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          {alertCards.map((card) => {
            const isMuted = card.count === 0
            const accentColor = isMuted ? 'gray' : card.color
            const Icon = card.icon
            return (
              <Card
                key={card.key}
                bg={isMuted ? 'gray.50' : `${accentColor}.50`}
                border="1px solid"
                borderColor={isMuted ? 'gray.200' : `${accentColor}.200`}
                cursor="pointer"
                transition="all 0.2s"
                _hover={{ shadow: 'sm', borderColor: isMuted ? 'gray.300' : `${accentColor}.300` }}
                onClick={card.onClick}
                minH="150px"
                h="100%"
              >
                <CardBody p={5} h="100%">
                  <Stack spacing={3} h="100%" justify="space-between">
                    <HStack spacing={3} align="center">
                      <Box color={`${accentColor}.500`}>
                        <Icon size={20} />
                      </Box>
                      <Text fontSize="3xl" fontWeight="bold" color={`${accentColor}.700`}>
                        {card.count}
                      </Text>
                    </HStack>
                    <Text fontWeight="semibold" color={`${accentColor}.700`}>
                      {card.label}
                    </Text>
                    <Button
                      size="sm"
                      variant="link"
                      colorScheme={accentColor === 'gray' ? 'gray' : accentColor}
                      onClick={card.onClick}
                      alignSelf="flex-start"
                    >
                      View all →
                    </Button>
                  </Stack>
                </CardBody>
              </Card>
            )
          })}
        </SimpleGrid>

        {(organizationsLoading || usersLoading) && !organizationsError && !usersError && (
          <Card bg="blue.50" border="1px solid" borderColor="blue.200">
            <CardBody>
              <Stack spacing={3}>
                <Text fontWeight="semibold" color="blue.700">
                  Loading dashboard data...
                </Text>
                <HStack spacing={3} wrap="wrap">
                  {organizationsLoading ? (
                    <Badge colorScheme="blue">Organizations loading...</Badge>
                  ) : organizationsReady ? (
                    <Badge colorScheme="green">Organizations loaded ✓</Badge>
                  ) : null}
                  {usersLoading ? (
                    <Badge colorScheme="blue">Users loading...</Badge>
                  ) : (
                    <Badge colorScheme="green">Users loaded ✓</Badge>
                  )}
                </HStack>
              </Stack>
            </CardBody>
          </Card>
        )}

        {(organizationsError || usersError) && (
          <Card bg="red.50" border="1px solid" borderColor="red.200">
            <CardBody>
              <Stack spacing={3}>
                <Text fontWeight="semibold" color="red.700">
                  We hit a problem loading your dashboard data.
                </Text>
                <HStack>
                  <Button size="sm" colorScheme="red" onClick={refreshOrganizations} isLoading={refreshingOrganizations}>
                    Retry loading data
                  </Button>
                </HStack>
              </Stack>
            </CardBody>
          </Card>
        )}

        <Stack spacing={4}>
          <HStack justify="space-between" align="center" wrap="wrap" spacing={3}>
            <VStack align="flex-start" spacing={0}>
              <Text fontWeight="bold" color="brand.text">Performance Snapshot</Text>
              <Text fontSize="sm" color="brand.subtleText">
                A quick read on activity and organization health.
              </Text>
            </VStack>
            <Button
              size="sm"
              variant="outline"
              onClick={refreshOrganizations}
              isLoading={refreshingOrganizations}
            >
              Refresh data
            </Button>
          </HStack>

          {isEmptyState && (
            <Card bg="purple.50" border="1px solid" borderColor="purple.200">
              <CardBody>
                <Stack spacing={2}>
                  <Text fontWeight="bold" color="purple.700">Welcome! Here's how to get started.</Text>
                  <Text fontSize="sm" color="purple.700">
                    1) Invite learners · 2) Set up check-ins · 3) Monitor progress
                  </Text>
                </Stack>
              </CardBody>
            </Card>
          )}

          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
            <Card bg="white" border="1px solid" borderColor="brand.border">
              <CardBody>
                <Stack spacing={4}>
                  <Text fontWeight="bold" color="brand.text">Activity Summary</Text>
                  <SimpleGrid columns={{ base: 2, md: 2 }} spacing={4}>
                    {activityMetrics.map((metric) => {
                      const MetricIcon = metric.icon
                      return (
                        <HStack key={metric.label} spacing={3} align="center">
                          <Box color="brand.primary">
                            <MetricIcon size={18} />
                          </Box>
                          <VStack align="flex-start" spacing={0}>
                            <Text fontSize="xs" color="brand.subtleText">
                              {metric.label}
                            </Text>
                            <Text fontWeight="bold" fontSize="lg" color="brand.text">
                              {metric.value}
                            </Text>
                          </VStack>
                        </HStack>
                      )
                    })}
                  </SimpleGrid>
                </Stack>
              </CardBody>
            </Card>

            <Card bg="white" border="1px solid" borderColor="brand.border">
              <CardBody>
                <Stack spacing={4}>
                  <HStack justify="space-between" align="center">
                    <Text fontWeight="bold" color="brand.text">Organization Health Snapshot</Text>
                    <Button size="sm" variant="link" colorScheme="purple" onClick={() => setActivePage('organization-management')}>
                      View All Organizations
                    </Button>
                  </HStack>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                    {organizationsLoading ? (
                      [1, 2, 3, 4].map((item) => (
                        <Box
                          key={item}
                          p={3}
                          borderRadius="md"
                          border="1px solid"
                          borderColor="brand.border"
                          bg="brand.accent"
                        >
                          <Skeleton height="16px" width="60%" />
                          <SkeletonText mt="2" noOfLines={2} spacing="2" />
                        </Box>
                      ))
                    ) : (
                      orgCards.slice(0, 4).map(company => {
                        const isHealthy = company.status === 'active'
                        const statusColor = isHealthy ? 'green' : 'orange'
                        return (
                          <Box
                            key={company.name}
                            p={4}
                            borderRadius="lg"
                            border="1px solid"
                            borderColor="brand.border"
                            bg="brand.accent"
                            transition="all 0.2s"
                            _hover={{ borderColor: 'brand.primary', shadow: 'sm' }}
                          >
                            <Stack spacing={2}>
                              <Text fontWeight="bold" color="brand.text" noOfLines={1}>{company.name}</Text>
                              <Text fontSize="sm" color="brand.subtleText">
                                {company.activeUsers} active users
                              </Text>
                              <HStack spacing={2}>
                                <Badge colorScheme={statusColor}>{isHealthy ? 'Healthy' : 'Needs attention'}</Badge>
                                <Text fontSize="xs" color="brand.subtleText">
                                  {isHealthy ? 'All learners on track' : 'Learners need follow-up'}
                                </Text>
                              </HStack>
                              <Button size="xs" variant="outline" onClick={() => handleViewOrganization(company.name)}>
                                Manage Organization
                              </Button>
                            </Stack>
                          </Box>
                        )
                      })
                    )}
                  </SimpleGrid>
                </Stack>
              </CardBody>
            </Card>
          </SimpleGrid>
        </Stack>

        <Stack spacing={4}>
          <Text fontWeight="bold" color="brand.text">Quick Actions</Text>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <Card bg="white" border="1px solid" borderColor="brand.border">
              <CardBody>
                <Stack spacing={3}>
                  <HStack spacing={2}>
                    <Mail size={18} />
                    <Text fontWeight="bold" color="brand.text">Digest & Alerts</Text>
                  </HStack>
                  <Text fontSize="sm" color="brand.subtleText">
                    {overdueCheckinsCount} overdue alert{overdueCheckinsCount === 1 ? '' : 's'} · {notificationCount} unread notification{notificationCount === 1 ? '' : 's'}
                  </Text>
                  <Button
                    variant="solid"
                    colorScheme="purple"
                    leftIcon={<Mail size={16} />}
                    onClick={handleSendDigest}
                    isLoading={digestSending}
                    isDisabled={digestSending || scopedDigestOrgIds.length === 0}
                    loadingText="Sending"
                  >
                    Send digest now
                  </Button>
                  <HStack spacing={2}>
                    <Text fontSize="xs" color="brand.subtleText">
                      Digest sent to: {user?.email ?? 'your email'}
                    </Text>
                    <Button size="xs" variant="link" colorScheme="purple" onClick={() => setActivePage('settings')}>
                      Edit
                    </Button>
                  </HStack>
                  {digestStatusMessage ? (
                    <Text fontSize="xs" color="green.600">
                      {digestStatusMessage}
                    </Text>
                  ) : null}
                </Stack>
              </CardBody>
            </Card>

            <Card bg="white" border="1px solid" borderColor="brand.border">
              <CardBody>
                <Stack spacing={3}>
                  <HStack spacing={2}>
                    <Users size={18} />
                    <Text fontWeight="bold" color="brand.text">Invite Learners</Text>
                  </HStack>
                  <Text fontSize="sm" color="brand.subtleText">
                    {metrics.activeMembers === 0
                      ? 'Kickstart engagement by inviting your first learner.'
                      : 'Bring new learners into your programs.'}
                  </Text>
                  <Button colorScheme="purple" onClick={() => setActivePage('users')}>
                    {metrics.activeMembers === 0 ? 'Invite your first learner →' : 'Invite learners →'}
                  </Button>
                </Stack>
              </CardBody>
            </Card>

            <Card bg="white" border="1px solid" borderColor="brand.border">
              <CardBody>
                <Stack spacing={3}>
                  <HStack spacing={2}>
                    <Building2 size={18} />
                    <Text fontWeight="bold" color="brand.text">Manage Organizations</Text>
                  </HStack>
                  <Text fontSize="sm" color="brand.subtleText">
                    {assignedOrgCount} organization{assignedOrgCount === 1 ? '' : 's'} assigned to you.
                  </Text>
                  <Button variant="outline" colorScheme="purple" onClick={() => setActivePage('organization-management')}>
                    Manage Organization
                  </Button>
                </Stack>
              </CardBody>
            </Card>
          </SimpleGrid>
        </Stack>

        <Card bg="white" border="1px solid" borderColor="brand.border">
          <CardBody>
            <Stack spacing={3}>
              <HStack justify="space-between" align="center" wrap="wrap" spacing={3}>
                <HStack spacing={2}>
                  <Bell size={18} />
                  <Text fontWeight="bold" color="brand.text">Recent Activity</Text>
                </HStack>
                <Badge colorScheme={notificationCount > 0 ? 'red' : 'gray'}>
                  {notificationCount} unread
                </Badge>
              </HStack>
              <Divider />
              {notificationsLoading ? (
                <Stack spacing={3}>
                  {[1, 2, 3].map((item) => (
                    <HStack
                      key={item}
                      justify="space-between"
                      p={3}
                      borderRadius="md"
                      border="1px solid"
                      borderColor="brand.border"
                      bg="brand.accent"
                    >
                      <HStack spacing={3} flex={1}>
                        <Skeleton height="32px" width="32px" borderRadius="md" />
                        <Box flex={1}>
                          <Skeleton height="14px" width="40%" />
                          <SkeletonText mt="2" noOfLines={2} spacing="2" />
                        </Box>
                      </HStack>
                      <Skeleton height="20px" width="70px" borderRadius="full" />
                    </HStack>
                  ))}
                </Stack>
              ) : notificationsError ? (
                <Box p={3} borderRadius="md" border="1px solid" borderColor="red.200" bg="red.50">
                  <Stack spacing={2}>
                    <Text fontWeight="semibold" color="red.700">Notifications unavailable</Text>
                    <Text fontSize="sm" color="red.700">{notificationsError}</Text>
                  </Stack>
                </Box>
              ) : notifications.length === 0 ? (
                <Box p={3} borderRadius="md" border="1px dashed" borderColor="gray.200" bg="gray.50">
                  <Text fontSize="sm" color="gray.600">
                    You are all caught up. New partner alerts will appear here.
                  </Text>
                </Box>
              ) : (
                <Stack spacing={4}>
                  {visibleNotifications.map((group) => {
                    const notification = group.latestNotification
                    // Extract learner ID only from explicit metadata fields (not from generic related_id)
                    const learnerId =
                      (notification.metadata as { learnerId?: string } | undefined)?.learnerId
                    // Extract organization ID from metadata or fall back to related_id
                    const organizationId =
                      (notification.metadata as { organizationId?: string } | undefined)?.organizationId
                      ?? notification.related_id
                    // Only link to user if we have an explicit learnerId
                    const actionLink = learnerId
                      ? `/partner/user/${learnerId}`
                      : organizationId
                        ? `/partner/organization/${organizationId}`
                        : null
                    const actionLabel = learnerId ? 'View learner' : organizationId ? 'View organization' : null
                    const timestamp = formatDistanceToNowSafe(notification.created_at, 'Just now', { addSuffix: true })
                    const isUnread = group.unreadCount > 0
                    const lowerTitle = group.title.toLowerCase()
                    const notificationType = lowerTitle.includes('challenge')
                      ? { icon: Sparkles, color: 'purple' }
                      : lowerTitle.includes('assignment') || lowerTitle.includes('approval')
                        ? { icon: ClipboardCheck, color: 'blue' }
                        : lowerTitle.includes('alert') || lowerTitle.includes('overdue')
                          ? { icon: AlertTriangle, color: 'red' }
                          : { icon: Bell, color: 'gray' }
                    const NotificationIcon = notificationType.icon

                    return (
                      <HStack
                        key={group.id}
                        justify="space-between"
                        p={4}
                        borderRadius="lg"
                        border="1px solid"
                        borderColor={notificationType.color === 'red' ? 'red.200' : 'brand.border'}
                        bg={notificationType.color === 'red' ? 'red.50' : 'brand.accent'}
                        align="flex-start"
                        transition="all 0.2s"
                        _hover={{ shadow: 'sm' }}
                        cursor={actionLink ? 'pointer' : 'default'}
                        onClick={actionLink ? () => navigate(actionLink) : undefined}
                      >
                        <HStack spacing={4} flex={1} align="flex-start">
                          <Box
                            p={2}
                            borderRadius="md"
                            bg="white"
                            border="1px solid"
                            borderColor="brand.border"
                            color={`${notificationType.color}.500`}
                          >
                            <NotificationIcon size={18} />
                          </Box>
                          <VStack align="flex-start" spacing={1} flex={1}>
                            <HStack spacing={2} align="center">
                              <Text fontWeight="bold" color="brand.text">
                                {group.count > 1 ? `${group.count} new ${group.title}` : group.title}
                              </Text>
                              {isUnread && (
                                <Badge colorScheme={notificationType.color === 'gray' ? 'purple' : notificationType.color} variant="solid">
                                  {group.unreadCount > 1 ? `${group.unreadCount} new` : 'New'}
                                </Badge>
                              )}
                            </HStack>
                            <Text fontSize="sm" color="brand.subtleText">
                              {group.message}
                            </Text>
                            <Text fontSize="xs" fontWeight="medium" color="brand.subtleText">
                              {timestamp}
                            </Text>
                            {actionLink && actionLabel ? (
                              <Button
                                size="sm"
                                colorScheme={notificationType.color === 'gray' ? 'purple' : notificationType.color}
                                variant="solid"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  navigate(actionLink)
                                }}
                                mt={2}
                              >
                                {actionLabel}
                              </Button>
                            ) : null}
                          </VStack>
                        </HStack>
                      </HStack>
                    )
                  })}
                  {groupedNotifications.length > 4 && !showAllNotifications && (
                    <Button
                      variant="link"
                      colorScheme="purple"
                      alignSelf="flex-start"
                      onClick={() => setShowAllNotifications(true)}
                    >
                      View all notifications →
                    </Button>
                  )}
                  {showAllNotifications && groupedNotifications.length > 4 && (
                    <Button
                      variant="link"
                      colorScheme="purple"
                      alignSelf="flex-start"
                      onClick={() => setShowAllNotifications(false)}
                    >
                      Show fewer notifications
                    </Button>
                  )}
                </Stack>
              )}
            </Stack>
          </CardBody>
        </Card>
      </Stack>
    )
  }

  const handleAtRiskAction = useCallback(async (action: string, caseId: string, additionalData?: Record<string, unknown>) => {
    logger.debug('[PartnerDashboard] At-Risk Action', { action, caseId, additionalData })

    try {
      if (action === 'start_intervention') {
        await recordEngagementAction({
          userId: interventions.find(i => i.id === caseId)?.userId || '',
          actionLabel: 'Started Intervention',
          actorId: profile?.id ?? null,
          actorName: profile?.fullName ?? null,
          additionalData: { intervention_id: caseId, action_type: 'intervention_start' }
        })
      }

      toast({
        title: 'Action recorded',
        description: `Action "${action}" has been logged for this case.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      logger.error('Failed to record at-risk action', error)
      toast({
        title: 'Action failed',
        description: 'We could not record your action. Please try again.',
        status: 'error',
      })
    }
  }, [interventions, profile?.fullName, profile?.id, toast])

  const renderAtRiskPage = () => (
    <AtRiskCommandPanel
      engagementTrend={engagementTrend}
      riskLevelList={riskLevelList}
      riskReasons={riskReasons}
      dataQualityWarnings={dataQualityWarnings}
      interventions={interventions}
      atRiskUsers={atRiskUsers}
      onAction={handleAtRiskAction}
    />
  )

  const renderDebugInfo = () => {
    if (!debugInfo) return null

    return (
      <Accordion allowToggle mt={4}>
        <AccordionItem border="1px dashed" borderColor="gray.300" borderRadius="md" bg="gray.50">
          <h2>
            <AccordionButton>
              <Box flex="1" textAlign="left" fontWeight="bold" fontSize="sm">
                <HStack>
                  <Gauge size={14} />
                  <Text>Dashboard Debug Info</Text>
                  {debugInfo.rejectedNoMatch > 0 && (
                    <Badge colorScheme="orange" ml={2}>
                      {debugInfo.rejectedNoMatch} Mismatched
                    </Badge>
                  )}
                </HStack>
              </Box>
              <AccordionIcon />
            </AccordionButton>
          </h2>
          <AccordionPanel pb={4}>
            <VStack align="flex-start" spacing={4}>
              {import.meta.env.DEV && (
                <Box w="full">
                  <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={2}>
                    Partner Debug Panel (DEV ONLY)
                  </Text>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                    <Box>
                      <Text fontSize="xs" color="gray.500">Role</Text>
                      <Text fontWeight="bold">{profile?.role || 'unknown'}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="gray.500">Partner ID</Text>
                      <Text fontWeight="bold">{partnerId || 'n/a'}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="gray.500">Assigned Org IDs</Text>
                      <Text fontWeight="bold">
                        {assignedOrganizations.length ? assignedOrganizations.join(', ') : 'none'}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="gray.500">Selected Org ID</Text>
                      <Text fontWeight="bold">{selectedOrgId || 'all'}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="gray.500">Partner Org Access</Text>
                      <Text fontWeight="bold">
                        {partnerOrgAccess === null ? 'checking' : partnerOrgAccess ? 'true' : 'false'}
                      </Text>
                    </Box>
                  </SimpleGrid>
                  <Divider mt={3} />
                </Box>
              )}
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} w="full">
                <Box>
                  <Text fontSize="xs" color="gray.500">Snapshot Total</Text>
                  <Text fontWeight="bold">{debugInfo.totalInSnapshot}</Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="gray.500">Kept</Text>
                  <Text fontWeight="bold" color="green.600">{debugInfo.keptCount}</Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="gray.500">Rejected (Org Mismatch)</Text>
                  <Text fontWeight="bold" color={debugInfo.rejectedNoMatch > 0 ? "orange.600" : "inherit"}>
                    {debugInfo.rejectedNoMatch}
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="gray.500">Rejected (Filter)</Text>
                  <Text fontWeight="bold">{debugInfo.rejectedSelectedOrg}</Text>
                </Box>
              </SimpleGrid>

              <Divider />

              <Box w="full">
                <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={2}>Assigned Organization Keys:</Text>
                <HStack wrap="wrap" spacing={2}>
                  {debugInfo.assignedOrgKeys.length > 0 ? (
                    debugInfo.assignedOrgKeys.map((key: string) => (
                      <Code key={key} fontSize="xs" colorScheme="purple">{key}</Code>
                    ))
                  ) : (
                    <Text fontSize="xs" fontStyle="italic">No keys assigned in profile</Text>
                  )}
                </HStack>
              </Box>

              {debugInfo.mismatchSamples.length > 0 && (
                <Box w="full">
                  <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={2}>Samples of Mismatched Users:</Text>
                  <VStack align="flex-start" spacing={2} w="full">
                    {debugInfo.mismatchSamples.map((sample: MismatchSample, idx: number) => (
                      <Box key={idx} p={2} bg="white" border="1px solid" borderColor="gray.200" borderRadius="md" w="full" fontSize="xs">
                        <HStack justify="space-between">
                          <Text fontWeight="bold">{sample.id}</Text>
                          <Badge size="xs" colorScheme="red">{sample.reason}</Badge>
                        </HStack>
                        <Text mt={1} color="gray.600">User Org Fields: {sample.userOrgKeys.length > 0 ? sample.userOrgKeys.join(', ') : '(Empty)'}</Text>
                      </Box>
                    ))}
                    {debugInfo.rejectedNoMatch > 5 && (
                      <Text fontSize="xs" color="gray.500" fontStyle="italic">...and {debugInfo.rejectedNoMatch - 5} more</Text>
                    )}
                  </VStack>
                </Box>
              )}

              <HStack spacing={3}>
                <Button size="xs" variant="outline" onClick={() => console.log('Full Dashboard Debug:', debugInfo)}>
                  Log Full Debug Data to Console
                </Button>
                {isSuperAdmin && (
                  <Button
                    size="xs"
                    colorScheme={debugMode ? "red" : "gray"}
                    variant={debugMode ? "solid" : "outline"}
                    onClick={() => setDebugMode(!debugMode)}
                  >
                    {debugMode ? "Disable Debug Mode (Filtering Off)" : "Enable Debug Mode (Bypass Filtering)"}
                  </Button>
                )}
              </HStack>
            </VStack>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    )
  }

  const renderUsersPage = () => (
    <Stack spacing={6}>
      {users.length === 0 && !usersLoading && debugInfo && debugInfo.rejectedNoMatch > 0 && (
        <Card bg="orange.50" border="1px solid" borderColor="orange.200">
          <CardBody>
            <HStack spacing={4} align="flex-start">
              <Box color="orange.500" mt={1}><Users size={24} /></Box>
              <Stack spacing={3} flex={1}>
                <VStack align="flex-start" spacing={0}>
                  <Text fontWeight="bold" color="orange.800">Learners found but not matching assignments</Text>
                  <Text fontSize="sm" color="orange.700">
                    We found {debugInfo.rejectedNoMatch} active learners in the database, but they don't match your assigned organizations ({debugInfo.assignedOrgKeys.join(', ') || 'none'}).
                  </Text>
                </VStack>
                <HStack>
                  <Button
                    as="a"
                    href={`mailto:${supportEmail}?subject=Organization Access Request&body=I am unable to see users for my assigned organizations. My assigned keys are: ${debugInfo.assignedOrgKeys.join(', ')}`}
                    size="sm"
                    colorScheme="orange"
                    leftIcon={<Mail size={16} />}
                  >
                    Request Organization Access
                  </Button>
                  <Button size="sm" variant="ghost" color="orange.700" onClick={refreshOrganizations}>
                    Refresh data
                  </Button>
                </HStack>
              </Stack>
            </HStack>
          </CardBody>
        </Card>
      )}

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={3}>
            <HStack justify="space-between" align="center" wrap="wrap" spacing={3}>
              <VStack align="flex-start" spacing={0}>
                <Text fontWeight="bold" color="brand.text">User management</Text>
                <Text fontSize="sm" color="brand.subtleText">
                  Filtered to {selectedOrg === 'all' ? 'all organizations' : selectedOrg}
                </Text>
              </VStack>
              <Badge colorScheme="purple">Scoped</Badge>
            </HStack>

            <PartnerUserManagement
              users={snapshotUsers}
              usersLoading={snapshotLoading}
              organizations={snapshotOrganizations}
              organizationsLoading={snapshotLoading}
              organizationsReady={!snapshotLoading}
              selectedOrg={selectedOrg}
              onSelectOrg={setSelectedOrg}
              updateUserPoints={updateUserPoints}
            />

            {renderDebugInfo()}
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )

  const renderOrganizationManagementPage = () => (
    <Stack spacing={6}>
      {(organizationsError || usersError) && (
        <Card bg="red.50" border="1px solid" borderColor="red.200">
          <CardBody>
            <Stack spacing={3}>
              <Text fontWeight="semibold" color="red.700">
                Some dashboard data failed to load.
              </Text>
              {organizationsError ? (
                <Text fontSize="sm" color="red.700">
                  Organizations: {organizationsError}
                </Text>
              ) : null}
              {usersError ? (
                <Text fontSize="sm" color="red.700">
                  Users: {usersError}
                </Text>
              ) : null}
              <Button size="sm" colorScheme="red" onClick={refreshOrganizations} isLoading={refreshingOrganizations}>
                Retry loading data
              </Button>
            </Stack>
          </CardBody>
        </Card>
      )}
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between" align="center" wrap="wrap" spacing={3}>
              <VStack align="flex-start" spacing={1}>
                <Text fontWeight="bold" color="brand.text">
                  Assigned organization overview
                </Text>
                <Text fontSize="sm" color="brand.subtleText">
                  Summary of scoped organizations and active learner engagement.
                </Text>
              </VStack>
              <HStack spacing={3}>
                <Badge colorScheme="purple">Scoped access</Badge>
                <Badge colorScheme="green">Real-time data</Badge>
                <Button size="sm" variant="outline" onClick={refreshOrganizations} isLoading={refreshingOrganizations}>
                  Refresh organizations
                </Button>
              </HStack>
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 2, xl: 5 }} spacing={3}>
              <Box p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
                <Text fontSize="xs" color="brand.subtleText">
                  Total assigned
                </Text>
                <Text fontWeight="bold" color="brand.text" fontSize="2xl">
                  {organizations.length}
                </Text>
              </Box>
              <Box p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
                <Text fontSize="xs" color="brand.subtleText">
                  Active organizations
                </Text>
                <HStack justify="space-between" align="center">
                  <Text fontWeight="bold" color="brand.text" fontSize="2xl">
                    {organizationSummary.active}
                  </Text>
                  <Badge colorScheme="green">Active</Badge>
                </HStack>
              </Box>
              <Box p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
                <Text fontSize="xs" color="brand.subtleText">
                  Watch organizations
                </Text>
                <HStack justify="space-between" align="center">
                  <Text fontWeight="bold" color="brand.text" fontSize="2xl">
                    {organizationSummary.watch}
                  </Text>
                  <Badge colorScheme="orange">Watch</Badge>
                </HStack>
              </Box>
              <Box p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
                <Text fontSize="xs" color="brand.subtleText">
                  Paused organizations
                </Text>
                <HStack justify="space-between" align="center">
                  <Text fontWeight="bold" color="brand.text" fontSize="2xl">
                    {organizationSummary.paused}
                  </Text>
                  <Badge colorScheme="red">Paused</Badge>
                </HStack>
              </Box>
              <Box p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
                <Text fontSize="xs" color="brand.subtleText">
                  Total active users
                </Text>
                <Text fontWeight="bold" color="brand.text" fontSize="2xl">
                  {organizationSummary.totalActiveUsers}
                </Text>
              </Box>
            </SimpleGrid>
          </Stack>
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between" align="center" wrap="wrap" spacing={3}>
              <VStack align="flex-start" spacing={1}>
                <Text fontWeight="bold" color="brand.text">
                  Organisation Management
                </Text>
                <Text fontSize="sm" color="brand.subtleText">
                  These organisations are assigned to your partner admin scope.
                </Text>
              </VStack>
              <Badge colorScheme={organizationsLoading ? 'gray' : 'purple'}>
                {organizationsLoading ? 'Loading' : `${organizations.length} assigned`}
              </Badge>
            </HStack>
            {organizationsLoading ? (
              <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Box
                    key={`org-skeleton-${idx}`}
                    border="1px solid"
                    borderColor="brand.border"
                    borderRadius="md"
                    p={4}
                    bg="white"
                  >
                    <Stack spacing={3}>
                      <Skeleton height="18px" width="60%" />
                      <Skeleton height="12px" width="40%" />
                      <Skeleton height="12px" width="80%" />
                    </Stack>
                  </Box>
                ))}
              </SimpleGrid>
            ) : organizationsError ? (
              <Box p={4} borderRadius="md" border="1px solid" borderColor="orange.200" bg="orange.50">
                <Stack spacing={2}>
                  <Text color="orange.700" fontWeight="semibold">
                    Unable to load assigned organizations.
                  </Text>
                  <Text color="orange.700" fontSize="sm">
                    {organizationsError}
                  </Text>
                </Stack>
              </Box>
            ) : organizations.length ? (
              <DashboardErrorBoundary context="Partner organizations">
                <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>
                  {organizations.map(org => (
                    <OrganizationCard
                      key={org.code || org.id}
                      name={org.name || org.code || org.id || 'Unknown organization'}
                      status={org.status}
                      activeUsers={org.activeUsers}
                      newThisWeek={org.newThisWeek}
                      warning={org.warning}
                      onViewClick={() => handleViewOrganization(org.code || org.id || 'unknown')}
                    />
                  ))}
                </SimpleGrid>
              </DashboardErrorBoundary>
            ) : (
              <Box p={4} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
                <Stack spacing={2}>
                  <Text color="brand.subtleText" fontWeight="semibold">
                    No organisations assigned yet
                  </Text>
                  <Text color="brand.subtleText" fontSize="sm">
                    Assigned organizations will appear here once a super admin connects your account.
                  </Text>
                  <Button
                    as="a"
                    href={`mailto:${supportEmail}`}
                    size="sm"
                    variant="outline"
                    alignSelf="flex-start"
                  >
                    Contact super admin
                  </Button>
                </Stack>
              </Box>
            )}
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )

  const renderReports = () => (
    <Stack spacing={6}>
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={3}>
            <Text fontWeight="bold" color="brand.text">Reports</Text>
            <Text fontSize="sm" color="brand.subtleText">
              Analytics and engagement reports will appear here. Customize filters by organization to export scoped summaries.
            </Text>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
              {['Engagement by org', 'At-risk trends', 'Data quality'].map(report => (
                <Box
                  key={report}
                  p={3}
                  borderRadius="md"
                  border="1px solid"
                  borderColor="brand.border"
                  bg="brand.accent"
                >
                  <Text fontWeight="semibold" color="brand.text">{report}</Text>
                  <Text fontSize="sm" color="brand.subtleText">Coming soon</Text>
                </Box>
              ))}
            </SimpleGrid>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )

  const handlePasswordChange = async () => {
    if (!auth.currentUser) {
      toast({
        title: 'Not authenticated',
        description: 'Please sign in again to change your password.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please ensure both password fields match.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    if (newPassword.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 8 characters long.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    setIsChangingPassword(true)
    try {
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email || '',
        currentPassword
      )
      await reauthenticateWithCredential(auth.currentUser, credential)
      await updatePassword(auth.currentUser, newPassword)

      toast({
        title: 'Password updated',
        description: 'Your password has been changed successfully.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      })

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      console.error('Password change error:', error)
      toast({
        title: 'Password change failed',
        description: error instanceof Error ? error.message : 'Unable to change password. Please check your current password.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const renderProfile = () => (
    <Stack spacing={6}>
      {/* Profile Information */}
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={4}>
            <HStack spacing={4}>
              <Avatar size="xl" name={profile?.fullName || 'Partner'} />
              <VStack align="flex-start" spacing={1}>
                <Text fontSize="xl" fontWeight="bold" color="brand.text">
                  {profile?.fullName || 'Partner'}
                </Text>
                <Badge colorScheme="purple">Partner</Badge>
                <Text fontSize="sm" color="brand.subtleText">
                  {profile?.email || user?.email || 'No email'}
                </Text>
              </VStack>
            </HStack>
            <Divider />
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <Box>
                <Text fontSize="sm" color="brand.subtleText">Role</Text>
                <Text fontWeight="medium" color="brand.text">Partner Administrator</Text>
              </Box>
              <Box>
                <Text fontSize="sm" color="brand.subtleText">Organizations Managed</Text>
                <Text fontWeight="medium" color="brand.text">{assignedOrgCount}</Text>
              </Box>
            </SimpleGrid>
          </Stack>
        </CardBody>
      </Card>

      {/* Change Password */}
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={4}>
            <HStack>
              <Key size={20} />
              <Text fontWeight="bold" color="brand.text">Change Password</Text>
            </HStack>
            <Text fontSize="sm" color="brand.subtleText">
              Update your password to keep your account secure.
            </Text>
            <Stack spacing={3} maxW="400px">
              <FormControl>
                <FormLabel fontSize="sm">Current Password</FormLabel>
                <InputGroup>
                  <Input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                  <InputRightElement>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </InputRightElement>
                </InputGroup>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">New Password</FormLabel>
                <InputGroup>
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <InputRightElement>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </InputRightElement>
                </InputGroup>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Confirm New Password</FormLabel>
                <InputGroup>
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                  <InputRightElement>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </InputRightElement>
                </InputGroup>
              </FormControl>
              <Button
                colorScheme="purple"
                leftIcon={<Save size={16} />}
                onClick={handlePasswordChange}
                isLoading={isChangingPassword}
                isDisabled={!currentPassword || !newPassword || !confirmPassword}
              >
                Update Password
              </Button>
            </Stack>
          </Stack>
        </CardBody>
      </Card>

      {/* Account Information */}
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={3}>
            <HStack>
              <User size={20} />
              <Text fontWeight="bold" color="brand.text">Account Information</Text>
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <Box>
                <Text fontSize="sm" color="brand.subtleText">User ID</Text>
                <Text fontWeight="medium" color="brand.text" fontSize="sm">{user?.uid || 'N/A'}</Text>
              </Box>
              <Box>
                <Text fontSize="sm" color="brand.subtleText">Email</Text>
                <Text fontWeight="medium" color="brand.text">{profile?.email || user?.email || 'N/A'}</Text>
              </Box>
            </SimpleGrid>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )

  const renderSettings = () => (
    <Stack spacing={6}>
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={3}>
            <Text fontWeight="bold" color="brand.text">Settings</Text>
            <Text fontSize="sm" color="brand.subtleText">
              Manage dashboard preferences, notification thresholds, and organization defaults.
            </Text>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
              {['Notification rules', 'Organization defaults', 'Access control'].map(setting => (
                <Box key={setting} p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
                  <Text fontWeight="semibold" color="brand.text">{setting}</Text>
                  <Text fontSize="sm" color="brand.subtleText">Configuration coming soon</Text>
                </Box>
              ))}
            </SimpleGrid>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )

  const renderSupport = () => (
    <Stack spacing={6}>
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={3}>
            <Text fontWeight="bold" color="brand.text">Support</Text>
            <Text fontSize="sm" color="brand.subtleText">
              Need help? Reach out to support or review the upcoming knowledge base articles for partner admins.
            </Text>
            <Badge colorScheme="blue" w="fit-content">
              Live chat coming soon
            </Badge>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )

  const renderPage = () => {
    switch (activePage) {
      case 'users':
        return renderUsersPage()
      case 'organization-management':
        return renderOrganizationManagementPage()
      case 'at-risk':
        return renderAtRiskPage()
      case 'reports':
        return renderReports()
      case 'settings':
        return renderSettings()
      case 'support':
        return renderSupport()
      case 'profile':
        return renderProfile()
      case 'overview':
      default:
        return renderOverview()
    }
  }

  const handleNavigate = (key: string) => {
    const normalized = key as PartnerPageKey
    if (['overview', 'users', 'organization-management', 'at-risk', 'reports', 'settings', 'support', 'profile'].includes(normalized)) {
      setActivePage(normalized)
    } else {
      setActivePage('overview')
    }
  }

  if (profileStatus !== 'ready') {
    return (
      <PartnerLayout
        organizations={organizations}
        selectedOrg={selectedOrg}
        onSelectOrg={setSelectedOrg}
        navSections={navSections}
        onNavigate={handleNavigate}
        activeItem={activePage}
      >
        <Stack spacing={4}>
          <Text fontSize="sm" color="brand.subtleText">
            Initializing dashboard...
          </Text>
          <PageTransitionLoader fullScreen={false} size="medium" />
        </Stack>
      </PartnerLayout>
    )
  }

  if (profile?.role === 'partner' && selectedOrgId && partnerOrgAccess === false) {
    return (
      <PartnerLayout
        organizations={organizations}
        selectedOrg={selectedOrg}
        onSelectOrg={setSelectedOrg}
        navSections={navSections}
        onNavigate={handleNavigate}
        activeItem={activePage}
      >
        <Card bg="red.50" border="1px solid" borderColor="red.200">
          <CardBody>
            <Stack spacing={2}>
              <Text fontWeight="bold" color="red.700">
                Access denied
              </Text>
              <Text color="red.600">
                You do not have access to the selected organization. Please choose another organization or contact support.
              </Text>
            </Stack>
          </CardBody>
        </Card>
      </PartnerLayout>
    )
  }

  return (
    <PartnerLayout
      organizations={organizations}
      selectedOrg={selectedOrg}
      onSelectOrg={setSelectedOrg}
      navSections={navSections}
      onNavigate={handleNavigate}
      activeItem={activePage}
    >
      {renderPage()}
    </PartnerLayout>
  )
}

export default PartnerDashboard
