import React from 'react'
import { Box, Heading, Text, VStack, SimpleGrid, Button } from '@chakra-ui/react'
import { SystemAlertRecord, VerificationRequest } from '@/types/admin'

interface PartnerOverviewPageProps {
  partnerName: string
  alerts: SystemAlertRecord[]
  pendingApprovals: VerificationRequest[]
  loading: boolean
  error: string | null
  onNavigate: (page: string) => void
}

export const PartnerOverviewPage: React.FC<PartnerOverviewPageProps> = ({
  partnerName,
  alerts,
  pendingApprovals,
  onNavigate,
}) => {
  return (
    <Box p={8}>
      <VStack align="start" spacing={6} w="full">
        <Heading size="lg">Welcome back, {partnerName}</Heading>
        <Text color="gray.600">Here is what is happening with your learners today.</Text>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} w="full">
          <Box p={6} bg="white" shadow="sm" borderRadius="lg" border="1px" borderColor="gray.100">
            <VStack align="start">
              <Text fontWeight="bold" color="gray.500" fontSize="sm">
                PENDING APPROVALS
              </Text>
              <Heading size="xl">{pendingApprovals.length}</Heading>
              <Button size="sm" variant="link" colorScheme="blue" onClick={() => onNavigate('approvals')}>
                View queue
              </Button>
            </VStack>
          </Box>
        </SimpleGrid>

        {alerts.length > 0 && (
          <Box w="full" p={6} bg="white" shadow="sm" borderRadius="lg" border="1px" borderColor="gray.100">
            <Heading size="md" mb={4}>
              System Alerts
            </Heading>
            <VStack align="start" spacing={3}>
              {alerts.map((alert) => (
                <Box key={alert.id} p={3} bg="red.50" w="full" borderRadius="md">
                  <Text fontSize="sm" color="red.700">
                    {alert.message}
                  </Text>
                </Box>
              ))}
            </VStack>
          </Box>
        )}
      </VStack>
    </Box>
  )
}
