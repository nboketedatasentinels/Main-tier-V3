import { useEffect, useMemo, useState } from 'react'
import { Box, Tab, TabList, TabPanel, TabPanels, Tabs, Alert, AlertIcon, Badge } from '@chakra-ui/react'
import { UsersManagementTab } from './tabs/UsersManagementTab'
import { UserEngagementMonitoringTab } from './tabs/UserEngagementMonitoringTab'
import { LeadershipCouncil } from './LeadershipCouncil'
import { listenToUsers, listenToOrganizations } from '@/services/superAdminService'
import { OrganizationOption, ManagedUserRecord } from '@/services/userManagementService'
import { getDisplayName } from '@/utils/displayName'

const TAB_STORAGE_KEY = 'user-management-active-tab'

/**
 * ✅ Single source of truth for users data.
 * - One listener for the whole page
 * - All tabs share the same dataset
 * - Prevents lazy-tab lifecycle issues + duplicate subscriptions
 */

function useManagedUsers() {
  const [users, setUsers] = useState<ManagedUserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    // 🔁 Subscribe once
    const unsubscribe = listenToUsers(
      (items) => {
        const mapped = items.map((user) => {
          const userData = user as ManagedUserRecord & {
            companyId?: string
            companyCode?: string
            companyName?: string
            membershipStatus?: string
            accountStatus?: string
            transformationTier?: string
            full_name?: string
            name?: string
            displayName?: string
            assignedOrganizations?: string[]
            accessLastUpdatedAt?: Date | null
            accessLastUpdatedBy?: string | null
            accessLastUpdatedByName?: string | null
            accessLastReason?: string | null
          }
          return {
            id: userData.id,
            name: getDisplayName(userData, 'Member'),
            email: userData.email,
            role: userData.role as ManagedUserRecord['role'],
            membershipStatus: (userData.membershipStatus as 'free' | 'paid' | 'inactive') || 'free',
            // Check companyId first (set at signup), then fall back to assignedOrganizations (for admins)
            companyId: userData.companyId || userData.assignedOrganizations?.[0] || null,
            companyName: userData.companyName || null,
            companyCode: userData.companyCode || null,
            lastActive: userData.lastActive instanceof Date ? userData.lastActive : null,
            createdAt: userData.createdAt instanceof Date ? userData.createdAt : null,
            accountStatus: userData.accountStatus || 'active',
            transformationTier: userData.transformationTier || null,
            assignedOrganizations: Array.isArray(userData.assignedOrganizations)
              ? userData.assignedOrganizations
              : undefined,
            accessLastUpdatedAt:
              userData.accessLastUpdatedAt instanceof Date
                ? userData.accessLastUpdatedAt
                : null,
            accessLastUpdatedBy: userData.accessLastUpdatedBy || null,
            accessLastUpdatedByName: userData.accessLastUpdatedByName || null,
            accessLastReason: userData.accessLastReason || null,
            notes: userData.notes || '',
          }
        }) as ManagedUserRecord[]
        setUsers(mapped)
        setLoading(false)
      },
      (err: unknown) => {
        console.error('[UserManagementWithTabs] listenToUsers failed:', err)
        setError('Failed to load users. Check Firestore permissions and the users query.')
        setLoading(false)
      },
    )

    return () => {
      try {
        unsubscribe?.()
      } catch (e) {
        console.warn('[UserManagementWithTabs] unsubscribe failed:', e)
      }
    }
  }, [])

  return { users, loading, error }
}

function useManagedOrganizations() {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)

    const unsubscribe = listenToOrganizations(
      (items) => {
        const mapped = items
          .filter((org) => org.id)
          .map((org) => ({
            id: org.id!,
            name: org.name,
            code: org.code,
          }))
        setOrganizations(mapped)
        setLoading(false)
      },
      (err: unknown) => {
        console.error('[UserManagementWithTabs] listenToOrganizations failed:', err)
        setLoading(false)
      },
    )

    return () => {
      try {
        unsubscribe?.()
      } catch (e) {
        console.warn('[UserManagementWithTabs] org unsubscribe failed:', e)
      }
    }
  }, [])

  return { organizations, loading }
}

export const UserManagementWithTabs = () => {
  const [tabIndex, setTabIndex] = useState(() => {
    if (typeof window === 'undefined') return 0
    const stored = sessionStorage.getItem(TAB_STORAGE_KEY)
    const parsed = stored ? Number.parseInt(stored, 10) : 0
    return Number.isFinite(parsed) ? parsed : 0
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(TAB_STORAGE_KEY, tabIndex.toString())
    }
  }, [tabIndex])

  const { users, loading, error } = useManagedUsers()
  const { organizations, loading: loadingOrgs } = useManagedOrganizations()

  // Computed counts for tab badges
  const userCount = users.length
  const mentorCount = users.filter(u => u.role === 'mentor').length
  const ambassadorCount = users.filter(u => u.role === 'ambassador').length

  // Optional: derived subsets per tab (keeps tab components simpler)
  const memo = useMemo(() => {
    return {
      users,
      organizations,
    }
  }, [users, organizations])

  return (
    <Box bg="gray.50" minH="calc(100vh - 120px)" p={{ base: 4, md: 6 }} borderRadius="3xl">
      {error && (
        <Alert status="warning" borderRadius="xl" mb={4}>
          <AlertIcon />
          {error}
        </Alert>
      )}

      <Tabs
        index={tabIndex}
        onChange={setTabIndex}
        colorScheme="purple"
        variant="enclosed"
        isLazy
        lazyBehavior="keepMounted"
      >
        <TabList overflowX="auto" pb={2}>
          <Tab whiteSpace="nowrap">
            Users Management
            <Badge ml={2} colorScheme="gray" fontSize="xs">{userCount}</Badge>
          </Tab>
          <Tab whiteSpace="nowrap">
            User Engagement
          </Tab>
          <Tab whiteSpace="nowrap">
            Leadership Council
            <Badge ml={2} colorScheme="gray" fontSize="xs">{mentorCount + ambassadorCount}</Badge>
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel px={0}>
            {/* ✅ Pass shared data down so tabs don't fight over fetching/listeners */}
            <UsersManagementTab users={memo.users} loading={loading} />
          </TabPanel>

          <TabPanel px={0}>
            <UserEngagementMonitoringTab users={memo.users} organizations={memo.organizations} />
          </TabPanel>

          <TabPanel px={0}>
            <LeadershipCouncil users={memo.users} organizations={memo.organizations} loadingUsers={loading || loadingOrgs} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  )
}
