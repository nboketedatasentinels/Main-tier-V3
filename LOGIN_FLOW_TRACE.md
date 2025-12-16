# Login Flow Trace with Comprehensive Logging

## Overview
This document describes the complete login flow with detailed logging at each step to trace user data from Firebase authentication through profile loading to final dashboard selection.

## Flow Steps with Logging

### 1. User Submits Login Form
**File**: `src/pages/auth/LoginPage.tsx`
**Function**: `handleLogin()`

**Logs**:
- 🔴 `LoginPage: handleLogin called` - Shows email being used
- 🔴 `LoginPage: Calling signIn...` - Before Firebase auth call
- 🔴 `LoginPage: signIn returned` - Shows error if any
- 🔴 `LoginPage: Sign in successful, waiting for AuthContext to update...` - After successful auth

**User Data**: Email only at this point

---

### 2. Firebase Authentication
**File**: `src/contexts/AuthContext.tsx`
**Function**: `signIn()`

**Logs**:
- 🟡 `AuthContext.signIn: Calling Firebase signInWithEmailAndPassword` - Shows email
- 🟡 `AuthContext.signIn: Firebase auth successful` - Auth completed
- 🟡 `AuthContext.signIn: Firebase auth failed` - If error occurs

**User Data**: Firebase User object created (uid, email)

---

### 3. Auth State Change Detection
**File**: `src/contexts/AuthContext.tsx`
**Function**: `onAuthStateChanged` listener

**Logs**:
- 🟠 `AuthContext: Setting up onAuthStateChanged listener` - Initial setup
- 🟠 `AuthContext: onAuthStateChanged triggered` - Shows user uid and email
- 🟠 `AuthContext: User detected, starting profile load...` - Profile fetch begins
- 🟠 `AuthContext: Extracting custom claims...` - Custom claims extraction
- 🟠 `AuthContext: Fetching profile from Firestore...` - Before Firestore query

**User Data**: 
- Firebase User: uid, email
- Custom claims (if any)

---

### 4. Profile Fetch from Firestore
**File**: `src/contexts/AuthContext.tsx`
**Function**: `fetchOrCreateProfile()`

**Logs**:
- 🟣 `fetchOrCreateProfile: Starting for user` - Shows uid and email
- 🟣 `fetchOrCreateProfile: Firestore document check` - Whether profile exists
- 🟣 `fetchOrCreateProfile: Profile found in Firestore` - Full profile data logged:
  - id
  - email
  - **role** (the raw value from Firestore)
  - roleType (typeof role)
  - fullName
  - onboardingComplete
  - transformationTier
- 🟣 `fetchOrCreateProfile: Remapping "partner" to UserRole.COMPANY_ADMIN` - If role is "partner"
- 🟣 `fetchOrCreateProfile: After remap, role is:` - Role after remapping
- 🟣 `fetchOrCreateProfile: Returning profile with role:` - Final role value
- 🟣 `fetchOrCreateProfile: No profile found, creating new one` - If no profile exists
- 🟣 `fetchOrCreateProfile: Creating new profile with role:` - For new users

**User Data**: Complete UserProfile object including:
- id, email, firstName, lastName, fullName
- **role** (this is the key field)
- totalPoints, level
- onboardingComplete, onboardingSkipped
- transformationTier
- dashboardPreferences
- All other profile fields

---

### 5. Profile State Update
**File**: `src/contexts/AuthContext.tsx`
**Function**: `onAuthStateChanged` callback continuation

**Logs**:
- 🟠 `AuthContext: Profile fetched` - Shows complete profile object
- 🟠 `AuthContext: Profile loading complete, profileLoading set to false` - State update
- 🟠 `AuthContext: Admin user detected` - For admin/super_admin roles specifically

**User Data**: Profile set in React state, accessible via useAuth() hook

---

### 6. LoginPage Detects Profile Load
**File**: `src/pages/auth/LoginPage.tsx`
**Function**: `useEffect` hook (lines 30-49)

