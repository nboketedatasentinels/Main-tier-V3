import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, TrendingUp, Users, GraduationCap } from 'lucide-react'

const serif = { fontFamily: 'Georgia, "Times New Roman", Times, serif' }

const Feature: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div className="inline-flex items-center gap-2 text-neutral-700">
    <span className="text-[#eab130]" aria-hidden="true">
      {icon}
    </span>
    <span className="text-base font-medium">{label}</span>
  </div>
)

interface HeroSectionProps {
  /** Where the primary CTA goes (default: the public assessment). */
  ctaTo?: string
  ctaLabel?: string
  note?: string
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  ctaTo = '/assessment',
  ctaLabel = 'Get started',
  note = 'Take the 4-minute LIFT assessment. No card needed.',
}) => {
  const navigate = useNavigate()

  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-16 text-center sm:py-24">
      {/* Badge */}
      <div className="mb-8 flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#fbf2d8] px-5 py-2 text-sm font-semibold text-[#9c6f15]">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Built by practitioners, for practitioners
        </span>
      </div>

      {/* Headline */}
      <h1
        style={serif}
        className="font-semibold leading-[1.1] tracking-tight text-[#1a1326] text-4xl sm:text-5xl md:text-6xl"
      >
        Digital transformation doesn&apos;t happen alone.{' '}
        <span className="block text-[#e0a008]">Bring your team.</span>
      </h1>

      {/* Subtext */}
      <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">
        Learn with your team, apply it to live work, and track the outcomes you can take straight to your leadership.
      </p>

      {/* CTA */}
      <div className="mt-10 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(ctaTo)}
          className="rounded-full bg-[#27062e] px-10 py-5 text-lg font-bold text-white shadow-lg transition hover:bg-[#3a0d44] focus:outline-none focus:ring-2 focus:ring-[#eab130] focus:ring-offset-2"
        >
          {ctaLabel}
        </button>
        <p className="text-sm text-neutral-500">{note}</p>
      </div>

      {/* Divider */}
      <hr className="mx-auto mt-14 max-w-3xl border-neutral-200" />

      {/* Features */}
      <div className="mt-8 flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-12">
        <Feature icon={<TrendingUp className="h-5 w-5" />} label="Track real impact" />
        <Feature icon={<Users className="h-5 w-5" />} label="Learn as a team" />
        <Feature icon={<GraduationCap className="h-5 w-5" />} label="Coached by practitioners" />
      </div>
    </section>
  )
}

export default HeroSection
