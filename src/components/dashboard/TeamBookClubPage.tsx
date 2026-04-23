import React from 'react'
import { JoinUs } from './bookClub/JoinUs'

export const TeamBookClubPage: React.FC = () => {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-bold text-neutral-900">Global Book Club</h1>
        <p className="text-base text-neutral-700">
          Join readers across the ecosystem and stay connected to every selection through our Firebase-backed hub log.
        </p>
      </header>

      <JoinUs />
    </main>
  )
}

