import React from 'react'
import { Header } from '@/components/Header'
import { HeroSection } from '@/components/HeroSection'
import { ShapeLandingBackground } from '@/components/ui/shape-landing-background'

export const HomePage: React.FC = () => {
  return (
    <>
      <Header />

      <main className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#020611] via-[#060d22] to-[#020611] text-white">
        <ShapeLandingBackground className="opacity-70" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:28px_28px]"
        />

        <div className="relative z-10">
          <HeroSection />
        </div>
      </main>
    </>
  )
}

export default HomePage
