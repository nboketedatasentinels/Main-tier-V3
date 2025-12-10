import React from 'react'
import { Box, Heading, Text, Stack, SimpleGrid, Stat, StatLabel, StatNumber, StatHelpText, Button } from '@chakra-ui/react'

export const ReferralRewardsPage: React.FC = () => {
  return (
    <Stack spacing={6}>
      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="brand.border" boxShadow="sm">
        <Heading size="md" color="brand.text">
          Referral Rewards
        </Heading>
        <Text color="brand.subtleText">Share your link to invite others and earn rewards.</Text>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        <Stat p={4} bg="white" borderRadius="lg" border="1px solid" borderColor="brand.border">
          <StatLabel>Referrals</StatLabel>
          <StatNumber>12</StatNumber>
          <StatHelpText color="brand.subtleText">Total invited</StatHelpText>
        </Stat>
        <Stat p={4} bg="white" borderRadius="lg" border="1px solid" borderColor="brand.border">
          <StatLabel>Rewards</StatLabel>
          <StatNumber>3</StatNumber>
          <StatHelpText color="brand.subtleText">Pending redemption</StatHelpText>
        </Stat>
        <Stat p={4} bg="white" borderRadius="lg" border="1px solid" borderColor="brand.border">
          <StatLabel>Points</StatLabel>
          <StatNumber>480</StatNumber>
          <StatHelpText color="brand.subtleText">Earned from referrals</StatHelpText>
        </Stat>
      </SimpleGrid>

      <Box bg="white" p={4} borderRadius="lg" border="1px solid" borderColor="brand.border">
        <Text mb={3} color="brand.subtleText">Your unique referral link</Text>
        <Button variant="secondary" width="full">Copy link</Button>
      </Box>
    </Stack>
  )
}
