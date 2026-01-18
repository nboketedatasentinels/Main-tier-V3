import {
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
import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'
import { AdminNotificationsList } from './AdminNotificationsList'

interface VerificationRequest {
  id: string
  userName: string
  activityTitle: string
  points: number
  created_at?: string
}

interface Registration {
  id: string
  name: string
  email: string
  company?: string
  created_at?: string
}

interface SystemAlert {
  id: string
  level: string
  message: string
  component?: string
  created_at?: string
}

export const RealTimeNotificationCenter = () => {
  const { notifications, loading: adminLoading } = useAdminNotifications({ role: 'super_admin' })
  const [verifications, setVerifications] = useState<VerificationRequest[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const verificationQuery = query(collection(db, 'points_verifications'), orderBy('created_at', 'desc'))
    const registrationQuery = query(collection(db, 'registrations'), orderBy('created_at', 'desc'))
    const systemAlertsQuery = query(collection(db, 'system_health_alerts'), orderBy('created_at', 'desc'))

    const unsubVerify = onSnapshot(verificationQuery, (snapshot) => {
      setVerifications(snapshot.docs.map((doc) => ({ ...(doc.data() as VerificationRequest), id: doc.id })))
      setLoading(false)
    })
    const unsubRegistration = onSnapshot(registrationQuery, (snapshot) => {
      setRegistrations(snapshot.docs.map((doc) => ({ ...(doc.data() as Registration), id: doc.id })))
      setLoading(false)
    })
    const unsubSystemAlerts = onSnapshot(systemAlertsQuery, (snapshot) => {
      setSystemAlerts(snapshot.docs.map((doc) => ({ ...(doc.data() as SystemAlert), id: doc.id })))
      setLoading(false)
    })

    return () => {
      unsubVerify()
      unsubRegistration()
      unsubSystemAlerts()
    }
  }, [])

  return (
    <Stack spacing={6}>
      <Heading size="lg">Real-time Notification Center</Heading>
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
