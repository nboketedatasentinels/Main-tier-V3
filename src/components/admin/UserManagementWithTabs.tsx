import { useEffect, useState } from 'react'
import { Box, Tab, TabList, TabPanel, TabPanels, Tabs } from '@chakra-ui/react'
import { UsersManagementTab } from './tabs/UsersManagementTab'
import { UserEngagementMonitoringTab } from './tabs/UserEngagementMonitoringTab'
import { LeadershipCouncil } from './LeadershipCouncil'

const TAB_STORAGE_KEY = 'user-management-active-tab'

export const UserManagementWithTabs = () => {
  const [tabIndex, setTabIndex] = useState(() => {
    if (typeof window === 'undefined') return 0
    const stored = sessionStorage.getItem(TAB_STORAGE_KEY)
    return stored ? Number.parseInt(stored, 10) : 0
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(TAB_STORAGE_KEY, tabIndex.toString())
    }
  }, [tabIndex])

  return (
    <Box bg="gray.50" minH="calc(100vh - 120px)" p={{ base: 4, md: 6 }} borderRadius="3xl">
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
            <UsersManagementTab />
          </TabPanel>
          <TabPanel px={0}>
            <UserEngagementMonitoringTab />
          </TabPanel>
          <TabPanel px={0}>
            <LeadershipCouncil />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  )
}
