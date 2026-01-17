import { useEffect, useMemo, useState } from 'react'
import { Box, Tab, TabList, TabPanel, TabPanels, Tabs, Alert, AlertIcon } from '@chakra-ui/react'
import { UsersManagementTab } from './tabs/UsersManagementTab'
import { UserEngagementMonitoringTab } from './tabs/UserEngagementMonitoringTab'
import { LeadershipCouncil } from './LeadershipCouncil'
import { listenToUsers } from '@/services/superAdminService' // ✅ adjust if your listener lives elsewhere

const TAB_STORAGE_KEY = 'user-management-active-tab'

/**
 * ✅ Single source of truth for users data.
 * - One listener for the whole page
 * - All tabs share the same dataset
 * - Prevents lazy-tab lifecycle issues + duplicate subscriptions
 */
type ManagedUser = Record<string, any> // ✅ replace with your real User type

function useManagedUsers() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    // 🔁 Subscribe once
    const unsubscribe = listenToUsers(
      (items: ManagedUser[]) => {
        setUsers(items || [])
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

  // Optional: derived subsets per tab (keeps tab components simpler)
  const memo = useMemo(() => {
    return {
      users,
      // Example placeholders if you want derived sets:
      // engagedUsers: users.filter(u => u.engagementScore >= 75),
      // councilCandidates: users.filter(u => u.role === 'mentor' || u.role === 'ambassador'),
    }
  }, [users])

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
          <Tab whiteSpace="nowrap">Users Management</Tab>
          <Tab whiteSpace="nowrap">User Engagement</Tab>
          <Tab whiteSpace="nowrap">Leadership Council</Tab>
        </TabList>

        <TabPanels>
          <TabPanel px={0}>
            {/* ✅ Pass shared data down so tabs don't fight over fetching/listeners */}
            <UsersManagementTab users={memo.users} loading={loading} />
          </TabPanel>

          <TabPanel px={0}>
            <UserEngagementMonitoringTab users={memo.users} loading={loading} />
          </TabPanel>

          <TabPanel px={0}>
            <LeadershipCouncil users={memo.users} loading={loading} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  )
}
