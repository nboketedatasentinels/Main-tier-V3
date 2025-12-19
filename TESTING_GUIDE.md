# Role-Based Login Redirect Testing Guide

This document provides a comprehensive testing checklist for the role-based login redirect system.

## Prerequisites

Before testing, ensure you have test accounts for each role type:
- Super Admin
- Admin
- Company Admin
- Mentor (with corporate tier)
- Mentor (with individual tier)
- Ambassador
- Paid Member
- Free User (with complete onboarding)
- Free User (without complete onboarding)

## Test Scenarios

### 1. Super Admin Login Flow

**Test**: Super admin user logs in
- [ ] Navigate to `/login`
- [ ] Enter super admin credentials
- [ ] Click "Sign In"
- [ ] **Expected**: Redirect to `/super-admin/dashboard`
- [ ] **Expected**: No stops at learner dashboards
- [ ] **Expected**: SuperAdminDashboard component renders

**Test**: Super admin navigates to `/app`
- [ ] While logged in as super admin, navigate to `/app`
- [ ] **Expected**: Redirect to `/super-admin/dashboard`

**Test**: Super admin access to other dashboards
- [ ] Navigate to `/admin/dashboard`
- [ ] **Expected**: Access granted (super admins can access admin areas)

### 2. Admin Login Flow

**Test**: Admin user logs in
- [ ] Navigate to `/login`
- [ ] Enter admin credentials (role = 'admin')
- [ ] Click "Sign In"
- [ ] **Expected**: Redirect to `/admin/dashboard`
- [ ] **Expected**: CompanyAdminDashboard component renders
- [ ] **Expected**: NO error message about "No admin dashboard available"

**Test**: Admin navigates to `/app`
- [ ] While logged in as admin, navigate to `/app`
- [ ] **Expected**: Redirect to `/admin/dashboard`

**Test**: Admin access restrictions
- [ ] Navigate to `/super-admin/dashboard`
- [ ] **Expected**: Redirect to `/unauthorized`

### 3. Company Admin Login Flow

**Test**: Company admin user logs in
- [ ] Navigate to `/login`
- [ ] Enter company admin credentials (role = 'company_admin')
- [ ] Click "Sign In"
- [ ] **Expected**: Redirect to `/admin/dashboard`
- [ ] **Expected**: CompanyAdminDashboard component renders

**Test**: Company admin navigates to `/app`
- [ ] While logged in as company admin, navigate to `/app`
- [ ] **Expected**: Redirect to `/admin/dashboard`

### 4. Mentor Login Flow (Corporate Tier)

**Test**: Mentor with corporate tier logs in
- [ ] Navigate to `/login`
- [ ] Enter mentor credentials with transformationTier = 'corporate_member' or 'corporate_leader'
- [ ] Click "Sign In"
- [ ] **Expected**: Redirect to `/mentor/dashboard`
- [ ] **Expected**: MentorDashboard component renders

**Test**: Mentor navigates to `/app`
- [ ] While logged in as corporate mentor, navigate to `/app`
- [ ] **Expected**: Redirect to `/mentor/dashboard`

**Test**: Mentor restrictions on learner routes
- [ ] Navigate to `/app/leaderboard`
- [ ] **Expected**: Redirect to `/mentor/dashboard`
- [ ] Navigate to `/app/impact`
- [ ] **Expected**: Redirect to `/mentor/dashboard`

### 5. Mentor Login Flow (Individual Tier)

**Test**: Mentor with individual tier logs in
- [ ] Navigate to `/login`
- [ ] Enter mentor credentials with transformationTier = 'individual_free' or 'individual_paid'
- [ ] Click "Sign In"
- [ ] **Expected**: Redirect to preferredDashboardRoute OR `/mentor/dashboard`

### 6. Ambassador Login Flow

**Test**: Ambassador user logs in
- [ ] Navigate to `/login`
- [ ] Enter ambassador credentials
- [ ] Click "Sign In"
- [ ] **Expected**: Redirect to `/ambassador/dashboard`
- [ ] **Expected**: AmbassadorDashboard component renders

**Test**: Ambassador navigates to `/app`
- [ ] While logged in as ambassador, navigate to `/app`
- [ ] **Expected**: Redirect to `/ambassador/dashboard`

### 7. Paid Member Login Flow

**Test**: Paid member logs in (onboarding complete)
- [ ] Navigate to `/login`
- [ ] Enter paid member credentials with onboardingComplete = true
- [ ] Click "Sign In"
- [ ] **Expected**: Redirect to preferredDashboardRoute OR `/app/weekly-glance` OR `/app/dashboard/member`

**Test**: Paid member navigates to `/app/dashboard`
- [ ] Navigate to `/app/dashboard`
- [ ] **Expected**: Redirect to `/app/dashboard/member`

### 8. Free User Login Flow (Onboarding Complete)

**Test**: Free user logs in (onboarding complete)
- [ ] Navigate to `/login`
- [ ] Enter free user credentials with onboardingComplete = true
- [ ] Click "Sign In"
- [ ] **Expected**: Redirect to preferredDashboardRoute OR `/app/weekly-glance` OR `/app/dashboard/free`

**Test**: Free user navigates to `/app/dashboard`
- [ ] Navigate to `/app/dashboard`
- [ ] **Expected**: Redirect to `/app/dashboard/free`

### 9. New User Login Flow (Onboarding Incomplete)

**Test**: New user logs in (needs onboarding)
- [ ] Navigate to `/login`
- [ ] Enter new user credentials with onboardingComplete = false and onboardingSkipped = false
- [ ] Click "Sign In"
- [ ] **Expected**: Redirect to `/welcome`

