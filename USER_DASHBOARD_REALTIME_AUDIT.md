# User Dashboard Real-Time Integrity Report

## Scope
Audit coverage includes the following user-facing pages and their dependent components:
- Dashboard (Home / Weekly Glance)
- Weekly Checklist
- Impact Log
- Leadership Council
- Peer Connect
- My Courses
- Leadership Board

---

## Dashboard (Home / Weekly Glance)

### Firebase Source Mapping (UI → Database)
- Weekly points & engagement count: `weeklyProgress/{uid}__{weekNumber}` via `onSnapshot` (real-time), with engagement backfill from `pointsLedger` via `getDocs` (static) filtered by `uid` and `weekNumber`.【F:src/hooks/useWeeklyGlanceData.ts†L156-L234】
- Support Team: `support_assignments` via `getDocs` filtered by `user_id`, then mentor/ambassador profiles via `fetchUserProfileById` (static).【F:src/hooks/useWeeklyGlanceData.ts†L236-L293】
- Personality Profile: `profiles/{uid}` via `getDoc` (static).【F:src/hooks/useWeeklyGlanceData.ts†L295-L320】
- Peer Matching: `peer_matches` via `getDocs` filtered by `user_id` (static).【F:src/hooks/useWeeklyGlanceData.ts†L322-L342】
- Weekly Habits: `weekly_habits` via `onSnapshot` filtered by `user_id` and `week_key` (real-time).【F:src/hooks/useWeeklyGlanceData.ts†L344-L370】
- Weekly Inspiration: `inspiration_quotes` via `getDocs` filtered by `week_number` with fallback to local quotes (static + mock).【F:src/hooks/useWeeklyGlanceData.ts†L372-L398】
- People Impacted: `impact_logs` via `onSnapshot` filtered by `user_id` (real-time), but note that Impact Log writes `userId` (camelCase) not `user_id` (snake_case).【F:src/hooks/useWeeklyGlanceData.ts†L400-L427】【F:src/pages/impact/ImpactLogPage.tsx†L81-L115】

### ✅ Confirmed Real-Time & Correct
- Weekly points document listener (`weeklyProgress`) and weekly habits listener (`weekly_habits`) are real-time and unsubscribed on unmount.【F:src/hooks/useWeeklyGlanceData.ts†L156-L234】【F:src/hooks/useWeeklyGlanceData.ts†L344-L370】

### ❌ Hardcoded / Fake / Simulated Data (Blocking)
- Weekly inspiration fallback text and author are hardcoded UI defaults, shown when Firestore data is missing or slow.【F:src/components/journeys/weeklyGlance/WeeklyInspirationCard.tsx†L20-L27】
- Full leadership quote list is hardcoded and used as a fallback instead of Firebase data; this is simulated content in production flows when `inspiration_quotes` is missing or errors occur.【F:src/services/quotes.ts†L1-L200】【F:src/hooks/useWeeklyGlanceData.ts†L372-L392】
- When `weeklyProgress` is missing, the UI fabricates zeroed points/engagement values without a Firebase source document, which violates the “no simulated data” requirement.【F:src/hooks/useWeeklyGlanceData.ts†L215-L223】

### ⚠️ Static Fetch Used Where Real-Time Is Required
- Support team assignments, personality profile, peer matches, and weekly inspiration quotes are fetched with `getDocs/getDoc` and do not update in real time when Firestore changes (e.g., new mentor assignment or peer match updates).【F:src/hooks/useWeeklyGlanceData.ts†L236-L342】【F:src/hooks/useWeeklyGlanceData.ts†L372-L398】

### 🔐 Security or Data Isolation Risks
- `weeklyProgress`, `weekly_habits`, `support_assignments`, `peer_matches`, `inspiration_quotes`, and `pointsLedger` are not defined in Firestore rules, so reads are denied by default, preventing authenticated users from accessing their own data via these queries.【F:firestore.rules†L272-L605】
- The impact log query uses `user_id` while impact log writes use `userId`, which can hide user data and force fallback/empty states that are not data-accurate.【F:src/hooks/useWeeklyGlanceData.ts†L400-L427】【F:src/pages/impact/ImpactLogPage.tsx†L81-L115】

