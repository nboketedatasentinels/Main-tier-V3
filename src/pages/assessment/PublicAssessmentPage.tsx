import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Center,
  Container,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { LiftAssessmentFlow } from '@/components/lift/LiftAssessmentFlow'
import { LiftResultView } from '@/components/lift/LiftResultView'
import { useAuth } from '@/hooks/useAuth'
import {
  completeLiftLead,
  createLiftLead,
  hasCompletedLiftAssessment,
  submitLiftAssessment,
  submitLiftLead,
} from '@/services/liftAssessmentService'
import type { IntakeAnswers, ItemScores, LiftResult } from '@/utils/liftScoring'

/**
 * Public, assessment-first funnel (no account, no app access). A visitor enters
 * their contact details, takes the LIFT assessment, sees their results in a
 * pop-up, and lands on a thank-you page. The lead is saved UP-FRONT (the moment
 * details are submitted) so the admin captures it even if they abandon the
 * questions; it is completed with their scores when they finish. A visitor who
 * happens to be signed in is saved to their own account instead.
 */
export const PublicAssessmentPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [result, setResult] = useState<LiftResult | null>(null)
  // Id of the lead row created up-front (anonymous visitors only), so we can
  // complete it with scores once the assessment is finished.
  const leadIdRef = useRef<string | null>(null)
  // Once-in-a-lifetime: if this signed-in user already has saved results, never
  // show the countdown/assessment again - send them straight to their results.
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    if (loading) return
    if (!user?.uid) {
      setChecking(false)
      return
    }
    hasCompletedLiftAssessment(user.uid)
      .then((completed) => {
        if (!active) return
        if (completed) {
          navigate('/app/lift-results', { replace: true })
        } else {
          setChecking(false)
        }
      })
      .catch(() => {
        // Fail open: let them take it rather than trap them on a spinner.
        if (active) setChecking(false)
      })
    return () => {
      active = false
    }
  }, [loading, user?.uid, navigate])

  // Contact details submitted (before the questions). Save the anonymous lead
  // immediately so the admin keeps it even if they never finish. Best-effort and
  // fire-and-forget: we never block the visitor from starting the assessment.
  const handleContactCaptured = (intake: IntakeAnswers) => {
    if (user?.uid) return // signed-in visitors save to their account at the end
    createLiftLead(intake)
      .then((id) => {
        leadIdRef.current = id
      })
      .catch(() => {
        /* non-fatal: handleComplete falls back to a one-shot insert */
      })
  }

  const handleComplete = async (intake: IntakeAnswers, itemScores: ItemScores, computed: LiftResult) => {
    if (user?.uid) {
      try {
        await submitLiftAssessment(user.uid, intake, itemScores, computed)
      } catch {
        /* the gate / results page reconcile if the save hiccups */
      }
    } else {
      // Anonymous visitor: complete the lead we created up-front. If that insert
      // never landed (no id), fall back to a one-shot insert so we still capture
      // them. Best-effort - results show either way.
      try {
        if (leadIdRef.current) {
          await completeLiftLead(leadIdRef.current, intake, itemScores, computed)
        } else {
          await submitLiftLead(intake, itemScores, computed)
        }
      } catch {
        /* non-fatal: results still show, thank-you page still loads */
      }
    }
    // Show their results in a pop-up first; the continue button routes onward.
    setResult(computed)
  }

  const handleContinue = () => {
    if (user?.uid) {
      navigate('/app/lift-results', { replace: true })
    } else {
      // No account, no platform access - thank them and recap their result.
      navigate('/assessment/thank-you', { replace: true, state: { result } })
    }
  }

  if (loading || checking) {
    return (
      <Center minH="100vh" bg="white">
        <Spinner size="lg" color="#27062e" thickness="4px" />
      </Center>
    )
  }

  return (
    <Box minH="100vh" bg="white" position="relative" overflow="hidden">
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
            A few honest answers - about four minutes. See your full LIFT profile the moment you finish, and
            we&apos;ll send it to your inbox. No account needed.
          </Text>
        </VStack>

        {/* No card - content sits directly on the page */}
        <LiftAssessmentFlow
          onComplete={handleComplete}
          onContactCaptured={handleContactCaptured}
          initialPhase="countdown"
        />
      </Container>

      {/* Results pop-up, shown when the assessment is complete */}
      <Modal
        isOpen={Boolean(result)}
        onClose={() => {}}
        closeOnOverlayClick={false}
        closeOnEsc={false}
        isCentered
        size={{ base: 'full', md: '2xl' }}
        scrollBehavior="inside"
      >
        <ModalOverlay bg="rgba(15, 3, 25, 0.85)" backdropFilter="blur(6px)" />
        <ModalContent borderRadius={{ base: 'none', md: '2xl' }}>
          <ModalHeader>Your LIFT Index</ModalHeader>
          <ModalCloseButton onClick={handleContinue} />
          <ModalBody py={6}>
            {result && (
              <LiftResultView
                variant="public"
                pillars={result.pillars}
                liftIndex={result.liftIndex}
                archetype={result.archetype}
                developmentEdge={result.developmentEdge}
                recommendedOffer={result.recommendedOffer}
                leadTier={result.leadTier}
                coachingTriggered={result.coachingTriggered}
                onContinue={handleContinue}
                continueLabel="Continue"
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
}

export default PublicAssessmentPage
