import React from 'react';
import { motion } from 'framer-motion';
import { useJourneyCompletion } from '@/hooks/useJourneyCompletion';
import { badges } from '@/config/badges';

export const JourneyCompletionBanner: React.FC = () => {
  const { completion, loading } = useJourneyCompletion();

  if (loading || !completion || !completion.isCompleted) {
    return null;
  }

  const badge = badges.find(b => b.journeyType === completion.journeyType);
  const { mentorAdjustment, ambassadorAdjustment } = completion.adjustmentDetails;
  const hasAdjustment = mentorAdjustment > 0 || ambassadorAdjustment > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 p-6 rounded-xl shadow-2xl mb-8 text-white relative overflow-hidden"
    >
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
      <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-24 h-24 bg-yellow-200 opacity-20 rounded-full blur-xl"></div>

      <div className="relative flex flex-col md:flex-row items-center gap-6">
        {/* Badge Icon */}
        <div className="flex-shrink-0">
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 5 }}
            className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border-4 border-white/50 p-2"
          >
            {badge ? (
              <img src={badge.image} alt={badge.name} className="w-full h-full object-contain" />
            ) : (
              <span className="text-4xl">🏆</span>
            )}
          </motion.div>
        </div>

        {/* Messaging */}
        <div className="flex-grow text-center md:text-left">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">
            Journey Completed!
          </h2>
          <p className="text-lg opacity-90 mb-4">
            {badge?.description || `Congratulations on completing your ${completion.journeyType} journey!`}
          </p>

          <div className="flex flex-wrap gap-4 items-center justify-center md:justify-start">
            <div className="bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/30">
              <span className="font-semibold">{completion.pointsEarned.toLocaleString()}</span> / {completion.passMark.toLocaleString()} points
            </div>

            {hasAdjustment && (
              <div className="text-sm bg-blue-500/30 px-3 py-1 rounded-full border border-blue-200/50 flex items-center gap-2">
                <span>ℹ️</span> Pass mark adjusted for missing support
              </div>
            )}
          </div>
        </div>

        {/* Action */}
        <div className="flex-shrink-0">
          <button
            className="bg-white text-orange-600 hover:bg-orange-50 font-bold py-3 px-8 rounded-full shadow-lg transition-colors"
            onClick={() => {/* TODO: Show certificate or share */}}
          >
            Celebrate!
          </button>
        </div>
      </div>
    </motion.div>
  );
};