### 🧹 Required Cleanup Actions
- Replace all fallback inspiration content with Firebase-sourced content and remove mock quote arrays from production paths.
- Convert support assignments, personality profile, peer matches, and inspiration quotes to `onSnapshot` for real-time consistency.
- Align impact log field names (`userId` vs `user_id`) and ensure rules allow access to required collections.

### 🚦 Readiness Verdict
**Not Ready** (blocking simulated data + missing real-time listeners + rules gaps)

---

## Weekly Checklist

### Firebase Source Mapping (UI → Database)
- Activity definitions and weekly targets: `pointsConfig` local constants (`FULL_ACTIVITIES`, `INTRO_ACTIVITIES`, `JOURNEY_META`).【F:src/config/pointsConfig.ts†L35-L191】
- Checklist completion by activity: `pointsLedger` via `getDocs` filtered by `uid` and `weekNumber` (static).【F:src/pages/journeys/WeeklyUpdatesPage.tsx†L333-L346】
- Weekly progress: `weeklyProgress/{uid}__{selectedWeek}` via `onSnapshot` (real-time).【F:src/pages/journeys/WeeklyUpdatesPage.tsx†L369-L381】
- All weeks progress summary: `weeklyProgress` via `onSnapshot` filtered by `uid` + week range (real-time).【F:src/pages/journeys/WeeklyUpdatesPage.tsx†L389-L405】
- Impact log auto-completion: `impact_logs` via `onSnapshot` filtered by `userId` + date range (real-time).【F:src/pages/journeys/WeeklyUpdatesPage.tsx†L408-L441】
- Checklist persistence: `checklists/{uid}_{week}` via `setDoc` (write).【F:src/pages/journeys/WeeklyUpdatesPage.tsx†L206-L229】

### ✅ Confirmed Real-Time & Correct
- Weekly progress (current + historical) and impact log auto-status are real-time and unsubscribe on unmount.【F:src/pages/journeys/WeeklyUpdatesPage.tsx†L369-L405】【F:src/pages/journeys/WeeklyUpdatesPage.tsx†L408-L441】

### ❌ Hardcoded / Fake / Simulated Data (Blocking)
- Journey labels, default weekly targets, and weekly guidance content are hardcoded and shown to users regardless of Firebase data availability.【F:src/pages/journeys/WeeklyUpdatesPage.tsx†L53-L126】
- Participation rhythm checklist is stored in `localStorage` with hardcoded items and a local points formula, meaning progress is simulated and not tied to Firestore data.【F:src/pages/journeys/WeeklyUpdatesPage.tsx†L98-L159】
- Activity definitions, points, and weekly targets are hardcoded in `pointsConfig`, not Firebase-driven.【F:src/config/pointsConfig.ts†L35-L191】

### ⚠️ Static Fetch Used Where Real-Time Is Required
- Activity completion uses `getDocs` from `pointsLedger` and does not update live when points are awarded elsewhere or from another device/session.【F:src/pages/journeys/WeeklyUpdatesPage.tsx†L333-L346】

### 🔐 Security or Data Isolation Risks
- `pointsLedger` and `weeklyProgress` collections have no rules defined, so authenticated users cannot reliably read their own data, pushing the UI toward local defaults or stale state.【F:firestore.rules†L272-L605】

### 🧹 Required Cleanup Actions
- Move activity definitions, weekly guidance, and participation rhythm items into Firebase-managed collections.
- Replace `pointsLedger` static fetch with `onSnapshot` for real-time completion.
- Add explicit Firestore rules for `weeklyProgress`, `pointsLedger`, and any checklist-related collections.

### 🚦 Readiness Verdict
**Not Ready** (hardcoded activity data + static completion fetch)

---

## Impact Log

### Firebase Source Mapping (UI → Database)
- Personal entries: `impact_logs` via `onSnapshot` filtered by `userId` (real-time).【F:src/pages/impact/ImpactLogPage.tsx†L329-L341】
- Company entries: `impact_logs` via `onSnapshot` filtered by `companyId` (real-time).【F:src/pages/impact/ImpactLogPage.tsx†L343-L361】
- Points awarding/limits: `pointsLedger` via `getDoc/getDocs` checks for weekly/monthly limits (static).【F:src/pages/impact/ImpactLogPage.tsx†L463-L520】

### ✅ Confirmed Real-Time & Correct
- New Impact Log entries and totals are driven by real-time listeners on `impact_logs`.【F:src/pages/impact/ImpactLogPage.tsx†L329-L361】

