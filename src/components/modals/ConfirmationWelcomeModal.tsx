import React, { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Button,
  Divider,
  HStack,
  Icon,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Tag,
  Text,
  VStack,
} from '@chakra-ui/react'
import { ArrowRight, BookOpenCheck, Compass, Sparkles, Target, Users } from 'lucide-react'
import type { StandardRole } from '@/types'
import { getDashboardPathForRole } from '@/utils/dashboardPaths'

interface ConfirmationWelcomeModalProps {
  isOpen: boolean
  onAcknowledge: () => void
  firstName?: string
  role?: StandardRole
}

export const ConfirmationWelcomeModal: React.FC<ConfirmationWelcomeModalProps> = ({
  isOpen,
  onAcknowledge,
  firstName,
  role,
}) => {
  const roleMessage = useMemo(() => {
    switch (role) {
      case 'paid_member':
        return 'Dive into your journey dashboard to keep weekly momentum strong.'
      case 'mentor':
        return 'Share your expertise, review mentee updates, and celebrate their wins.'
      case 'ambassador':
        return 'Rally the community by sharing opportunities and spotlighting great work.'
      default:
        return 'Explore the platform, find your community, and start logging your impact.'
    }
  }, [role])

  const featureHighlights = [
    {
      icon: Compass,
      title: 'Platform tour in one view',
      description: 'Dashboards, impact logs, courses, and events — all organized in your left nav.',
    },
    {
      icon: Users,
      title: 'Community first',
      description: 'Join villages, participate in peer spaces, and meet leaders on the same path.',
    },
    {
      icon: Target,
      title: 'Focus on wins',
      description: 'Track points, weekly milestones, and badges to keep your momentum going.',
    },
  ]

  const dashboardPath = getDashboardPathForRole(role)

  const quickActions = useMemo(
    () => [
      { label: 'Open my dashboard', href: dashboardPath, icon: Sparkles },
      { label: 'Log my first impact', href: '/app/impact', icon: Target },
      { label: 'Join the community', href: '/app/announcements', icon: Users },
      { label: 'Browse courses', href: '/app/courses', icon: BookOpenCheck },
    ],
    [dashboardPath],
  )

  return (
    <Modal isOpen={isOpen} onClose={onAcknowledge} isCentered size="2xl">
      <ModalOverlay bg="rgba(15, 6, 33, 0.75)" />
      <ModalContent bg="brand.sidebar" border="1px solid" borderColor="brand.border" boxShadow="2xl">
        <ModalHeader>
          <HStack spacing={3} align="center">
            <Box
              bg="rgba(234, 177, 48, 0.16)"
              borderRadius="full"
              p={2}
              display="grid"
              placeItems="center"
            >
              <Icon as={Sparkles} color="brand.gold" />
            </Box>
            <VStack align="flex-start" spacing={0}>
              <Text fontSize="lg" color="brand.text">
                Welcome, {firstName || 'leader'}!
              </Text>
              <Text fontSize="sm" color="brand.subtleText">
                We set up your workspace so you can start strong.
              </Text>
            </VStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={6}>
            <Box bg="brand.primaryMuted" borderRadius="lg" p={4} border="1px solid" borderColor="brand.border">
              <HStack spacing={3} align="flex-start">
                <Icon as={Compass} color="brand.gold" />
                <VStack align="flex-start" spacing={1}>
                  <Text fontWeight="semibold" color="brand.text">
                    You are in the right place
                  </Text>
                  <Text color="brand.subtleText">{roleMessage}</Text>
                </VStack>
              </HStack>
            </Box>

            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              {featureHighlights.map((feature) => (
                <Box
                  key={feature.title}
                  border="1px solid"
                  borderColor="brand.border"
                  borderRadius="lg"
                  p={4}
                  bg="rgba(53, 14, 111, 0.5)"
                >
                  <HStack spacing={3} mb={2}>
                    <Box bg="rgba(234, 177, 48, 0.12)" borderRadius="full" p={2}>
                      <Icon as={feature.icon} color="brand.gold" />
                    </Box>
                    <Text fontWeight="semibold" color="brand.text">
                      {feature.title}
                    </Text>
                  </HStack>
                  <Text fontSize="sm" color="brand.subtleText">
                    {feature.description}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>

            <Box>
              <HStack justify="space-between" align="center" mb={3}>
                <VStack align="flex-start" spacing={1}>
                  <Text fontWeight="semibold" color="brand.text">
                    Quick start
                  </Text>
                  <Text color="brand.subtleText">Jump to the actions new members love most.</Text>
                </VStack>
                <Tag colorScheme="yellow" bg="rgba(234, 177, 48, 0.16)" color="brand.gold">
                  Recommended
                </Tag>
              </HStack>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    as={RouterLink}
                    to={action.href}
                    onClick={onAcknowledge}
                    justifyContent="space-between"
                    rightIcon={<Icon as={ArrowRight} />}
                    leftIcon={<Icon as={action.icon} />}
                    variant="outline"
                    colorScheme="yellow"
                    borderColor="brand.border"
                    bg="brand.primaryMuted"
                  >
                    {action.label}
                  </Button>
                ))}
              </SimpleGrid>
            </Box>
          </Stack>
        </ModalBody>
        <Divider borderColor="brand.border" />
        <ModalFooter>
          <HStack w="full" justify="space-between">
            <Link
              as={RouterLink}
              to="/app/leaderboard"
              color="brand.subtleText"
              fontSize="sm"
              onClick={onAcknowledge}
            >
              See how others are progressing
            </Link>
            <Button colorScheme="yellow" onClick={onAcknowledge} rightIcon={<Icon as={ArrowRight} />}>
              Start exploring
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
