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
  VStack,
  useDisclosure,
} from '@chakra-ui/react'
import { LogOut, Menu, Sparkles } from 'lucide-react'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'
import { useAuth } from '@/hooks/useAuth'
import { NavigationItem, NavigationSection, buildCompanyAdminNavItems } from '@/utils/navigationItems'

interface CompanyAdminLayoutProps {
  children: React.ReactNode
  navSections?: NavigationSection[]
  activeItem?: string
  onNavigate?: (key: string) => void
  organizations?: { code: string; name: string }[]
  selectedOrg?: string
  onSelectOrg?: (org: string) => void
}

const defaultOrganizations = [
  { code: 'all', name: 'All Organizations' },
  { code: 'northwind', name: 'Northwind Holdings' },
  { code: 'contoso', name: 'Contoso Labs' },
]

const NavItemRow: React.FC<{
  item: NavigationItem
  isActive: boolean
  onClick?: (key: string) => void
}> = ({ item, isActive, onClick }) => (
  <HStack
    key={item.key}
    spacing={3}
    px={3}
    py={2}
    borderRadius="md"
    cursor="pointer"
    _hover={{ bg: 'brand.accent' }}
    bg={isActive ? 'brand.accent' : undefined}
    border="1px solid"
    borderColor={isActive ? 'brand.border' : 'transparent'}
    transition="all 0.2s"
    onClick={() => onClick?.(item.key)}
    aria-current={isActive ? 'page' : undefined}
  >
    {item.icon && (
      <Box p={2} borderRadius="lg" bg="white" border="1px solid" borderColor="brand.border">
        <Icon as={item.icon} color="brand.text" />
      </Box>
    )}
    <Text fontWeight="semibold" color="brand.text">
      {item.label}
    </Text>
    {item.key !== 'support' && (
      <Badge colorScheme="purple" variant="subtle">
        Scoped
      </Badge>
    )}
  </HStack>
)

export const CompanyAdminLayout: React.FC<CompanyAdminLayoutProps> = ({
  children,
  navSections,
  activeItem,
  onNavigate,
  organizations = defaultOrganizations,
  selectedOrg = 'all',
  onSelectOrg,
}) => {
  const { profile, signOut } = useAuth()
  const disclosure = useDisclosure()
  const sidebarWidth = '280px'
  const sections = navSections?.length ? navSections : buildCompanyAdminNavItems()

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
              <NavItemRow key={item.key} item={item} isActive={activeItem === item.key} onClick={onNavigate} />
            ))}
          </VStack>
        </Stack>
      ))}
    </Stack>
  )

  const ProfileSection = () => (
    <HStack spacing={3} p={3} borderRadius="lg" bg="brand.accent" align="flex-start">
      <Avatar name={profile?.fullName || 'Company Admin'} size="sm" src={profile?.avatarUrl} />
      <VStack align="flex-start" spacing={0} flex={1}>
        <Text fontWeight="bold" color="brand.text">
          {profile?.fullName || 'Company Admin'}
        </Text>
        <Text fontSize="sm" color="brand.subtleText">
          {profile?.assignedOrganizations?.length || 0} organizations
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
        onChange={e => onSelectOrg?.(e.target.value)}
        bg="white"
        borderColor="brand.border"
      >
        {organizations.map(org => (
          <option key={org.code} value={org.code}>
            {org.name}
          </option>
        ))}
      </Select>
      <NotificationDropdown />
      <Button
        display={{ base: 'none', md: 'inline-flex' }}
        leftIcon={<LogOut size={16} />}
        variant="outline"
        onClick={() => signOut()}
      >
        Logout
      </Button>
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
            <Box p={2} borderRadius="md" bg="brand.accent" border="1px solid" borderColor="brand.border">
              <Sparkles size={18} />
            </Box>
            <VStack align="flex-start" spacing={0}>
              <Text fontWeight="bold" color="brand.text">
                Company Admin
              </Text>
              <Text fontSize="xs" color="brand.subtleText">
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
                Company Dashboard
              </Text>
              <Text fontSize="3xl" fontWeight="bold" color="brand.text">
                {profile?.fullName || 'Company Admin'}
              </Text>
              <Text color="brand.subtleText" maxW="760px">
                Manage users, organizations, and insights across your assigned companies with scoped oversight and targeted
                interventions.
              </Text>
            </VStack>
            <HeaderControls />
          </Flex>

          {children}
        </Box>
      </Flex>
    </Flex>
  )
}

export default CompanyAdminLayout