### ❌ Hardcoded / Fake / Simulated Data (Blocking)
- ESG/business activity lists are hardcoded instead of Firebase-managed reference data.【F:src/pages/impact/ImpactLogPage.tsx†L117-L139】
- Verification multipliers and requirements are hardcoded constants, not Firestore-driven, yet displayed as authoritative scoring rules.【F:src/pages/impact/ImpactLogPage.tsx†L147-L175】
- Base points and pillar mapping logic are hardcoded, which drives the user-facing “impact preview” without a Firestore source of truth.【F:src/pages/impact/ImpactLogPage.tsx†L177-L259】
- Gamification goals (“On Track”, “3 days”, “7 badges”) are hardcoded display values that simulate engagement metrics.【F:src/pages/impact/ImpactLogPage.tsx†L937-L955】

### ⚠️ Static Fetch Used Where Real-Time Is Required
- Points ledger checks for duplication and monthly limits are done via `getDoc/getDocs` and not real-time; if rules change or approvals update, results can be stale mid-session.【F:src/pages/impact/ImpactLogPage.tsx†L463-L520】

### 🔐 Security or Data Isolation Risks
- No explicit rules exist for `pointsLedger`, which Impact Log relies on to enforce point limits; access may fail for non-admin users by default rules absence.【F:firestore.rules†L272-L605】

### 🧹 Required Cleanup Actions
- Move ESG/business activity catalogs and verification multipliers to Firebase reference collections.
- Replace gamification goal placeholders with real Firestore-driven metrics or remove them.

### 🚦 Readiness Verdict
**Not Ready** (hardcoded scoring and engagement metrics)

---

## Leadership Council

### Firebase Source Mapping (UI → Database)
- Mentor/ambassador assignment: initial `profiles/{uid}` via `getDoc` (static), then `onSnapshot` for mentor/ambassador profiles by ID (real-time).【F:src/pages/leadership/LeadershipCouncilPage.tsx†L156-L203】
- Transformation partner: `transformation_partners/primary` via `getDoc` (static).【F:src/pages/leadership/LeadershipCouncilPage.tsx†L204-L208】
- Mentorship sessions: `mentorship_sessions` via `onSnapshot` filtered by `learner_id` and status (real-time).【F:src/pages/leadership/LeadershipCouncilPage.tsx†L222-L261】

### ✅ Confirmed Real-Time & Correct
- Mentorship session list uses `onSnapshot` and unsubscribes properly.【F:src/pages/leadership/LeadershipCouncilPage.tsx†L222-L261】

### ⚠️ Static Fetch Used Where Real-Time Is Required
- Leadership assignments are only fetched once via `getDoc` for the learner profile, so mentor/ambassador changes are not real-time if the learner’s profile updates after initial load.【F:src/pages/leadership/LeadershipCouncilPage.tsx†L156-L168】
- Transformation partner profile is fetched via `getDoc` and is not real-time for updates (bio, resources, ratings).【F:src/pages/leadership/LeadershipCouncilPage.tsx†L204-L208】

### 🔐 Security or Data Isolation Risks
- Firestore rules for `mentorship_sessions` only allow mentors/super admins to read; learners are not permitted to read their own sessions, which breaks this page’s data model and forces empty states or errors.【F:firestore.rules†L439-L453】

### 🧹 Required Cleanup Actions
- Use `onSnapshot` for learner profile and transformation partner documents.
- Update rules to permit learners to read their own `mentorship_sessions` records.

### 🚦 Readiness Verdict
**Conditionally Ready** (real-time sessions exist, but rules block learners and assignments are not real-time)

---

## Peer Connect

### Firebase Source Mapping (UI → Database)
- Peers list: `profiles` via `getDocs` filtered by `companyCode` (static).【F:src/pages/peer/PeerConnectPage.tsx†L272-L304】
- Weekly match: `peer_weekly_matches/{uid}-{weekRange}` via `getDoc/setDoc` (static).【F:src/pages/peer/PeerConnectPage.tsx†L171-L200】
- Pending invites: `peer_session_requests` via `getDocs` filtered by `toUserId` (static).【F:src/pages/peer/PeerConnectPage.tsx†L206-L218】
- Sessions: `peer_sessions` via `getDocs` filtered by `participants` (static).【F:src/pages/peer/PeerConnectPage.tsx†L219-L255】