**Test**: Complete onboarding
- [ ] Click "Get Started" on welcome page
- [ ] **Expected**: onboardingComplete set to true
- [ ] **Expected**: Redirect to appropriate dashboard

**Test**: Skip onboarding
- [ ] Click "Skip for now" on welcome page
- [ ] **Expected**: onboardingSkipped set to true
- [ ] **Expected**: Redirect to appropriate dashboard

### 10. Account Status Tests

**Test**: Inactive account login
- [ ] Set user accountStatus = 'inactive'
- [ ] Attempt to log in
- [ ] **Expected**: Stay on `/login` with error message
- [ ] **Expected**: Toast: "Account is inactive. Please contact support."

**Test**: Suspended account login
- [ ] Set user accountStatus = 'suspended'
- [ ] Attempt to log in
- [ ] **Expected**: Redirect to `/suspended`
- [ ] **Expected**: Toast: "Account has been suspended. Please contact support."

### 11. Password Change Flow

**Test**: User with mustChangePassword flag
- [ ] Set user mustChangePassword = true
- [ ] Log in
- [ ] **Expected**: PasswordChangeModal appears
- [ ] **Expected**: Cannot navigate until password changed
- [ ] Enter new password
- [ ] Click "Change Password"
- [ ] **Expected**: mustChangePassword set to false
- [ ] **Expected**: Redirect to role-based landing page

### 12. Redirect URL Parameter Tests

**Test**: Login with redirectUrl parameter
- [ ] Navigate to `/login?redirectUrl=/app/profile`
- [ ] Log in with any role
- [ ] **Expected**: Redirect to `/app/profile`

**Test**: Payment flow redirect
- [ ] Navigate to `/login?redirectUrl=/upgrade`
- [ ] Log in
- [ ] **Expected**: Redirect to `/upgrade`

### 13. Direct URL Access Tests

**Test**: Admin accessing learner dashboard
- [ ] Log in as admin
- [ ] Navigate directly to `/app/dashboard/free`
- [ ] **Expected**: Blocked by ProtectedRoute OR redirected to `/unauthorized`

**Test**: Free user accessing admin dashboard
- [ ] Log in as free user
- [ ] Navigate directly to `/admin/dashboard`
- [ ] **Expected**: Redirect to `/unauthorized`

**Test**: Non-super-admin accessing super admin dashboard
- [ ] Log in as admin
- [ ] Navigate directly to `/super-admin/dashboard`
- [ ] **Expected**: Redirect to `/unauthorized`

### 14. ProtectedRoute Tests

**Test**: requireSuperAdmin flag
- [ ] Routes with requireSuperAdmin prop
- [ ] **Expected**: Only super admins can access
- [ ] **Expected**: Others redirect to `/unauthorized`

**Test**: requireAdmin flag
- [ ] Routes with requireAdmin prop
- [ ] **Expected**: Super admins, admins, and company admins can access
- [ ] **Expected**: Others redirect to `/unauthorized`

**Test**: restrictMentor flag
- [ ] Routes with restrictMentor prop
- [ ] **Expected**: Mentors redirect to `/mentor/dashboard`
- [ ] **Expected**: Others can access normally

## Edge Cases

### Test: Profile Missing
- [ ] User authenticated but no Firestore profile
- [ ] **Expected**: Redirect to `/auth/profile-missing`

### Test: Role Missing
- [ ] User profile exists but role field is null/undefined
- [ ] **Expected**: Redirect to `/auth/profile-missing`

### Test: Invalid Role
- [ ] User profile has invalid role string
- [ ] **Expected**: System handles gracefully, uses normalizeRole

## Regression Tests

### Test: DashboardRouter Fix
- [ ] Log in as admin
- [ ] Verify NOT redirected to `/app/dashboard/free`
- [ ] Verify landing at `/admin/dashboard`
- [ ] **This was the critical bug - must pass**

### Test: Existing Learner Flows Still Work
- [ ] Log in as free user
- [ ] Verify `/app/dashboard/free` works
- [ ] Navigate through learner features
- [ ] **Expected**: No regressions in learner experience

## Browser Testing

Test the above scenarios in:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

## Mobile Testing

Test key scenarios on mobile devices:
- [ ] Login flows work correctly
- [ ] Redirects work on mobile
- [ ] No navigation issues

## Performance Tests

- [ ] Login with various roles completes in < 2 seconds
- [ ] No infinite redirect loops
- [ ] No console errors during redirect
- [ ] Token refresh works without user action

## Checklist Summary

### Critical Tests (Must Pass)
- [ ] Admin login → `/admin/dashboard` (NOT `/app/dashboard/free`)
- [ ] Super admin login → `/super-admin/dashboard`
- [ ] ProtectedRoute requireAdmin allows all admin types
- [ ] Onboarding flow works for new users
- [ ] Account status checks prevent inactive/suspended users

### Important Tests (Should Pass)
- [ ] Mentor routing based on transformation tier
- [ ] Ambassador routing works correctly
- [ ] Password change flow works
- [ ] Redirect URL parameter honored

### Nice to Have Tests (Can be deferred)
- [ ] Mobile experience smooth
- [ ] All edge cases handled gracefully
- [ ] Performance metrics acceptable

## Bug Reporting

If any test fails, report with:
1. User role and profile data
2. Expected behavior
3. Actual behavior
4. Console errors (if any)
5. Network tab errors (if any)
6. Steps to reproduce

## Notes

- The key fix was in DashboardRouter - it now checks if landing path starts with `/app/dashboard/` before defaulting
- Admin roles (ADMIN, COMPANY_ADMIN, SUPER_ADMIN) now route correctly to their dashboards
- Role normalization is centralized in `/src/utils/role.ts`
