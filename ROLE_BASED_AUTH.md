# Role-Based Login Redirect System

This document describes the comprehensive role-based login redirect system implemented in the application.

## Overview

The system provides sophisticated user routing based on roles, account status, onboarding state, and preferences. It ensures users are directed to the appropriate dashboard while enforcing security and access control at multiple levels.

## Recent Updates

### Role Normalization & Admin Routing Fix (December 2025)

**Critical Bug Fixed**: Admins were being incorrectly redirected to the learner dashboard (`/app/dashboard/free`) instead of their proper admin dashboard.

**Key Changes**:
1. **Centralized Role Normalization** (`/src/utils/role.ts`):
   - Single source of truth for role normalization via `normalizeRole()` function
   - Maps legacy role values to standardized Firestore vocabulary:
     - `company_admin` / `admin` → `partner`
     - Other roles remain as-is (super_admin, mentor, ambassador, team_leader, user, free_user, paid_member)
   - Provides helper functions: `toUserRole()`, `isAdminRole()`, `isSuperAdminRole()`, `rolesMatch()`
   
2. **Centralized Landing Path Logic** (`/src/utils/roleRouting.ts`):
   - `getLandingPathForRole(role, profile, redirectUrl)` implements priority-based routing:
     1. redirectUrl query parameter (payment/external flows)
     2. super_admin → `/super-admin/dashboard`
     3. partner (company_admin) → `/admin/dashboard`
     4. mentor → `/mentor/dashboard` (conditional based on transformationTier)
     5. ambassador → `/ambassador/dashboard`
     6. Regular users → onboarding check → preferred route → default by membership
   - `getPreferredDashboardRoute(profile)` - gets user's preferred dashboard
   - `getDefaultDashboardRouteByMembership(profile)` - default route by membership status
   - Re-exported from `/src/utils/routes.ts` for backwards compatibility

3. **Fixed RoleRedirect** (`/src/pages/auth/RoleRedirect.tsx`):
   - Completely rewritten to use `getLandingPathForRole` consistently
   - Fixed broken code that referenced undefined variables
   - Properly handles redirectUrl query parameter
   - Shows nothing while loading, then navigates to computed landing path

4. **Updated ProtectedRoute** (`/src/components/ProtectedRoute.tsx`):
   - Uses normalized roles for all comparisons
   - `requireAdmin` now correctly allows both `partner` and `super_admin`
   - `requireSuperAdmin` only allows `super_admin`
   - `requiredRoles` array compares normalized values

5. **Simplified AdminDashboard** (`/src/pages/dashboards/AdminDashboard.tsx`):
   - Removed error fallback message ("No admin dashboard available for your role")
   - Route guards ensure only authorized users reach this component
   - Delegates to SuperAdminDashboard or CompanyAdminDashboard based on role
   - Trust the route protection layer instead of duplicating checks

6. **Fixed DashboardRouter** (`/src/routes/index.tsx`):
   - Index route uses full landing path from `getLandingPathForRole`
   - No longer defaults to 'free' for non-learner roles
   - Admin landing paths work correctly without falling back to learner dashboards

**Migration Note**: The old `/src/utils/roles.ts` (note: plural) remains for potential backwards compatibility but is not actively used. The canonical implementation is in `/src/utils/role.ts` (singular) and `/src/utils/roleRouting.ts`.

## Architecture

### 1. Type System

#### UserProfile Interface
Enhanced with the following fields:

```typescript
interface UserProfile {
  // ... existing fields ...
  
  // Account Management
  accountStatus?: AccountStatus // 'active', 'inactive', 'pending', 'suspended'
  mustChangePassword?: boolean
  
  // Onboarding
  onboardingComplete?: boolean
  onboardingSkipped?: boolean
  hasSeenDashboardTour?: boolean
  
  // Role-Based Features
  transformationTier?: TransformationTier // 'individual_free', 'individual_paid', 'corporate_member', 'corporate_leader'
  assignedOrganizations?: string[] // For admin organization access
  dashboardPreferences?: DashboardPreferences
  defaultDashboardRoute?: string
}
```

#### Enums

```typescript
enum UserRole {
  USER = 'user',
  TEAM_LEADER = 'team_leader',
  AMBASSADOR = 'ambassador',
  MENTOR = 'mentor',
  COMPANY_ADMIN = 'partner',     // Stored as 'partner' in Firestore
  SUPER_ADMIN = 'super_admin',
  FREE_USER = 'free_user',
  PAID_MEMBER = 'paid_member',
}

enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

enum TransformationTier {
  INDIVIDUAL_FREE = 'individual_free',
  INDIVIDUAL_PAID = 'individual_paid',
  CORPORATE_MEMBER = 'corporate_member',
  CORPORATE_LEADER = 'corporate_leader',
}
```

### 2. AuthContext Enhancements

#### Role Flags
Computed boolean properties for easy role checking:

- `isAdmin` - true for COMPANY_ADMIN (partner) or SUPER_ADMIN
- `isSuperAdmin` - true for SUPER_ADMIN only
- `isMentor` - true for MENTOR
- `isAmbassador` - true for AMBASSADOR
- `isPaid` - true for paid roles (PAID_MEMBER and above)
- `isCorporateMember` - true if transformationTier contains "corporate"

