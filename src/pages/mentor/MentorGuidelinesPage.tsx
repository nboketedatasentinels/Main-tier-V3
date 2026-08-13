import React, { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MentorDashboardLayout } from '@/layouts/MentorDashboardLayout'
import { MentorGuidelinesContent } from '@/components/mentor/MentorGuidelinesContent'
import { useAuth } from '@/hooks/useAuth'
import { resolveMentorNavDestination } from '@/utils/mentorNavigation'

export const MentorGuidelinesPage: React.FC = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const onNavigate = useCallback(
    (key: string) => {
      const dest = resolveMentorNavDestination(key)
      if (dest.kind === 'route') {
        navigate(dest.path)
        return
      }
      navigate('/mentor/dashboard', { state: { mentorSection: dest.section } })
    },
    [navigate],
  )

  return (
    <MentorDashboardLayout
      activeItem="guidelines"
      mentorName={`${profile?.firstName || 'Mentor'} ${profile?.lastName || ''}`.trim()}
      avatarUrl={profile?.avatarUrl || profile?.photoURL}
      onNavigate={onNavigate}
    >
      <MentorGuidelinesContent />
    </MentorDashboardLayout>
  )
}
