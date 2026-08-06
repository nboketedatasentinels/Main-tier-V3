import { describe, expect, it } from 'vitest'
import {
  orgKeyMatches,
  resolveUserOrganizationLabel,
  userMatchesOrganizationFilter,
} from '@/utils/userOrganizationFilter'

const dsNew = { id: 'b62d465e-fabc-4466-8fa6-c4e3cba9ca24', name: 'DS-New', code: 'ORBF55' }
const jour = { id: 'e2b86eae-a03b-4cbb-afe4-5bebce38f642', name: 'Jour', code: 'OR7MKJ' }
const orgs = [dsNew, jour]

describe('userOrganizationFilter', () => {
  it('matches org keys by id or code case-insensitively', () => {
    expect(orgKeyMatches('ORBF55', dsNew)).toBe(true)
    expect(orgKeyMatches('orbf55', dsNew)).toBe(true)
    expect(orgKeyMatches(dsNew.id, dsNew)).toBe(true)
    expect(orgKeyMatches(jour.id, dsNew)).toBe(false)
  })

  it('matches learners by company id or code', () => {
    expect(
      userMatchesOrganizationFilter({ companyId: dsNew.id, companyCode: 'ORBF55' }, dsNew),
    ).toBe(true)
    expect(userMatchesOrganizationFilter({ companyCode: 'orbf55' }, dsNew)).toBe(true)
    expect(userMatchesOrganizationFilter({ companyId: jour.id }, dsNew)).toBe(false)
  })

  it('matches multi-org partners via assignedOrganizations', () => {
    const partner = {
      companyId: jour.id,
      assignedOrganizations: [jour.id, dsNew.id],
    }
    expect(userMatchesOrganizationFilter(partner, dsNew)).toBe(true)
    expect(userMatchesOrganizationFilter(partner, jour)).toBe(true)
  })

  it('does not match unrelated users', () => {
    expect(
      userMatchesOrganizationFilter(
        { companyId: jour.id, companyName: 'Jour', assignedOrganizations: [jour.id] },
        dsNew,
      ),
    ).toBe(false)
  })

  it('labels the filtered org when a multi-org partner matches the active filter', () => {
    const partner = {
      companyId: jour.id,
      companyName: null,
      assignedOrganizations: [jour.id, dsNew.id],
    }
    const label = resolveUserOrganizationLabel(partner, orgs, dsNew)
    expect(label?.name).toBe('DS-New')
    expect(label?.code).toBe('ORBF55')
  })

  it('lists all assigned orgs when no filter is active', () => {
    const partner = {
      companyId: jour.id,
      assignedOrganizations: [jour.id, dsNew.id],
    }
    const label = resolveUserOrganizationLabel(partner, orgs, null)
    expect(label?.allNames).toEqual(['Jour', 'DS-New'])
  })
})
