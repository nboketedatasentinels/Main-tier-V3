import React from 'react'
import { Box, Heading, Text, VStack } from '@chakra-ui/react'
import { VerificationRequest } from '@/types/admin'

interface PartnerApprovalCenterPageProps {
  requests: VerificationRequest[]
  loading: boolean
  error: string | null
}

export const PartnerApprovalCenterPage: React.FC<PartnerApprovalCenterPageProps> = ({ requests }) => {
  return (
    <Box p={8}>
      <VStack align="start" spacing={6} w="full">
        <Heading size="lg">Approval Center</Heading>
        <Text color="gray.600">Review and approve learner point requests.</Text>
        <Box p={6} bg="white" shadow="sm" borderRadius="lg" border="1px" borderColor="gray.100" w="full">
          {requests.length === 0 ? (
            <Text>No pending requests.</Text>
          ) : (
            <VStack align="start" spacing={4}>
              {requests.map((req) => (
                <Box key={req.id} p={4} borderBottom="1px" borderColor="gray.100" w="full">
                  <Text fontWeight="bold">{req.userName}</Text>
                  <Text fontSize="sm">
                    {req.activityTitle} - {req.points} pts
                  </Text>
                </Box>
              ))}
            </VStack>
          )}
        </Box>
      </VStack>
    </Box>
  )
}
