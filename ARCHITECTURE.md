# T4L Tier Platform – Architecture & Experience Blueprint

This document captures the target architecture, routing map, and dashboard layout definitions for rebuilding the Tier site for Transformation 4 Leaders (T4L). It aligns to the mandated stack, brand system, and product requirements in the latest specification.

## 1. System Overview

- **SPA with secure API layer**: React 18 + TypeScript front end powered by Vite. Client renders authenticated experience while calling Bolt Database Edge Functions for all privileged logic.
- **Serverless backend**: Bolt Database PostgreSQL (115+ migrations), Bolt Auth, Edge Functions, Storage, and real-time subscriptions for live updates (leaderboards, notifications, checklists).
- **Security**: RBAC enforced in UI and API, RLS on data tables, encrypted storage, CSRF/XSS protection, validated inputs, and secure Stripe integration through Edge Functions + webhooks.
- **Brand-first UI**: Plum-forward shell with Royal Purple accents, Flame Orange CTAs, and Gold/Soft Gold highlights. Framer Motion for polish, Recharts for analytics, and Canvas Confetti for celebrations.

## 2. Technology Stack

### Frontend
- React 18 + TypeScript
- Vite build tool
- React Router v6 (data APIs for loaders/actions where applicable)
- Chakra UI for accessible primitives
- Tailwind CSS for layout utilities and fine-grain spacing
- Framer Motion for transitions and micro-interactions
- Recharts for charts; Lucide React for iconography
- date-fns for date/time utilities
- Canvas Confetti for milestone celebrations

### Backend & Platform Services
- Bolt Database PostgreSQL with RLS
- Bolt Auth (email/password, magic links, password reset)
- Bolt Edge Functions for server-side logic (payments, automations, exports)
- Bolt Storage for assets (avatars, certificates, proof uploads)
- Real-time subscriptions for leaderboards, notifications, checklist progression

### Payments & Email
- Stripe Checkout + Customer Portal via secure Edge Functions & webhooks
- SendGrid for transactional and notification emails

### State & Data Layer
- React Context API + custom hooks for auth, user profile, notifications, feature flags
- `services/` for API clients, strongly typed responses, error normalization, and retries where safe
- Centralized RBAC helpers: `hasRole`, `hasAnyRole`, `assertRole` exported from `useAuth()`

## 3. Application Architecture

### App Shell & Layouts
- **AppShell layout**: persistent header (points, level, upgrade CTA), collapsible sidebar (role-aware nav), main content area with responsive padding, and global toasts/notifications. Uses Deep Plum background with purple gradients on premium sections.
- **Auth layout**: centered card on a plum→purple→gold gradient background with tabs for Login/Register/Forgot. Includes logo and CPD badge.
- **Dashboard layouts**: role-scoped wrappers that set nav sections, permissible quick actions, and contextual banners (upgrade prompts for free users, compliance notices for admins).
- **Error boundaries**: wrap routes to contain failures and show friendly recovery UI.

### Suggested Folder Structure
```
src/
├── components/        # Shared UI (cards, charts, tables, badges, loaders)
├── contexts/          # AuthContext, NotificationContext, FeatureFlagContext
├── hooks/             # useAuth, useRBAC, useJourneyProgress, useChecklist, useImpactLog
├── layouts/           # AppShell, AuthLayout, RoleDashboardLayout variants
├── pages/             # Route-level screens organized by domain
│   ├── auth/
│   ├── dashboard/
│   ├── journeys/
│   ├── impact/
│   ├── leaderboard/
│   ├── community/
│   ├── admin/
│   └── settings/
├── routes/            # Route configuration and loaders
├── services/          # API clients (Bolt, Stripe), Edge Function callers, storage helpers
├── theme/             # Chakra theme tokens with T4L brand palette
├── types/             # Domain models and enums (User, Role, Journey, Checklist, ImpactLog, Badge)
└── utils/             # Formatting, guards, error mappers, validation
```

### Data Access & Services
- **`services/authService.ts`**: login/register/magic links/password reset, token handling, profile bootstrap, email verification.
- **`services/profileService.ts`**: profile CRUD, avatar uploads (Bolt Storage), preferences, notification settings.
- **`services/journeyService.ts`**: journey catalog, enrollment, minimum weekly points expectations, progress, custom journey builder.
- **`services/checklistService.ts`**: fetch/update weekly tasks, unlock rules, proof uploads, completion stats.
- **`services/impactService.ts`**: create/update/delete impact logs, filters, stats, CSV export.
- **`services/leaderboardService.ts`**: scoped leaderboards (global/org/village/cluster), kudos actions, challenges.
- **`services/courseService.ts`**: course lists, module progress, certificates, CPD tracking.
- **`services/paymentService.ts`**: Stripe checkout session creation, portal links, webhook event handling (Edge Functions).
- **`services/adminService.ts`**: users/orgs/events/upgrade requests, audit logs, badge management.

## 4. Routing Structure

### Public & Auth
- `/` – Landing page (hero, CTA, brand gradient)
- `/auth` – Tabbed login/register/forgot with token handling
- `/verify-email` – Email confirmation state
- `/magic-link` – Magic link confirmation/error

