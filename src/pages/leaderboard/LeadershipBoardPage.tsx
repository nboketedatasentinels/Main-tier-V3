import React, { useEffect, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Heading,
  Text,
  Stack,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Tag,
} from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { hasSeenLeaderboardFilter, markLeaderboardFilterSeen } from '@/services/boltDatabase'

const sampleLeaders = [
  { rank: 1, name: 'You', points: 1200 },
  { rank: 2, name: 'Kevin', points: 1150 },
  { rank: 3, name: 'Joker', points: 980 },
]

export const LeadershipBoardPage: React.FC = () => {
  const { user } = useAuth()
  const [showFilterTip, setShowFilterTip] = useState(false)

  useEffect(() => {
    const load = async () => {
      const userId = user?.uid || 'anonymous'
      const seen = await hasSeenLeaderboardFilter(userId)
      setShowFilterTip(!seen)
    }

    load()
  }, [user?.uid])

  const dismissBanner = async () => {
    const userId = user?.uid || 'anonymous'
    await markLeaderboardFilterSeen(userId)
    setShowFilterTip(false)
  }

  return (
    <Stack spacing={6}>
      {showFilterTip && (
        <Alert
          status="info"
          bg="blue.50"
          color="blue.900"
          borderRadius="lg"
          border="1px solid"
          borderColor="blue.200"
        >
          <AlertIcon />
          <Box flex="1">
            <AlertTitle fontWeight="bold">Pro tip: Filter the leaderboard</AlertTitle>
            <AlertDescription>
              Narrow by village, journey, or time frame to see where to focus next. We will remember this choice for you.
            </AlertDescription>
          </Box>
          <Button
            size="sm"
            variant="ghost"
            colorScheme="blue"
            aria-label="Dismiss filter tutorial"
            onClick={dismissBanner}
          >
            Dismiss
          </Button>
        </Alert>
      )}

      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="brand.border" boxShadow="sm">
        <Heading size="md" color="brand.text">
          Leadership Board
        </Heading>
        <Text color="brand.subtleText">Compare your progress with peers across multiple leaderboards.</Text>
      </Box>

      <Box bg="white" p={4} borderRadius="lg" border="1px solid" borderColor="brand.border">
        <Table variant="simple" size="sm">
          <Thead>
            <Tr>
              <Th>Rank</Th>
              <Th>Name</Th>
              <Th isNumeric>Points</Th>
            </Tr>
          </Thead>
          <Tbody>
            {sampleLeaders.map(leader => (
              <Tr key={leader.rank} bg={leader.name === 'You' ? 'brand.primaryMuted' : 'transparent'}>
                <Td>
                  {leader.rank <= 3 ? <Tag colorScheme="purple">{leader.rank}</Tag> : leader.rank}
                </Td>
                <Td>{leader.name}</Td>
                <Td isNumeric>{leader.points}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </Stack>
  )
}
