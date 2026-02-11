import { ChakraProvider } from '@chakra-ui/react'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { ActivityState } from '@/hooks/useWeeklyChecklistViewModel'
import { WeeklyActivityCard } from './WeeklyActivityCard'

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

  it('shows pending approval exit link when selection is interaction-locked', () => {
    renderCard({
      activity: makeActivity({
        hasInteracted: true,
        status: 'pending',
        availability: { state: 'available', isScheduledForWeek: true },
      }),
    })

    const action = screen.getByRole('link', { name: 'Review pending approval' })
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

    expect(screen.queryByRole('link', { name: 'Review pending approval' })).not.toBeInTheDocument()
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
    expect(screen.queryByRole('link', { name: /review pending approval/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /view support options/i })).not.toBeInTheDocument()
  })
})
