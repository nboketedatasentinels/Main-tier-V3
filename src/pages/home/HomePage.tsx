import React from 'react'
import { Header } from '@/components/Header'
import { HeroSection } from '@/components/HeroSection'

export const HomePage: React.FC = () => {
  return (
    <>
      <Header />

      <main
        className="min-h-screen w-full bg-[#f8fafc]"
        style={{
          backgroundImage: 'radial-gradient(rgba(100,116,139,0.08) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      >
        <HeroSection />
      </main>
    </>
  )
}

export default HomePage
