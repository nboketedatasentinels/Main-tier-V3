# Fix Admin and Super Admin Login Redirect Issue

## Problem Analysis

After analyzing the authentication flow, I've identified a race condition causing Super Admin and Admin users to fail redirecting to their dashboards after login:

- `LoginPage` manually fetches the profile from Firestore and calls `navigate` immediately after login.
- `AuthContext` also fetches the profile via an `onAuthStateChanged` listener (happens asynchronously).
- When navigation to `/admin/dashboard` or `/super-admin/dashboard` occurs, `ProtectedRoute` checks `isAdmin` or `isSuperAdmin` from the auth context.
- If the `AuthContext` profile hasn't finished loading yet, the checks fail and users get redirected to unauthorized or default routes.

## Solution

The core issue is a race condition between `LoginPage`'s manual navigation and `AuthContext`'s profile loading. When Admin or Super Admin users log in, `LoginPage` navigates to `/admin/dashboard` or `/super-admin/dashboard` before `AuthContext` finishes loading the profile state. The `ProtectedRoute` then checks `isAdmin` or `isSuperAdmin` from the empty context, fails the check, and redirects away.

The fix involves synchronizing the navigation to wait for `AuthContext` profile loading completion.

### 1. Synchronize Profile Loading in `LoginPage`

- Removed duplicate profile fetching logic from `LoginPage`'s `handlePostLoginRedirect` function.
- Instead of manually fetching the profile and navigating, `LoginPage` now waits for `AuthContext` to complete profile loading.
- Added a `useEffect` hook that watches for profile loading completion after a successful login.
- Once the profile is loaded in the context, it calls `getLandingPathForRole` and navigates.

### 2. Add Loading State Management

- Added a local state variable in `LoginPage` to track the post-login navigation pending status.
- This flag is set to `true` after a successful `signIn` call.
- The `useEffect` checks if the flag is `true` AND `profileLoading` is `false` AND a `profile` exists.
- Only then is the role-based navigation performed.
- The flag is cleared after the navigation completes.

### 3. Enhance `AuthContext` Profile Synchronization

- Ensured `extractCustomClaims` is called immediately after the profile fetch in `onAuthStateChanged`.
- Added console logging to track when profile loading completes for admin roles.
- Ensured the profile state is set BEFORE `profileLoading` is set to `false`.

### 4. Update `ProtectedRoute` Admin Checks

- Added additional console logging in `ProtectedRoute` for admin role checks.
- The log shows when `requireAdmin` or `requireSuperAdmin` checks fail with the current profile state.

### 5. Add Fallback Navigation in `RoleRedirect`

- Ensured the `RoleRedirect` component properly handles admin roles.
- Added console logging for when `RoleRedirect` determines the landing path for admins.

### 6. Add Debug Logging for Troubleshooting

- Added temporary console logs in `LoginPage` showing when navigation is attempted.
- These logs help verify that the fix works correctly and identify any remaining timing issues.
