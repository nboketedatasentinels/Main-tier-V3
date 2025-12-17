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
} from '@chakra-ui/react'
import { Bell, Menu as MenuIcon, Medal, TrendingUp, X } from 'lucide-react'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'
import { buildAmbassadorNavItems, buildCommonAccountItems, NavigationItem, NavigationSection } from '@/utils/navigationItems'
import { useAuth } from '@/hooks/useAuth'

interface AmbassadorLayoutProps {
  children: React.ReactNode
  activeItem?: string
  onNavigate?: (key: string) => void
  ambassadorName?: string
  avatarUrl?: string
  navSections?: NavigationSection[]
  notificationCount?: number
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
                variant={isActive ? 'primary' : 'ghost'}
                bg={isActive ? '#3D0C69' : 'transparent'}
                color={isActive ? 'white' : 'brand.text'}
                _hover={{ bg: isActive ? '#3D0C69' : 'brand.primaryMuted' }}
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
  notificationCount = 0,
  subtitle = 'Grow the community and track your impact',
}) => {
  const { signOut } = useAuth()
  const sections = useMemo(() => navSections || buildAmbassadorNavItems(), [navSections])
  const accountItems = useMemo(() => buildCommonAccountItems(), [])
  const drawer = useDisclosure()
  const isMobile = useBreakpointValue({ base: true, lg: false })

  const handleAccountNavigate = (key: string) => {
    if (key === 'logout') {
      signOut()
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
    <Flex minH="100vh" h="100vh" bg="brand.accent" overflow="hidden">
      <Box
        as="nav"
        w={{ base: '0', lg: '260px' }}
        bg="white"
        borderRight="1px solid"
        borderColor="brand.border"
        display={{ base: 'none', lg: 'flex' }}
        flexDirection="column"
        h="100vh"
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

      <Flex flex="1" direction="column" minW={0} h="100vh" overflow="hidden">
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
            <Box position="relative" display={{ base: 'none', sm: 'block' }}>
              <IconButton aria-label="Alerts" icon={<Bell size={18} />} variant="ghost" />
              {notificationCount > 0 && (
                <Badge position="absolute" top="-1" right="-1" colorScheme="purple" borderRadius="full">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </Badge>
              )}
            </Box>
            <Menu>
              <MenuButton as={Button} leftIcon={<Avatar size="sm" name={ambassadorName} src={avatarUrl} />} variant="outline">
                <Text>{ambassadorName}</Text>
              </MenuButton>
              <MenuList>
                {accountItems.map((item) => (
                  <MenuItem key={item.key} icon={item.icon ? <Icon as={item.icon} /> : undefined} onClick={() => handleAccountNavigate(item.key)}>
                    {item.label}
                  </MenuItem>
                ))}
                <MenuItem onClick={() => signOut()}>Logout</MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </Flex>

        <Box px={{ base: 4, md: 6, lg: 10 }} py={{ base: 5, md: 8 }} flex="1" overflowY="auto">
          <Stack spacing={6} maxW="1400px" mx="auto">
            {children}
          </Stack>
        </Box>
      </Flex>
    </Flex>
  )
}
