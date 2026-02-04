import { describe, expect, it } from 'vitest'
import { resolveEffectiveOrganization, resolveEffectiveRole } from './authz'

describe('authz', () => {
  it('prefers claimsRole over profileRole', () => {
    expect(resolveEffectiveRole({ claimsRole: 'super_admin', profileRole: 'user' })).toEqual({
      role: 'super_admin',
      source: 'claims',
    })
  })

  it('falls back to profileRole when claimsRole is missing', () => {
    expect(resolveEffectiveRole({ claimsRole: null, profileRole: 'mentor' })).toEqual({
      role: 'mentor',
      source: 'profile',
    })
  })

  it('returns fallback when both are missing', () => {
    expect(resolveEffectiveRole({ claimsRole: null, profileRole: null })).toEqual({
      role: 'user',
      source: 'fallback',
    })
  })

  it('resolves organizationId with explicit priority', () => {
    expect(resolveEffectiveOrganization({ companyId: 'c1', organizationId: 'o1', companyCode: 'X' })).toEqual({
      companyId: 'c1',
      companyCode: 'X',
      organizationId: 'o1',
    })
    expect(resolveEffectiveOrganization({ companyId: 'c1', companyCode: 'X' })).toEqual({
      companyId: 'c1',
      companyCode: 'X',
      organizationId: 'c1',
    })
    expect(resolveEffectiveOrganization({ assignedOrganizations: ['a1'] })).toEqual({
      companyId: null,
      companyCode: null,
      organizationId: 'a1',
    })
  })
})

