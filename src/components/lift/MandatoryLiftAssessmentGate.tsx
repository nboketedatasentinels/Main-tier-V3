import React, { useEffect, useState } from 'react'
import {
  Center,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spinner,
  useToast,
} from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { LiftAssessmentFlow } from './LiftAssessmentFlow'
import { LiftResultView } from './LiftResultView'
import {
  hasCompletedLiftAssessment,
  submitLiftAssessment,
} from '@/services/liftAssessmentService'
import type { LiftResult, ItemScores, IntakeAnswers } from '@/utils/liftScoring'

// Roles required to complete the one-time assessment (learners only; staff exempt).
const GATED_ROLES = new Set(['free_user', 'paid_member', 'user'])

type GateStatus = 'checking' | 'needs' | 'submitting' | 'result' | 'done'

export const MandatoryLiftAssessmentGate: React.FC = () => {
  const { user, profile, profileStatus, effectiveRole } = useAuth()
  const toast = useToast()
  const [status, setStatus] = useState<GateStatus>('checking')
  const [result, setResult] = useState<LiftResult | null>(null)

  const uid = user?.uid
  const gated = GATED_ROLES.has(effectiveRole ?? '')

  useEffect(() => {
    let active = true
    if (profileStatus !== 'ready' || !uid || !profile) return
    if (!gated) {
      setStatus('done')
      return
    }
    setStatus('checking')
    hasCompletedLiftAssessment(uid)
      .then((completed) => {
        if (!active) return
        setStatus(completed ? 'done' : 'needs')
      })
      .catch((error) => {
        console.error('[LiftGate] completion check failed', error)
        // Fail open: do not trap the user behind a broken check.
        if (active) setStatus('done')
      })
    return () => {
      active = false
    }
  }, [profileStatus, uid, profile, gated])

  const handleComplete = async (intake: IntakeAnswers, itemScores: ItemScores, computed: LiftResult) => {
    if (!uid) return
    setStatus('submitting')
    try {
      await submitLiftAssessment(uid, intake, itemScores, computed)
      setResult(computed)
      setStatus('result')
    } catch (error) {
      console.error('[LiftGate] submit failed', error)
      toast({
        title: 'Could not save your results',
        description: 'Please try again in a moment.',
        status: 'error',
        duration: 4000,
      })
      setStatus('needs')
    }
  }

  if (status === 'done') return null

  const isOpen = status === 'checking' || status === 'needs' || status === 'submitting' || status === 'result'

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      closeOnOverlayClick={false}
      closeOnEsc={false}
      isCentered
      size={{ base: 'full', md: '2xl' }}
      scrollBehavior="inside"
    >
      <ModalOverlay bg="rgba(15, 3, 25, 0.85)" backdropFilter="blur(6px)" />
      <ModalContent borderRadius={{ base: 'none', md: '2xl' }} bg="brand.accent">
        <ModalHeader bg="white" borderTopRadius={{ base: 'none', md: '2xl' }}>
          {status === 'result' ? 'Your LIFT Index' : 'Welcome - one quick step'}
        </ModalHeader>
        <ModalBody py={6}>
          {status === 'checking' && (
            <Center py={16}>
              <Spinner size="lg" color="purple.500" />
            </Center>
          )}
          {(status === 'needs' || status === 'submitting') && (
            <LiftAssessmentFlow onComplete={handleComplete} submitting={status === 'submitting'} />
          )}
          {status === 'result' && result && (
            <LiftResultView
              pillars={result.pillars}
              liftIndex={result.liftIndex}
              archetype={result.archetype}
              developmentEdge={result.developmentEdge}
              recommendedOffer={result.recommendedOffer}
              leadTier={result.leadTier}
              coachingTriggered={result.coachingTriggered}
              onContinue={() => setStatus('done')}
              continueLabel="Continue to the app"
            />
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
