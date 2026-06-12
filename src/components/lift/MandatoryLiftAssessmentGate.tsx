import React, { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { hasCompletedLiftAssessment, submitLiftAssessment } from '@/services/liftAssessmentService'
import { computeLiftResult } from '@/utils/liftScoring'
import { readPendingLift, clearPendingLift } from '@/utils/pendingLift'

// Roles whose pre-signup assessment answers we persist (learners; staff exempt).
const GATED_ROLES = new Set(['free_user', 'paid_member', 'user'])

/**
 * No longer a blocking gate. The LIFT assessment is taken in the public funnel
 * (/assessment) before signup; this component just SILENTLY saves any answers a
 * new user took before creating their account, so the admin still receives them.
 * It never shows a modal, forces the assessment, or pops the result after login.
 */
export const MandatoryLiftAssessmentGate: React.FC = () => {
  const { user, profile, profileStatus, effectiveRole } = useAuth()
  const uid = user?.uid
  const gated = GATED_ROLES.has(effectiveRole ?? '')

  useEffect(() => {
    let active = true
    if (profileStatus !== 'ready' || !uid || !profile || !gated) return
    hasCompletedLiftAssessment(uid)
      .then(async (completed) => {
        if (!active || completed) return
        const pending = readPendingLift()
        if (!pending) return
        try {
          const computed = computeLiftResult(pending.itemScores, pending.intake)
          await submitLiftAssessment(uid, pending.intake, pending.itemScores, computed)
          clearPendingLift()
        } catch (error) {
          console.error('[LiftGate] pending submit failed', error)
        }
      })
      .catch((error) => console.error('[LiftGate] completion check failed', error))
    return () => {
      active = false
    }
  }, [profileStatus, uid, profile, gated])

  return null
}
