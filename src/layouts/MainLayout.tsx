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
        { label: 'Weekly Updates', path: '/app/weekly-updates', icon: ClipboardList },
        { label: 'Leadership Board', path: '/app/leadership-board', icon: Trophy },
        { label: 'My Courses', path: '/app/courses', icon: BookOpen },
        { label: 'Peer Connect', path: '/app/peer-connect', icon: Users },
        { label: 'Impact Activities', path: '/app/impact', icon: Target },
        { label: 'Leadership Council', path: '/app/leadership-council', icon: Gavel },
      ],
    },
    {
      label: 'COMMUNITY',
      items: [
        { label: 'Announcements', path: '/app/announcements', icon: Megaphone },
        { label: 'Referral Rewards', path: '/app/referral-rewards', icon: Gift },
        { label: 'Global Book Club', path: '/app/book-club', icon: BookMarked },
        { label: 'Shameless Circle', path: '/app/shameless-circle', icon: Sparkles },
      ],
    },
  ]

  const NavContent = () => (
    <VStack align="stretch" spacing={5} pt={4}>
      {navigationSections.map(section => (
        <Box key={section.label}>
          <Text mb={2} {...sectionLabelStyles}>
            {section.label}
          </Text>
          <VStack align="stretch" spacing={1}>
            {section.items.map(item => {
              const isDashboardItem = item.path.startsWith('/app/dashboard')
              const isActive = isDashboardItem
                ? location.pathname.startsWith('/app/dashboard')
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
    </VStack>
  )

  return (
    <Flex minH="100vh" bg="brand.accent" color="brand.text">
      {/* Desktop Sidebar */}
      <Box
        w={{ base: '0', md: '260px' }}
        bg="brand.sidebar"
        borderRight="1px solid"
        borderColor="brand.border"
        p={6}
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

          <Box flex="1">
            <NavContent />
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

          <HStack spacing={3} ml={{ base: 0, md: 4 }} align="center">
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
