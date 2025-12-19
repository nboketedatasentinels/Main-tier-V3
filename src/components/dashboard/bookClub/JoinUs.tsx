import React, { useCallback, useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/services/firebase'

const HUB_URL = 'https://chat.whatsapp.com/GlioRkWeQ36LxxFeBZc8SW'

export const JoinUs: React.FC = () => {
  const { user, profile } = useAuth()
  const [isLogging, setIsLogging] = useState(false)

  const logHubVisit = useCallback(async () => {
    try {
      setIsLogging(true)
      await addDoc(collection(db, 'bookClubVisits'), {
        userId: user?.uid ?? null,
        userEmail: profile?.email ?? null,
        userName: profile?.fullName ?? null,
        source: 'global_book_club_page',
        clickedAt: serverTimestamp(),
      })
    } catch (error) {
      console.error('Error logging book club hub visit:', error)
    } finally {
      setIsLogging(false)
    }
  }, [profile?.email, profile?.fullName, user?.uid])

  const handleJoinClick = () => {
    window.open(HUB_URL, '_blank', 'noopener,noreferrer')
    void logHubVisit()
  }

  return (
    <section className="space-y-6 rounded-2xl border border-border-subtle bg-surface-default p-8 shadow-sm">
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-text-primary">
          Book club management lives on the Global Book Club hub
        </h2>
        <div className="space-y-3 text-base leading-relaxed text-text-secondary">
          <p>
            Our reading community is coordinated through an external platform where you can see upcoming selections, join
            discussions, and manage your membership.
          </p>
          <p>
            Visit the Global Book Club hub to get plugged into the latest reads and conversation spaces. We log your visit with
            Firebase so we can keep the community experience seamless across the app and our discussion space.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleJoinClick}
          className="inline-flex items-center justify-center rounded-lg bg-brand-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:ring focus-visible:ring-offset-2 focus-visible:ring-brand-primary focus-visible:ring-offset-surface-default"
        >
          Go to the Global Book Club hub
        </button>
        {isLogging && <span className="text-sm text-text-muted">Syncing with Firebase...</span>}
      </div>
    </section>
  )
}
