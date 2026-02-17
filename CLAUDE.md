# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Claude should treat this file as authoritative.

Project Overview

T4L (Transformation 4 Leaders) is a comprehensive leadership transformation and professional development platform.

It is a React 18 + TypeScript SPA built with Vite, using Firebase (Firestore, Auth, Cloud Functions, Storage) for backend services, Chakra UI + Tailwind CSS for styling, Stripe for payments, and SendGrid for transactional emails.

The platform features:

Structured Learning Journeys
4-week to 12-month transformation programs with weekly checklists and completion logic

Gamification Engine
Window-based points system with:

2-week windows as the core unit (learners think in "this fortnight")

minimum points per window (not activities)

badges & levels

leaderboards (global / organization / village / cluster)

See docs/points-system.md for complete reference

Impact Tracking
Log and visualize:

hours invested

USD value

people impacted
Categorized by ESG and business impact

Multi-Role System
Six roles with strict RBAC and role-based dashboards

Community Features
Villages, peer matching, book clubs, leadership councils

Nudge System
Automated behavioral nudges based on engagement patterns

Development Commands
Core Commands
npm run dev          # Start Vite dev server (port 3000, auto-opens browser)
npm run build        # TypeScript compile + Vite production build
npm run preview      # Preview production build locally
npm run lint         # Run ESLint with max-warnings 0
npm run format       # Format all src files with Prettier
npm run typecheck    # Run TypeScript compiler without emitting files
npm run qa           # Run lint + typecheck + build (comprehensive QA check)
npm run test         # Alias for npm run qa

Utility Scripts
# Database seeding and migrations
node scripts/seed-nudge-templates.mjs
node scripts/seed-journey-activity-catalog.mjs
node scripts/seed-window-configs.mjs
node scripts/seed-courses.mjs
node scripts/migrations/add-role-based-fields.mjs

# Weekly points management
npm run populate-weekly-points

# Nightly automation
npm run nightly-nudge-check

Firebase Commands
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only functions

Architecture Overview
Tech Stack

Frontend: React 18, TypeScript (strict), Vite, React Router v6

UI: Chakra UI, Tailwind CSS, Framer Motion, Lucide React

Backend: Firebase (Auth, Firestore, Storage, Cloud Functions)

Charts: Recharts

Dates: date-fns

Payments: Stripe (via Cloud Functions + Webhooks)

Email: SendGrid

Brand Colors

Deep Plum: #27062e

Flame Orange: #f4540c

Royal Purple: #350e6f

Gold: #eab130

Soft Gold: #f9db59

Folder Structure
src/
├── components/
├── contexts/
├── hooks/
├── layouts/
├── pages/
│   ├── auth/
│   ├── dashboards/
│   ├── journeys/
│   ├── impact/
│   ├── leaderboard/
│   └── admin/
├── routes/
├── services/
├── theme/
├── types/
└── utils/

Path Aliases

@/ maps to src/

import { useAuth } from '@/hooks/useAuth'
import { profileService } from '@/services/profileService'

Role-Based Authorization System
User Roles

free_user

paid_member

mentor

ambassador

partner

super_admin

Important
Legacy roles company_admin and admin are fully consolidated into partner.

Role Normalization (MANDATORY)

Always normalize roles via:

import { normalizeRole } from '@/utils/role'

const role = normalizeRole(rawRole)


Never hard-code legacy role checks.

Landing Path Logic

Centralized in:

src/utils/roleRouting.ts


Priority order:

redirectUrl query param

super_admin → /admin/dashboard

partner → /partner/dashboard

mentor → /mentor/dashboard (tier-dependent)

ambassador → /ambassador/dashboard

Users → onboarding → preferred route → default

Route Protection

Use ProtectedRoute only — no ad-hoc guards.

<ProtectedRoute
  requiredRoles={[UserRole.PARTNER]}
  requireSuperAdmin
  requireAdmin
  requireMentor
  requirePaid
  restrictMentor
  requireOrganization="org-code"
>
  {children}
</ProtectedRoute>

AuthContext Helpers
const {
  isAdmin,
  isSuperAdmin,
  isMentor,
  isAmbassador,
  isPaid,
  canAccessOrganization
} = useAuth()

Services (src/services/)

All Firebase access must go through services — no direct Firestore calls in pages.

Core

firebase.ts

authService.ts

profileService.ts

User & Organization

userManagementService.ts

organizationService.ts

invitationService.ts

leadershipService.ts

Points & Engagement

pointsService.ts

pointsVerificationService.ts

badgeService.ts

