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

    navigate('/signup', { replace: true })
  }, [navigate, searchParams])

  return null
}
