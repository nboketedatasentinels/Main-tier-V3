import React from 'react'
import {
  Avatar,
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
  Menu as ChakraMenu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
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
import { LogOut, Menu, RefreshCw, Sparkles, User } from 'lucide-react'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'
import { useAuth } from '@/hooks/useAuth'
import { usePartnerAdminSnapshot } from '@/hooks/partner/usePartnerAdminSnapshot'
import { type NavigationSection, buildPartnerNavItems } from '@/utils/navigationItems'

const APP_VIEWPORT_HEIGHT = { base: '100dvh', md: '100vh' } as const
const MOBILE_NAV_HEIGHT = 68
const MOBILE_NAV_HEIGHT_WITH_SAFE_AREA = `calc(${MOBILE_NAV_HEIGHT}px + env(safe-area-inset-bottom))`
const MOBILE_NAV_BUTTON_HEIGHT = MOBILE_NAV_HEIGHT - 12

interface PartnerLayoutProps {
  children: React.ReactNode
  organizations: { id?: string; code: string; name: string }[]
  selectedOrg: string
  onSelectOrg: (org: string) => void
  navSections?: NavigationSection[]
  activeItem?: string
  onNavigate?: (key: string) => void
}

export const PartnerLayout: React.FC<PartnerLayoutProps> = ({
  children,
  organizations,
  selectedOrg,
  onSelectOrg,
  navSections,
  activeItem,
  onNavigate,
}) => {
  const sidebarWidth = '280px'
  const disclosure = useDisclosure()
  const { profile, signOut, signingOut, refreshProfile, profileLoading, lastProfileLoadAt, isAdmin } = useAuth()
  const { assignedOrganizationIds } = usePartnerAdminSnapshot({ enabled: isAdmin })
  const enableProfileRealtime = import.meta.env.VITE_ENABLE_PROFILE_REALTIME === 'true'
  const toast = useToast()
  const [lastUpdatedLabel, setLastUpdatedLabel] = React.useState('Not yet loaded')
  const assignedCount = organizations.length || assignedOrganizationIds.length || 0
  const sections = navSections?.length ? navSections : buildPartnerNavItems()
  const primaryNavItems = React.useMemo(() => sections.flatMap(section => section.items).slice(0, 4), [sections])
  const mobileLabelByKey = React.useMemo<Record<string, string>>(
    () => ({
      overview: 'Overview',
      'at-risk': 'At-Risk',
      users: 'Users',
      'partner-assignment': 'Issue',
      'organization-management': 'Orgs',
      reports: 'Reports',
      settings: 'Settings',
    }),
    [],
  )

  const orgOptions = organizations.length ? organizations : []

  const formatLastUpdated = (timestamp?: string | null) => {
    if (!timestamp) return 'Not yet loaded'
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return 'Not yet loaded'
    return date.toLocaleString()
  }

  const updateRefreshHint = React.useCallback(() => {
    if (!lastProfileLoadAt) {
      setLastUpdatedLabel(formatLastUpdated(null))
      return
    }
    setLastUpdatedLabel(formatLastUpdated(lastProfileLoadAt))
  }, [lastProfileLoadAt])

  React.useEffect(() => {
    updateRefreshHint()
    const interval = window.setInterval(updateRefreshHint, 60 * 1000)
    return () => window.clearInterval(interval)
  }, [updateRefreshHint])

  const handleLogout = React.useCallback(async () => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] 🖱️ [PartnerLayout] Logout button clicked`)

    try {
      console.log(`[${new Date().toISOString()}] 🔄 [PartnerLayout] Calling AuthContext.signOut()`)
      const result = await signOut()

      if (result.error) {
        // Only show toast if it's NOT the "already in progress" error
        if (result.error.message !== 'Sign out already in progress') {
          console.error(`[${new Date().toISOString()}] 🔴 [PartnerLayout] Logout failed`, result.error)
          toast({
            title: 'Logout failed',
            description: result.error.message,
            status: 'error',
            duration: 5000,
            isClosable: true,
          })
        } else {
          console.warn(`[${new Date().toISOString()}] 🟡 [PartnerLayout] Sign out already in progress (caught error)`)
        }
      } else {
        console.log(`[${new Date().toISOString()}] ✅ [PartnerLayout] AuthContext.signOut() returned success`)
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] 🔴 [PartnerLayout] Unexpected error during logout`, err)
    }
  }, [signOut, toast])

  const handleManualRefresh = React.useCallback(async () => {
    const result = await refreshProfile({ reason: 'partner-dashboard-manual', isManual: true })
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
    <Stack spacing={4} py={4} px={2}>
      {sections.map(section => (
        <Stack key={section.title ?? 'navigation'} spacing={2}>
          {section.title && (
            <Text fontSize="xs" color="brand.subtleText" px={2} textTransform="uppercase" letterSpacing="wide">
              {section.title}
            </Text>
          )}
          <VStack align="stretch" spacing={2}>
            {section.items.map(item => (
              <Button
                key={item.key}
                variant="unstyled"
                w="full"
                display="flex"
                alignItems="center"
                justifyContent="flex-start"
                gap={3}
                px={3}
                py={2}
                minH="44px"
                borderRadius="md"
                cursor="pointer"
                _hover={{ bg: 'brand.accent' }}
                bg={activeItem === item.key ? 'brand.accent' : undefined}
                border="1px solid"
                borderColor={activeItem === item.key ? 'brand.border' : 'transparent'}
                transition="all 0.2s"
                onClick={() => onNavigate?.(item.key)}
                aria-current={activeItem === item.key ? 'page' : undefined}
              >
                {item.icon && (
                  <Box p={2} borderRadius="lg" bg="white" border="1px solid" borderColor="brand.border">
                    <Icon as={item.icon} color="brand.text" />
                  </Box>
                )}
                <VStack align="flex-start" spacing={0} flex={1}>
                  <Text fontSize="sm" fontWeight="semibold" color="brand.text">
                    {item.label}
                  </Text>
                  {item.description && (
                    <Text fontSize="xs" color="brand.subtleText">
                      {item.description}
                    </Text>
                  )}
                </VStack>
              </Button>
            ))}
          </VStack>
        </Stack>
      ))}
    </Stack>
  )

  const ProfileSection = () => (
    <HStack spacing={3} p={3} borderRadius="lg" bg="brand.accent" align="flex-start">
      <Avatar name={profile?.fullName || 'Partner'} size="sm" />
      <VStack align="flex-start" spacing={0} flex={1}>
        <Text fontWeight="bold" color="brand.text" fontSize="sm">
          {profile?.fullName || 'Partner'}
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
          onClick={handleLogout}
          isLoading={signingOut}
          isDisabled={signingOut}
        >
          {signingOut ? 'Signing out...' : 'Sign out'}
        </Button>
      </VStack>
    </HStack>
  )

  const HeaderControls = () => (
    <HStack spacing={3} align="center" wrap="wrap" justify={{ base: 'flex-start', md: 'flex-end' }} w={{ base: 'full', md: 'auto' }}>
      <Select
        flex={{ base: '1 1 220px', md: '0 1 auto' }}
        minW={{ base: 'full', sm: '220px' }}
        maxW={{ base: 'full', md: '280px' }}
        value={selectedOrg}
        onChange={e => onSelectOrg(e.target.value)}
        bg="white"
        borderColor="brand.border"
      >
        <option value="all">All Companies</option>
        {orgOptions.map(org => (
          <option key={org.id || org.code} value={org.id || org.code}>
            {org.name}
          </option>
        ))}
      </Select>
      <NotificationDropdown />
      <ChakraMenu>
        <MenuButton
          as={Button}
          variant="outline"
          leftIcon={<Avatar size="sm" name={profile?.fullName || 'Partner'} />}
          display={{ base: 'none', md: 'inline-flex' }}
        >
          <Text fontSize="sm" noOfLines={1} maxW="150px">
            {profile?.fullName || 'Partner'}
          </Text>
        </MenuButton>
        <MenuList>
          <MenuItem icon={<User size={16} />} onClick={() => onNavigate?.('profile')}>Profile</MenuItem>
          <MenuDivider />
          <MenuItem
            icon={<LogOut size={16} />}
            onClick={handleLogout}
            isDisabled={signingOut}
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
          </MenuItem>
        </MenuList>
      </ChakraMenu>
      <IconButton
        aria-label="Open navigation"
        icon={<Menu />}
        variant="outline"
        display={{ base: 'inline-flex', md: 'none' }}
        onClick={disclosure.onOpen}
      />
    </HStack>
  )

  return (
    <Flex minH={APP_VIEWPORT_HEIGHT} h={APP_VIEWPORT_HEIGHT} bg="brand.canvas" overflow="hidden">
      <Box
        display={{ base: 'none', md: 'block' }}
        w={sidebarWidth}
        borderRight="1px solid"
        borderColor="brand.border"
        bg="white"
        p={4}
        h={APP_VIEWPORT_HEIGHT}
        overflowY="auto"
      >
        <VStack align="stretch" spacing={4} h="full">
          <HStack spacing={2}>
            <Box p={1.5} borderRadius="md" bg="brand.accent" border="1px solid" borderColor="brand.border">
              <Sparkles size={16} />
            </Box>
            <VStack align="flex-start" spacing={0}>
              <Text fontWeight="bold" color="brand.text" fontSize="sm">
                Partner
              </Text>
              <Text fontSize="2xs" color="brand.subtleText">
                Organization oversight
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
              <Button
                leftIcon={<LogOut size={16} />}
                variant="outline"
                onClick={handleLogout}
                isLoading={signingOut}
                isDisabled={signingOut}
              >
                {signingOut ? 'Signing out...' : 'Logout'}
              </Button>
            </Stack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Flex
        flex={1}
        direction="column"
        h={APP_VIEWPORT_HEIGHT}
        overflow="hidden"
        px={{ base: 4, md: 8 }}
        pt={{ base: 4, md: 8 }}
        pb={{ base: MOBILE_NAV_HEIGHT_WITH_SAFE_AREA, md: 8 }}
        minW={0}
        minH={0}
      >
        <Box flex={1} overflowY="auto">
          <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} mb={6} gap={4} wrap="wrap">
            <VStack align="flex-start" spacing={1}>
              <Text fontSize="sm" color="brand.subtleText">
                Partner Dashboard
              </Text>
              <Text fontSize={{ base: '2xl', md: '3xl' }} lineHeight="shorter" fontWeight="bold" color="brand.text" wordBreak="break-word">
                Welcome back, {profile?.fullName || 'Partner'}
              </Text>
              <Text color="brand.subtleText" maxW="760px">
                Your partner workspace for learners, organizations, and interventions.
              </Text>
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

      {primaryNavItems.length > 0 && (
        <Box
          display={{ base: 'block', md: 'none' }}
          position="fixed"
          left={0}
          right={0}
          bottom={0}
          bg="white"
          borderTop="1px solid"
          borderColor="brand.border"
          zIndex={20}
          minH={MOBILE_NAV_HEIGHT_WITH_SAFE_AREA}
          pt={1}
          pb="calc(8px + env(safe-area-inset-bottom))"
          px={2}
        >
          <HStack spacing={1}>
            {primaryNavItems.map(item => {
              const isActive = activeItem === item.key
              return (
                <Button
                  key={item.key}
                  variant="ghost"
                  flex="1"
                  minW={0}
                  h={`${MOBILE_NAV_BUTTON_HEIGHT}px`}
                  borderRadius="md"
                  onClick={() => onNavigate?.(item.key)}
                  bg={isActive ? 'brand.primaryMuted' : 'transparent'}
                  color={isActive ? 'brand.primary' : 'brand.subtleText'}
                  _hover={{ bg: 'brand.primaryMuted', color: 'brand.primary' }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <VStack spacing={1} w="full" minW={0}>
                    {item.icon && <Icon as={item.icon} boxSize={4} />}
                    <Text fontSize="2xs" noOfLines={1} w="full" textAlign="center">
                      {mobileLabelByKey[item.key] ?? item.label}
                    </Text>
                  </VStack>
                </Button>
              )
            })}
            <Button
              variant="ghost"
              flex="1"
              minW={0}
              h={`${MOBILE_NAV_BUTTON_HEIGHT}px`}
              borderRadius="md"
              onClick={disclosure.onOpen}
              bg={disclosure.isOpen ? 'brand.primaryMuted' : 'transparent'}
              color={disclosure.isOpen ? 'brand.primary' : 'brand.subtleText'}
              _hover={{ bg: 'brand.primaryMuted', color: 'brand.primary' }}
              aria-label="Open navigation menu"
              aria-expanded={disclosure.isOpen}
            >
              <VStack spacing={1} w="full" minW={0}>
                <Icon as={Menu} boxSize={4} />
                <Text fontSize="2xs" noOfLines={1} w="full" textAlign="center">
                  Menu
                </Text>
              </VStack>
            </Button>
          </HStack>
        </Box>
      )}
    </Flex>
  )
}

export default PartnerLayout