### ❌ Hardcoded / Fake / Simulated Data (Blocking)
- Timezone options and default session description are hardcoded reference data rather than Firebase-managed lists.【F:src/pages/peer/PeerConnectPage.tsx†L123-L137】
- Default session form values include hardcoded titles/links that present as real meeting data before Firebase writes.【F:src/pages/peer/PeerConnectPage.tsx†L155-L165】
- Demo sessions and demo peer profiles are inserted when Firebase returns no data, which is explicitly simulated user content in production UI.【F:src/pages/peer/PeerConnectPage.tsx†L240-L348】
- Invite defaults (“Peer”, “peer@example.com”) fabricate user identity fields when Firestore data is missing.【F:src/pages/peer/PeerConnectPage.tsx†L211-L217】

### ⚠️ Static Fetch Used Where Real-Time Is Required
- Weekly matches, session invites, and session updates are fetched with `getDocs/getDoc` and do not update live; these are required real-time elements for match status and connection state.【F:src/pages/peer/PeerConnectPage.tsx†L171-L255】【F:src/pages/peer/PeerConnectPage.tsx†L272-L370】

### 🔐 Security or Data Isolation Risks
- `profiles` rules only allow users to read their own profile (plus admin/mentor scopes), so Peer Connect’s peer discovery query likely fails for standard members without rule updates, indicating a rules/data mismatch.【F:firestore.rules†L132-L145】【F:src/pages/peer/PeerConnectPage.tsx†L272-L304】
- No explicit rules exist for `peer_sessions`, `peer_session_requests`, or `peer_weekly_matches`, so access is denied by default for authenticated users.【F:firestore.rules†L272-L605】

### 🧹 Required Cleanup Actions
- Replace all demo/fallback peer and session data with real empty states or Firebase-driven content.
- Move match, invite, and session queries to `onSnapshot` listeners.
- Add Firestore rules scoped to authenticated participants for peer session collections.

### 🚦 Readiness Verdict
**Not Ready** (simulated data + non-real-time core flows + missing rules)

---

## My Courses

### Firebase Source Mapping (UI → Database)
- User courses: `user_courses` via `onSnapshot` filtered by `user_id` (real-time).【F:src/pages/courses/MyCoursesPage.tsx†L218-L260】
- Company-assigned courses: `assigned_courses` via `onSnapshot` filtered by `companyCode` (real-time).【F:src/pages/courses/MyCoursesPage.tsx†L262-L304】
- Personal assignments: `assigned_courses` via `onSnapshot` filtered by `userId` (real-time).【F:src/pages/courses/MyCoursesPage.tsx†L306-L348】
- Organization program: `companies/{companyCode}` via `onSnapshot` (real-time).【F:src/pages/courses/MyCoursesPage.tsx†L350-L458】
- Course catalog details: `courses` via `getDocs` `where('id', 'in', chunk)` (static).【F:src/pages/courses/MyCoursesPage.tsx†L405-L429】

### ✅ Confirmed Real-Time & Correct
- Course assignments and progress are real-time via `onSnapshot` for user, personal, and company assignments.【F:src/pages/courses/MyCoursesPage.tsx†L218-L348】

### ❌ Hardcoded / Fake / Simulated Data (Blocking)
- Course image filenames, monthly journey templates, and metadata fallbacks are hardcoded and used in UI when Firebase data is missing or incomplete, resulting in simulated course details (descriptions, durations, difficulties, and links).【F:src/pages/courses/MyCoursesPage.tsx†L62-L132】【F:src/pages/courses/MyCoursesPage.tsx†L231-L247】【F:src/pages/courses/MyCoursesPage.tsx†L468-L478】【F:src/utils/courseMappings.ts†L16-L220】

### ⚠️ Static Fetch Used Where Real-Time Is Required
- `courses` catalog data is fetched with `getDocs` and does not update live, which means course metadata changes won’t reflect without a manual refresh.【F:src/pages/courses/MyCoursesPage.tsx†L405-L429】

### 🔐 Security or Data Isolation Risks
- Firestore rules for `user_courses` only allow mentors/super admins; users cannot read their own course assignments, breaking this page’s primary data source for standard users.【F:firestore.rules†L555-L565】
- No rules exist for `assigned_courses`, so company/personal course assignments will be denied by default unless added explicitly.【F:firestore.rules†L272-L605】

