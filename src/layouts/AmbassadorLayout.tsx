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
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Stack,
  Text,
  VStack,
  useBreakpointValue,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { Menu as MenuIcon, Medal, TrendingUp, X } from 'lucide-react'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'
import { buildAmbassadorNavItems, buildCommonAccountItems, NavigationItem, NavigationSection } from '@/utils/navigationItems'
import { useAuth } from '@/hooks/useAuth'

const APP_VIEWPORT_HEIGHT = { base: '100dvh', md: '100vh' } as const

interface AmbassadorLayoutProps {
  children: React.ReactNode
  activeItem?: string
  onNavigate?: (key: string) => void
  ambassadorName?: string
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
          <Text fontSize="xs" fontWeight="bold" color="brand.subtleText" letterSpacing="0.08em">
            {section.title}
          </Text>
        )}
        <VStack align="stretch" spacing={2}>
          {section.items.map((item) => {
            const isActive = activeItem === item.key
            return (
              <Button
                key={item.key}
                justifyContent="flex-start"
                leftIcon={item.icon ? <Icon as={item.icon} /> : undefined}
                fontSize="sm"
                variant={isActive ? 'primary' : 'ghost'}
                minH="44px"
                px={3}
                bg={isActive ? 'brand.primary' : 'transparent'}
                color={isActive ? 'white' : 'brand.text'}
                _hover={{ bg: isActive ? 'brand.primary' : 'brand.primaryMuted' }}
                onClick={() => onNavigate?.(item.key)}
              >
                {item.label}
              </Button>
            )
          })}
        </VStack>
      </VStack>
    ))}
  </VStack>
)

const AccountMenu = ({
  items,
  onNavigate,
}: {
  items: NavigationItem[]
  onNavigate?: (key: string) => void
}) => (
  <Menu>
    <MenuButton as={Button} variant="outline">
      Account
    </MenuButton>
    <MenuList>
      {items.map((item) => (
        <MenuItem key={item.key} icon={item.icon ? <Icon as={item.icon} /> : undefined} onClick={() => onNavigate?.(item.key)}>
          {item.label}
        </MenuItem>
      ))}
    </MenuList>
  </Menu>
)

export const AmbassadorLayout: React.FC<AmbassadorLayoutProps> = ({
  children,
  activeItem = 'overview',
  onNavigate,
  ambassadorName = 'Ambassador',
  avatarUrl,
  navSections,
  subtitle = 'Grow the community and track your impact',
}) => {
  const { signOut, signingOut } = useAuth()
  const toast = useToast()
  const sections = useMemo(() => navSections || buildAmbassadorNavItems(), [navSections])
  const primaryNavItems = useMemo(() => sections.flatMap(section => section.items).slice(0, 4), [sections])
  const accountItems = useMemo(() => buildCommonAccountItems(), [])
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

  const handleAccountNavigate = (key: string) => {
    if (key === 'logout') {
      handleLogout()
      return
    }

    onNavigate?.(key)
  }

  const navContent = (
    <VStack spacing={6} align="stretch">
      <HStack spacing={3} align="center">
        <Avatar size="sm" name={ambassadorName} src={avatarUrl} />
        <Box>
          <Text fontWeight="bold" color="brand.text">
            {ambassadorName}
          </Text>
          <Badge colorScheme="purple">Ambassador</Badge>
        </Box>
      </HStack>

      <Divider />

      <SidebarNav sections={sections} activeItem={activeItem} onNavigate={onNavigate} />

      <Divider />

      <AccountMenu items={accountItems} onNavigate={handleAccountNavigate} />
    </VStack>
  )

  return (
    <Flex minH={APP_VIEWPORT_HEIGHT} h={APP_VIEWPORT_HEIGHT} bg="brand.accent" overflow="hidden">
      <Box
        as="nav"
        w={{ base: '0', lg: '260px' }}
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
          variant="ghost"
          justifyContent="flex-start"
          leftIcon={<Icon as={TrendingUp} />}
          color="brand.text"
          onClick={() => onNavigate?.('analytics')}
          mt="auto"
        >
          Performance
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
              <AccountMenu
                items={accountItems}
                onNavigate={(key) => {
                  drawer.onClose()
                  handleAccountNavigate(key)
                }}
              />
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Flex flex="1" direction="column" minW={0} h={APP_VIEWPORT_HEIGHT} overflow="hidden" minH={0}>
        <Flex
          px={{ base: 4, md: 6, lg: 10 }}
          py={4}
          align="center"
          justify="space-between"
          borderBottom="1px solid"
          borderColor="brand.border"
          bg="white"
          position="sticky"
          top={0}
          zIndex={10}
        >
          <HStack spacing={3} align="center">
            {isMobile && (
              <IconButton
                aria-label="Open navigation"
                icon={<Icon as={MenuIcon} />}
                variant="ghost"
                onClick={drawer.onOpen}
              />
            )}
            <VStack align="flex-start" spacing={0}>
              <HStack spacing={2}>
                <Medal size={18} />
                <Text fontWeight="bold" color="brand.text">
                  Ambassador Hub
                </Text>
              </HStack>
              <Text fontSize="sm" color="brand.subtleText">
                {subtitle}
              </Text>
            </VStack>
          </HStack>

          <HStack spacing={3} align="center">
            <NotificationDropdown />
            <Menu>
              <MenuButton
                as={Button}
                leftIcon={<Avatar size="sm" name={ambassadorName} src={avatarUrl} />}
                variant="outline"
                size="sm"
                px={{ base: 2, md: 3 }}
              >
                <Text display={{ base: 'none', md: 'block' }} noOfLines={1} maxW="180px">
                  {ambassadorName}
                </Text>
              </MenuButton>
              <MenuList>
                {accountItems.map((item) => (
                  <MenuItem key={item.key} icon={item.icon ? <Icon as={item.icon} /> : undefined} onClick={() => handleAccountNavigate(item.key)}>
                    {item.label}
                  </MenuItem>
                ))}
                <MenuItem onClick={handleLogout} isDisabled={signingOut}>Logout</MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </Flex>

        <Box
          px={{ base: 4, md: 6, lg: 10 }}
          pt={{ base: 5, md: 8 }}
          pb={{ base: 16, md: 8 }}
          flex="1"
          overflowY="auto"
        >
          <Stack spacing={6} maxW="1400px" mx="auto">
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
                  h="56px"
                  borderRadius="md"
                  onClick={() => onNavigate?.(item.key)}
                  bg={isActive ? 'brand.primaryMuted' : 'transparent'}
                  color={isActive ? 'brand.primary' : 'brand.subtleText'}
                  _hover={{ bg: 'brand.primaryMuted', color: 'brand.primary' }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <VStack spacing={1}>
                    {item.icon && <Icon as={item.icon} boxSize={4} />}
                    <Text fontSize="2xs" noOfLines={1}>
                      {item.label}
                    </Text>
                  </VStack>
                </Button>
              )
            })}
            <Button
              variant="ghost"
              flex="1"
              h="56px"
              borderRadius="md"
              onClick={drawer.onOpen}
              bg={drawer.isOpen ? 'brand.primaryMuted' : 'transparent'}
              color={drawer.isOpen ? 'brand.primary' : 'brand.subtleText'}
              _hover={{ bg: 'brand.primaryMuted', color: 'brand.primary' }}
              aria-label="Open navigation menu"
              aria-expanded={drawer.isOpen}
            >
              <VStack spacing={1}>
                <Icon as={MenuIcon} boxSize={4} />
                <Text fontSize="2xs" noOfLines={1}>
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
