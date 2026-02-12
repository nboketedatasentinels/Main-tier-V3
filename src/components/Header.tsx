import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Crown, Lock, Menu, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { isFreeUser } from '@/utils/membership'

type HeaderProps = {
  topOffset?: string
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export const Header: React.FC<HeaderProps> = ({ topOffset = '0' }) => {
  const navigate = useNavigate()
  const { user, profile, loading } = useAuth()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrollY, setScrollY] = useState(0)

  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  const isAuthed = !!user
  const showUpgrade = isAuthed && isFreeUser(profile)

  const collapseProgress = useMemo(() => clamp(scrollY / 120, 0, 1), [scrollY])
  const dynamicPaddingY = 24 - (24 - 12) * collapseProgress
  const dynamicMinH = 88 - (88 - 60) * collapseProgress

  useEffect(() => {
    const onScroll = () => {
      setScrollY(window.scrollY || 0)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!isMenuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isMenuOpen])

  useEffect(() => {
    if (!isMenuOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMenuOpen])

  useEffect(() => {
    if (!isMenuOpen) return
    const root = dialogRef.current
    if (!root) return

    const focusable = Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    first?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (focusable.length === 0) return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }

    root.addEventListener('keydown', onKeyDown)
    return () => root.removeEventListener('keydown', onKeyDown)
  }, [isMenuOpen])

  const closeMenu = () => {
    setIsMenuOpen(false)
    triggerRef.current?.focus()
  }

  const goSignIn = () => {
    closeMenu()
    navigate('/login')
  }

  const goDashboard = () => {
    closeMenu()
    navigate('/app')
  }

  const goUpgrade = () => {
    closeMenu()
    navigate('/upgrade')
  }

  const headerBg = scrollY > 20 ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'
  const textColor = scrollY > 20 ? 'text-neutral-700' : 'text-white'
  const subtleText = scrollY > 20 ? 'text-neutral-600' : 'text-neutral-200'

  return (
    <header
      className={`fixed left-0 right-0 z-50 ${headerBg}`}
      style={{ top: topOffset, transition: 'background 180ms ease-in-out, box-shadow 220ms ease-in-out' }}
    >
      <div
        className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8"
        style={{
          paddingTop: dynamicPaddingY,
          paddingBottom: dynamicPaddingY,
          minHeight: dynamicMinH,
          transition: 'padding 300ms ease, min-height 300ms ease',
        }}
      >
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-brand-indigo-500 rounded-md"
              aria-label="Go to homepage"
            >
              <img
                src="/t4.png"
                alt="T4L Logo"
                className="h-9 w-9 rounded-full object-cover"
              />
              <span className={`hidden sm:inline font-semibold ${textColor}`}>T4L</span>
            </button>

            <a
              href="https://www.t4leader.com/transfomation-teens"
              target="_blank"
              rel="noopener noreferrer"
              className={`hidden md:inline text-sm font-medium ${subtleText} hover:underline`}
            >
              Transformation Teens
            </a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {!loading && showUpgrade && (
              <button
                type="button"
                onClick={goUpgrade}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm
                  bg-gradient-to-r from-accent-gold-400 to-accent-gold-500 text-brand-dark hover:opacity-95
                  focus:outline-none focus:ring-2 focus:ring-brand-indigo-500"
              >
                <Crown className="h-4 w-4" />
                Upgrade
              </button>
            )}

            <button
              type="button"
              onClick={isAuthed ? goDashboard : goSignIn}
              className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold
                bg-brand-indigo-500 text-white hover:opacity-95 shadow-sm
                focus:outline-none focus:ring-2 focus:ring-brand-indigo-500"
            >
              {isAuthed ? 'Dashboard' : 'Sign In'}
            </button>
          </div>

          <button
            ref={triggerRef}
            type="button"
            className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/80 shadow-sm backdrop-blur focus:outline-none focus:ring-2 focus:ring-brand-indigo-500"
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(v => !v)}
          >
            {isMenuOpen ? <X className="h-5 w-5 text-neutral-700" /> : <Menu className="h-5 w-5 text-neutral-700" />}
          </button>
        </nav>
      </div>

      {isMenuOpen && (
        <div
          className="md:hidden fixed left-0 right-0 bottom-0 top-16 bg-white"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          ref={dialogRef}
        >
          <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Account</p>
              {showUpgrade && (
                <button
                  type="button"
                  onClick={goUpgrade}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-accent-gold-400 to-accent-gold-500
                    text-brand-dark font-semibold text-lg shadow-sm hover:opacity-95
                    inline-flex items-center justify-center gap-2"
                >
                  <Lock className="h-5 w-5" />
                  Upgrade
                </button>
              )}

              <button
                type="button"
                onClick={isAuthed ? goDashboard : goSignIn}
                className="w-full h-12 rounded-xl bg-brand-indigo-500 text-white font-semibold text-lg shadow-sm hover:opacity-95"
              >
                {isAuthed ? 'Dashboard' : 'Sign In'}
              </button>
            </div>

            <div className="space-y-3 pt-4 border-t border-neutral-200">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Explore</p>
              <RouterLink
                to="/"
                className="block w-full h-12 rounded-xl border bg-white text-neutral-900 font-semibold text-lg shadow-sm hover:bg-neutral-50
                  inline-flex items-center justify-center"
                onClick={() => closeMenu()}
              >
                Home
              </RouterLink>

              <a
                href="https://www.t4leader.com/transfomation-teens"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-12 rounded-xl border bg-white text-neutral-900 font-semibold text-lg shadow-sm hover:bg-neutral-50
                  inline-flex items-center justify-center"
                onClick={() => closeMenu()}
              >
                Transformation Teens
              </a>
            </div>

            <div className="pt-4 border-t border-neutral-200">
              <button
                type="button"
                onClick={closeMenu}
                className="w-full h-12 rounded-xl border bg-white text-neutral-700 font-medium text-lg hover:bg-neutral-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

export default Header
