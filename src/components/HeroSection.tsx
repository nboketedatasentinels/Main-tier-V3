import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Award } from 'lucide-react'

export const HeroSection: React.FC = () => {
  const navigate = useNavigate()

  return (
    <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none hidden sm:block absolute right-[-60px] top-[-60px] h-48 w-48 md:h-64 md:w-64 rounded-full bg-slate-200 opacity-20 blur-[60px] -z-10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none hidden sm:block absolute left-[-80px] bottom-[-80px] h-64 w-64 md:h-96 md:w-96 rounded-full bg-accent-gold-100 opacity-20 blur-[60px] -z-10"
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
        <div className="mb-6 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-indigo-100 px-4 py-2 text-sm font-medium text-brand-indigo-800 shadow-sm">
            <Award className="h-4 w-4" aria-hidden="true" />
            CPD-Accredited Training
          </div>
        </div>

        <h1
          className="mx-auto max-w-2xl font-heading font-bold leading-tight tracking-tight text-3xl text-white sm:max-w-3xl sm:text-4xl md:text-5xl lg:max-w-4xl lg:text-6xl xl:text-7xl"
        >
          Digital Transformation Doesn&apos;t Happen Alone.{' '}
          <span className="text-accent-gold-100">Even Beyoncé Has a Team.</span>
        </h1>

        <p
          className="mx-auto mt-6 max-w-xl px-4 font-body text-sm leading-relaxed text-white/85 sm:max-w-2xl sm:text-base md:text-lg lg:max-w-3xl lg:text-xl"
        >
          Our gamified, CPD-accredited platform gives your team the skills, coaching, and loving-but-firm accountability to
          lead real change without burning out or boring everyone to death. Perfect for managers, team leads, and brave souls
          wearing too many hats.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="h-12 sm:h-14 px-6 sm:px-8 rounded-full bg-brand-indigo-500 text-white font-semibold shadow-lg hover:opacity-95
              w-full sm:w-auto max-w-md
              focus:outline-none focus:ring-2 focus:ring-brand-indigo-500"
          >
            Get Started (+50 XP)
          </button>

          <p className="max-w-sm px-2 text-center text-xs text-white/80 sm:text-sm">
            For go-getters who want to dive in and earn XP like a boss.
          </p>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
