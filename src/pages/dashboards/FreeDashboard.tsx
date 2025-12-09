import React from 'react'
import { Box, Heading, Text, SimpleGrid, Stat, StatLabel, StatNumber, StatHelpText, Card, CardBody } from '@chakra-ui/react'
import { useAuth } from '@/contexts/AuthContext'

export const FreeDashboard: React.FC = () => {
  const { profile } = useAuth()

  return (
    <Box>
      <Heading mb={6} color="brand.gold">Welcome, {profile?.firstName}!</Heading>
      <Text mb={8} color="brand.softGold">
        You're on the Curious Cat Path. Explore T4L and upgrade to unlock full features!
      </Text>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.softGold">Total Points</StatLabel>
              <StatNumber color="brand.gold">{profile?.totalPoints || 0}</StatNumber>
              <StatHelpText color="brand.softGold">Keep logging impact!</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.softGold">Level</StatLabel>
              <StatNumber color="brand.gold">{profile?.level || 1}</StatNumber>
              <StatHelpText color="brand.softGold">Earn points to level up</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.softGold">Journey</StatLabel>
              <StatNumber color="brand.gold">Free Tier</StatNumber>
              <StatHelpText color="brand.flameOrange">Upgrade to start a journey!</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>
    </Box>
  )
}
