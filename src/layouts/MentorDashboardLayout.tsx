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
} from '@chakra-ui/react'
import { Bell, LogOut, Menu } from 'lucide-react'
import { buildMentorNavItems, NavigationSection } from '@/utils/navigationItems'

interface MentorDashboardLayoutProps {
  children: React.ReactNode
  activeItem?: string
  onNavigate?: (key: string) => void
  unreadCount?: number
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
                onClick={() => onNavigate?.(item.key)}
                bg={isActive ? '#3D0C69' : 'transparent'}
                color={isActive ? 'white' : 'brand.text'}
                _hover={{ bg: isActive ? '#3D0C69' : 'brand.primaryMuted' }}
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
  unreadCount = 0,
  mentorName = 'Mentor',
  mentorRoleLabel = 'Mentor',
  avatarUrl,
  navSections,
}) => {
  const sections = useMemo(() => navSections || buildMentorNavItems(), [navSections])
  const sidebarWidth = useBreakpointValue({ base: '64px', lg: '256px' })
  const isMobile = useBreakpointValue({ base: true, lg: false })
  const drawer = useDisclosure()
  const shortName = useMemo(() => mentorName?.split(' ')[0] || 'Mentor', [mentorName])

  return (
    <Flex minH="100vh" h="100vh" bg="brand.accent" overflow="hidden">
      <Box
        as="nav"
        w={sidebarWidth}
        bg="white"
        borderRight="1px solid"
        borderColor="brand.border"
        display={{ base: 'none', lg: 'flex' }}
        flexDirection="column"
        h="100vh"
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
              >
                Logout
              </Button>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Flex flex="1" direction="column" minW={0} h="100vh" overflow="hidden">
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
            <Box position="relative">
              <IconButton aria-label="Notifications" icon={<Icon as={Bell} />} variant="ghost" />
              {unreadCount > 0 && (
                <Badge
                  position="absolute"
                  top="-1"
                  right="-1"
                  colorScheme="yellow"
                  borderRadius="full"
                  px={2}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </Box>
          </Flex>
        )}

        <Box px={{ base: 4, md: 6, lg: 10 }} py={{ base: 5, md: 8 }} flex="1" overflowY="auto">
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
                  <Box position="relative">
                    <IconButton aria-label="Notifications" icon={<Icon as={Bell} />} variant="ghost" />
                    {unreadCount > 0 && (
                      <Badge
                        position="absolute"
                        top="-1"
                        right="-1"
                        colorScheme="yellow"
                        borderRadius="full"
                        px={2}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Badge>
                    )}
                  </Box>
                  <Avatar size="sm" name={mentorName} src={avatarUrl} />
                </HStack>
              )}
            </Flex>

            {children}
          </Stack>
        </Box>
      </Flex>
    </Flex>
  )
}
