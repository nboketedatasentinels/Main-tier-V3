import { ChakraProvider } from '@chakra-ui/react'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { ActivityState } from '@/hooks/useWeeklyChecklistViewModel'
import { WeeklyActivityCard } from './WeeklyActivityCard'

// Mock matchMedia (Chakra + responsive hooks)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const makeActivity = (overrides: Partial<ActivityState> = {}): ActivityState => ({
  id: 'podcast',
  baseId: 'podcast',
  title: 'Podcast activity',
  description: 'Complete the podcast activity',
  points: 100,
  maxPerMonth: 3,
  approvalType: 'self',
  week: 1,
  category: 'Learning',
  status: 'not_started',
  availability: {
    state: 'available',
    isScheduledForWeek: true,
  },
  ...overrides,
})

const renderCard = (overrides: Partial<ComponentProps<typeof WeeklyActivityCard>> = {}) => {
  const props: ComponentProps<typeof WeeklyActivityCard> = {
    activity: makeActivity(),
    selectedWeek: 2,
    currentWeek: 2,
    isWeekLocked: false,
    isAdmin: false,
    onOpenCurrentWeek: vi.fn(),
    onFocusAvailableActivity: vi.fn(),
    hasAvailableAlternative: false,
    onMarkCompleted: vi.fn(async () => undefined),
    onMarkNotStarted: vi.fn(async () => undefined),
    onOpenProof: vi.fn(),
    isActionInFlight: false,
    ...overrides,
  }

  render(
    <ChakraProvider>
      <MemoryRouter>
        <WeeklyActivityCard {...props} />
      </MemoryRouter>
    </ChakraProvider>,
  )

  return props
}

