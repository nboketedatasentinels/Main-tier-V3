import React from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
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
} from '@chakra-ui/react'
import { 
  Menu as MenuIcon,
  Home,
  TrendingUp,
  Target,
  Users,
  Settings,
  LogOut,
  User,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { UserRole } from '@/types'

export const MainLayout: React.FC = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
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

  const navigationItems = [
    { label: 'Dashboard', path: getDashboardPath(), icon: Home },
    { label: 'Journeys', path: '/app/journeys', icon: Target },
    { label: 'Impact Log', path: '/app/impact', icon: TrendingUp },
    { label: 'Leaderboard', path: '/app/leaderboard', icon: Users },
  ]

  const NavContent = () => (
    <VStack align="stretch" spacing={2}>
      {navigationItems.map(item => (
        <Button
          key={item.path}
          leftIcon={<item.icon size={20} />}
          variant="ghost"
          justifyContent="flex-start"
          onClick={() => {
            navigate(item.path)
            onClose()
          }}
          _hover={{ bg: 'rgba(249, 219, 89, 0.1)', color: 'brand.gold' }}
          color="brand.softGold"
        >
          {item.label}
        </Button>
      ))}
    </VStack>
  )

  return (
    <Flex h="100vh" bg="brand.deepPlum">
      {/* Desktop Sidebar */}
      <Box
        w="250px"
        bg="brand.deepPlum"
        borderRight="1px solid"
        borderColor="rgba(234, 177, 48, 0.2)"
        p={4}
        display={{ base: 'none', md: 'block' }}
      >
        <VStack align="stretch" h="full" spacing={6}>
          {/* Logo */}
          <Box>
            <Text fontSize="2xl" fontWeight="bold" color="brand.gold">
              T4L
            </Text>
            <Text fontSize="xs" color="brand.softGold">
              Transformation 4 Leaders
            </Text>
          </Box>

          {/* Navigation */}
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
        {/* Mobile Header */}
        <Flex
          display={{ base: 'flex', md: 'none' }}
          p={4}
          bg="brand.deepPlum"
          borderBottom="1px solid"
          borderColor="rgba(234, 177, 48, 0.2)"
          align="center"
          justify="space-between"
        >
          <Text fontSize="xl" fontWeight="bold" color="brand.gold">
            T4L
          </Text>
          <HStack>
            <Menu>
              <MenuButton as={IconButton} icon={<User size={20} />} variant="ghost" />
              <MenuList bg="brand.deepPlum" borderColor="brand.gold">
                <MenuItem onClick={() => navigate('/app/profile')}>Profile</MenuItem>
                <MenuItem onClick={() => navigate('/app/settings')}>Settings</MenuItem>
                <MenuDivider />
                <MenuItem onClick={handleSignOut}>Sign Out</MenuItem>
              </MenuList>
            </Menu>
            <IconButton
              icon={<MenuIcon size={20} />}
              variant="ghost"
              onClick={onOpen}
              aria-label="Open menu"
            />
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
        <DrawerContent bg="brand.deepPlum">
          <DrawerCloseButton color="brand.softGold" />
          <DrawerBody pt={12}>
            <VStack align="stretch" spacing={4}>
              <Text fontSize="2xl" fontWeight="bold" color="brand.gold" mb={4}>
                T4L Menu
              </Text>
              <NavContent />
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Flex>
  )
}
