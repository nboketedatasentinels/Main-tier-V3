import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Container, Text, VStack } from '@chakra-ui/react'
import { LiftAssessmentFlow } from '@/components/lift/LiftAssessmentFlow'
import { useAuth } from '@/hooks/useAuth'
import { savePendingLift } from '@/utils/pendingLift'
import { submitLiftAssessment } from '@/services/liftAssessmentService'
import type { IntakeAnswers, ItemScores, LiftResult } from '@/utils/liftScoring'

/**
 * Public, assessment-first funnel: a visitor takes the LIFT assessment without
 * an account. On finish, anonymous answers are stashed in the browser and the
 * visitor is sent to sign up / sign in; the post-login gate scores + saves them
 * and shows the results. A visitor already signed in is saved straight away.
 */
export const PublicAssessmentPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleComplete = async (intake: IntakeAnswers, itemScores: ItemScores, result: LiftResult) => {
    if (user?.uid) {
      try {
        await submitLiftAssessment(user.uid, intake, itemScores, result)
      } catch {
        /* results page re-reads from storage if the save hiccups */
      }
      navigate('/app/lift-results', { replace: true })
      return
    }
    savePendingLift({ intake, itemScores })
    navigate('/signup?from=assessment', { replace: true })
  }

  return (
    <Box minH="100vh" bg="#fffdf6" position="relative" overflow="hidden">
      {/* Soft gold blobs */}
      <Box
        aria-hidden
        position="absolute"
        top="-130px"
        right="-130px"
        w={{ base: '280px', md: '420px' }}
        h={{ base: '280px', md: '420px' }}
        borderRadius="full"
        bg="#eab130"
        opacity={0.2}
        filter="blur(90px)"
        pointerEvents="none"
      />
      <Box
        aria-hidden
        position="absolute"
        bottom="-150px"
        left="-150px"
        w={{ base: '320px', md: '460px' }}
        h={{ base: '320px', md: '460px' }}
        borderRadius="full"
        bg="#f9db59"
        opacity={0.28}
        filter="blur(100px)"
        pointerEvents="none"
      />

      {/* Minimal brand mark */}
      <Box position="relative" zIndex={1} px={{ base: 4, sm: 6 }} pt={5}>
        <Box
          as="button"
          onClick={() => navigate('/')}
          display="flex"
          alignItems="center"
          gap={2.5}
          aria-label="Transformation Leader home"
        >
          <img src="/t4.png" alt="" style={{ height: 36, width: 36, borderRadius: '9999px', objectFit: 'cover' }} />
          <Box as="span" fontWeight="extrabold" letterSpacing="wide" color="#27062e" fontSize="sm">
            TRANSFORMATION <Box as="span" color="#eab130">LEADER</Box>
          </Box>
        </Box>
      </Box>

      <Container maxW="2xl" position="relative" zIndex={1} py={{ base: 8, md: 12 }}>
        {/* Stylish note: this is the way in */}
        <VStack spacing={1.5} mb={{ base: 8, md: 10 }} textAlign="center">
          <Text fontSize="xs" fontWeight="bold" letterSpacing="0.2em" textTransform="uppercase" color="#9c6f15">
            Your LIFT profile awaits
          </Text>
          <Text fontSize={{ base: 'sm', md: 'md' }} color="gray.600" maxW="lg">
            A few honest answers - about four minutes. When you finish, you&apos;ll create your account (or sign in)
            to unlock and keep your results.
          </Text>
        </VStack>

        {/* No card - content sits directly on the page */}
        <LiftAssessmentFlow onComplete={handleComplete} initialPhase="countdown" />
      </Container>
    </Box>
  )
}

export default PublicAssessmentPage
