import React from 'react'
import { Box, Heading, Text, SimpleGrid, Card, CardBody, Stat, StatLabel, StatNumber, StatHelpText } from '@chakra-ui/react'
import { useAuth } from '@/contexts/AuthContext'

export const PaidMemberDashboard: React.FC = () => {
  const { profile } = useAuth()

  return (
    <Box>
      <Heading mb={6} color="brand.gold">Welcome back, {profile?.firstName}!</Heading>
      <Text mb={8} color="brand.softGold">
        Continue your transformation journey with T4L.
      </Text>

      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={6}>
        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.softGold">Total Points</StatLabel>
              <StatNumber color="brand.gold">{profile?.totalPoints || 0}</StatNumber>
              <StatHelpText color="brand.softGold">This journey</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.softGold">Level</StatLabel>
              <StatNumber color="brand.gold">{profile?.level || 1}</StatNumber>
              <StatHelpText color="brand.softGold">Current level</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.softGold">Current Week</StatLabel>
              <StatNumber color="brand.gold">{profile?.currentWeek || 1}</StatNumber>
              <StatHelpText color="brand.softGold">of your journey</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.softGold">Badges</StatLabel>
              <StatNumber color="brand.gold">0</StatNumber>
              <StatHelpText color="brand.softGold">Earned</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>
    </Box>
  )
}