#### Organization Access
- `assignedOrganizations: string[]` - Array of organization codes
- `hasFullOrganizationAccess: boolean` - true for super admins
- `canAccessOrganization(orgCode: string): boolean` - Check if user can access an organization

#### Custom Claims Sync
- `claimsRole: string | null` - Role from Firebase Auth custom claims
- `refreshAdminSession(): Promise<void>` - Force token refresh to sync claims
- Auto-detects role mismatches between Firestore and custom claims
- Auto-refreshes super admin sessions every 5 minutes

### 3. Role Routing Logic

#### Priority System

The `getLandingPathForRole` function implements the following priority:

1. **redirectUrl Query Parameter** - External/payment flows take precedence
2. **Super Admin & Admin** - Redirect to `/super-admin/dashboard` or `/admin/dashboard`
3. **Mentor (Conditional)** - Based on transformationTier:
   - Corporate mentors → `/mentor/dashboard`
   - Individual mentors → preferredDashboardRoute or `/mentor/dashboard`
4. **Ambassador** - Redirect to `/ambassador/dashboard`
5. **Regular Users** - With onboarding check:
   - Incomplete onboarding → `/welcome`
   - Complete → preferredDashboardRoute or default by membership

#### Helper Functions

```typescript
getPreferredDashboardRoute(profile): string | null
getDefaultDashboardRouteByMembership(profile): string
```

### 4. Login Flow

The enhanced login flow:

1. User enters credentials and submits
2. Firebase Authentication validates credentials
3. System fetches user profile from Firestore
4. **Account Status Check**:
   - Inactive → redirect to `/login` with error
   - Suspended → redirect to `/suspended`
5. **Password Change Check**:
   - If `mustChangePassword === true` → show modal
   - Block navigation until password changed
   - Update Firestore after successful change
6. **Onboarding Check**:
   - If incomplete and not skipped → redirect to `/welcome`
7. **Role-Based Redirect**:
   - Check for redirectUrl parameter
   - Call `getLandingPathForRole` with full profile data
   - Navigate with `replace: true`

### 5. Route Protection

#### ProtectedRoute Component

Enhanced props:

```typescript
<ProtectedRoute
  requiredRoles={[UserRole.ADMIN]} // Specific role requirement
  requireSuperAdmin={true}          // Super admin only
  requireAdmin={true}               // Any admin type
  requireMentor={true}              // Mentor only
  requireAmbassador={true}          // Ambassador only
  requirePaid={true}                // Paid membership
  restrictMentor={true}             // Block mentors from this route
  requireOrganization="org-code"    // Require org access
>
  {children}
</ProtectedRoute>
```

Protection checks (in order):
1. Authentication status
2. Profile existence
3. Account status (active/inactive/suspended)
4. Mentor restriction (if specified)
5. Role requirements (super admin, admin, etc.)
6. Organization access (if specified)
7. Specific role list (if provided)

### 6. Route Configuration

#### Route Structure

```
/login                  - Public login page
/signup                 - Public signup page
/suspended              - Account suspended page
/welcome                - Onboarding page

/super-admin
  /dashboard            - Super admin dashboard (requireSuperAdmin)

/admin
  /dashboard            - Admin dashboard (requireAdmin)

/mentor
  /dashboard            - Mentor dashboard (requireMentor)

/ambassador
  /dashboard            - Ambassador dashboard (requireAmbassador)

/app
  /                     - RoleRedirect (determines destination)
  /dashboard
    /free               - Free user dashboard
    /member             - Paid member dashboard
  /weekly-glance        - Main learning page
  /leaderboard          - Learner leaderboard (restrictMentor)
  /impact               - Impact logging (restrictMentor)
  ...
```

### 7. Onboarding System

#### Status Check Utility

```typescript
needsOnboarding(profile): boolean
hasCompletedOnboarding(profile): boolean
getOnboardingStatus(profile): 'complete' | 'skipped' | 'incomplete'
```

#### Welcome Page

- Shows onboarding steps
- "Get Started" button → sets `onboardingComplete: true`
- "Skip for now" button → sets `onboardingSkipped: true`
- Both actions redirect to role-based landing page

### 8. Password Change Flow

#### PasswordChangeModal Component

- Blocks all navigation when `mustChangePassword === true`
- Validates password strength (min 6 characters)
- Confirms password match
- Updates Firebase Auth password
- Updates `mustChangePassword: false` in Firestore
- Triggers role-based redirect on success

### 9. Account Status Management

#### Status Values

- **active** - Full access to all features
- **inactive** - Cannot log in, redirected to `/login`
- **pending** - Awaiting approval (could show pending page)
- **suspended** - Cannot log in, redirected to `/suspended`

#### Real-Time Monitoring

The AuthContext includes a real-time listener that monitors account status changes and auto-logs out users if their status changes to inactive or suspended.

### 10. Firebase Security Rules

Enhanced rules provide:

- Users can read their own profile
- Users cannot change their own role
- Admins can read profiles in their assigned organizations
- Super admins can read all profiles
- Organization-scoped access control
- Custom claims validation support
- Account status enforcement at database level

