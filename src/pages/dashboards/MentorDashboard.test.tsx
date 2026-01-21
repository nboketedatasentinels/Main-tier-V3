import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';
import { MentorDashboard } from './MentorDashboard';
import * as mentorService from '@/services/mentorDashboardService';
import * as useAuthHook from '@/hooks/useAuth';

// Mock data
const mockMentorProfile = {
  id: 'mentor-123',
  email: 'mentor@example.com',
  firstName: 'John',
  lastName: 'Mentor',
  role: 'mentor',
};

const mockMentees = [
  {
    id: 'mentee-1',
    email: 'mentee1@example.com',
    firstName: 'Alice',
    lastName: 'Smith',
    lastActive: new Date('2024-01-15'),
    weeklyActivity: 5,
    progress: 75,
    goalsCompleted: 8,
    goalsTotal: 10,
    risk: {
      level: 'engaged' as const,
      summary: 'Very active',
      daysSinceLastActive: 3,
      weeklyActivity: 5,
    },
    daysSinceLastActive: 3,
    engagementStatus: 'active' as const,
    company: 'Tech Corp',
    program: 'Leadership Development',
    timezone: 'EST',
  },
  {
    id: 'mentee-2',
    email: 'mentee2@example.com',
    firstName: 'Bob',
    lastName: 'Johnson',
    lastActive: new Date('2024-01-01'),
    weeklyActivity: 1,
    progress: 45,
    goalsCompleted: 3,
    goalsTotal: 10,
    risk: {
      level: 'watch' as const,
      summary: 'Moderate activity',
      daysSinceLastActive: 10,
      weeklyActivity: 1,
    },
    daysSinceLastActive: 10,
    engagementStatus: 'idle' as const,
    company: 'Business Inc',
    program: 'Executive Coaching',
    timezone: 'PST',
  },
  {
    id: 'mentee-3',
    email: 'mentee3@example.com',
    firstName: 'Carol',
    lastName: 'Williams',
    lastActive: new Date('2023-12-01'),
    weeklyActivity: 0,
    progress: 20,
    goalsCompleted: 1,
    goalsTotal: 10,
    risk: {
      level: 'critical' as const,
      summary: 'No recent activity',
      daysSinceLastActive: 45,
      weeklyActivity: 0,
    },
    daysSinceLastActive: 45,
    engagementStatus: 'disengaged' as const,
    company: 'Startup Co',
    program: 'Career Development',
    timezone: 'CST',
  },
];

