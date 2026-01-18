import { Box, Button, HStack, Icon, Text, VStack } from '@chakra-ui/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, ClipboardList, Target, Trophy, User } from 'lucide-react'

interface NavItem {
  label: string
  path: string
  icon: typeof CalendarDays
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/app/weekly-glance', icon: CalendarDays },
  { label: 'Checklist', path: '/app/weekly-checklist', icon: ClipboardList },
  { label: 'Impact', path: '/app/impact', icon: Target },
  { label: 'Leaderboard', path: '/app/leaderboard', icon: Trophy },
  { label: 'Profile', path: '/app/profile', icon: User },
]

export const MobileBottomNav = () => {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Box
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      bg="surface.default"
      borderTop="1px solid"
      borderColor="border.subtle"
      boxShadow="0 -2px 10px rgba(0, 0, 0, 0.05)"
      display={{ base: 'block', md: 'none' }}
      zIndex={1000}
      pb="env(safe-area-inset-bottom)"
    >
      <HStack spacing={0} justify="space-around" py={2}>
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname.startsWith(item.path)

          return (
            <Button
              key={item.path}
              variant="ghost"
              onClick={() => navigate(item.path)}
              flexDir="column"
              height="auto"
              py={2}
              px={3}
              flex={1}
              borderRadius="none"
              _hover={{ bg: 'transparent' }}
            >
              <VStack spacing={0.5}>
                <Icon
                  as={item.icon}
                  boxSize={5}
                  color={isActive ? 'brand.primary' : 'text.muted'}
                  transition="color 0.2s"
                />
                <Text
                  fontSize="10px"
                  fontWeight={isActive ? 'semibold' : 'medium'}
                  color={isActive ? 'brand.primary' : 'text.muted'}
                  transition="color 0.2s"
                >
                  {item.label}
                </Text>
              </VStack>
            </Button>
          )
        })}
      </HStack>
    </Box>
  )
}
