import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Divider,
  Flex,
  Heading,
  Spinner,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'
import { AdminNotificationsList } from './AdminNotificationsList'
import { LoadingCoordinator } from '@/utils/firestoreErrorHandling'
import {
  listenToPointsVerifications,
  listenToRegistrations,
  listenToSystemAlerts,
  type VerificationRequest,
  type Registration,
  type SystemAlert,
} from '@/services/adminNotificationsService'

export const RealTimeNotificationCenter = () => {
  const { notifications, loading: adminLoading } = useAdminNotifications({ role: 'super_admin' })
  const [verifications, setVerifications] = useState<VerificationRequest[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create loading coordinator to manage parallel listeners
  const coordinator = useMemo(() => new LoadingCoordinator(setLoading), [])

  useEffect(() => {
    setError(null)

    // Mark all 3 operations as started
    coordinator.start('verifications')
    coordinator.start('registrations')
    coordinator.start('alerts')

    // Use service layer functions
    const unsubVerify = listenToPointsVerifications(
      (data) => {
        setVerifications(data)
        coordinator.complete('verifications')
      },
      (err) => {
        setError(err.message)
        coordinator.complete('verifications')
      }
    )

    const unsubRegistration = listenToRegistrations(
      (data) => {
        setRegistrations(data)
        coordinator.complete('registrations')
      },
      (err) => {
        setError(err.message)
        coordinator.complete('registrations')
      }
    )

    const unsubSystemAlerts = listenToSystemAlerts(
      (data) => {
        setSystemAlerts(data)
        coordinator.complete('alerts')
      },
      (err) => {
        setError(err.message)
        coordinator.complete('alerts')
      }
    )

    return () => {
      unsubVerify()
      unsubRegistration()
      unsubSystemAlerts()
    }
  }, [coordinator])

  return (
    <Stack spacing={6}>
      <Heading size="lg">Real-time Notification Center</Heading>

      {error && (
        <Alert status="error">
          <AlertIcon />
          {error}
        </Alert>
      )}

      {(loading || adminLoading) && (
        <Flex justify="center" py={4}>
          <Spinner />
        </Flex>
      )}

      <Stack direction={{ base: 'column', md: 'row' }} spacing={4}>
        <Box flex={1} borderWidth="1px" rounded="md" p={4} bg="white">
          <Heading size="md" mb={2}>
            Pending verifications
          </Heading>
          <Divider mb={3} />
          <VStack align="start" spacing={3}>
            {verifications.map((item) => (
              <Box key={item.id} w="full" p={3} borderWidth="1px" rounded="md">
                <Text fontWeight="bold">{item.userName}</Text>
                <Text color="gray.600">{item.activityTitle}</Text>
                <Badge colorScheme="purple">{item.points} pts</Badge>
              </Box>
            ))}
            {!verifications.length && <Text color="gray.500">No pending verifications</Text>}
          </VStack>
        </Box>

        <Box flex={1} borderWidth="1px" rounded="md" p={4} bg="white">
          <Heading size="md" mb={2}>
            New registrations
          </Heading>
          <Divider mb={3} />
          <VStack align="start" spacing={3}>
            {registrations.map((registration) => (
              <Box key={registration.id} w="full" p={3} borderWidth="1px" rounded="md">
                <Text fontWeight="bold">{registration.name}</Text>
                <Text color="gray.600">{registration.email}</Text>
                {registration.company && <Text color="gray.600">{registration.company}</Text>}
              </Box>
            ))}
            {!registrations.length && <Text color="gray.500">No registrations</Text>}
          </VStack>
        </Box>

        <Box flex={1} borderWidth="1px" rounded="md" p={4} bg="white">
          <Heading size="md" mb={2}>
            System health alerts
          </Heading>
          <Divider mb={3} />
          <VStack align="start" spacing={3}>
            {systemAlerts.map((alert) => (
              <Box key={alert.id} w="full" p={3} borderWidth="1px" rounded="md">
                <Badge colorScheme="red" mb={1}>
                  {alert.level}
                </Badge>
                <Text fontWeight="bold">{alert.component}</Text>
                <Text color="gray.600">{alert.message}</Text>
              </Box>
            ))}
            {!systemAlerts.length && <Text color="gray.500">No system alerts</Text>}
          </VStack>
        </Box>
      </Stack>

      <AdminNotificationsList notifications={notifications} />
    </Stack>
  )
}

export default RealTimeNotificationCenter
