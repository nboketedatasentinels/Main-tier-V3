import React, { useMemo } from 'react'
import {
  Avatar,
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
import { LogOut, Menu } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'
import { buildMentorNavItems, NavigationSection } from '@/utils/navigationItems'

const APP_VIEWPORT_HEIGHT = { base: '100dvh', md: '100vh' } as const

interface MentorDashboardLayoutProps {
  children: React.ReactNode
  activeItem?: string
  onNavigate?: (key: string) => void
  mentorName?: string
  mentorRoleLabel?: string
  avatarUrl?: string
  navSections?: NavigationSection[]
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
                variant={isActive ? 'primary' : 'ghost'}
                justifyContent="flex-start"
                leftIcon={item.icon ? <Icon as={item.icon} /> : undefined}
                fontSize="sm"
                minH="44px"
                px={3}
                onClick={() => onNavigate?.(item.key)}
                bg={isActive ? 'brand.primary' : 'transparent'}
                color={isActive ? 'white' : 'brand.text'}
                _hover={{ bg: isActive ? 'brand.primary' : 'brand.primaryMuted' }}
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

export const MentorDashboardLayout: React.FC<MentorDashboardLayoutProps> = ({
  children,
  activeItem = 'overview',
  onNavigate,
  mentorName = 'Mentor',
  mentorRoleLabel = 'Mentor',
  avatarUrl,
  navSections,
}) => {
  const { signOut, signingOut } = useAuth()
  const toast = useToast()
  const sections = useMemo(() => navSections || buildMentorNavItems(), [navSections])
  const primaryNavItems = useMemo(() => sections.flatMap(section => section.items).slice(0, 4), [sections])
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

  const sidebarWidth = useBreakpointValue({ base: '64px', lg: '256px' })
  const isMobile = useBreakpointValue({ base: true, lg: false })
  const drawer = useDisclosure()
  const shortName = useMemo(() => mentorName?.split(' ')[0] || 'Mentor', [mentorName])

  return (
    <Flex minH={APP_VIEWPORT_HEIGHT} h={APP_VIEWPORT_HEIGHT} bg="brand.accent" overflow="hidden">
      <Box
        as="nav"
        w={sidebarWidth}
        bg="white"
        borderRight="1px solid"
        borderColor="brand.border"
        display={{ base: 'none', lg: 'flex' }}
        flexDirection="column"
        h={APP_VIEWPORT_HEIGHT}
        overflowY="auto"
      >
        <Flex direction="column" h="full" p={4} gap={4}>
          <HStack spacing={3} align="center">
            <Avatar size="sm" name={mentorName} src={avatarUrl} />
            <Box>
              <Text fontWeight="bold" color="brand.text">
                {shortName}
              </Text>
              <Text fontSize="sm" color="brand.subtleText">
                {mentorRoleLabel}
              </Text>
            </Box>
          </HStack>

          <Divider />

          <SidebarNav sections={sections} activeItem={activeItem} onNavigate={onNavigate} />

          <Flex mt="auto" pt={4} borderTop="1px solid" borderColor="brand.border">
            <Button
              variant="ghost"
              leftIcon={<Icon as={LogOut} />}
              justifyContent="flex-start"
              color="brand.text"
              onClick={handleLogout}
              isLoading={signingOut}
              isDisabled={signingOut}
              w="full"
            >
              Logout
            </Button>
          </Flex>
        </Flex>
      </Box>

      <Drawer isOpen={drawer.isOpen} placement="left" onClose={drawer.onClose} size="xs">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerBody p={4}>
            <VStack spacing={4} align="stretch">
              <HStack spacing={3} align="center">
                <Avatar size="sm" name={mentorName} src={avatarUrl} />
                <Box>
                  <Text fontWeight="bold">{shortName}</Text>
                  <Text fontSize="sm" color="brand.subtleText">
                    {mentorRoleLabel}
                  </Text>
                </Box>
              </HStack>
              <SidebarNav
                sections={sections}
                activeItem={activeItem}
                onNavigate={(key) => {
                  drawer.onClose()
                  onNavigate?.(key)
                }}
              />
              <Button
                variant="ghost"
                leftIcon={<Icon as={LogOut} />}
                justifyContent="flex-start"
                color="brand.text"
                onClick={handleLogout}
                isLoading={signingOut}
                isDisabled={signingOut}
                w="full"
              >
                Logout
              </Button>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Flex flex="1" direction="column" minW={0} h={APP_VIEWPORT_HEIGHT} overflow="hidden" minH={0}>
        {isMobile && (
          <Flex
            px={4}
            py={3}
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
              <IconButton
                aria-label="Open navigation"
                icon={<Icon as={Menu} />}
                variant="ghost"
                onClick={drawer.onOpen}
              />
              <Text fontWeight="bold">Mentor Dashboard</Text>
            </HStack>
            <NotificationDropdown />
          </Flex>
        )}

        <Box
          px={{ base: 4, md: 6, lg: 10 }}
          pt={{ base: 5, md: 8 }}
          pb={{ base: 20, md: 8 }}
          flex="1"
          overflowY="auto"
        >
          <Stack spacing={6} maxW="1600px" mx="auto">
            <Flex justify="space-between" align="center">
              <Box>
                <Text fontSize="2xl" fontWeight="bold" color="brand.text">
                  Mentor Dashboard
                </Text>
                <Text color="brand.subtleText">Tools for mentorship management and learner support.</Text>
              </Box>
              {!isMobile && (
                <HStack spacing={3}>
                  <NotificationDropdown />
                  <Avatar size="sm" name={mentorName} src={avatarUrl} />
                </HStack>
              )}
            </Flex>

            {children}
          </Stack>
        </Box>
      </Flex>

      {primaryNavItems.length > 0 && (
        <Box
          as="nav"
          aria-label="Primary bottom navigation"
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
                <Icon as={Menu} boxSize={4} />
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