engagementService.ts

journeyCompletionService.ts

Notifications & Nudges

notificationService.ts

nudgeService.ts

firebaseNudgeService.ts

nudgeMonitorService.ts

Dashboards & Analytics

organizationStatsService.ts

mentorDashboardService.ts

partnerDigestService.ts

dashboardCache.ts

Admin

adminUsersService.ts

adminUpgradeService.ts

adminEngagementService.ts

Hooks (src/hooks/)

Hooks follow single-responsibility + composition.

Partner Hooks (Refactored)

Located in src/hooks/partner/

usePartnerOrganizations

usePartnerUsers

usePartnerMetrics

usePartnerBulkActions

useWeeklyPointsFetcher

useUserSelection

Do not create monolithic partner hooks.

Firestore Collections (Core)

profiles

organizations

journeys

journey_configs

checklists

weeklyProgress

windowProgress

impact_logs

notifications

nudge_templates

nudges_sent

nudge_effectiveness

upgrade_requests

interventions

leaderboards

villages

clusters

Firestore Rules & Indexes

Rules enforce RBAC

Indexes must be deployed before assuming query support

firebase deploy --only firestore:indexes

Environment Variables

Required:

VITE_FIREBASE_*

VITE_STRIPE_PUBLIC_KEY

VITE_APP_BASE_URL

Optional:

VITE_BOOTSTRAP_ADMIN_EMAILS

VITE_ENABLE_PROFILE_REALTIME

VITE_FEATURE_FLAG_PARALLEL_WINDOW_TRACKING

Development Patterns (MANDATORY)
Real-Time Listeners

Always unsubscribe:

const unsubscribe = onSnapshot(q, handler)
return unsubscribe

Transaction Safety

Points must use Firestore transactions.

Points System (Core Concepts)

Core Principle: Learners are guided by minimum POINTS per 2-week window, not activities.

Window-Based Architecture:

All journeys divided into 2-week windows

Learners think in "this fortnight" - never months

Activities unlock, lock, rotate, and disappear temporarily

Points alone determine progress and passing

Journey Types:
| Journey | Windows | Pass Mark | Max Points | Per Window Target |
|---------|---------|-----------|------------|-------------------|
| 4-Week Intro | 2 | 9,000 | 15,000 | 4,500 |
| 6-Week Power | 3 | 40,000 | 60,000 | 13,500 |
| 3-Month | 6 | 75,000 | 113,000 | 12,500 |
| 6-Month | 12 | 150,000 | 226,000 | 12,500 |
| 9-Month | 18 | 227,000 | 339,000 | 12,600 |

Per Window Target formula: `Pass Mark / Windows` (rounded for display where needed).

Activity Types:
- One-Time: Claim once → permanently disabled
- Window-Limited: Max 1 claim per window, reappears next window
- Ongoing: Always visible, hard-capped by total frequency

Points Claiming Methods:
- Auto Marks: Platform-tracked activities
- Self-Reporting: User marks complete
- Partner Approved: User submits evidence, partner reviews
- Partner-Issued: Partner awards directly from Admin portal
- Mentor-Issued: Mentor awards directly from Mentor portal
- Ambassador-Issued: Ambassador awards directly from Ambassador portal

See docs/points-system.md for complete reference including implementation code.

Cloud Functions

Only call via httpsCallable.
Never expose privileged logic client-side.

Error Handling

Retry transient failures

Always surface user-safe errors

Log admin-grade errors

Testing Strategy

Run before every commit:

npm run qa

Claude-Specific Instructions (CRITICAL)

Claude must follow these rules when working in this repo:

DO

Respect role normalization and RBAC at all times

Use existing services and hooks before creating new ones

Prefer composition over duplication

Match existing patterns exactly

Assume Firebase is the only database

Treat Firestore rules as non-negotiable constraints

DO NOT

Invent new roles

Bypass ProtectedRoute

Write direct Firestore queries in pages/components

Hard-code organization access

Add speculative abstractions

Change architecture without explicit instruction

When Unsure

Ask one clarifying question

Default to the safest, least-privileged approach

Key Documentation

ARCHITECTURE.md

ROLE_BASED_AUTH.md

TESTING_GUIDE.md

MIGRATION_GUIDE.md

database/firestore-schema.md

THEME_CONTRACT.md

docs/points-system.md

docs/README.md

Code Quality Standards

TypeScript strict mode

ESLint: zero warnings

Prettier enforced

Functional components only

WCAG 2.1 AA

Mobile-first

Clear loading + error states

No over-engineering