### Core Member Experience
- `/dashboard` – Default redirect based on role
- `/dashboard/member` – Member dashboard (free & paid variants)
- `/dashboard/mentor` – Mentor dashboard
- `/dashboard/ambassador` – Ambassador dashboard
- `/dashboard/company-admin` – Company admin dashboard
- `/dashboard/super-admin` – Super admin tools
- `/journeys` – Journey catalog & enrollment
- `/journeys/:journeyId` – Journey detail with weekly map
- `/journeys/:journeyId/weeks/:weekNumber` – Weekly checklist view
- `/impact` – Impact log (personal/company tabs)
- `/leaderboard` – Leaderboards (global/company/village/cluster, time filters)
- `/courses` – Course list and module progress
- `/courses/:courseId` – Course detail, module tracking
- `/community` – Overview hub (villages, book club, council, shameless circle)
- `/community/villages/:villageId`
- `/community/book-club`
- `/community/shameless-circle`
- `/peer-connect` – Peer matching and sessions
- `/notifications` – In-app notification center
- `/referrals` – Referral rewards and stats
- `/subscription` – Plan selection, Stripe portal, invoices
- `/profile` – Personal profile & preferences
- `/users/:userId` – Public profile
- `/settings` – Account, security, feature toggles
- `/help` – Knowledge base / FAQ
- `/command` – Command palette (Cmd/Ctrl+K shortcut)
- `/unauthorized` – Access denied

### Admin & Ops
- `/admin/dashboard` – Platform overview (for admins)
- `/admin/users` – User directory & detail drawer
- `/admin/organizations` – Org management & codes
- `/admin/events` – Event CRUD, calendar, QR generation
- `/admin/upgrade-requests` – Approvals & history
- `/admin/analytics` – Engagement, points, exports
- `/admin/oversight` – Audit logs & security
- `/super-admin` – Global settings, role management, migrations, health checks

## 5. Dashboard Layout Sketches

### Member Dashboard (Free & Paid)
- **Hero strip**: name, current level, points-to-next-level, Flame Orange CTA (upgrade for free users, “Continue journey” for paid) with confetti on milestones.
- **Overview grid**: minimum weekly points progress (gold progress bar), streak counter, next milestone badge, upgrade prompt card for free tier.
- **Journey & checklist**: current journey card with phase timeline; weekly checklist card with completion meter and quick actions.
- **Impact log snapshot**: hours/USD/people impacted with Recharts mini charts; CTA to log impact.
- **Leaderboard preview**: top peers and personal rank; kudos button.
- **Courses & community**: “My Courses” carousel (premium), Book Club/Peer Connect cards, announcements/notifications feed.
- **Onboarding widget**: stepper with countdown for new/free users; Intro.js launch button.

### Mentor Dashboard
- **Header metrics**: mentee count, upcoming sessions, risk flags.
- **Sessions calendar**: week/month toggle; quick add session.
- **Mentee list**: filters (risk, journey, activity), quick actions (message, schedule, notes).
- **Engagement analytics**: mentee progress charts (gold on-track, orange warning).
- **Resource hub**: templates/guides with download status; notes panel.

### Ambassador Dashboard
- **Referral card**: copy/share link with Flame Orange CTA, mini funnel metrics (clicks → signups → conversions).
- **Rewards & commissions**: gold highlight cards; payout history.
- **Community impact**: charts for reach, engagement, leaderboard for referrals.
- **Announcements & tips**: playbook links and suggested actions.

### Company Admin Dashboard
- **Org overview**: total users, active seats, engagement level, risk distribution.
- **Usage analytics**: charts for points, impact hours/USD, completion rates.
- **Team management**: user table with filters, bulk actions, invite by code; upgrade requests widget.
- **Events & schedules**: calendar and quick create with QR generation.
- **Reports**: exports, audit summaries, compliance notices.

### Super Admin Dashboard
- **System health**: migrations status, Edge Function latency, auth events, subscription revenue.
- **Global settings**: roles/permissions management, feature flags.
- **Data tools**: migrations runner, data snapshots, performance testing views.
- **Oversight**: audit logs, admin actions, RLS policy summary, webhook monitor.

## 6. RBAC & Route Protection
- Route guards check `requiredRoles` before rendering; unauthorized users are redirected to `/unauthorized` with helpful messaging.
- Components hide gated features (e.g., premium courses, admin tools) using `hasRole/hasAnyRole` helpers.
- Backend enforces the same roles via Edge Function checks + RLS policies to prevent UI bypass.

## 7. UX & Interaction Baselines
- **Loading**: skeletons for cards/tables, shimmer placeholders in dashboard grids.
- **Error**: inline callouts with retry; modal-safe errors for destructive flows.
- **Empty**: illustrated states with contextual CTAs (e.g., “Log your first impact”).
- **Animations**: 150–300ms transitions; Framer Motion for card hover/entrances; confetti on major achievements.
- **Accessibility**: WCAG 2.1 AA, focus outlines, semantic headings, ARIA labels, keyboard nav, sufficient contrast with brand colors.

## 8. Testing Recommendations
- **Unit**: points calculation, minimum weekly points status, RBAC guards, checklist unlock rules.
- **Integration**: auth flows, weekly checklist completion, impact logging, subscription upgrade/downgrade.
- **Visual/regression**: route-level snapshots for dashboards and critical flows.

## 9. Environment & Dev Workflow
- `.env` uses Bolt/Stripe/SendGrid keys; never commit secrets.
- `npm run dev` for local development; `npm run build` for production preview.
- Prefer lazy-loaded route chunks for heavy dashboards and chart-heavy pages.
- Use centralized logging for Edge Function calls and surfaced errors to aid support.
