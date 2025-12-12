import { describe, expect, test } from 'vitest'
import { UserRole } from '@/types'
import { getSafeRole, isAdminRole, isValidUserRole, normalizeUserRole } from '../roles'

describe('normalizeUserRole', () => {
  test('handles standard enum values', () => {
    expect(normalizeUserRole(UserRole.FREE_USER)).toBe(UserRole.FREE_USER)
    expect(normalizeUserRole(UserRole.COMPANY_ADMIN)).toBe(UserRole.COMPANY_ADMIN)
    expect(normalizeUserRole(UserRole.SUPER_ADMIN)).toBe(UserRole.SUPER_ADMIN)
  })

  test('normalizes admin variants with different casing', () => {
    expect(normalizeUserRole('Admin')).toBe(UserRole.COMPANY_ADMIN)
    expect(normalizeUserRole('company administrator')).toBe(UserRole.COMPANY_ADMIN)
    expect(normalizeUserRole('SUPER ADMIN')).toBe(UserRole.SUPER_ADMIN)
    expect(normalizeUserRole('Super-Administrator')).toBe(UserRole.SUPER_ADMIN)
  })

  test('falls back to detecting admin keywords', () => {
    expect(normalizeUserRole('super company admin')).toBe(UserRole.SUPER_ADMIN)
    expect(normalizeUserRole('team admin user')).toBe(UserRole.COMPANY_ADMIN)
  })

  test('returns null for unknown roles', () => {
    expect(normalizeUserRole('unknown')).toBeNull()
    expect(normalizeUserRole(undefined)).toBeNull()
    expect(normalizeUserRole(null)).toBeNull()
  })
})

describe('role helpers', () => {
  test('isValidUserRole verifies normalization works', () => {
    expect(isValidUserRole('Ambassador')).toBe(true)
    expect(isValidUserRole('super leader')).toBe(false)
  })

  test('isAdminRole checks both admin types', () => {
    expect(isAdminRole(UserRole.SUPER_ADMIN)).toBe(true)
    expect(isAdminRole('company-admin')).toBe(true)
    expect(isAdminRole(UserRole.MENTOR)).toBe(false)
  })

  test('getSafeRole returns null for invalid roles', () => {
    expect(getSafeRole('not-a-role')).toBeNull()
    expect(getSafeRole('super_admin')).toBe(UserRole.SUPER_ADMIN)
  })
})
