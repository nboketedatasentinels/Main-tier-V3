import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter } from 'react-router-dom'
import { MentorDashboard } from './MentorDashboard'

const authMock = vi.hoisted(() => ({
  profile: {
    id: 'mentor-1',
    email: 'mentor@t4leader.com',
    firstName: 'Maya',
    lastName: 'Mentor',
    role: 'mentor',
  },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    profile: authMock.profile,
    user: { uid: 'mentor-1' },
    isAuthenticated: true,
  }),
}))

vi.mock('@/layouts/MentorDashboardLayout', () => ({
  MentorDashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mentor-layout">{children}</div>
  ),
}))

vi.mock('@/components/mentor/MentorSessionsPanel', () => ({
  MentorSessionsPanel: () => <div data-testid="sessions-panel">sessions</div>,
}))

vi.mock('@/components/assessments/RateLearnerCourseAssessment', () => ({
  RateLearnerCourseAssessment: () => <div data-testid="rate-panel">rate</div>,
}))

vi.mock('@/hooks/useOrganizationProgramCourses', () => ({
  useOrganizationProgramCourses: () => ({
    program: {
      orderedCourseIds: ['course-1'],
      monthlyAssignments: {},
      totalMonths: 1,
      cohortStartDate: null,
      courseAssignments: ['course-1'],
      journeyType: '3M',
      programDurationWeeks: 12,
      pillar: null,
    },
    loading: false,
    error: null,
  }),
}))

vi.mock('@/config/courseCatalogue', () => ({
  getCatalogueCourseById: () => ({ id: 'course-1', title: 'Leading Self' }),
}))

vi.mock('@/services/learnerAssignmentService', () => ({
  fetchAssignedMenteesForMentor: vi.fn(async () => [
    {
      id: 'learner-1',
      email: 'ada@org.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'paid_member',
      personalityType: 'INTJ',
      coreValues: ['Growth', 'Excellence', 'Curiosity'],
      ageRange: '25_34',
      journeyType: '3M',
      currentWeek: 4,
      mentorId: 'mentor-1',
      organizationId: 'org-1',
    },
  ]),
}))

const renderDashboard = () =>
  render(
    <ChakraProvider>
      <MemoryRouter>
        <MentorDashboard />
      </MemoryRouter>
    </ChakraProvider>,
  )

describe('MentorDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders mentor workspace hero and mentee directory', async () => {
    renderDashboard()
    expect(await screen.findByText(/Guide your mentees with clarity/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText(/AI-generated/i).length).toBeGreaterThan(0)
    expect(screen.getByTestId('sessions-panel')).toBeInTheDocument()
    expect(screen.getAllByTestId('rate-panel').length).toBe(1)
    expect(screen.getByText(/Mentee pre-assessments/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Pre assessments/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Pre-course survey/i })).toBeInTheDocument()
  })
})
