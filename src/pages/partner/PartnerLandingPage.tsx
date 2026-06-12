import React from 'react'
import { useNavigate } from 'react-router-dom'
import { HeroSection } from '@/components/HeroSection'
import { useAuth } from '@/hooks/useAuth'

/**
 * Partner entry point. Partners don't take the LIFT assessment, so "Get started"
 * goes straight to sign up (not the assessment funnel). Share this URL
 * (/partners) with partners.
 */
export const PartnerLandingPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-white">
      <header className="w-full bg-[#27062e]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-3 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eab130]"
            aria-label="Transformation Leader home"
          >
            <img src="/t4.png" alt="" className="h-10 w-10 rounded-full object-cover" />
            <span className="flex flex-col text-left leading-none">
              <span className="font-heading text-base font-extrabold tracking-wide text-[#eab130] sm:text-lg">
                TRANSFORMATION <span className="text-[#f9db59]">LEADER</span>
              </span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.25em] text-[#eab130]/70">
                Partner Portal
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate(user ? '/app' : '/login')}
            className="rounded-full bg-[#eab130] px-6 py-2.5 text-sm font-bold text-[#27062e] shadow-sm transition hover:bg-[#f9db59] focus:outline-none focus:ring-2 focus:ring-white"
          >
            {user ? 'Dashboard' : 'Sign in'}
          </button>
        </div>
      </header>

      <main>
        <HeroSection
          ctaTo="/signup"
          ctaLabel="Get started"
          note="Create your partner account - no assessment required."
        />
      </main>
    </div>
  )
}

export default PartnerLandingPage