**Logs**:
- 🔵 `LoginPage useEffect triggered` - Shows:
  - user: { uid, email }
  - profile: { id, email, role, fullName }
  - profileLoading: boolean
  - condition: whether redirect will happen
- 🟢 `LoginPage: Calculating landing path` - Shows:
  - role: The role value
  - redirectUrl: Any query parameter
  - profileData: Full profile object

**User Data**: Both user and profile objects available

---

### 7. Role Normalization
**File**: `src/utils/role.ts`
**Function**: `normalizeRole()`

**Logs**:
- 🔶 `normalizeRole: Input role:` - Shows role and its type
- 🔶 `normalizeRole: After normalization:` - Lowercase, underscore format
- 🔶 `normalizeRole: Mapped to:` - Final normalized role

**Role Mappings**:
- "partner" → "partner"
- "super_admin" → "super_admin"
- "mentor" → "mentor"
- "ambassador" → "ambassador"
- "paid_member" → "paid_member"
- "free_user" → "free_user"

---

### 8. Landing Path Calculation
**File**: `src/utils/roleRouting.ts`
**Function**: `getLandingPathForRole()`

**Logs**:
- 🔷 `getLandingPathForRole called with:` - Shows:
  - role: Raw role value
  - roleType: typeof role
  - profile: Complete profile object
  - redirectUrl: Query parameter if any
- 🔷 `getLandingPathForRole: Normalized role:` - After normalizeRole()
- 🔷 `getLandingPathForRole: Matched [role type]` - Which condition matched
- 🔷 `getLandingPathForRole: [various conditions]` - For mentor/regular user logic

**Path Selection Logic**:
1. **redirectUrl**: If provided, use it
2. **super_admin**: → `/super-admin/dashboard`
3. **partner**: → `/admin/dashboard`
4. **mentor**: → `/mentor/dashboard` (with tier checks)
5. **ambassador**: → `/ambassador/dashboard`
6. **Regular users**: Check onboarding, preferences, then membership
7. **Fallback**: → `/app/dashboard/free`

---

### 9. Navigation
**File**: `src/pages/auth/LoginPage.tsx`
**Function**: `useEffect` continuation

**Logs**:
- 🎯 `LoginPage: Navigating to:` - Final destination path

**User Data**: Navigation occurs with full user and profile context

---

## Key Data Points to Watch

### For Admin Users (company_admin/super_admin):

1. **Firestore role value**: Should be "partner" for company_admin, "super_admin" for super admin
2. **After fetchOrCreateProfile**: 
   - For "partner": Should be remapped to UserRole.COMPANY_ADMIN (which equals "partner")
   - For "super_admin": Stays as "super_admin"
3. **normalizeRole output**:
   - "partner" → "partner"
   - "super_admin" → "super_admin"
4. **Expected paths**:
   - partner → `/admin/dashboard`
   - super_admin → `/super-admin/dashboard`

### Console Log Colors:
- 🔴 Red: LoginPage handleLogin
- 🟡 Yellow: AuthContext signIn
- 🟠 Orange: AuthContext onAuthStateChanged
- 🟣 Purple: fetchOrCreateProfile
- 🔵 Blue: LoginPage useEffect
- 🟢 Green: Path calculation start
- 🔶 Orange diamond: normalizeRole
- 🔷 Blue diamond: getLandingPathForRole
- 🎯 Target: Final navigation

## How to Use

1. Open browser console
2. Log in with an admin user
3. Watch the console logs in sequence
4. Look for the 🟣 and 🔷 logs specifically - these show the role at critical points
5. Verify the role value is correct at each stage
6. Confirm the final path 🎯 matches the expected dashboard

## Troubleshooting

If admin users are going to wrong dashboard:

1. **Check 🟣 logs**: Is the role in Firestore correct? ("partner" or "super_admin")
2. **Check 🔶 logs**: Is normalizeRole returning the right value?
3. **Check 🔷 logs**: Is getLandingPathForRole matching the correct condition?
4. **Check 🎯 log**: Is the final path correct?

The logs will pinpoint exactly where the issue occurs in the flow.
