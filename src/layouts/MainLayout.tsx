import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  InputRightElement,
  Input,
  Tooltip,
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
import { BuildVillageModal } from '@/components/modals/BuildVillageModal'
import { PersonalityTypeModal } from '@/components/modals/PersonalityTypeModal'
import { PlatformTour } from '@/components/tour/PlatformTour'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'
import { isFreeUser as isFreeTierUser } from '@/utils/membership'
import { UpgradePromptModal } from '@/components/UpgradePromptModal'
import PointsNotificationListener from '@/components/PointsNotificationListener'
import { MandatoryAnnouncementGate } from '@/components/announcements/MandatoryAnnouncementGate'

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
const APP_VIEWPORT_HEIGHT = { base: '100dvh', md: '100vh' } as const
const MOBILE_NAV_HEIGHT = 68
const MOBILE_NAV_HEIGHT_WITH_SAFE_AREA = `calc(${MOBILE_NAV_HEIGHT}px + env(safe-area-inset-bottom))`
const MOBILE_NAV_BUTTON_HEIGHT = MOBILE_NAV_HEIGHT - 12

type RestrictedFeatureConfig = {
  pathPrefix: string
  featureName: string
  tooltip: string
  benefits: string[]
}

const RESTRICTED_FREE_FEATURES: RestrictedFeatureConfig[] = [
  {
    pathPrefix: '/app/peer-connect',
    featureName: 'Peer Connect',
    tooltip: 'Upgrade required to access peer matching and session scheduling.',
    benefits: [
      'One-on-one peer matching',
      'Session scheduling and confirmations',
      'Progress accountability workflows',
      'Access to premium networking tools',
    ],
  },
  {
    pathPrefix: '/app/leadership-council',
    featureName: 'Leadership Council',
    tooltip: 'Upgrade required to join premium leadership council sessions.',
    benefits: [
      'Leadership council live sessions',
      'Advanced facilitation playbooks',
      'Premium discussion circles',
      'Leadership growth tracking',
    ],
  },
]

const getRestrictedFeatureForPath = (path: string): RestrictedFeatureConfig | null =>
  RESTRICTED_FREE_FEATURES.find((feature) => path.startsWith(feature.pathPrefix)) ?? null

