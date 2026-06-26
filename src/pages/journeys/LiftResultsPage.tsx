import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Center, Heading, Spinner, Text, VStack } from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { LiftResultView } from '@/components/lift/LiftResultView'
import { getOwnLiftAssessment, type LiftAssessmentRow } from '@/services/liftAssessmentService'
import { OFFERS, type Offer } from '@/config/liftAssessment'

const offerByKey = (key: string): Offer => {
  const all: Offer[] = [
    OFFERS.gateway,
    OFFERS.topVoices,
    OFFERS.journeyByEdge.L,
    OFFERS.journeyByEdge.I,
    OFFERS.journeyByEdge.F,
    OFFERS.journeyByEdge.T,
  ]
  return all.find((o) => o.key === key) ?? { key, label: key }
}

export const LiftResultsPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [row, setRow] = useState<LiftAssessmentRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!user?.uid) return
    setLoading(true)
    getOwnLiftAssessment(user.uid)
      .then((data) => active && setRow(data))
      .catch((error) => console.error('[LiftResults] load failed', error))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [user?.uid])

  if (loading) {
    return (
      <Center py={20}>
        <Spinner size="lg" color="purple.500" />
      </Center>
    )
  }

  if (!row) {
    return (
      <Box maxW="2xl" mx="auto" py={10} textAlign="center">
        <Heading size="md" color="brand.deepPlum">
          No LIFT results yet
        </Heading>
        <Text mt={2} color="gray.500">
          You have not completed the LIFT assessment.
        </Text>
      </Box>
    )
  }

  return (
    <Box maxW="3xl" mx="auto">
      <VStack align="stretch" spacing={4}>
        <Heading size="lg" color="brand.deepPlum">
          Your LIFT Results
        </Heading>
        <LiftResultView
          pillars={row.pillars}
          liftIndex={row.liftIndex}
          archetype={row.archetype}
          developmentEdge={row.developmentEdge}
          recommendedOffer={offerByKey(row.recommendedOffer)}
          leadTier={row.leadTier}
          coachingTriggered={row.coachingTriggered}
          onPrimaryCta={() => navigate('/app/journeys')}
        />
      </VStack>
    </Box>
  )
}

export default LiftResultsPage
