import { describe, expect, it } from 'vitest'
import { normalizeRole, resolveRole } from './role'

describe('role', () => {
  it('resolveRole returns null for empty input', () => {
    expect(resolveRole(null)).toBeNull()
    expect(resolveRole(undefined)).toBeNull()
    expect(resolveRole('   ')).toBeNull()
  })

  it('normalizeRole uses least-privilege fallback by default', () => {
    expect(normalizeRole(null)).toBe('user')
    expect(normalizeRole(undefined)).toBe('user')
  })

  it('normalizes legacy admin aliases to partner', () => {
    expect(resolveRole('admin')).toBe('partner')
    expect(resolveRole('company-admin')).toBe('partner')
    expect(resolveRole('administrator')).toBe('partner')
  })

  it('normalizes super admin aliases', () => {
    expect(resolveRole('superadmin')).toBe('super_admin')
    expect(resolveRole('Super Admin')).toBe('super_admin')
  })

  it('supports explicit fallback override', () => {
    expect(normalizeRole(null, 'paid_member')).toBe('paid_member')
  })
})

