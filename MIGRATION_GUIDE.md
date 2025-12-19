# Role Normalization Migration Guide

This guide helps developers update code that uses role-related utilities to use the new centralized role normalization system.

## Overview

**Old System**: Two different normalization functions in separate files
- `normalizeRole()` in `roleRouting.ts` (simple uppercase)
- `normalizeUserRole()` in `roles.ts` (converts to UserRole enum)

**New System**: Single source of truth in `role.ts`
- `normalizeRole()` - Normalize to uppercase string for comparison
- `toUserRole()` - Convert to UserRole enum
- Helper functions for common checks

## Migration Steps

### 1. Update Imports

**Before:**
```typescript
import { normalizeUserRole } from '@/utils/roles'
import { normalizeRole } from '@/utils/roleRouting'
```

**After:**
```typescript
import { normalizeRole, toUserRole } from '@/utils/role'
```

### 2. Replace normalizeUserRole Usage

**Before:**
```typescript
const role = normalizeUserRole(profile?.role)
if (role === UserRole.ADMIN) {
  // ...
}
```

**After:**
```typescript
const role = toUserRole(profile?.role)
if (role === UserRole.ADMIN) {
  // ...
}
```

### 3. Use Helper Functions

**Before:**
```typescript
const isAdmin = 
  profile.role === UserRole.ADMIN || 
  profile.role === UserRole.COMPANY_ADMIN || 
  profile.role === UserRole.SUPER_ADMIN
```

**After:**
```typescript
import { isAdminRole } from '@/utils/role'
const isAdmin = isAdminRole(profile.role)
```

### 4. Compare Roles Consistently

**Before:**
```typescript
if (role.toUpperCase() === 'ADMIN') {
  // ...
}
```

**After:**
```typescript
import { normalizeRole } from '@/utils/role'
if (normalizeRole(role) === 'ADMIN') {
  // ...
}
```

Or use the helper:
```typescript
import { rolesMatch } from '@/utils/role'
if (rolesMatch(role, 'ADMIN')) {
  // ...
}
```

## Available Functions

### normalizeRole(role: unknown): string
Converts any role value to uppercase with underscores for comparison.

```typescript
normalizeRole('admin') // 'ADMIN'
normalizeRole(UserRole.ADMIN) // 'ADMIN'
normalizeRole('super-admin') // 'SUPER_ADMIN'
```

### toUserRole(role?: string | UserRole | null): UserRole | null
Converts a string to UserRole enum, handling variations.

```typescript
toUserRole('admin') // UserRole.ADMIN
toUserRole('super-admin') // UserRole.SUPER_ADMIN
toUserRole('invalid') // null
```

### isAdminRole(role: unknown): boolean
Checks if role is any admin type (ADMIN, COMPANY_ADMIN, or SUPER_ADMIN).

```typescript
isAdminRole(UserRole.ADMIN) // true
isAdminRole(UserRole.SUPER_ADMIN) // true
isAdminRole(UserRole.MENTOR) // false
```

### isSuperAdminRole(role: unknown): boolean
Checks if role is specifically super admin.

```typescript
isSuperAdminRole(UserRole.SUPER_ADMIN) // true
isSuperAdminRole(UserRole.ADMIN) // false
```

### rolesMatch(role1: unknown, role2: unknown): boolean
Compares two roles after normalization.

```typescript
rolesMatch('admin', UserRole.ADMIN) // true
rolesMatch('super-admin', 'SUPER_ADMIN') // true
```

## Common Patterns

### Pattern: Check if User is Admin
```typescript
import { isAdminRole } from '@/utils/role'
const { profile } = useAuth()

if (isAdminRole(profile?.role)) {
  // Show admin features
}
```

### Pattern: Route Based on Role
```typescript
import { normalizeRole } from '@/utils/role'

const handleRoleBasedNavigation = (role: unknown) => {
  const normalized = normalizeRole(role)
  
  switch (normalized) {
    case 'SUPER_ADMIN':
      navigate('/super-admin/dashboard')
      break
    case 'ADMIN':
    case 'COMPANY_ADMIN':
      navigate('/admin/dashboard')
      break
    case 'MENTOR':
      navigate('/mentor/dashboard')
      break
    default:
      navigate('/app/dashboard/free')
  }
}
```

### Pattern: Convert String to Enum
```typescript
import { toUserRole } from '@/utils/role'

const role = toUserRole('admin')
if (role) {
  // role is UserRole.ADMIN
}
```

### Pattern: Protected Route Check
```typescript
import { normalizeRole } from '@/utils/role'

const checkAccess = (userRole: unknown, allowedRoles: unknown[]) => {
  const normalized = normalizeRole(userRole)
  return allowedRoles.some(allowed => 
    normalizeRole(allowed) === normalized
  )
}
```

## Files That Need Migration

The following files currently import from deprecated `roles.ts`:

1. **src/utils/dashboardPaths.ts**
   - Uses: `normalizeUserRole`
   - Action: Change to `toUserRole` from `role.ts`

2. **src/routes/RequireRole.tsx**
   - Uses: `normalizeUserRole`
   - Action: Change to `toUserRole` from `role.ts`

3. Any custom code that imports from `roles.ts` or `roleRouting.ts`
   - Action: Update to use `role.ts`

## Backward Compatibility

The old `roles.ts` file is maintained as a compatibility wrapper:

```typescript
// roles.ts
import { toUserRole as convertToUserRole } from './role'

/**
 * @deprecated Use toUserRole from @/utils/role instead
 */
export const normalizeUserRole = convertToUserRole
```

This means existing code will continue to work, but:
- You should migrate to the new imports
- The old file may be removed in the future
- IDE may show deprecation warnings

## Testing After Migration

After updating imports, verify:

1. **Build passes**: `npm run build` completes without errors
2. **Role comparisons work**: Check logs for role-based decisions
3. **Routing works**: Test all role-based redirects
4. **Guards work**: Test ProtectedRoute with various roles

## Breaking Changes

There are NO breaking changes. The old functions still work through the compatibility layer.

However, be aware:
- `normalizeRole` output format is UPPERCASE (no change from before)
- `toUserRole` returns `UserRole | null` (same as old `normalizeUserRole`)
- Helper functions are new, not replacements

## Questions?

If you encounter issues during migration:

1. Check that imports are from `@/utils/role` not `@/utils/roles`
2. Verify role comparisons use normalized values
3. Check TypeScript errors for type mismatches
4. Review ROLE_BASED_AUTH.md for system overview

## Example: Complete Migration

**Before (Old Code):**
```typescript
import { normalizeUserRole } from '@/utils/roles'
import { UserRole } from '@/types'

export const checkAdminAccess = (role?: UserRole | string | null) => {
  const normalized = normalizeUserRole(role)
  return (
    normalized === UserRole.ADMIN ||
    normalized === UserRole.COMPANY_ADMIN ||
    normalized === UserRole.SUPER_ADMIN
  )
}
```

**After (New Code):**
```typescript
import { isAdminRole } from '@/utils/role'

export const checkAdminAccess = (role?: unknown) => {
  return isAdminRole(role)
}
```

Much cleaner! 🎉
