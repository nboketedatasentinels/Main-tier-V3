import React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Box,
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
  InputGroup,
  InputLeftElement,
  Input,
  Divider,
  Badge,
} from '@chakra-ui/react'
import {
  Menu as MenuIcon,
  Home,
  Target,
  Trophy,
  BookOpen,
  Users,
  ClipboardList,
  Gavel,
  Megaphone,
  Gift,
  BookMarked,
  Sparkles,
  Search,
  Bell,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { UserRole } from '@/types'

const sectionLabelStyles = {
  fontSize: 'xs',
  fontWeight: 'semibold',
  color: 'brand.subtleText',
  letterSpacing: '0.08em',
}

export const MainLayout: React.FC = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { isOpen, onOpen, onClose } = useDisclosure()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const getDashboardPath = () => {
    switch (profile?.role) {
      case UserRole.FREE_USER:
        return '/app/dashboard/free'
      case UserRole.PAID_MEMBER:
        return '/app/dashboard/member'
      case UserRole.MENTOR:
        return '/app/dashboard/mentor'
      case UserRole.AMBASSADOR:
        return '/app/dashboard/ambassador'
      case UserRole.COMPANY_ADMIN:
        return '/app/dashboard/company-admin'
      case UserRole.SUPER_ADMIN:
        return '/app/dashboard/super-admin'
      default:
        return '/app/dashboard/free'
    }
  }

  const navigationSections = [
    {
      label: 'MY JOURNEY',
      items: [
        { label: 'Dashboard', path: getDashboardPath(), icon: Home },
        { label: 'Weekly Updates', path: '/weekly-updates', icon: ClipboardList },
        { label: 'Leadership Board', path: '/leadership-board', icon: Trophy },
        { label: 'My Courses', path: '/courses', icon: BookOpen },
        { label: 'Peer Connect', path: '/peer-connect', icon: Users },
        { label: 'Impact Activities', path: '/impact', icon: Target },
        { label: 'Leadership Council', path: '/leadership-council', icon: Gavel },
      ],
    },
    {
      label: 'COMMUNITY',
      items: [
        { label: 'Announcements', path: '/announcements', icon: Megaphone },
        { label: 'Referral Rewards', path: '/referral-rewards', icon: Gift },
        { label: 'Global Book Club', path: '/book-club', icon: BookMarked },
        { label: 'Shameless Circle', path: '/shameless-circle', icon: Sparkles },
      ],
    },
  ]

  const NavContent = () => (
    <VStack align="stretch" spacing={4} pt={4}>
      {navigationSections.map(section => (
        <Box key={section.label}>
          <Text mb={2} {...sectionLabelStyles}>
            {section.label}
          </Text>
          <VStack align="stretch" spacing={1}>
            {section.items.map(item => {
              const isActive =
                item.path === '/dashboard/free'
                  ? location.pathname.startsWith('/dashboard')
                  : location.pathname.startsWith(item.path)

              return (
                <Button
                  key={item.path}
                  leftIcon={<item.icon size={18} />}
                  variant="ghost"
                  justifyContent="flex-start"
                  onClick={() => {
                    navigate(item.path)
                    onClose()
                  }}
                  bg={isActive ? 'brand.primaryMuted' : 'transparent'}
                  color={isActive ? 'brand.text' : 'brand.subtleText'}
                  _hover={{ bg: 'brand.primaryMuted', color: 'brand.text' }}
                  height="42px"
                  fontWeight={isActive ? 'semibold' : 'medium'}
                >
                  {item.label}
                </Button>
              )
            })}
          </VStack>
        </Box>
      ))}
      <Divider borderColor="brand.border" pt={2} />
      <Button
        leftIcon={<LogOut size={18} />}
        variant="ghost"
        justifyContent="flex-start"
        color="brand.subtleText"
        onClick={handleSignOut}
        height="42px"
        _hover={{ bg: 'brand.primaryMuted', color: 'brand.text' }}
      >
        Sign Out
      </Button>
    </VStack>
  )

  return (
    <Flex minH="100vh" bg="brand.accent" color="brand.text">
      {/* Desktop Sidebar */}
      <Box
        w={{ base: '0', md: '260px' }}
        bg="brand.primaryMuted"
        borderRight="1px solid"
        borderColor="brand.border"
        p={6}
        display={{ base: 'none', md: 'block' }}
      >
        <VStack align="stretch" h="full" spacing={8}>
          <HStack spacing={3}>
            <Box boxSize="38px" borderRadius="full" bg="brand.primary" display="grid" placeItems="center">
              <Text fontWeight="bold" color="white">
                T4
              </Text>
            </Box>
            <Box>
              <Text fontSize="md" fontWeight="bold" color="brand.text">
                Transformation
              </Text>
              <Text fontSize="xs" color="brand.subtleText">
                Tier Platform
              </Text>
            </Box>
          </HStack>

          <Box flex="1">
            <NavContent />
          </Box>

          {/* User Info */}
          <VStack align="stretch" spacing={2}>
            <Box
              p={3}
              bg="rgba(53, 14, 111, 0.5)"
              borderRadius="lg"
              border="1px solid"
              borderColor="rgba(234, 177, 48, 0.2)"
            >
              <HStack>
                <Avatar size="sm" name={profile?.fullName} src={profile?.avatarUrl} />
                <Box flex="1">
                  <Text fontSize="sm" fontWeight="semibold" color="brand.softGold">
                    {profile?.fullName}
                  </Text>
                  <Text fontSize="xs" color="brand.gold">
                    {profile?.totalPoints || 0} points
                  </Text>
                </Box>
              </HStack>
            </Box>
            <Button
              leftIcon={<Settings size={16} />}
              variant="ghost"
              size="sm"
              onClick={() => navigate('/app/settings')}
            >
              Settings
            </Button>
            <Button
              leftIcon={<LogOut size={16} />}
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              colorScheme="red"
            >
              Sign Out
            </Button>
          </VStack>
        </VStack>
      </Box>

      {/* Main Content */}
      <Flex flex="1" direction="column" overflow="hidden">
        {/* Header */}
        <Flex
          align="center"
          justify="space-between"
          px={{ base: 4, md: 8 }}
          py={4}
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

          <HStack spacing={3} ml={{ base: 0, md: 4 }}>
            <IconButton
              aria-label="Notifications"
              icon={<Bell size={18} />}
              variant="ghost"
              bg="brand.accent"
              border="1px solid"
              borderColor="brand.border"
              _hover={{ bg: 'brand.primaryMuted' }}
            />
            <Menu>
              <MenuButton as={IconButton} icon={<User size={20} />} variant="ghost" />
              <MenuList bg="brand.deepPlum" borderColor="brand.gold">
                <MenuItem onClick={() => navigate('/app/profile')}>Profile</MenuItem>
                <MenuItem onClick={() => navigate('/app/settings')}>Settings</MenuItem>
                <MenuDivider />
                <MenuItem onClick={handleSignOut}>Sign Out</MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </Flex>

        {/* Content */}
        <Box flex="1" overflow="auto" p={{ base: 4, md: 8 }}>
          <Outlet />
        </Box>
      </Flex>

      {/* Mobile Drawer */}
      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent bg="white">
          <DrawerCloseButton />
          <DrawerBody pt={12}>
            <VStack align="stretch" spacing={4}>
              <Text fontSize="lg" fontWeight="bold" color="brand.text" mb={2}>
                T4 Menu
              </Text>
              <NavContent />
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Flex>
  )
}
