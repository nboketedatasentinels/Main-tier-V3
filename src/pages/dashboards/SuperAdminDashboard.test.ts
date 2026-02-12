import { describe, expect, it } from 'vitest'
import {
  buildDashboardSearchForNavigation,
  consumeCreateIntentFromSearch,
  resolveDashboardTabFromSearch,
} from './superAdminDashboardRouting'

describe('SuperAdminDashboard URL helpers', () => {
  describe('resolveDashboardTabFromSearch', () => {
    it('returns overview when tab is missing', () => {
      expect(resolveDashboardTabFromSearch('')).toBe('overview')
    })

    it('returns overview for unsupported tab values', () => {
      expect(resolveDashboardTabFromSearch('?tab=unknown')).toBe('overview')
    })

    it('returns supported tab from query', () => {
      expect(resolveDashboardTabFromSearch('?tab=organizations')).toBe('organizations')
    })
  })

  describe('buildDashboardSearchForNavigation', () => {
    it('sets target tab and removes create intent', () => {
      expect(buildDashboardSearchForNavigation('?tab=overview&create=true', 'organizations'))
        .toBe('?tab=organizations')
    })

    it('removes tab when navigating to overview', () => {
      expect(buildDashboardSearchForNavigation('?tab=reports', 'overview')).toBe('')
    })

    it('preserves unrelated params while removing create', () => {
      expect(buildDashboardSearchForNavigation('?foo=bar&create=true', 'users')).toBe('?foo=bar&tab=users')
    })
  })

  describe('consumeCreateIntentFromSearch', () => {
    it('removes create intent and keeps tab', () => {
      expect(consumeCreateIntentFromSearch('?tab=organizations&create=true')).toBe('?tab=organizations')
    })

    it('returns empty string when create was the only param', () => {
      expect(consumeCreateIntentFromSearch('?create=true')).toBe('')
    })
  })
})
