import React, { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { RouteTransition } from '@/components/RouteTransition'
import {
  Box,
  Badge,
  Flex,
  VStack,
  HStack,
  Text,
  Button,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  IconButton,
  useDisclosure,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerBody,
  Divider,
  InputGroup,
  InputLeftElement,
  Input,
  useToast,
} from '@chakra-ui/react'
import {
  LucideIcon,
  Menu as MenuIcon,
  Target,
  Users,
  ClipboardList,
  Gavel,
  Megaphone,
  Gift,
  BookMarked,
  BookOpen,
  Sparkles,
  Search,
  Trophy,
  LogOut,
  CalendarDays,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCurrentWindow } from '@/hooks/useCurrentWindow'
import { BuildVillageModal } from '@/components/modals/BuildVillageModal'
import { ConfirmationWelcomeModal } from '@/components/modals/ConfirmationWelcomeModal'
import { PlatformTour } from '@/components/tour/PlatformTour'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'
import { isFreeUser as isFreeTierUser } from '@/utils/membership'
import PointsNotificationListener from '@/components/PointsNotificationListener'

interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  isPrimary?: boolean
  badge?: {
    label: string
  }
}

interface NavSection {
  label: string
  items: NavItem[]
}

const HEADER_HEIGHT = '72px'
const sectionLabelStyles = {
  fontSize: 'xs',
  fontWeight: 'semibold',
  letterSpacing: '0.08em',
  color: 'brand.subtleText',
} as const