### 🧹 Required Cleanup Actions
- Move course details, metadata, and journey templates to Firestore collections and remove local mappings.
- Add/adjust rules so users can read their own `user_courses` and assignments.

### 🚦 Readiness Verdict
**Not Ready** (hardcoded course catalog + rules prevent user access)

---

## Leadership Board

### Firebase Source Mapping (UI → Database)
- Profiles: `profiles` via `onSnapshot` filtered by segment or all profiles for admin (real-time).【F:src/pages/leaderboard/LeadershipBoardPage.tsx†L630-L670】
- Points transactions: `points_transactions` via `onSnapshot` with `orderBy` + `limit` and optional `companyId` filter (real-time).【F:src/pages/leaderboard/LeadershipBoardPage.tsx†L402-L451】
- Challenges: `challenges` via `onSnapshot` filtered by `participants` (real-time).【F:src/pages/leaderboard/LeadershipBoardPage.tsx†L453-L498】
- Featured badges: `user_badges` and `badges` via `getDocs` (static).【F:src/pages/leaderboard/LeadershipBoardPage.tsx†L214-L274】

### ✅ Confirmed Real-Time & Correct
- Leaderboard points, profiles, and challenges are loaded via `onSnapshot` and update live (when rules permit).【F:src/pages/leaderboard/LeadershipBoardPage.tsx†L402-L498】【F:src/pages/leaderboard/LeadershipBoardPage.tsx†L630-L670】

### ❌ Hardcoded / Fake / Simulated Data (Blocking)
- Badge counts are derived from points using a hardcoded minimum of 1 badge, which simulates achievement data rather than using Firebase badge counts.【F:src/pages/leaderboard/LeadershipBoardPage.tsx†L636-L651】

### ⚠️ Static Fetch Used Where Real-Time Is Required
- Featured badges are fetched with `getDocs` and do not update in real time; new badges earned mid-session will not appear without manual refresh.【F:src/pages/leaderboard/LeadershipBoardPage.tsx†L214-L274】

### 🔐 Security or Data Isolation Risks
- `profiles` rules only allow users to read their own profile, but the leaderboard requires cross-user reads; this will fail for standard users unless rules are expanded for approved segments.【F:firestore.rules†L132-L145】【F:src/pages/leaderboard/LeadershipBoardPage.tsx†L630-L670】
- `points_transactions` rules only allow mentors/super admins to read; standard users cannot read their own or segment transactions, blocking leaderboard computation.【F:firestore.rules†L501-L512】

### 🧹 Required Cleanup Actions
- Remove simulated badge counts and replace with Firebase-driven badge aggregations.
- Add real-time listener for `user_badges` if featured badges are expected to update live.
- Update rules to allow scoped leaderboard reads for authenticated members.

### 🚦 Readiness Verdict
**Not Ready** (simulated badge counts + rules block access)

---

## Cross-Page Security & Data Isolation Summary

### 🔐 Risks
- Multiple collections required for the user dashboard are missing Firestore rules, resulting in default-deny access or reliance on mock data: `weeklyProgress`, `weekly_habits`, `support_assignments`, `peer_matches`, `peer_weekly_matches`, `peer_sessions`, `peer_session_requests`, `pointsLedger`, and `assigned_courses` are not defined in the rules file.【F:firestore.rules†L272-L605】
- Some existing rules block legitimate user access (e.g., `user_courses`, `points_transactions`, `mentorship_sessions`), causing empty states or forcing fallback content instead of live data.【F:firestore.rules†L439-L453】【F:firestore.rules†L501-L565】

### 🧹 Required Cleanup Actions
- Define rules for all collections used in user-facing pages, scoped to the authenticated user or approved segments.
- Align field naming (`userId` vs `user_id`) and rule predicates to avoid silent data mismatches.

---

## Overall Readiness Summary
- **Dashboard (Home): Not Ready**
- **Weekly Checklist: Not Ready**
- **Impact Log: Not Ready**
- **Leadership Council: Conditionally Ready**
- **Peer Connect: Not Ready**
- **My Courses: Not Ready**
- **Leadership Board: Not Ready**

Blocking issues are primarily caused by hardcoded/simulated data, static fetches where real-time is required, and Firestore rules that deny legitimate user access.