describe('WeeklyActivityCard exit actions', () => {
  it('shows "Go to Week N" for future-week lock and triggers callback', () => {
    const props = renderCard({
      selectedWeek: 5,
      currentWeek: 3,
      isWeekLocked: true,
      activity: makeActivity(),
    })

    const action = screen.getByRole('button', { name: 'Go to Week 3' })
    expect(action).toBeInTheDocument()

    fireEvent.click(action)
    expect(props.onOpenCurrentWeek).toHaveBeenCalledTimes(1)
  })

  it('shows lock reason outside collapsed details on mobile', () => {
    renderCard({
      selectedWeek: 5,
      currentWeek: 3,
      isWeekLocked: true,
      activity: makeActivity(),
    })

    expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument()
    const lockReasons = screen.getAllByText('Week 5 opens after Week 3.')
    const outsideCollapsedDetails = lockReasons.find((node) => !node.closest('#activity-details-podcast'))
    expect(outsideCollapsedDetails).toBeInTheDocument()
  })

  it('shows pending approval exit link when selection is interaction-locked', () => {
    renderCard({
      activity: makeActivity({
        hasInteracted: true,
        status: 'pending',
        availability: { state: 'available', isScheduledForWeek: true },
      }),
    })

    const action = screen.getByRole('link', { name: 'Review submitted proofs' })
    expect(action).toBeInTheDocument()
    expect(action).toHaveAttribute('href', '/app/weekly-checklist?focus=pending-approvals')
  })

  it('does not show pending approval exit link for completed activities', () => {
    renderCard({
      activity: makeActivity({
        hasInteracted: true,
        status: 'completed',
        availability: { state: 'available', isScheduledForWeek: true },
      }),
    })

    expect(screen.queryByRole('link', { name: 'Review submitted proofs' })).not.toBeInTheDocument()
  })

  it('shows support options link when missing mentor/ambassador blocks activity', () => {
    renderCard({
      hasAvailableAlternative: true,
      activity: makeActivity({
        availability: { state: 'locked', reason: 'missing_mentor', isScheduledForWeek: false },
      }),
    })

    const action = screen.getByRole('link', { name: 'View support options' })
    expect(action).toBeInTheDocument()
    expect(action).toHaveAttribute('href', '/app/weekly-glance')
  })

  it('shows unlock week guidance for schedule-locked activities', () => {
    renderCard({
      selectedWeek: 2,
      currentWeek: 2,
      activity: makeActivity({
        week: 4,
        availability: { state: 'locked', reason: 'scheduled', isScheduledForWeek: false },
      }),
    })

    expect(screen.getAllByText('This activity unlocks in Week 4.').length).toBeGreaterThan(0)
  })

  it('shows "Jump to available activity" and triggers focus callback when alternatives exist', () => {
    const props = renderCard({
      hasAvailableAlternative: true,
      activity: makeActivity({
        availability: { state: 'next_window', reason: 'window_cap_reached', isScheduledForWeek: true },
      }),
    })

    const action = screen.getByRole('button', { name: 'Jump to available activity' })
    expect(action).toBeInTheDocument()

    fireEvent.click(action)
    expect(props.onFocusAvailableActivity).toHaveBeenCalledTimes(1)
  })

  it('does not show exit actions for admin users', () => {
    renderCard({
      isAdmin: true,
      selectedWeek: 5,
      currentWeek: 3,
      isWeekLocked: true,
      hasAvailableAlternative: true,
      activity: makeActivity({
        hasInteracted: true,
        availability: { state: 'locked', reason: 'missing_mentor', isScheduledForWeek: false },
      }),
    })

    expect(screen.queryByRole('button', { name: /go to week/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /jump to available activity/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /review submitted proofs/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /view support options/i })).not.toBeInTheDocument()
  })

  it('disables claim action while an activity mutation is in flight', () => {
    const props = renderCard({
      isActionInFlight: true,
      activity: makeActivity({
        status: 'not_started',
        availability: { state: 'available', isScheduledForWeek: true },
      }),
    })

    const claimButton = screen.getByRole('button', { name: /Confirm \(Honor System\)/i })
    expect(claimButton).toBeDisabled()

    fireEvent.click(claimButton)
    expect(props.onMarkCompleted).not.toHaveBeenCalled()
  })

  it('keeps partner-issued activity locked before issuance', () => {
    renderCard({
      activity: makeActivity({
        approvalType: 'partner_issued',
        issuedByPartner: false,
        status: 'not_started',
      }),
    })

    const action = screen.getByRole('button', { name: 'Awaiting Assignment' })
    expect(action).toBeDisabled()
    expect(screen.getAllByText('Your partner needs to issue this activity before you can complete it.').length).toBeGreaterThan(0)
  })

  it('allows completion for partner-issued activity after issuance', () => {
    const props = renderCard({
      activity: makeActivity({
        approvalType: 'partner_issued',
        issuedByPartner: true,
        status: 'not_started',
      }),
    })

    const action = screen.getByRole('button', { name: 'Mark Complete' })
    expect(action).not.toBeDisabled()
    fireEvent.click(action)
    expect(props.onMarkCompleted).toHaveBeenCalledTimes(1)
  })

  it('renders quick action links for linked activities', () => {
    renderCard({
      activity: makeActivity({
        quickActionLink: {
          label: 'Join Book Club',
          href: '/app/book-club',
        },
      }),
    })

    const action = screen.getByRole('link', { name: 'Join Book Club' })
    expect(action).toBeInTheDocument()
    expect(action).toHaveAttribute('href', '/app/book-club')
  })

  it('uses external tools link and hides proof modal action for ai_tool_review', () => {
    renderCard({
      activity: makeActivity({
        id: 'ai_tool_review',
        baseId: 'ai_tool_review',
        approvalType: 'partner_approved',
        requiresApproval: true,
        quickActionLink: {
          label: 'Submit AI Tool',
          href: 'https://www.t4leader.com/tools',
          external: true,
        },
      }),
    })

    const action = screen.getByRole('link', { name: 'Submit AI Tool' })
    expect(action).toBeInTheDocument()
    expect(action).toHaveAttribute('href', 'https://www.t4leader.com/tools')
    expect(screen.queryByRole('button', { name: /submit proof/i })).not.toBeInTheDocument()
  })
})