export const MainLayout: React.FC = () => {
  const { profile, profileStatus, signOut, signingOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const {
    isOpen: isUpgradeModalOpen,
    onOpen: onUpgradeModalOpen,
    onClose: onUpgradeModalClose,
  } = useDisclosure()
  const toast = useToast()
  const [showVillagePrompt, setShowVillagePrompt] = useState(false)
  const [showPersonalityModal, setShowPersonalityModal] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [selectedRestrictedFeature, setSelectedRestrictedFeature] = useState<RestrictedFeatureConfig | null>(null)
  const [suppressSessionOnboarding, setSuppressSessionOnboarding] = useState(false)
  const onboardingSessionRef = useRef<string | null>(null)

  const buildVillageKey = useMemo(() => (profile ? `t4l.buildVillage.${profile.id}` : null), [profile])
  const welcomeKey = useMemo(() => (profile ? `t4l.newUserWelcome.${profile.id}` : null), [profile])
  const isAppShellRoute = useMemo(
    () =>
      location.pathname.startsWith('/app/') ||
      location.pathname.startsWith('/mentor/') ||
      location.pathname.startsWith('/ambassador/'),
    [location.pathname],
  )
  const hasCompletedPersonalityAndValues = useMemo(() => {
    if (!profile) return false
    return (
      Boolean(profile.hasCompletedPersonalityTest) &&
      Boolean(profile.hasCompletedValuesTest) &&
      Boolean(profile.personalityType) &&
      Array.isArray(profile.coreValues) &&
      profile.coreValues.length === 5
    )
  }, [profile])
  const shouldAutoOpenTour = Boolean(
    welcomeKey && isAppShellRoute && localStorage.getItem(welcomeKey) === 'pending',
  )
  // Only prompt once profile is fully loaded from database (profileStatus === 'ready')
  const shouldPromptPersonalityModal = Boolean(
    profile && isAppShellRoute && profileStatus === 'ready' && !hasCompletedPersonalityAndValues
  )
  const onboardingSessionSuppressionKey = useMemo(
    () => (profile?.id ? `t4l.onboardingSessionSuppressed.${profile.id}` : null),
    [profile?.id],
  )

  useEffect(() => {
    localStorage.removeItem('t4l.dashboard_tour_progress')
  }, [])

  useEffect(() => {
    if (!onboardingSessionSuppressionKey) {
      setSuppressSessionOnboarding(false)
      return
    }
    setSuppressSessionOnboarding(sessionStorage.getItem(onboardingSessionSuppressionKey) === 'true')
  }, [onboardingSessionSuppressionKey])

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

  }, [buildVillageKey, isFreeUser, location.pathname, profile])

  useEffect(() => {
    if (!profile?.id || !isAppShellRoute) {
      onboardingSessionRef.current = null
      return
    }
    if (onboardingSessionRef.current === profile.id) return
    if (suppressSessionOnboarding) return

    onboardingSessionRef.current = profile.id
    if (shouldAutoOpenTour) {
      if (welcomeKey) {
        localStorage.removeItem(welcomeKey)
      }
      setShowTour(true)
      return
    }
    if (shouldPromptPersonalityModal) {
      setShowPersonalityModal(true)
    }
  }, [
    isAppShellRoute,
    profile?.id,
    shouldAutoOpenTour,
    shouldPromptPersonalityModal,
    suppressSessionOnboarding,
    welcomeKey,
  ])

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

  const handleTourClosed = useCallback(() => {
    setShowTour(false)
    if (!suppressSessionOnboarding && shouldPromptPersonalityModal) {
      setShowPersonalityModal(true)
    }
  }, [shouldPromptPersonalityModal, suppressSessionOnboarding])

  const handlePersonalityModalComplete = useCallback(() => {
    if (onboardingSessionSuppressionKey) {
      sessionStorage.setItem(onboardingSessionSuppressionKey, 'true')
    }
    setSuppressSessionOnboarding(true)
    setShowTour(false)
    setShowPersonalityModal(false)
  }, [onboardingSessionSuppressionKey])

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

  const primaryNavItems = useMemo(
    () =>
      filteredNavigation
        .flatMap(section => section.items.filter(item => item.isPrimary))
        .slice(0, 4),
    [filteredNavigation],
  )

  const openUpgradePrompt = useCallback(
    (feature: RestrictedFeatureConfig) => {
      setSelectedRestrictedFeature(feature)
      onUpgradeModalOpen()
      toast({
        title: 'Upgrade required',
        description: `${feature.featureName} is available on paid plans.`,
        status: 'info',
        duration: 3500,
        isClosable: true,
      })
    },
    [onUpgradeModalOpen, toast],
  )

  const closeUpgradePrompt = useCallback(() => {
    onUpgradeModalClose()
    setSelectedRestrictedFeature(null)
  }, [onUpgradeModalClose])

  const searchableNavigation = useMemo(
    () =>
      filteredNavigation.flatMap(section =>
        section.items.map(item => ({
          ...item,
          sectionLabel: section.label,
          searchText: `${section.label} ${item.label} ${item.path}`.toLowerCase(),
        })),
      ),
    [filteredNavigation],
  )

  const searchResults = useMemo(() => {
    const query = globalSearchQuery.trim().toLowerCase()
    if (!query) return []

    return searchableNavigation.filter(item => item.searchText.includes(query)).slice(0, 6)
  }, [globalSearchQuery, searchableNavigation])

  const handleNavigation = (path: string) => {
    const restrictedFeature = isFreeUser ? getRestrictedFeatureForPath(path) : null
    if (restrictedFeature) {
      openUpgradePrompt(restrictedFeature)
      onClose()
      return
    }

    navigate(path)
    onClose()
  }

  const handleSearchNavigation = (path: string) => {
    handleNavigation(path)
    setGlobalSearchQuery('')
  }

  const handleSearchSubmit = () => {
    const query = globalSearchQuery.trim()
    if (!query) return

    const firstMatch = searchResults[0]
    if (!firstMatch) {
      toast({
        title: 'No matching page found',
        description: 'Try page names like Weekly Checklist, Impact Log, or Events.',
        status: 'info',
        duration: 3200,
        isClosable: true,
      })
      return
    }

    handleSearchNavigation(firstMatch.path)
  }

  useEffect(() => {
    setGlobalSearchQuery('')
  }, [location.pathname])

  const NavContent = ({ variant }: { variant: 'sidebar' | 'drawer' }) => {
    const isDark = variant === 'drawer'
    const sectionTextColor = isDark ? 'whiteAlpha.600' : 'gray.500'
    const activeBorder = isDark ? 'white' : 'purple.600'
    const activeText = isDark ? 'white' : 'purple.700'
    const activeIconColor = isDark ? 'white' : 'purple.600'
    const inactiveText = isDark ? 'whiteAlpha.800' : 'gray.600'
    const inactiveIconColor = isDark ? 'whiteAlpha.700' : 'gray.400'
    const hoverBg = isDark ? 'whiteAlpha.100' : 'purple.50'
    const activeBg = isDark ? 'whiteAlpha.150' : 'purple.50'
    const dividerColor = isDark ? 'whiteAlpha.200' : 'gray.200'

    return (
      <VStack align="stretch" spacing={5} pt={2}>
        {filteredNavigation.map((section, sectionIndex) => (
          <Box key={section.label}>
            <Text
              mb={2}
              fontSize="xs"
              fontWeight="bold"
              letterSpacing="0.1em"
              textTransform="uppercase"
              color={sectionTextColor}
              fontFamily="heading"
              px={3}
            >
              {section.label}
            </Text>
            <VStack align="stretch" spacing={1}>
              {section.items.map(item => {
                const isActive = location.pathname.startsWith(item.path)
                const restrictedFeature = isFreeUser ? getRestrictedFeatureForPath(item.path) : null
                const isRestrictedForFreeUser = Boolean(restrictedFeature)

                const getTourAttribute = (path: string) => {
                  if (path === '/app/weekly-glance') return 'dashboard'
                  if (path === '/app/weekly-checklist') return 'weekly-checklist'
                  if (path === '/app/impact') return 'impact-log'
                  if (path === '/app/announcements') return 'community'
                  return undefined
                }

                const navButton = (
                  <Button
                    key={item.path}
                    variant="ghost"
                    justifyContent="flex-start"
                    onClick={() => handleNavigation(item.path)}
                    bg={isActive ? activeBg : 'transparent'}
                    color={isActive ? activeText : inactiveText}
                    _hover={{ bg: hoverBg, color: activeText, transform: 'translateX(2px)' }}
                    minH="44px"
                    px={3}
                    borderLeftWidth="3px"
                    borderLeftColor={isActive ? activeBorder : 'transparent'}
                    borderRadius="lg"
                    fontWeight={isActive ? 'semibold' : 'medium'}
                    fontSize="sm"
                    fontFamily="body"
                    transition="all 0.2s ease"
                    aria-current={isActive ? 'page' : undefined}
                    data-tour={getTourAttribute(item.path)}
                    sx={isRestrictedForFreeUser ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                  >
                    <HStack spacing={3} w="full" justify="space-between">
                      <HStack spacing={3}>
                        <Box color={isActive ? activeIconColor : inactiveIconColor} transition="color 0.2s">
                          <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                        </Box>
                        <Text color="inherit" fontFamily="body">{item.label}</Text>
                        {isRestrictedForFreeUser && item.label !== 'Leadership Council' ? (
                          <Badge colorScheme="orange" variant="subtle" fontSize="2xs">
                            Pro
                          </Badge>
                        ) : null}
                      </HStack>
                      {item.badge && (
                        <Badge
                          bg={isDark ? 'whiteAlpha.200' : 'purple.100'}
                          color={isDark ? 'white' : 'purple.700'}
                          px={2}
                          py={0.5}
                          borderRadius="full"
                          fontSize="2xs"
                          fontWeight="bold"
                        >
                          {item.badge.label}
                        </Badge>
                      )}
                    </HStack>
                  </Button>
                )

                if (!isRestrictedForFreeUser || !restrictedFeature) return navButton

                return (
                  <Tooltip key={item.path} label={restrictedFeature.tooltip} hasArrow openDelay={200}>
                    <Box>{navButton}</Box>
                  </Tooltip>
                )
              })}
            </VStack>
            {sectionIndex < filteredNavigation.length - 1 && (
              <Divider mt={5} borderColor={dividerColor} />
            )}
          </Box>
        ))}
      </VStack>
    )
  }

  return (
    <Flex minH={APP_VIEWPORT_HEIGHT} h={APP_VIEWPORT_HEIGHT} bg="brand.accent" color="brand.text" overflow="hidden">
      {/* Desktop Sidebar */}
      <Box
        w={{ base: '0', md: '260px' }}
        bg="white"
        borderRight="1px solid"
        borderColor="gray.200"
        display={{ base: 'none', md: 'block' }}
        overflowY="auto"
      >
        <VStack align="stretch" h="full" spacing={0}>
          {/* Logo Header */}
          <HStack
            spacing={3}
            align="center"
            px={4}
            py={5}
            borderBottom="1px solid"
            borderColor="gray.100"
          >
            <Box
              boxSize="40px"
              borderRadius="xl"
              bgGradient="linear(to-br, purple.600, purple.800)"
              display="grid"
              placeItems="center"
              boxShadow="md"
            >
              <Text fontWeight="bold" fontSize="sm" color="white" fontFamily="heading">
                T4L
              </Text>
            </Box>
            <Box>
              <Text fontSize="sm" fontWeight="semibold" color="gray.800" fontFamily="heading">
                Transformation
              </Text>
              <Text fontSize="xs" color="gray.500" fontFamily="body">
                Leadership Journey
              </Text>
            </Box>
          </HStack>

          {/* Navigation */}
          <Box flex="1" px={3} py={4} overflowY="auto">
            <NavContent variant="sidebar" />
          </Box>

          {/* User Info */}
          <Box px={4} py={4} borderTop="1px solid" borderColor="gray.100" bg="gray.50">
            <HStack align="center" spacing={3} mb={3}>
              <Avatar
                size="sm"
                name={profile?.fullName}
                src={profile?.avatarUrl}
                bg="purple.600"
                color="white"
                border="2px solid"
                borderColor="purple.200"
              />
              <Box flex="1">
                <Text fontSize="sm" fontWeight="semibold" color="gray.800" fontFamily="body" noOfLines={1}>
                  {profile?.fullName || 'Your name'}
                </Text>
                <Text fontSize="xs" color="gray.500" fontFamily="body">
                  {profile?.totalPoints ? `${profile.totalPoints.toLocaleString()} pts` : 'Member'}
                </Text>
              </Box>
            </HStack>
            <Button
              leftIcon={<LogOut size={14} />}
              variant="ghost"
              size="sm"
              w="full"
              onClick={handleSignOut}
              color="gray.600"
              _hover={{ bg: 'gray.100', color: 'red.500' }}
              isLoading={signingOut}
              isDisabled={signingOut}
              fontFamily="body"
              fontWeight="medium"
            >
              Sign Out
            </Button>
          </Box>
        </VStack>
      </Box>

      {/* Main Content */}
      <Flex flex="1" direction="column" h={APP_VIEWPORT_HEIGHT} maxH={APP_VIEWPORT_HEIGHT} overflow="hidden" minW={0} minH={0}>
        {/* Header */}
        <Flex
          align={{ base: 'flex-start', md: 'center' }}
          justify="space-between"
          px={{ base: 4, md: 8 }}
          minH={HEADER_HEIGHT}
          flexShrink={0}
          bg="white"
          gap={3}
          flexWrap={{ base: 'wrap', md: 'nowrap' }}
          rowGap={{ base: 3, md: 0 }}
          py={{ base: 3, md: 0 }}
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

          <InputGroup
            maxW={{ base: '100%', md: '420px' }}
            flex={1}
            flexBasis={{ base: '100%', md: 'auto' }}
            order={{ base: 3, md: 0 }}
          >
            <InputLeftElement pointerEvents="none">
              <Box color="text.muted">
                <Search size={18} />
              </Box>
            </InputLeftElement>
            <Input
              placeholder="Search"
              bg="brand.accent"
              borderColor="brand.border"
              _focus={{ borderColor: 'brand.primary', boxShadow: 'focus' }}
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSearchSubmit()
                }
                if (e.key === 'Escape') {
                  setGlobalSearchQuery('')
                }
              }}
              aria-label="Search dashboard pages"
            />
            {globalSearchQuery.trim() && (
              <InputRightElement width="auto" pr={2}>
                <Button size="xs" variant="ghost" onClick={handleSearchSubmit}>
                  Go
                </Button>
              </InputRightElement>
            )}
            {globalSearchQuery.trim() && (
              <Box
                position="absolute"
                top="calc(100% + 8px)"
                left={0}
                right={0}
                bg="white"
                border="1px solid"
                borderColor="brand.border"
                borderRadius="md"
                boxShadow="md"
                overflow="hidden"
                zIndex={20}
              >
                {searchResults.length > 0 ? (
                  <VStack spacing={0} align="stretch">
                    {searchResults.map(result => {
                      const restrictedFeature = isFreeUser ? getRestrictedFeatureForPath(result.path) : null
                      const isRestrictedForFreeUser = Boolean(restrictedFeature)
                      const searchButton = (
                        <Button
                          key={result.path}
                          variant="ghost"
                          justifyContent="space-between"
                          borderRadius="0"
                          h="auto"
                          py={2.5}
                          px={3}
                          onClick={() => handleSearchNavigation(result.path)}
                          _hover={{ bg: 'brand.primaryMuted' }}
                          sx={isRestrictedForFreeUser ? { opacity: 0.55, filter: 'grayscale(1)' } : undefined}
                        >
                          <HStack spacing={2}>
                            <Text fontSize="sm" color="brand.text">
                              {result.label}
                            </Text>
                            {isRestrictedForFreeUser ? (
                              <Badge colorScheme="yellow" variant="subtle">
                                Upgrade
                              </Badge>
                            ) : null}
                          </HStack>
                          <Text fontSize="xs" color="brand.subtleText">
                            {result.sectionLabel}
                          </Text>
                        </Button>
                      )

                      if (!isRestrictedForFreeUser || !restrictedFeature) return searchButton

                      return (
                        <Tooltip key={result.path} label={restrictedFeature.tooltip} hasArrow openDelay={200}>
                          <Box>{searchButton}</Box>
                        </Tooltip>
                      )
                    })}
                  </VStack>
                ) : (
                  <Text px={3} py={2.5} fontSize="sm" color="brand.subtleText">
                    No pages found
                  </Text>
                )}
              </Box>
            )}
          </InputGroup>

          <HStack
            spacing={3}
            ml={{ base: 0, md: 'auto' }}
            align="center"
            order={{ base: 2, md: 0 }}
            justify="flex-end"
          >
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
          overflowY="auto"
          px={{ base: 4, md: 8 }}
          pt={{ base: 4, md: 8 }}
          pb={{ base: MOBILE_NAV_HEIGHT_WITH_SAFE_AREA, md: 8 }}
          minW={0}
          minH={0}
        >
          <RouteTransition>
            <Outlet />
          </RouteTransition>
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
              const isActive = location.pathname.startsWith(item.path)
              const restrictedFeature = isFreeUser ? getRestrictedFeatureForPath(item.path) : null
              const isRestrictedForFreeUser = Boolean(restrictedFeature)
              return (
                <Tooltip
                  key={item.path}
                  label={restrictedFeature?.tooltip}
                  hasArrow
                  openDelay={200}
                  isDisabled={!isRestrictedForFreeUser}
                >
                  <Box flex="1">
                    <Button
                      variant="ghost"
                      w="full"
                      h={`${MOBILE_NAV_BUTTON_HEIGHT}px`}
                      borderRadius="md"
                      onClick={() => handleNavigation(item.path)}
                      bg={isActive ? 'brand.primaryMuted' : 'transparent'}
                      color={isActive ? 'brand.primary' : 'brand.subtleText'}
                      _hover={{ bg: 'brand.primaryMuted', color: 'brand.primary' }}
                      aria-current={isActive ? 'page' : undefined}
                      sx={isRestrictedForFreeUser ? { opacity: 0.55, filter: 'grayscale(1)' } : undefined}
                    >
                      <VStack spacing={1}>
                        <Box color="inherit">
                          <item.icon size={18} />
                        </Box>
                        <Text fontSize="2xs" noOfLines={1}>
                          {item.label}
                        </Text>
                      </VStack>
                    </Button>
                  </Box>
                </Tooltip>
              )
            })}
            <Button
              variant="ghost"
              flex="1"
              h={`${MOBILE_NAV_BUTTON_HEIGHT}px`}
              borderRadius="md"
              onClick={onOpen}
              bg={isOpen ? 'brand.primaryMuted' : 'transparent'}
              color={isOpen ? 'brand.primary' : 'brand.subtleText'}
              _hover={{ bg: 'brand.primaryMuted', color: 'brand.primary' }}
              aria-label="Open navigation menu"
              aria-expanded={isOpen}
            >
              <VStack spacing={1}>
                <Box color="inherit">
                  <MenuIcon size={18} />
                </Box>
                <Text fontSize="2xs" noOfLines={1}>
                  Menu
                </Text>
              </VStack>
            </Button>
          </HStack>
        </Box>
      )}

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

      <PersonalityTypeModal
        isOpen={showPersonalityModal}
        onClose={() => setShowPersonalityModal(false)}
        onComplete={handlePersonalityModalComplete}
      />

      <PlatformTour isOpen={showTour} onClose={handleTourClosed} />

      <UpgradePromptModal
        featureName={selectedRestrictedFeature?.featureName ?? 'Premium Feature'}
        benefits={
          selectedRestrictedFeature?.benefits ?? [
            'Unlock paid-only collaboration features',
            'Access advanced leadership tools',
            'Use the full journey and community toolkit',
          ]
        }
        isOpen={isUpgradeModalOpen}
        onClose={closeUpgradePrompt}
      />

      <PointsNotificationListener />

      <MandatoryAnnouncementGate />
    </Flex>
  )
}
