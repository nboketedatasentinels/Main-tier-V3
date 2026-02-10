import React from 'react'
import { motion } from 'framer-motion'
import { useJourneyCompletion } from '@/hooks/useJourneyCompletion'
import { badges } from '@/config/badges'

export const JourneyCompletionBanner: React.FC = () => {
  const { completion, loading } = useJourneyCompletion()

  if (loading || !completion || !completion.isCompleted) {
    return null
  }

  const badge = badges.find(item => item.journeyType === completion.journeyType)
  const { mentorAdjustment = 0, ambassadorAdjustment = 0 } = completion.adjustmentDetails ?? {}
  const hasAdjustment = mentorAdjustment > 0 || ambassadorAdjustment > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: -36 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-8 overflow-hidden rounded-2xl p-6 text-white shadow-2xl bg-gradient-to-r from-brand-primary via-brand-dark to-brand-primary"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-accent-gold-300/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-brand-indigo-200/20 blur-2xl" />

      <div className="relative flex flex-col items-center gap-6 md:flex-row">
        <div className="flex-shrink-0">
          <motion.div
            animate={{ rotate: [0, -8, 8, -8, 0] }}
            transition={{ repeat: Infinity, duration: 5 }}
            className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/50 bg-white/15 p-2 backdrop-blur-md"
          >
            {badge ? (
              <img src={badge.image} alt={badge.name} className="h-full w-full object-contain" />
            ) : (
              <span className="text-lg font-bold">T4L</span>
            )}
          </motion.div>
        </div>

        <div className="flex-grow text-center md:text-left">
          <h2 className="mb-2 text-2xl font-bold md:text-3xl">Journey Completed</h2>
          <p className="mb-4 text-lg text-white/90">
            {badge?.description || `Congratulations on completing your ${completion.journeyType} journey.`}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <div className="rounded-lg border border-white/30 bg-white/15 px-4 py-2 backdrop-blur-sm">
              <span className="font-semibold">{completion.pointsEarned.toLocaleString()}</span>
              {' / '}
              {completion.passMark.toLocaleString()} points
            </div>

            {hasAdjustment && (
              <div className="rounded-full border border-accent-warning bg-tint-accentWarning px-3 py-1 text-sm text-text-primary">
                Pass mark adjusted for missing support
              </div>
            )}
          </div>
        </div>

        <div className="flex-shrink-0">
          <button
            type="button"
            className="rounded-full bg-white px-8 py-3 font-bold text-brand-primary shadow-lg transition-colors hover:bg-surface-subtle"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Celebrate
          </button>
        </div>
      </div>
    </motion.div>
  )
}