// Mock implementations
vi.mock('@/hooks/useAuth');
vi.mock('@/services/mentorDashboardService');
vi.mock('@/layouts/MentorDashboardLayout', () => ({
  MentorDashboardLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="mentor-layout">{children}</div>,
}));
vi.mock('@/utils/navigationItems', () => ({
  buildMentorNavItems: () => [
    {
      section: 'Mentorship',
      items: [
        { label: 'Overview', icon: 'LayoutDashboard', path: '/mentor/dashboard' },
      ],
    },
  ],
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ChakraProvider>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </ChakraProvider>
  );
};

describe('MentorDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthHook.useAuth as Mock).mockReturnValue({
      profile: mockMentorProfile,
      user: { uid: 'mentor-123' },
    });
    (mentorService.fetchAssignedMentees as Mock).mockResolvedValue({
      data: mockMentees,
      error: null,
    });
    (mentorService.subscribeToAssignedMentees as Mock).mockReturnValue(() => {});
  });

  describe('Component Rendering', () => {
    it('should render the mentor dashboard layout', async () => {
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('mentor-layout')).toBeInTheDocument();
      });
    });

    it('should display welcome message with mentor name', async () => {
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Welcome back, John/i)).toBeInTheDocument();
      });
    });

    it('should render summary cards', async () => {
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Total mentees/i)).toBeInTheDocument();
        expect(screen.getByText(/Upcoming sessions/i)).toBeInTheDocument();
        expect(screen.getByText(/Pending actions/i)).toBeInTheDocument();
      });
    });

    it('should render weekly comparison metrics', async () => {
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Sessions Completed/i)).toBeInTheDocument();
        expect(screen.getByText(/Resources Shared/i)).toBeInTheDocument();
        expect(screen.getByText(/Check-ins Reviewed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading', () => {
    it('should show loading state initially', () => {
      renderWithProviders(<MentorDashboard />);

      // Check for skeleton loaders
      const skeletons = screen.getAllByRole('status');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should fetch assigned mentees on mount', async () => {
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(mentorService.fetchAssignedMentees).toHaveBeenCalledWith('mentor-123');
      });
    });

    it('should subscribe to real-time mentee updates', async () => {
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(mentorService.subscribeToAssignedMentees).toHaveBeenCalledWith(
          'mentor-123',
          expect.any(Function)
        );
      });
    });

    it('should display error message when fetch fails', async () => {
      (mentorService.fetchAssignedMentees as Mock).mockResolvedValue({
        data: [],
        error: new Error('Failed to fetch mentees'),
      });

      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch mentees/i)).toBeInTheDocument();
      });
    });

    it('should display mentees after successful load', async () => {
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        expect(screen.getByText('Carol Williams')).toBeInTheDocument();
      });
    });
  });

  describe('Mentee List Display', () => {
    it('should display mentee names and companies', async () => {
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        expect(screen.getByText('Tech Corp')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        expect(screen.getByText('Business Inc')).toBeInTheDocument();
      });
    });

    it('should display risk badges for each mentee', async () => {
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Engaged')).toBeInTheDocument();
        expect(screen.getByText('Monitor')).toBeInTheDocument();
        expect(screen.getByText('Critical')).toBeInTheDocument();
      });
    });

    it('should display progress bars for mentees', async () => {
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        // Progress bars should be rendered
        const progressBars = screen.getAllByRole('progressbar');
        expect(progressBars.length).toBeGreaterThan(0);
      });
    });

    it('should display correct mentee count in summary', async () => {
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        // Should show 3 total mentees
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });
  });

  describe('Risk-Based Filtering', () => {
    it('should filter mentees by engaged risk level', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      // Click engaged filter
      const engagedButton = screen.getByText('Engaged');
      await user.click(engagedButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
        expect(screen.queryByText('Carol Williams')).not.toBeInTheDocument();
      });
    });

    it('should filter mentees by monitor risk level', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      // Click monitor filter
      const monitorButton = screen.getByText('Monitor');
      await user.click(monitorButton);

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Carol Williams')).not.toBeInTheDocument();
      });
    });

    it('should filter mentees by critical risk level', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Carol Williams')).toBeInTheDocument();
      });

      // Click critical filter
      const criticalButton = screen.getByText('Critical');
      await user.click(criticalButton);

      await waitFor(() => {
        expect(screen.getByText('Carol Williams')).toBeInTheDocument();
        expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });
    });

    it('should show all mentees when "All" filter is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      // First filter by engaged
      const engagedButton = screen.getByText('Engaged');
      await user.click(engagedButton);

      await waitFor(() => {
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });

      // Then click "All" to show all mentees again
      const allButton = screen.getByText('All');
      await user.click(allButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        expect(screen.getByText('Carol Williams')).toBeInTheDocument();
      });
    });
  });

  describe('Engagement Status Filtering', () => {
    it('should filter mentees by active engagement status', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      // Find and click active filter
      const activeButton = screen.getByRole('button', { name: /active/i });
      await user.click(activeButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
        expect(screen.queryByText('Carol Williams')).not.toBeInTheDocument();
      });
    });

    it('should filter mentees by idle engagement status', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      // Find and click idle filter
      const idleButton = screen.getByRole('button', { name: /idle/i });
      await user.click(idleButton);

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Carol Williams')).not.toBeInTheDocument();
      });
    });

    it('should filter mentees by disengaged engagement status', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Carol Williams')).toBeInTheDocument();
      });

      // Find and click disengaged filter
      const disengagedButton = screen.getByRole('button', { name: /disengaged/i });
      await user.click(disengagedButton);

      await waitFor(() => {
        expect(screen.getByText('Carol Williams')).toBeInTheDocument();
        expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should filter mentees by search term (name)', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search mentees/i);
      await user.type(searchInput, 'Alice');

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
        expect(screen.queryByText('Carol Williams')).not.toBeInTheDocument();
      });
    });

    it('should filter mentees by search term (company)', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Tech Corp')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search mentees/i);
      await user.type(searchInput, 'Tech Corp');

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
        expect(screen.queryByText('Carol Williams')).not.toBeInTheDocument();
      });
    });

    it('should show no results message when search has no matches', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search mentees/i);
      await user.type(searchInput, 'NonexistentName');

      await waitFor(() => {
        expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
        expect(screen.queryByText('Carol Williams')).not.toBeInTheDocument();
        expect(screen.getByText(/No mentees found/i)).toBeInTheDocument();
      });
    });

    it('should be case-insensitive when searching', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search mentees/i);
      await user.type(searchInput, 'alice smith');

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });
    });
  });

  describe('Combined Filters', () => {
    it('should apply both risk filter and search simultaneously', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      // Apply engaged filter
      const engagedButton = screen.getByText('Engaged');
      await user.click(engagedButton);

      // Then search for "Alice"
      const searchInput = screen.getByPlaceholderText(/search mentees/i);
      await user.type(searchInput, 'Alice');

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
        expect(screen.queryByText('Carol Williams')).not.toBeInTheDocument();
      });
    });

    it('should apply risk filter and engagement filter simultaneously', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      // Apply engaged risk filter
      const engagedButton = screen.getByText('Engaged');
      await user.click(engagedButton);

      // Apply active engagement filter
      const activeButton = screen.getByRole('button', { name: /active/i });
      await user.click(activeButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
        expect(screen.queryByText('Carol Williams')).not.toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('should show empty state when no mentees are assigned', async () => {
      (mentorService.fetchAssignedMentees as Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/No mentees found/i)).toBeInTheDocument();
      });
    });

    it('should show "no sessions scheduled" when there are no upcoming sessions', async () => {
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/No sessions scheduled/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible search input', async () => {
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search mentees/i);
        expect(searchInput).toBeInTheDocument();
        expect(searchInput).toHaveAttribute('type', 'text');
      });
    });

    it('should have accessible filter buttons', async () => {
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        const allButton = screen.getByText('All');
        expect(allButton).toBeInTheDocument();
        expect(allButton.tagName).toBe('BUTTON');
      });
    });

    it('should have proper heading hierarchy', async () => {
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);
      });
    });
  });

  describe('User Interactions', () => {
    it('should clear search when cleared', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search mentees/i);
      await user.type(searchInput, 'Alice');

      await waitFor(() => {
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });

      await user.clear(searchInput);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        expect(screen.getByText('Carol Williams')).toBeInTheDocument();
      });
    });

    it('should handle rapid filter changes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentorDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      // Rapidly change filters
      const engagedButton = screen.getByText('Engaged');
      await user.click(engagedButton);

      const monitorButton = screen.getByText('Monitor');
      await user.click(monitorButton);

      const criticalButton = screen.getByText('Critical');
      await user.click(criticalButton);

      await waitFor(() => {
        expect(screen.getByText('Carol Williams')).toBeInTheDocument();
        expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });
    });
  });
});
