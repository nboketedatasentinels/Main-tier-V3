import React, { useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Box, Flex, Heading, VStack, Button, Text } from '@chakra-ui/react'
import { ShieldCheck, LayoutDashboard, Users2, Settings } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { LoadingAnimation } from '@/components/loading/LoadingAnimation'

const navItems = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Organizations', path: '/admin/organizations', icon: Users2 },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
]

export const AdminLayout: React.FC = () => {
  const { profile, signOut, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const activePath = useMemo(() => location.pathname, [location.pathname])

  if (loading) {
    return (
      <Box minH="100vh" bg="brand.deepPlum">
        <LoadingAnimation label="Preparing admin console..." />
      </Box>
    )
  }

  return (
    <Flex minH="100vh" bg="brand.midnight" color="brand.softGold">
      <Box
        as="nav"
        w={{ base: 'full', md: '280px' }}
        p={6}
        bg="brand.deepPlum"
        borderRightWidth={1}
        borderColor="brand.charcoal"
      >
        <Flex align="center" gap={3} mb={8}>
          <ShieldCheck color="var(--chakra-colors-brand-gold)" />
          <Box>
            <Heading size="md" color="brand.gold">
              Admin Console
            </Heading>
            <Text fontSize="sm" color="brand.subtleText">
              Secure controls for administrators
            </Text>
          </Box>
        </Flex>

        <VStack align="stretch" spacing={3}>
          {navItems.map(({ label, path, icon: Icon }) => {
            const isActive = activePath.startsWith(path)
            return (
              <Button
                key={path}
                onClick={() => navigate(path)}
                justifyContent="flex-start"
                leftIcon={<Icon size={18} />}
                variant={isActive ? 'solid' : 'ghost'}
                colorScheme={isActive ? 'orange' : undefined}
                bg={isActive ? 'brand.flameOrange' : 'transparent'}
                color={isActive ? 'brand.deepPlum' : 'brand.softGold'}
                _hover={{ bg: 'brand.gold', color: 'brand.deepPlum' }}
              >
                {label}
              </Button>
            )
          })}
        </VStack>

        <Button mt={10} variant="outline" onClick={signOut} colorScheme="orange">
          Sign out {profile?.firstName ?? ''}
        </Button>
      </Box>

      <Box flex="1" p={{ base: 4, md: 8 }}>
        <Outlet />
      </Box>
    </Flex>
  )
}
