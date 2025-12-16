# Fix Admin and Super Admin Login Redirect Issue

## Problem Analysis

After analyzing the authentication flow, I've identified a race condition causing Super Admin and Admin users to fail redirecting to their dashboards after login:

- `LoginPage` was trying to manually redirect the user after login.
- `RoleRedirect.tsx` was also trying to redirect the user based on their role.
- These two components were racing, leading to unpredictable behavior.

## Solution

The core issue was a race condition between `LoginPage`'s manual navigation and `RoleRedirect.tsx`.

The fix was to simplify the login flow and make `RoleRedirect.tsx` the single source of truth for post-login redirection.

### 1. Simplify `LoginPage.tsx`

- All navigation logic has been removed from `LoginPage.tsx`.
- The `handleLogin` function now only calls `signIn` and shows a toast message.
- After a successful sign-in, the `onAuthStateChanged` listener in `AuthContext` fires, which in turn triggers `RoleRedirect.tsx` to perform the correct redirection.

### 2. Rely on `RoleRedirect.tsx`

- `RoleRedirect.tsx` now handles all post-login redirection logic.
- It waits for the user's profile to be loaded in `AuthContext`, and then uses `getLandingPathForRole` to determine the correct dashboard and navigate the user.

This approach eliminates the race condition and provides a much cleaner and more reliable authentication flow.