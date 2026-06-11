import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Container } from '@chakra-ui/react'
import { LiftAssessmentFlow } from '@/components/lift/LiftAssessmentFlow'
import { useAuth } from '@/hooks/useAuth'
import { savePendingLift } from '@/utils/pendingLift'
import { submitLiftAssessment } from '@/services/liftAssessmentService'
import type { IntakeAnswers, ItemScores, LiftResult } from '@/utils/liftScoring'

/**
 * Public, assessment-first funnel: a visitor takes the LIFT assessment without
 * an account. On finish, anonymous answers are stashed in the browser and the
 * visitor is sent to sign up / sign in; the post-login gate scores + saves them
 * and shows the results. A visitor who is already signed in is saved straight
 * away and sent to their results.
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
    <Box minH="100vh" bg="white">
      <Box as="header" w="full" bg="#27062e">
        <Box mx="auto" maxW="6xl" px={{ base: 4, sm: 6 }} py={4}>
          <Box
            as="button"
            onClick={() => navigate('/')}
            display="flex"
            alignItems="center"
            gap={3}
            aria-label="Transformation Leader home"
          >
            <img src="/t4.png" alt="" style={{ height: 40, width: 40, borderRadius: '9999px', objectFit: 'cover' }} />
            <Box as="span" fontWeight="extrabold" letterSpacing="wide" color="#eab130" fontSize={{ base: 'sm', sm: 'md' }}>
              TRANSFORMATION <Box as="span" color="#f9db59">LEADER</Box>
            </Box>
          </Box>
        </Box>
      </Box>

      <Container maxW="2xl" py={{ base: 6, md: 10 }}>
        <Box
          bg="white"
          borderWidth="1px"
          borderColor="gray.100"
          borderRadius="2xl"
          shadow="sm"
          p={{ base: 4, md: 8 }}
        >
          <LiftAssessmentFlow onComplete={handleComplete} initialPhase="countdown" />
        </Box>
      </Container>
    </Box>
  )
}

export default PublicAssessmentPage
