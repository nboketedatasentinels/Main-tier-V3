import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export const ReferralLanding: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const ref = searchParams.get('ref')?.trim()

    if (typeof window !== 'undefined') {
      if (ref) {
        localStorage.setItem('pending_ref', ref)
      }
    }

    // Forward the ref param so SignUpPage can read it from the URL too
    navigate(ref ? `/signup?ref=${encodeURIComponent(ref)}` : '/signup', { replace: true })
  }, [navigate, searchParams])

  return null
}
