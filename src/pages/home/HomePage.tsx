import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

const ENTERPRISE_URL = 'https://www.t4leader.com/enterprise-digital-transformation-training'
const TERMS_URL = 'https://www.t4leader.com/terms-of-use'
const PRIVACY_URL = 'https://www.t4leader.com/privacy-statement'

const steps = [
  { n: '1', label: 'Take the LIFT assessment' },
  { n: '2', label: 'Log every improvement' },
  { n: '3', label: 'Show the value' },
]

const serif = { fontFamily: 'Georgia, "Times New Roman", Times, serif' }

const howItWorks = [
  {
    title: 'Take the LIFT assessment',
    body: 'Four minutes. See where you are strong and where your gaps are across the four LIFT pillars. Your full profile is emailed to you so you never lose it.',
  },
  {
    title: 'Log every improvement',
    body: 'Each time you fix something, record the problem, what you changed, and the measured effect. It takes a couple of minutes per entry.',
  },
  {
    title: 'Show the value',
    body: 'Watch your savings and outcomes add up, then export them for a performance review, a promotion case, or your next business case.',
  },
]

export const HomePage: React.FC = () => {
  const { user } = useAuth()
  const startHref = user ? '/app' : '/signup'
  const accountHref = user ? '/app' : '/login'
  const accountLabel = user ? 'Dashboard' : 'Sign in'

  return (
    <div className="min-h-screen bg-white pb-24 text-[#1a1326] md:pb-0">
      <header className="w-full bg-[#27062e]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eab130]"
            aria-label="Transformation Leader home"
          >
            <img src="/t4.png" alt="" className="h-10 w-10 rounded-full object-cover" />
            <span className="flex flex-col text-left leading-none">
              <span className="font-heading text-base font-extrabold tracking-wide text-[#eab130] sm:text-lg">
                TRANSFORMATION <span className="text-[#f9db59]">LEADER</span>
              </span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.25em] text-[#eab130]/70">
                Positive Impact · Sustainable Change
              </span>
            </span>
          </Link>
          <Link
            to={accountHref}
            data-cta="bar_login"
            className="rounded-full bg-[#eab130] px-6 py-2.5 text-sm font-bold text-[#27062e] shadow-sm transition hover:bg-[#f9db59] focus:outline-none focus:ring-2 focus:ring-white"
          >
            {accountLabel}
          </Link>
        </div>
      </header>

      <main>
        <section className="px-6 py-16 text-center sm:py-24" aria-labelledby="hero-title">
          <div className="mx-auto max-w-4xl">
            <p className="mb-8 inline-block rounded-full bg-[#fbf2d8] px-5 py-2 text-sm font-semibold text-[#9c6f15]">
              Free to join
            </p>
            <h1
              id="hero-title"
              style={serif}
              className="text-4xl font-semibold leading-[1.1] tracking-tight text-[#1a1326] sm:text-5xl md:text-6xl"
            >
              Track what your transformation work is{' '}
              <em className="text-[#e0a008] not-italic">actually worth.</em>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#6B6560] sm:text-xl">
              Take the 4-minute LIFT assessment, log every improvement you make, and export a record
              of the value you created, ready for your next review.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-5 sm:flex-row">
              <Link
                to={startHref}
                data-cta="hero_start"
                className="inline-flex rounded-full bg-[#27062e] px-6 py-3 text-base font-bold !text-white shadow-md transition hover:bg-[#3a0d44] hover:!text-white focus:outline-none focus:ring-2 focus:ring-[#eab130] focus:ring-offset-2"
              >
                Start free
              </Link>
              <Link
                to="/assessment"
                data-cta="hero_assessment"
                className="inline-flex rounded-full bg-[#eab130] px-6 py-3 text-base font-bold text-[#27062e] shadow-md transition hover:bg-[#f9db59] focus:outline-none focus:ring-2 focus:ring-[#27062e] focus:ring-offset-2"
              >
                Take the assessment first
              </Link>
            </div>
            <p className="mt-6 text-sm text-[#6B6560]">
              Free. No card needed. Your details are private and used only to deliver your results.{' '}
              <a href={TERMS_URL} className="underline underline-offset-2">
                Terms
              </a>{' '}
              ·{' '}
              <a href={PRIVACY_URL} className="underline underline-offset-2">
                Privacy
              </a>
            </p>
            <ul className="mx-auto mt-14 flex max-w-3xl flex-col items-start gap-4 border-t border-[#E5E2DE] pt-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-10">
              {steps.map((step) => (
                <li key={step.n} className="flex items-center gap-3 text-lg font-medium">
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FDF8EF] text-sm font-bold text-[#8A6708]"
                  >
                    {step.n}
                  </span>
                  {step.label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-[#F5F3F0] px-6 py-16 sm:py-20" aria-labelledby="how-title">
          <div className="mx-auto max-w-6xl">
            <h2 id="how-title" style={serif} className="text-3xl font-semibold text-[#1a1326] sm:text-4xl">
              From first assessment to proof of value
            </h2>
            <div className="mt-9 grid gap-6 md:grid-cols-3">
              {howItWorks.map((item) => (
                <article key={item.title} className="rounded-2xl border border-[#E5E2DE] bg-white p-7">
                  <h3 style={serif} className="text-2xl font-semibold text-[#1a1326]">{item.title}</h3>
                  <p className="mt-3 text-[#6B6560]">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-16 sm:py-20" aria-labelledby="ex-title">
          <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-14">
            <div>
              <h2 id="ex-title" style={serif} className="text-3xl font-semibold text-[#1a1326] sm:text-4xl">
                Most transformation work goes unrecorded.
              </h2>
              <p className="mt-4 text-lg text-[#6B6560]">
                So nobody sees what it saved, including the people deciding your next role. An Impact
                Log entry turns a quiet win into a record your leadership can see.
              </p>
            </div>
            <figure className="rounded-2xl bg-[#27062e] p-8 text-white" aria-label="Example Impact Log entry">
              <p className="mb-5 inline-block rounded-full bg-[#eab130]/20 px-3 py-1 text-xs font-semibold text-[#eab130]">
                Example entry
              </p>
              <dl className="space-y-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-[#eab130]">Problem</dt>
                  <dd style={serif} className="text-xl">Weekly status report took a full day to compile by hand</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-[#eab130]">What changed</dt>
                  <dd style={serif} className="text-xl">Automated the data pull and drafted the summary with AI</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-[#eab130]">Measured effect</dt>
                  <dd style={serif} className="text-xl">Compile time down from 8 hours to 1</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-[#eab130]">Period</dt>
                  <dd style={serif} className="text-xl">Tracked over 6 weeks</dd>
                </div>
              </dl>
              <figcaption className="mt-5 text-xs text-[#A09DA8]">
                Illustrative example of an Impact Log entry.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="bg-[#FDF8EF] px-6 py-16 sm:py-20" aria-labelledby="team-title">
          <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-[1.5fr_auto]">
            <div>
              <h2 id="team-title" style={serif} className="text-3xl font-semibold text-[#1a1326] sm:text-4xl">
                Leading a team? <em className="text-[#e0a008] not-italic">Bring them with you.</em>
              </h2>
              <p className="mt-4 max-w-xl text-lg text-[#6B6560]">
                When your whole team logs its improvements, you get one view of what the transformation
                is producing, and the evidence to defend it upward.
              </p>
            </div>
            <a
              href={ENTERPRISE_URL}
              data-cta="team_enterprise"
              className="inline-flex justify-center rounded-full bg-[#27062e] px-6 py-3 text-base font-bold !text-white shadow-md transition hover:bg-[#3a0d44] hover:!text-white focus:outline-none focus:ring-2 focus:ring-[#eab130] focus:ring-offset-2"
            >
              Explore team options
            </a>
          </div>
        </section>

        <section className="bg-[#2D2A3E] px-6 py-16 text-center text-white sm:py-20" aria-labelledby="close-title">
          <div className="mx-auto max-w-2xl">
            <h2 id="close-title" style={serif} className="text-4xl font-semibold sm:text-5xl">
              Start with four minutes.
            </h2>
            <p className="mx-auto mt-4 text-lg text-[#A09DA8]">
              Take the assessment, see your gaps, and log your first improvement today.
            </p>
            <Link
              to={startHref}
              data-cta="closing_start"
              className="mt-8 inline-flex rounded-full bg-[#eab130] px-6 py-3 text-base font-bold text-[#27062e] shadow-sm transition hover:bg-[#f9db59] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#2D2A3E]"
            >
              Start free
            </Link>
          </div>
        </section>
      </main>

      <div
        className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 bg-[#27062e] px-4 py-3 shadow-[0_-6px_20px_rgba(26,23,38,0.25)] md:hidden"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        role="region"
        aria-label="Quick start"
      >
        <span className="text-sm leading-tight text-white">
          Free to join
          <br />
          No card needed
        </span>
        <Link
          to={startHref}
          data-cta="sticky_start"
          className="whitespace-nowrap rounded-full bg-[#eab130] px-6 py-2.5 text-sm font-bold text-[#27062e] shadow-sm transition hover:bg-[#f9db59]"
        >
          Start free
        </Link>
      </div>
    </div>
  )
}

export default HomePage
