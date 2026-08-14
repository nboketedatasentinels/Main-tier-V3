import React, { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AmbassadorLayout } from '@/layouts/AmbassadorLayout'
import { MentorGuidelinesContent } from '@/components/mentor/MentorGuidelinesContent'
import { COACH_GUIDELINES_META, COACH_GUIDELINES_SECTIONS } from '@/content/coachGuidelines'
import { useAuth } from '@/hooks/useAuth'
import { resolveCoachNavDestination } from '@/utils/coachNavigation'

export const CoachGuidelinesPage: React.FC = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const onNavigate = useCallback(
    (key: string) => {
      const dest = resolveCoachNavDestination(key)
      if (dest.kind === 'route') {
        navigate(dest.path)
        return
      }
      navigate('/coach/dashboard', { state: { coachSection: dest.section } })
    },
    [navigate],
  )

  return (
    <AmbassadorLayout
      activeItem="guidelines"
      ambassadorName={`${profile?.firstName || 'Coach'} ${profile?.lastName || ''}`.trim()}
      avatarUrl={profile?.avatarUrl || profile?.photoURL}
      onNavigate={onNavigate}
      subtitle="Coach guidelines"
    >
      <MentorGuidelinesContent
        meta={COACH_GUIDELINES_META}
        sections={COACH_GUIDELINES_SECTIONS}
        eyebrow="Coaching handbook"
      />
    </AmbassadorLayout>
  )
}
