import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { PartnerDashboard } from './PartnerDashboard'
import { BrowserRouter } from 'react-router-dom'
import { ChakraProvider } from '@chakra-ui/react'

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // Deprecated
        removeListener: vi.fn(), // Deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
})

// Mock the hooks
vi.mock('@/hooks/usePartnerDashboardData', () => ({
    usePartnerDashboardData: vi.fn(),
}))

vi.mock('@/hooks/useAuth', () => ({
    useAuth: vi.fn(),
}))

vi.mock('@/services/organizationService', () => ({
    logOrganizationAccessAttempt: vi.fn(),
}))

vi.mock('@/services/engagementService', () => ({
    recordEngagementAction: vi.fn(),
    bulkRecordEngagementActions: vi.fn(),
}))

vi.mock('@/services/partnerDigestService', () => ({
    generatePartnerDigest: vi.fn(),
    sendPartnerDigestEmail: vi.fn(),
}))

vi.mock('@/services/nudgeService', () => ({
    getActiveNudgeTemplates: vi.fn().mockResolvedValue([]),
}))

// Mock child components that might be complex
vi.mock('@/layouts/PartnerLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div data-testid="partner-layout">{children}</div>,
}))

vi.mock('@/components/partner/PartnerUserManagement', () => ({
    PartnerUserManagement: () => <div data-testid="partner-user-management">User Management</div>,
}))

vi.mock('@/hooks/partner/usePointsApprovalQueue', () => ({
    usePointsApprovalQueue: () => ({
        approvalQueue: [],
        loading: false,
        actionId: null,
        handleApprove: vi.fn(),
        handleReject: vi.fn(),
    }),
}))

vi.mock('@/components/partner/nudges/NudgeControlPanel', () => ({
    default: () => <div data-testid="nudge-control-panel">Nudge Control Panel</div>,
}))

vi.mock('@/components/admin/EngagementChart', () => ({
    EngagementChart: () => <div data-testid="engagement-chart">Engagement Chart</div>,
}))

vi.mock('@/components/admin/RiskAnalysisCard', () => ({
    RiskAnalysisCard: () => <div data-testid="risk-analysis-card">Risk Analysis Card</div>,
}))

vi.mock('@/components/admin/StatusBadge', () => ({
    StatusBadge: () => <div data-testid="status-badge">Status Badge</div>,
}))

vi.mock('@/components/admin/OrganizationCard', () => ({
    OrganizationCard: () => <div data-testid="organization-card">Organization Card</div>,
}))

vi.mock('@/components/partner/PartnerInterventionPanel', () => ({
    PartnerInterventionPanel: () => <div data-testid="partner-intervention-panel">Partner Intervention Panel</div>,
}))

vi.mock('@/components/partner/AtRiskCommandPanel', () => ({
    AtRiskCommandPanel: () => <div data-testid="at-risk-command-panel">At-Risk Command Panel</div>,
}))

import { usePartnerDashboardData } from '@/hooks/usePartnerDashboardData'
import { useAuth } from '@/hooks/useAuth'

const mockUsePartnerDashboardData = usePartnerDashboardData as any
const mockUseAuth = useAuth as any

const defaultAuthReturn = {
    assignedOrganizations: [],
    isSuperAdmin: false,
    user: { uid: 'test-user', email: 'test@example.com' },
    refreshProfile: vi.fn(),
    profileStatus: 'ready',
    lastProfileLoadAt: new Date().toISOString(),
}

const defaultDashboardReturn = {
    assignedOrganizations: [],
    assignedOrgCount: 0,
    engagementTrend: [],
    metrics: {
        activeMembers: 0,
        engagementRate: 0,
        newRegistrations: 0,
        managedCompanies: 0,
        deltas: {},
    },
    organizations: [],
    organizationsError: null,
    organizationsLoading: false,
    organizationsReady: true,
    lastOrganizationsSuccessAt: new Date().toISOString(),
    riskLevels: { engaged: 0, watch: 0, concern: 0, critical: 0 },
    selectedOrg: 'all',
    setSelectedOrg: vi.fn(),
    updateUserPoints: vi.fn(),
    users: [],
    usersError: null,
    usersLoading: false,
    lastUsersSuccessAt: new Date().toISOString(),
    retryOrganizations: vi.fn(),
    retryUsers: vi.fn(),
    dataQualityWarnings: [],
    interventions: [],
    daysUntil: vi.fn(),
    atRiskUsers: [],
    managedBreakdown: { active: 0, inactive: 0 },
    notificationCount: 0,
    notifications: [],
    notificationsLoading: false,
    notificationsError: null,
    debugInfo: null,
    snapshot: {
        partnerId: 'test-user',
        assignments: [],
        assignedOrganizationIds: [],
        organizations: [],
        users: [],
        analytics: {
            metrics: {
                activeMembers: 0,
                engagementRate: 0,
                newRegistrations: 0,
                managedCompanies: 0,
                deltas: {},
            },
            engagementTrend: [],
            riskLevels: { engaged: 0, watch: 0, concern: 0, critical: 0 },
            atRiskUsers: [],
            managedBreakdown: { active: 0, inactive: 0 },
            daysUntil: vi.fn(),
        },
        organizationLookup: new Map(),
        assignedOrgKeys: new Set(),
    },
}

