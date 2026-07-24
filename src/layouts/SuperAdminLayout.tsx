import React, { useMemo } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerOverlay,
  Flex,
  HStack,
  Icon,
  IconButton,
  Stack,
  Text,
  VStack,
  useBreakpointValue,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { LogOut, Menu as MenuIcon, Shield, X } from 'lucide-react'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'
import { useAuth } from '@/hooks/useAuth'
import { buildSuperAdminNavItems, NavigationSection } from '@/utils/navigationItems'

const APP_VIEWPORT_HEIGHT = { base: '100dvh', md: '100vh' } as const
const MOBILE_NAV_HEIGHT = 68
const MOBILE_NAV_HEIGHT_WITH_SAFE_AREA = `calc(${MOBILE_NAV_HEIGHT}px + env(safe-area-inset-bottom))`
const MOBILE_NAV_BUTTON_HEIGHT = MOBILE_NAV_HEIGHT - 12

interface SuperAdminLayoutProps {
  children: React.ReactNode
  activeItem?: string
  onNavigate?: (key: string) => void
  adminName?: string
  avatarUrl?: string
  navSections?: NavigationSection[]
  subtitle?: string
}

const SidebarNav = ({
  sections,
  activeItem,
  onNavigate,
}: {
  sections: NavigationSection[]
  activeItem: string
  onNavigate?: (key: string) => void
}) => (
  <VStack spacing={6} align="stretch">
    {sections.map((section) => (
      <VStack key={section.title || 'default'} align="stretch" spacing={3}>
        {section.title && (
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="gray.400"
            letterSpacing="0.12em"
            textTransform="uppercase"
            px={3}
          >
            {section.title}
          </Text>
        )}
        <VStack align="stretch" spacing={1}>
          {section.items.map((item) => {
            const isActive = activeItem === item.key
            return (
              <Button
                key={item.key}
                justifyContent="flex-start"
                leftIcon={item.icon ? <Icon as={item.icon} /> : undefined}
                fontSize="sm"
                fontWeight={isActive ? 'semibold' : 'medium'}
                variant={isActive ? 'primary' : 'ghost'}
                minH="44px"
                px={3}
                borderRadius="xl"
                bg={isActive ? 'brand.primary' : 'transparent'}
                color={isActive ? 'white' : 'brand.text'}
                boxShadow={isActive ? 'sm' : 'none'}
                _hover={{ bg: isActive ? 'brand.primary' : 'brand.primaryMuted' }}
                onClick={() => onNavigate?.(item.key)}
              >
                <HStack justify="space-between" flex="1">
                  <Text color="inherit">{item.label}</Text>
                  {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                    <Badge colorScheme="red" borderRadius="full">
                      {item.badgeCount}
                    </Badge>
                  )}
                </HStack>
              </Button>
            )
          })}
        </VStack>
      </VStack>
    ))}
  </VStack>
)

