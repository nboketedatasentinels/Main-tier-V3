import { describe, expect, it } from 'vitest'
import type { UserProfile } from '@/types'
import type { LeaderboardContext } from '@/hooks/leaderboard/useLeaderboardContext'
import { canViewerSeeCandidateOnLeaderboard } from './leaderboardPrivacy'

const makeProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: overrides.id || 'user-1',
  email: overrides.email || 'user-1@example.com',
  firstName: overrides.firstName || 'User',
  lastName: overrides.lastName || 'One',
  fullName: overrides.fullName || 'User One',
  role: overrides.role || 'user',
  journeyType: overrides.journeyType || '4W',
  totalPoints: overrides.totalPoints ?? 0,
  level: overrides.level ?? 1,
  isOnboarded: overrides.isOnboarded ?? true,
  createdAt: overrides.createdAt || new Date(0).toISOString(),
  updatedAt: overrides.updatedAt || new Date(0).toISOString(),
  ...overrides,
})

describe('canViewerSeeCandidateOnLeaderboard', () => {
  it('keeps private profiles visible to themselves only', () => {
    const candidate = makeProfile({ id: 'u1', leaderboardVisibility: 'private' })
    const otherViewer = makeProfile({ id: 'u2' })

    expect(
      canViewerSeeCandidateOnLeaderboard({
        viewer: otherViewer,
        candidate,
        context: { type: 'organization', organizationId: 'org-1' },
      }),
    ).toBe(false)

    expect(
      canViewerSeeCandidateOnLeaderboard({
        viewer: candidate,
        candidate,
        context: { type: 'organization', organizationId: 'org-1' },
      }),
    ).toBe(true)
  })

  it('shows company-only profiles in org-scoped contexts for same organization', () => {
    const viewer = makeProfile({ id: 'u1', companyId: 'org-1' })
    const candidate = makeProfile({ id: 'u2', companyId: 'org-1', leaderboardVisibility: 'company' })
    const context: LeaderboardContext = { type: 'organization', organizationId: 'org-1' }

    expect(canViewerSeeCandidateOnLeaderboard({ viewer, candidate, context })).toBe(true)
  })

  it('hides company-only profiles in community context', () => {
    const viewer = makeProfile({ id: 'u1', companyId: 'org-1' })
    const candidate = makeProfile({ id: 'u2', companyId: 'org-1', leaderboardVisibility: 'company' })
    const context: LeaderboardContext = { type: 'community' }

    expect(canViewerSeeCandidateOnLeaderboard({ viewer, candidate, context })).toBe(false)
  })

  it('honors explicit privacySettings.showOnLeaderboard=false regardless of visibility label', () => {
    const viewer = makeProfile({ id: 'u1', companyId: 'org-1' })
    const candidate = makeProfile({
      id: 'u2',
      companyId: 'org-1',
      leaderboardVisibility: 'public',
      privacySettings: {
        showOnLeaderboard: false,
        allowPeerMatching: true,
        shareImpactPublicly: true,
      },
    })

    expect(
      canViewerSeeCandidateOnLeaderboard({
        viewer,
        candidate,
        context: { type: 'organization', organizationId: 'org-1' },
      }),
    ).toBe(false)
  })
})