export const MainLayout: React.FC = () => {
  const { profile, signOut, signingOut } = useAuth()
  const windowContext = useCurrentWindow()
  const location = useLocation()
  const navigate = useNavigate()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const toast = useToast()
  const [showVillagePrompt, setShowVillagePrompt] = useState(false)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [showTour, setShowTour] = useState(false)

  const buildVillageKey = useMemo(() => (profile ? `t4l.buildVillage.${profile.id}` : null), [profile])
  const welcomeKey = useMemo(() => (profile ? `t4l.newUserWelcome.${profile.id}` : null), [profile])

  useEffect(() => {
    localStorage.removeItem('t4l.dashboard_tour_progress')
  }, [])

  const isFreeUser = isFreeTierUser(profile)
  const isMentor = profile?.role === 'mentor'

  useEffect(() => {
    if (!profile) return

    if (buildVillageKey) {
      const hasVillageContext = Boolean(
        profile.villageId ||
          profile.corporateVillageId ||
          profile.companyId ||
          profile.companyCode ||
          profile.organizationId,
      )
      const shouldPromptVillage =
        isFreeUser && !hasVillageContext && location.pathname.startsWith('/app/')

      const stored = localStorage.getItem(buildVillageKey)
      setShowVillagePrompt(Boolean(shouldPromptVillage && !stored))
    }

    // Support all dashboard routes, not just weekly-glance
    if (
      welcomeKey &&
      (location.pathname.startsWith('/app/') ||
        location.pathname.startsWith('/mentor/') ||
        location.pathname.startsWith('/ambassador/'))
    ) {
      const shouldWelcome = localStorage.getItem(welcomeKey)
      if (shouldWelcome === 'pending') {
        setShowWelcomeModal(true)
      }
    }
  }, [buildVillageKey, isFreeUser, location.pathname, profile, welcomeKey])

  useEffect(() => {
    if (!welcomeKey) return

    const handleStorage = (event: StorageEvent) => {
      if (event.key === welcomeKey && event.newValue !== 'pending') {
        setShowWelcomeModal(false)
      }
    }

    window.addEventListener('storage', handleStorage)

    return () => window.removeEventListener('storage', handleStorage)
  }, [welcomeKey])

  const handleSignOut = async () => {
    const result = await signOut()
    if (result.error) {
      toast({
        title: 'Logout failed',
        description: result.error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  const handleVillageCreated = () => {
    if (buildVillageKey) {
      localStorage.setItem(buildVillageKey, 'completed')
    }
    setShowVillagePrompt(false)
  }
  const handleVillageSkipped = () => {
    if (buildVillageKey) {
      localStorage.setItem(buildVillageKey, 'skipped')
    }
    setShowVillagePrompt(false)
  }

  const handleWelcomeAcknowledged = () => {
    if (welcomeKey) {
      localStorage.removeItem(welcomeKey)
    }
    setShowWelcomeModal(false)
  }

  const navigationSections = useMemo<NavSection[]>(
    () => [
      {
        label: 'MY JOURNEY',
        items: [
          { label: 'Dashboard', path: '/app/weekly-glance', icon: CalendarDays, isPrimary: true },
          { label: 'Weekly Checklist', path: '/app/weekly-checklist', icon: ClipboardList, isPrimary: true },
          { label: 'Leadership Board', path: '/app/leadership-board', icon: Trophy },
          { label: 'My Courses', path: '/app/courses', icon: BookOpen, badge: { label: '1 new' }, isPrimary: true },
          { label: 'Peer Connect', path: '/app/peer-connect', icon: Users },
          { label: 'Impact Log', path: '/app/impact', icon: Target },
          { label: 'Leadership Council', path: '/app/leadership-council', icon: Gavel },
        ],
      },
      {
        label: 'COMMUNITY',
        items: [
          { label: 'Events', path: '/app/announcements', icon: Megaphone, badge: { label: '2' } },
          { label: 'Referral Rewards', path: '/app/referral-rewards', icon: Gift },
          { label: 'Global Book Club', path: '/app/book-club', icon: BookMarked },
          { label: 'Shameless Circle', path: '/app/shameless-circle', icon: Sparkles },
        ],
      },
    ],
    [],
  )

  const filteredNavigation = useMemo(() => {
    return navigationSections.map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (isMentor && item.label === 'Leadership Board') {
          return false
        }
        return true
      }),
    }))
  }, [isMentor, navigationSections])

  const handleNavigation = (path: string) => {
    const restrictedPaths = ['/app/peer-connect', '/app/leadership-council']

    if (isFreeUser && restrictedPaths.some(restricted => path.startsWith(restricted))) {
      toast({
        title: 'Upgrade required',
        description: 'This feature is available to paid members. Upgrade to continue.',
        status: 'info',
        duration: 3500,
        isClosable: true,
      })
      navigate('/app/weekly-glance', { replace: true })
      onClose()
      return
    }

    navigate(path)
    onClose()
  }

  const NavContent = ({ variant }: { variant: 'sidebar' | 'drawer' }) => {
    const isDark = variant === 'drawer'
    const sectionTextColor = isDark ? 'whiteAlpha.700' : sectionLabelStyles.color
    const activeBorder = isDark ? 'whiteAlpha.900' : 'brand.primary'
    const activeText = isDark ? 'white' : 'brand.text'
    const inactiveText = isDark ? 'whiteAlpha.900' : 'brand.subtleText'
    const hoverBg = isDark ? 'whiteAlpha.100' : 'brand.primaryMuted'
    const activeBg = isDark ? 'whiteAlpha.100' : 'brand.primaryMuted'
    const dividerColor = isDark ? 'whiteAlpha.200' : 'brand.border'
    const badgeStyles = isDark
      ? { bg: 'whiteAlpha.200', color: 'whiteAlpha.900' }
      : { bg: 'brand.primaryMuted', color: 'brand.text' }

    return (
      <VStack align="stretch" spacing={6} pt={4}>
        {filteredNavigation.map((section, sectionIndex) => (
          <Box key={section.label}>
            <Text
              mb={3}
              fontSize="xs"
              fontWeight="semibold"
              letterSpacing="0.12em"
              textTransform="uppercase"
              color={sectionTextColor}
            >
              {section.label}
            </Text>
            <VStack align="stretch" spacing={2}>
              {section.items.map(item => {
                const isActive = location.pathname.startsWith(item.path)
                const fontWeight = isActive || item.isPrimary ? 'semibold' : 'medium'

                // Add data-tour attributes for tour targets
                const getTourAttribute = (path: string) => {
                  if (path === '/app/weekly-glance') return 'dashboard'
                  if (path === '/app/weekly-checklist') return 'weekly-checklist'
                  if (path === '/app/impact') return 'impact-log'
                  if (path === '/app/announcements') return 'community'
                  return undefined
                }

                return (
                  <Button
                    key={item.path}
                    variant="ghost"
                    justifyContent="flex-start"
                    onClick={() => handleNavigation(item.path)}
                    bg={isActive ? activeBg : 'transparent'}
                    color={isActive ? activeText : inactiveText}
                    _hover={{ bg: hoverBg, color: activeText }}
                    minH="48px"
                    px={4}
                    borderLeftWidth="4px"
                    borderLeftColor={isActive ? activeBorder : 'transparent'}
                    borderRadius="md"
                    fontWeight={fontWeight}
                    fontSize="sm"
                    aria-current={isActive ? 'page' : undefined}
                    data-tour={getTourAttribute(item.path)}
                  >
                    <HStack spacing={3} w="full" justify="space-between">
                      <HStack spacing={3}>
                        <Box color={isActive ? activeText : inactiveText}>
                          <item.icon size={20} />
                        </Box>
                        <Text>{item.label}</Text>
                      </HStack>
                      {item.badge && (
                        <Badge px={2} borderRadius="full" fontSize="xs" {...badgeStyles}>
                          {item.badge.label}
                        </Badge>
                      )}
                    </HStack>
                  </Button>
                )
              })}
            </VStack>
            {sectionIndex < filteredNavigation.length - 1 && (
              <Divider mt={6} borderColor={dividerColor} />
            )}
          </Box>
        ))}
      </VStack>
    )
  }

  return (
    <Flex minH="100vh" h="100vh" bg="brand.accent" color="brand.text" overflow="hidden">
      {/* Desktop Sidebar */}
      <Box
        w={{ base: '0', md: '260px' }}
        bg="brand.sidebar"
        borderRight="1px solid"
        borderColor="rgba(234, 177, 48, 0.2)"
        p={4}
        display={{ base: 'none', md: 'block' }}
      >
        <VStack align="stretch" h="full" spacing={8}>
          <HStack spacing={3} align="center">
            <Box boxSize="36px" borderRadius="full" bg="white" display="grid" placeItems="center" boxShadow="sm">
              <Text fontWeight="bold" color="brand.primary">
                T4
              </Text>
            </Box>
            <Box>
              <Text fontSize="sm" fontWeight="bold" color="brand.text">
                Tier Platform
              </Text>
              <Text fontSize="xs" color="brand.subtleText">
                Transformation Journey
              </Text>
            </Box>
          </HStack>

          {/* Navigation */}
          <Box flex="1">
            <NavContent variant="sidebar" />
          </Box>

          {/* User Info */}
          <VStack align="stretch" spacing={3}>
            <HStack align="center" spacing={3}>
              <Avatar size="sm" name={profile?.fullName} src={profile?.avatarUrl} bg="brand.primary" color="white" />
              <Box flex="1">
                <Text fontSize="sm" fontWeight="semibold" color="brand.text">
                  {profile?.fullName || 'Your name'}
                </Text>
                <Text fontSize="xs" color="brand.subtleText">
                  {profile?.totalPoints ? `${profile.totalPoints} points` : 'Logged in'}
                </Text>
              </Box>
            </HStack>
            <Button
              leftIcon={<LogOut size={16} />}
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              colorScheme="red"
              isLoading={signingOut}
              isDisabled={signingOut}
            >
              Sign Out
            </Button>
          </VStack>
        </VStack>
      </Box>

      {/* Main Content */}
      <Flex flex="1" direction="column" h="100vh" maxH="100vh" overflow="hidden">
        {/* Header */}
        <Flex
          align="center"
          justify="space-between"
          px={{ base: 4, md: 8 }}
          h={HEADER_HEIGHT}
          flexShrink={0}
          bg="white"
          borderBottom="1px solid"
          borderColor="brand.border"
          gap={3}
        >
          <HStack spacing={3} display={{ base: 'flex', md: 'none' }}>
            <IconButton
              icon={<MenuIcon size={20} />}
              variant="ghost"
              aria-label="Open menu"
              onClick={onOpen}
            />
            <Text fontWeight="bold">T4</Text>
          </HStack>

          <InputGroup maxW={{ base: '100%', md: '420px' }} flex={1}>
            <InputLeftElement pointerEvents="none">
              <Search size={18} color="#6b7392" />
            </InputLeftElement>
            <Input
              placeholder="Search"
              bg="brand.accent"
              borderColor="brand.border"
              _focus={{ borderColor: 'brand.primary', boxShadow: '0 0 0 1px #5d6bff' }}
            />
          </InputGroup>

          <HStack spacing={3} ml={{ base: 0, md: 4 }} align="center">
            <NotificationDropdown />
            <Menu>
              <MenuButton as={Button} variant="ghost" px={0} _hover={{ bg: 'transparent' }}>
                <HStack spacing={2}>
                  <Avatar size="sm" name={profile?.fullName} src={profile?.avatarUrl} bg="brand.primary" color="white" />
                  <Text display={{ base: 'none', md: 'block' }} fontSize="sm" color="brand.text">
                    {profile?.fullName || "User's name"}
                  </Text>
                </HStack>
              </MenuButton>
              <MenuList bg="white" borderColor="brand.border">
                <MenuItem onClick={() => navigate('/app/profile')}>Profile</MenuItem>
                <MenuDivider />
                <MenuItem onClick={handleSignOut} isDisabled={signingOut}>Sign Out</MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </Flex>

        {/* Content */}
        <Box
          flex="1"
          height={`calc(100vh - ${HEADER_HEIGHT})`}
          overflowY="auto"
          p={{ base: 4, md: 8 }}
        >
          <RouteTransition>
            <Outlet />
          </RouteTransition>
        </Box>
      </Flex>

      {/* Mobile Drawer */}
      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay bg="rgba(0, 0, 0, 0.65)" />
        <DrawerContent bg="brand.deepPlum" color="white">
          <DrawerCloseButton color="whiteAlpha.900" />
          <DrawerBody pt={10} pb={6} display="flex" flexDirection="column">
            <VStack align="stretch" spacing={6} flex="1">
              <HStack spacing={3} align="center">
                <Avatar size="sm" name={profile?.fullName} src={profile?.avatarUrl} bg="whiteAlpha.200" />
                <Box>
                  <Text fontWeight="semibold" color="white">
                    {profile?.fullName || "User's name"}
                  </Text>
                  <Button
                    variant="link"
                    color="whiteAlpha.700"
                    fontSize="sm"
                    onClick={() => handleNavigation('/app/profile')}
                  >
                    View Profile
                  </Button>
                </Box>
              </HStack>

              <NavContent variant="drawer" />
            </VStack>

            <Divider borderColor="whiteAlpha.200" mt={6} />
            <VStack align="stretch" spacing={2} pt={4}>
              <Button
                variant="ghost"
                justifyContent="flex-start"
                color="whiteAlpha.800"
                fontSize="sm"
                onClick={() => handleNavigation('/app/profile')}
                minH="44px"
              >
                Settings
              </Button>
              <Button
                variant="ghost"
                justifyContent="flex-start"
                color="whiteAlpha.700"
                fontSize="sm"
                onClick={handleSignOut}
                isLoading={signingOut}
                isDisabled={signingOut}
                minH="44px"
              >
                Sign Out
              </Button>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <BuildVillageModal
        isOpen={showVillagePrompt}
        onCreate={handleVillageCreated}
        onSkip={handleVillageSkipped}
      />

      <ConfirmationWelcomeModal
        isOpen={showWelcomeModal}
        onAcknowledge={handleWelcomeAcknowledged}
        firstName={profile?.firstName}
        role={profile?.role}
        membershipStatus={profile?.membershipStatus}
        windowContext={windowContext}
        onStartTour={() => setShowTour(true)}
      />

      <PlatformTour isOpen={showTour} onClose={() => setShowTour(false)} />

      <PointsNotificationListener />
    </Flex>
  )
}