Key functions:
```javascript
function isSuperAdmin()
function isAdmin()
function canAccessOrganization(orgCode)
function isActiveAccount()
```

## Usage Examples

### Check Role in Component

```typescript
import { useAuth } from '@/hooks/useAuth'

function MyComponent() {
  const { isAdmin, isSuperAdmin, canAccessOrganization } = useAuth()
  
  if (isSuperAdmin) {
    // Show super admin features
  }
  
  if (isAdmin && canAccessOrganization('org-123')) {
    // Show org-specific admin features
  }
}
```

### Protect a Route

```typescript
<Route
  path="/admin/users"
  element={
    <ProtectedRoute requireAdmin requireOrganization="org-123">
      <UserManagementPage />
    </ProtectedRoute>
  }
/>
```

### Update Dashboard Preferences

```typescript
import { useAuth } from '@/hooks/useAuth'

function SettingsPage() {
  const { updateDashboardPreferences } = useAuth()
  
  const handleSave = async () => {
    await updateDashboardPreferences({
      defaultRoute: '/app/weekly-glance',
      membershipStatus: 'paid',
    })
  }
}
```

### Check Onboarding Status

```typescript
import { needsOnboarding } from '@/utils/onboarding'
import { useAuth } from '@/hooks/useAuth'

function AppEntry() {
  const { profile } = useAuth()
  
  if (needsOnboarding(profile)) {
    return <Navigate to="/welcome" />
  }
  
  return <Dashboard />
}
```

## Testing

### Test User Creation

For each role, create test users:

```javascript
// Super Admin
{
  email: 'superadmin@test.com',
  role: 'super_admin',
  accountStatus: 'active',
  transformationTier: 'individual_free',
  assignedOrganizations: [] // Has access to all
}

// Admin
{
  email: 'admin@test.com',
  role: 'admin',
  accountStatus: 'active',
  transformationTier: 'individual_free',
  assignedOrganizations: ['org-123', 'org-456']
}

// Mentor (Corporate)
{
  email: 'mentor@test.com',
  role: 'mentor',
  accountStatus: 'active',
  transformationTier: 'corporate_member'
}

// Ambassador
{
  email: 'ambassador@test.com',
  role: 'ambassador',
  accountStatus: 'active',
  transformationTier: 'individual_free'
}
```

### Test Scenarios

1. **Login Flow**:
   - ✓ Super admin → `/super-admin/dashboard`
   - ✓ Admin → `/admin/dashboard`
   - ✓ Mentor with corporate tier → `/mentor/dashboard`
   - ✓ Ambassador → `/ambassador/dashboard`
   - ✓ Paid member → `/app/dashboard/member`
   - ✓ Free user → `/app/dashboard/free`

2. **Account Status**:
   - ✓ Inactive user cannot log in
   - ✓ Suspended user sees suspension page
   - ✓ Active user has full access

3. **Password Change**:
   - ✓ User with `mustChangePassword: true` sees modal
   - ✓ Cannot navigate until password changed
   - ✓ After change, redirects to role-based destination

4. **Onboarding**:
   - ✓ New user without onboarding → `/welcome`
   - ✓ Can complete onboarding → redirects to dashboard
   - ✓ Can skip onboarding → redirects to dashboard
   - ✓ Existing users bypass onboarding

5. **Role Changes**:
   - ✓ User upgraded to mentor → redirects on next login
   - ✓ Admin promoted to super admin → gains full access
   - ✓ Custom claims sync automatically

6. **Organization Access**:
   - ✓ Admin can only access assigned organizations
   - ✓ Super admin can access all organizations
   - ✓ Non-admins cannot access admin features

## Migration

See `scripts/migrations/README.md` for detailed migration instructions.

Quick start:
```bash
# 1. Backup database
# 2. Set environment variables
export FIREBASE_PROJECT_ID="your-project-id"

# 3. Run migration
node scripts/migrations/add-role-based-fields.mjs

# 4. Deploy security rules
firebase deploy --only firestore:rules
```

## Troubleshooting

### User Stuck in Login Loop
- Check account status is 'active'
- Verify role is valid UserRole value
- Check browser console for errors
- Verify Firebase Auth and Firestore are properly configured

### Role Not Working
- Check custom claims vs Firestore role
- Call `refreshAdminSession()` to sync
- Verify security rules allow profile read
- Check browser console for warnings

### Organization Access Denied
- Verify user has role that supports organizations (admin/super_admin)
- Check `assignedOrganizations` array includes the org code
- Super admins should have full access regardless

### Onboarding Loop
- Check `onboardingComplete` and `onboardingSkipped` flags
- Verify `/welcome` route is not in redirect loop
- Test with existing users (should skip onboarding)

## Future Enhancements

- [ ] Organization selector UI for multi-org admins
- [ ] Detailed dashboard preference customization
- [ ] Role-specific dashboard widgets
- [ ] Advanced audit logging for admin actions
- [ ] Batch user operations for admins
- [ ] Custom onboarding flows per role
- [ ] Progressive onboarding (step tracking)