const renderComponent = () => {
    return render(
        <ChakraProvider>
            <BrowserRouter>
                <PartnerDashboard />
            </BrowserRouter>
        </ChakraProvider>
    )
}

describe('PartnerDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAuth.mockReturnValue(defaultAuthReturn)
        mockUsePartnerDashboardData.mockReturnValue(defaultDashboardReturn)
    })

    it('renders loading state for organizations', () => {
        mockUsePartnerDashboardData.mockReturnValue({
            ...defaultDashboardReturn,
            organizationsLoading: true,
        })

        renderComponent()

        expect(screen.getByText('Loading dashboard data...')).toBeInTheDocument()
        expect(screen.getByText('Organizations loading...')).toBeInTheDocument()
    })

    it('renders loading state for users', () => {
        mockUsePartnerDashboardData.mockReturnValue({
            ...defaultDashboardReturn,
            usersLoading: true,
        })

        renderComponent()

        expect(screen.getByText('Loading dashboard data...')).toBeInTheDocument()
        expect(screen.getByText('Users loading...')).toBeInTheDocument()
    })

    it('renders error state', () => {
        mockUsePartnerDashboardData.mockReturnValue({
            ...defaultDashboardReturn,
            organizationsError: 'Failed to fetch organizations',
        })

        renderComponent()

        expect(screen.getByText('We hit a problem loading your dashboard data.')).toBeInTheDocument()
        // The error details are now on the dedicated organization management page, not the overview
        expect(screen.getByText('Retry loading data')).toBeInTheDocument()
    })

    it('renders success state with metrics', () => {
        mockUsePartnerDashboardData.mockReturnValue({
            ...defaultDashboardReturn,
            metrics: {
                activeMembers: 100,
                engagementRate: 85,
                newRegistrations: 5,
                managedCompanies: 3,
                deltas: {},
            },
            organizations: [
                { name: 'Org 1', status: 'active', activeUsers: 50, newThisWeek: 2 },
                { name: 'Org 2', status: 'active', activeUsers: 50, newThisWeek: 3 },
            ],
            assignedOrgCount: 2,
            snapshot: {
                ...defaultDashboardReturn.snapshot,
                organizations: [
                    { name: 'Org 1', status: 'active', activeUsers: 50, newThisWeek: 2 },
                    { name: 'Org 2', status: 'active', activeUsers: 50, newThisWeek: 3 },
                ],
                analytics: {
                    ...defaultDashboardReturn.snapshot.analytics,
                    metrics: {
                        activeMembers: 100,
                        engagementRate: 85,
                        newRegistrations: 5,
                        managedCompanies: 3,
                        deltas: {},
                    },
                },
            },
        })

        renderComponent()

        expect(screen.getByText('Partner Overview')).toBeInTheDocument()
        // Check for activity summary metrics
        expect(screen.getByText('Activity Summary')).toBeInTheDocument()
        expect(screen.getByText('Active members (30d)')).toBeInTheDocument()
        expect(screen.getByText('100')).toBeInTheDocument()
        expect(screen.getByText('Engagement rate')).toBeInTheDocument()
        expect(screen.getByText('85%')).toBeInTheDocument()
        expect(screen.getByText('New registrations (7d)')).toBeInTheDocument()
        expect(screen.getByText('5')).toBeInTheDocument()
        expect(screen.getByText('Managed companies')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument()

        // Check for organizations
        expect(screen.getByText('Organization Health Snapshot')).toBeInTheDocument()
        expect(screen.getByText('Org 1')).toBeInTheDocument()
        expect(screen.getByText('Org 2')).toBeInTheDocument()
    })

    it('handles organization selection', async () => {
        // Since PartnerUserManagement is mocked, we can't test the actual interaction inside it easily here,
        // but we can verify it renders when navigating to the users page.
        renderComponent()

        // User management should NOT be on the overview page now
        expect(screen.queryByTestId('partner-user-management')).not.toBeInTheDocument()

        // Click on "Invite your first learner" to navigate to users page
        const inviteButton = screen.getByRole('button', { name: /invite your first learner/i })
        fireEvent.click(inviteButton)

        // Now it should be in the document
        await waitFor(() => {
            expect(screen.getByTestId('partner-user-management')).toBeInTheDocument()
        })
    })

    it('displays real-time notifications', () => {
        mockUsePartnerDashboardData.mockReturnValue({
            ...defaultDashboardReturn,
            notificationCount: 5
        })

        renderComponent()

        expect(screen.getByText('Recent Activity')).toBeInTheDocument()
        expect(screen.getByText('5 unread')).toBeInTheDocument()
    })
})
