import React from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  Icon,
  IconButton,
  Select,
  Stack,
  Text,
  Tooltip,
  VStack,
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  useToast,
  useDisclosure,
} from '@chakra-ui/react'
import { Bell, LogOut, Menu, RefreshCw, Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { type NavigationItem } from '@/utils/navigationItems'

export type PartnerNavItem = Omit<NavigationItem, 'key'> & {
  key?: string
}

interface PartnerDashboardLayoutProps {
  children: React.ReactNode
  organizations: { code: string; name: string }[]
  selectedOrg: string
  onSelectOrg: (org: string) => void
  notificationCount?: number
  navItems?: PartnerNavItem[]
  activeItem?: string
  onNavigate?: (key: string) => void
}

export const PartnerDashboardLayout: React.FC<PartnerDashboardLayoutProps> = ({
  children,
  organizations,
  selectedOrg,
  onSelectOrg,
  notificationCount = 0,
  navItems = [],
  activeItem,
  onNavigate,
}) => {
  const sidebarWidth = '280px'
  const disclosure = useDisclosure()
  const { profile, signOut, refreshProfile, profileLoading, lastProfileLoadAt, isAdmin, profileStatus } = useAuth()
  const enableProfileRealtime = import.meta.env.VITE_ENABLE_PROFILE_REALTIME === 'true'
  const toast = useToast()
  const [showRefreshHint, setShowRefreshHint] = React.useState(false)
  const [lastUpdatedLabel, setLastUpdatedLabel] = React.useState('Not yet loaded')
  const [profileSyncWarning, setProfileSyncWarning] = React.useState(false)
  const profileLoadingSinceRef = React.useRef<number | null>(null)
  const assignedCount = organizations.length || profile?.assignedOrganizations?.length || 0
  const menuItems = navItems.length
    ? navItems
    : [
        { key: 'overview', label: 'Overview', icon: Sparkles },
        { key: 'users', label: 'Users', icon: Sparkles },
        { key: 'job-board', label: 'Job Board', icon: Sparkles },
        { key: 'grants', label: 'Grants & Funding', icon: Sparkles },
      ]

  const orgOptions = organizations.length ? organizations : []

  const formatLastUpdated = (timestamp?: string | null) => {
    if (!timestamp) return 'Not yet loaded'
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return 'Not yet loaded'
    return date.toLocaleString()
  }

  const updateRefreshHint = React.useCallback(() => {
    if (!lastProfileLoadAt) {
      setShowRefreshHint(false)
      setLastUpdatedLabel(formatLastUpdated(null))
      return
    }
    const lastDate = new Date(lastProfileLoadAt)
    const minutesSince = (Date.now() - lastDate.getTime()) / (1000 * 60)
    setShowRefreshHint(minutesSince >= 30)
    setLastUpdatedLabel(formatLastUpdated(lastProfileLoadAt))
  }, [lastProfileLoadAt])

  React.useEffect(() => {
    updateRefreshHint()
    const interval = window.setInterval(updateRefreshHint, 60 * 1000)
    return () => window.clearInterval(interval)
  }, [updateRefreshHint])

  React.useEffect(() => {
    if (profileStatus === 'loading') {
      profileLoadingSinceRef.current = profileLoadingSinceRef.current ?? Date.now()
    } else {
      profileLoadingSinceRef.current = null
      setProfileSyncWarning(false)
    }
  }, [profileStatus])

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      if (profileStatus !== 'loading' || !profileLoadingSinceRef.current) {
        setProfileSyncWarning(false)
        return
      }
      const elapsedMs = Date.now() - profileLoadingSinceRef.current
      setProfileSyncWarning(elapsedMs > 15000)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [profileStatus])

  const handleManualRefresh = React.useCallback(async () => {
    const result = await refreshProfile({ reason: 'partner-dashboard-manual' })
    if (result.error) {
      toast({
        title: 'Profile refresh failed',
        description: result.error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }
    toast({
      title: 'Profile refreshed',
      description: 'Latest organization assignments are now available.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }, [refreshProfile, toast])

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'r') {
        event.preventDefault()
        void handleManualRefresh()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleManualRefresh])

  const renderNav = () => (
    <VStack align="stretch" spacing={2} py={4} px={2}>
      {menuItems.map(item => (
        <HStack
          key={item.key || item.label}
          spacing={3}
          px={3}
          py={2}
          borderRadius="md"
          cursor="pointer"
          _hover={{ bg: 'brand.accent' }}
          bg={(item.key || item.label.toLowerCase()) === activeItem ? 'brand.accent' : undefined}
          border="1px solid"
          borderColor={(item.key || item.label.toLowerCase()) === activeItem ? 'brand.border' : 'transparent'}
          transition="all 0.2s"
          onClick={() => onNavigate?.(item.key || item.label.toLowerCase())}
          aria-current={(item.key || item.label.toLowerCase()) === activeItem ? 'page' : undefined}
        >
          {item.icon && (
            <Box
              p={1.5}
              borderRadius="lg"
              bg="brand.accent"
              border="1px solid"
              borderColor="brand.border"
            >
              <Icon as={item.icon} color="brand.text" />
            </Box>
          )}
          <VStack align="flex-start" spacing={0} flex={1}>
            <Text fontSize="xs" fontWeight="semibold" color="brand.text">
              {item.label}
            </Text>
            {'description' in item && item.description && (
              <Text fontSize="2xs" color="brand.subtleText">
                {item.description}
              </Text>
            )}
          </VStack>
          <Badge colorScheme="purple" variant="subtle" fontSize="xs">
            Scoped
          </Badge>
        </HStack>
      ))}
    </VStack>
  )

  const ProfileSection = () => (
    <HStack spacing={3} p={3} borderRadius="lg" bg="brand.accent" align="flex-start">
      <Avatar name={profile?.fullName || 'Partner Admin'} size="sm" />
      <VStack align="flex-start" spacing={0} flex={1}>
        <Text fontWeight="bold" color="brand.text" fontSize="sm">
          {profile?.fullName || 'Partner Admin'}
        </Text>
        <HStack spacing={2} align="center">
          <Text fontSize="xs" color="brand.subtleText">
            Assigned: {assignedCount} orgs
          </Text>
          <Tooltip label="Refresh profile (Alt+Shift+R)" placement="top">
            <IconButton
              aria-label="Refresh profile"
              icon={<RefreshCw size={14} />}
              size="xs"
              variant="ghost"
              onClick={() => void handleManualRefresh()}
              isLoading={profileLoading}
            />
          </Tooltip>
        </HStack>
        <Text fontSize="2xs" color="brand.subtleText">
          Last updated: {lastUpdatedLabel}
        </Text>
        <Button
          size="xs"
          leftIcon={<LogOut size={14} />}
          variant="outline"
          colorScheme="gray"
          onClick={() => signOut()}
        >
          Sign out
        </Button>
      </VStack>
    </HStack>
  )

  const HeaderControls = () => (
    <HStack spacing={3} align="center">
      <Select
        maxW={{ base: '220px', md: '280px' }}
        value={selectedOrg}
        onChange={e => onSelectOrg(e.target.value)}
        bg="white"
        borderColor="brand.border"
      >
        <option value="all">All Companies</option>
        {orgOptions.map(org => (
          <option key={org.code} value={org.code}>
            {org.name}
          </option>
        ))}
      </Select>
      <Tooltip label="Refresh profile (Alt+Shift+R)" placement="bottom">
        <IconButton
          aria-label="Refresh profile"
          icon={<RefreshCw size={16} />}
          variant="outline"
          onClick={() => void handleManualRefresh()}
          isLoading={profileLoading}
        />
      </Tooltip>
      <Box position="relative">
        <IconButton aria-label="Notifications" icon={<Bell />} variant="outline" />
        {notificationCount > 0 && (
          <Badge
            position="absolute"
            top="-6px"
            right="-6px"
            colorScheme="red"
            borderRadius="full"
            px={2}
          >
            {notificationCount}
          </Badge>
        )}
      </Box>
      <IconButton
        aria-label="Open navigation"
        icon={<Menu />}
        variant="outline"
        display={{ base: 'inline-flex', md: 'none' }}
        onClick={disclosure.onOpen}
      />
      <Button
        display={{ base: 'inline-flex', md: 'inline-flex' }}
        leftIcon={<LogOut size={16} />}
        variant="outline"
        onClick={() => signOut()}
      >
        Logout
      </Button>
    </HStack>
  )

  return (
    <Flex minH="100vh" h="100vh" bg="brand.canvas" overflow="hidden">
      <Box
        display={{ base: 'none', md: 'block' }}
        w={sidebarWidth}
        borderRight="1px solid"
        borderColor="brand.border"
        bg="white"
        p={4}
        h="100vh"
        overflowY="auto"
      >
        <VStack align="stretch" spacing={4} h="full">
          <HStack spacing={2}>
            <Box p={1.5} borderRadius="md" bg="brand.accent" border="1px solid" borderColor="brand.border">
              <Sparkles size={16} />
            </Box>
            <VStack align="flex-start" spacing={0}>
              <Text fontWeight="bold" color="brand.text" fontSize="sm">
                Transformation Partner
              </Text>
              <Text fontSize="2xs" color="brand.subtleText">
                Scoped access dashboard
              </Text>
            </VStack>
          </HStack>

          <Divider />

          {renderNav()}

          <Box flex={1} />

          <ProfileSection />
        </VStack>
      </Box>

      <Drawer isOpen={disclosure.isOpen} placement="left" onClose={disclosure.onClose} size="xs">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>Navigation</DrawerHeader>
          <DrawerBody>
            <Stack spacing={6}>
              <ProfileSection />
              {renderNav()}
              <Button leftIcon={<LogOut size={16} />} variant="outline" onClick={() => signOut()}>
                Logout
              </Button>
            </Stack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Flex flex={1} direction="column" h="100vh" overflow="hidden" p={{ base: 4, md: 8 }}>
        <Box flex={1} overflowY="auto">
          <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} mb={6} gap={4} wrap="wrap">
            <VStack align="flex-start" spacing={1}>
              <Text fontSize="sm" color="brand.subtleText">
                Partner Dashboard
              </Text>
              <Text fontSize="3xl" fontWeight="bold" color="brand.text">
                {profile?.fullName || 'Partner Admin'}
              </Text>
              <Text color="brand.subtleText" maxW="760px">
                Real-time oversight for assigned organizations with scoped interventions, approvals, and mentor engagement tools.
              </Text>
              <HStack spacing={3} align="center" flexWrap="wrap">
                <Badge colorScheme={profileStatus === 'ready' ? 'green' : 'orange'}>
                  {profileStatus === 'ready' ? 'Profile synced' : 'Profile syncing'}
                </Badge>
                <Text fontSize="xs" color="brand.subtleText">
                  Profile last updated: {lastUpdatedLabel}
                </Text>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => void handleManualRefresh()}
                  isLoading={profileLoading}
                >
                  Sync Profile
                </Button>
              </HStack>
              {showRefreshHint && (
                <HStack spacing={3} pt={2}>
                  <Badge colorScheme="orange">Refresh suggested</Badge>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => void handleManualRefresh()}
                    isLoading={profileLoading}
                  >
                    Refresh now
                    </Button>
                </HStack>
              )}
              {profileSyncWarning && (
                <HStack spacing={2} pt={2}>
                  <Badge colorScheme="red">Profile sync delayed</Badge>
                  <Text fontSize="xs" color="red.600">
                    Profile has not loaded within the expected timeframe.
                  </Text>
                </HStack>
              )}
            </VStack>
            <HeaderControls />
          </Flex>

          {isAdmin && !enableProfileRealtime && (
            <Alert status="warning" mb={6} borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle>Real-time profile updates are disabled.</AlertTitle>
                <AlertDescription>
                  Enable VITE_ENABLE_PROFILE_REALTIME to keep organization assignments in sync. Until then, use the
                  refresh button to pull updates.
                </AlertDescription>
              </Box>
            </Alert>
          )}

          {children}
        </Box>
      </Flex>
    </Flex>
  )
}

export default PartnerDashboardLayout