export const SuperAdminLayout: React.FC<SuperAdminLayoutProps> = ({
  children,
  activeItem = 'overview',
  onNavigate,
  adminName = 'Super Admin',
  avatarUrl,
  navSections,
  subtitle = 'Platform Control Center',
}) => {
  const { signOut, signingOut } = useAuth()
  const toast = useToast()
  const sections = useMemo(() => navSections || buildSuperAdminNavItems(), [navSections])
  const primaryNavItems = useMemo(() => sections.flatMap(section => section.items).slice(0, 4), [sections])
  const mobileLabelByKey = useMemo<Record<string, string>>(
    () => ({
      overview: 'Overview',
      organizations: 'Orgs',
      users: 'Users',
      approvals: 'Approvals',
      reports: 'Reports',
    }),
    [],
  )
  const drawer = useDisclosure()
  const isMobile = useBreakpointValue({ base: true, lg: false })

  const handleLogout = async () => {
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

  const navContent = (
    <VStack spacing={6} align="stretch">
      <HStack spacing={3} align="center">
        <Avatar size="sm" name={adminName} src={avatarUrl} />
        <Box>
          <Text fontWeight="bold" color="brand.text">
            {adminName}
          </Text>
        </Box>
      </HStack>

      <Divider />

      <SidebarNav sections={sections} activeItem={activeItem} onNavigate={onNavigate} />
    </VStack>
  )

  return (
    <Flex minH={APP_VIEWPORT_HEIGHT} h={APP_VIEWPORT_HEIGHT} bg="brand.accent" overflow="hidden">
      <Box
        as="nav"
        w={{ base: '0', lg: '280px' }}
        bg="white"
        borderRight="1px solid"
        borderColor="brand.border"
        display={{ base: 'none', lg: 'flex' }}
        flexDirection="column"
        h={APP_VIEWPORT_HEIGHT}
        overflowY="auto"
        p={5}
        gap={6}
      >
        {navContent}
        <Button
          leftIcon={<Icon as={LogOut} />}
          variant="ghost"
          justifyContent="flex-start"
          color="brand.text"
          onClick={handleLogout}
          isLoading={signingOut}
          isDisabled={signingOut}
          mt="auto"
        >
          Logout
        </Button>
      </Box>

      <Drawer isOpen={drawer.isOpen} placement="left" onClose={drawer.onClose} size="xs">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerBody p={5}>
            <VStack align="stretch" spacing={6}>
              <HStack justify="space-between" align="center">
                <Text fontWeight="bold">Navigation</Text>
                <IconButton aria-label="Close" icon={<Icon as={X} />} variant="ghost" onClick={drawer.onClose} />
              </HStack>
              <SidebarNav
                sections={sections}
                activeItem={activeItem}
                onNavigate={(key) => {
                  drawer.onClose()
                  onNavigate?.(key)
                }}
              />
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Flex flex="1" direction="column" minW={0} h={APP_VIEWPORT_HEIGHT} overflow="hidden" minH={0}>
        <Flex
          px={{ base: 4, md: 6, lg: 10 }}
          py={{ base: 3, md: 4 }}
          align={{ base: 'flex-start', md: 'center' }}
          justify="space-between"
          borderBottom="1px solid"
          borderColor="brand.border"
          bg="white"
          position="sticky"
          top={0}
          zIndex={10}
          gap={3}
          flexWrap={{ base: 'wrap', md: 'nowrap' }}
          rowGap={{ base: 3, md: 0 }}
        >
          <HStack spacing={3} align="center" flex="1 1 auto" minW={0}>
            {isMobile && (
              <IconButton
                aria-label="Open navigation"
                icon={<Icon as={MenuIcon} />}
                variant="ghost"
                onClick={drawer.onOpen}
              />
            )}
            <VStack align="flex-start" spacing={0} minW={0}>
              <HStack spacing={2}>
                <Shield size={18} />
                <Text fontWeight="bold" color="brand.text" noOfLines={1} fontSize={{ base: 'sm', sm: 'md' }}>
                  Super Admin Console
                </Text>
              </HStack>
              <Text fontSize="xs" color="brand.subtleText" display={{ base: 'none', sm: 'block' }} noOfLines={1}>
                {subtitle}
              </Text>
            </VStack>
          </HStack>

          <HStack spacing={3} align="center" w={{ base: 'full', sm: 'auto' }} justify={{ base: 'space-between', sm: 'flex-end' }}>
            <NotificationDropdown />
          </HStack>
        </Flex>

        <Box
          px={{ base: 4, md: 6, lg: 10 }}
          pt={{ base: 5, md: 8 }}
          pb={{ base: MOBILE_NAV_HEIGHT_WITH_SAFE_AREA, lg: 8 }}
          flex="1"
          overflowY="auto"
        >
          <Stack spacing={6} maxW="1600px" mx="auto">
            {children}
          </Stack>
        </Box>
      </Flex>

      {primaryNavItems.length > 0 && (
        <Box
          display={{ base: 'block', lg: 'none' }}
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
                    {item.icon && (
                      <Box position="relative" lineHeight={0}>
                        <Icon as={item.icon} boxSize={4} />
                        {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                          <Badge
                            position="absolute"
                            top="-8px"
                            right="-10px"
                            colorScheme="red"
                            borderRadius="full"
                            fontSize="2xs"
                            px={1.5}
                            aria-label={`${item.badgeCount} pending items`}
                          >
                            {item.badgeCount}
                          </Badge>
                        )}
                      </Box>
                    )}
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
              onClick={drawer.onOpen}
              bg={drawer.isOpen ? 'brand.primaryMuted' : 'transparent'}
              color={drawer.isOpen ? 'brand.primary' : 'brand.subtleText'}
              _hover={{ bg: 'brand.primaryMuted', color: 'brand.primary' }}
              aria-label="Open navigation menu"
              aria-expanded={drawer.isOpen}
            >
              <VStack spacing={1} w="full" minW={0}>
                <Icon as={MenuIcon} boxSize={4} />
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
