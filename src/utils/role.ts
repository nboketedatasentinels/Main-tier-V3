// utils/role.ts

export type StandardRole = 'super_admin' | 'partner' | 'mentor' | 'ambassador' | 'team_leader' | 'user';

export type LegacyRole = 'company_admin' | 'admin' | 'free_user' | 'paid_member';

export type AllRoles = StandardRole | LegacyRole;

/**
 * Normalizes a given role string to a StandardRole.
 *
 * @param role The role string to normalize.
 * @returns The normalized StandardRole.
 */
export function normalizeRole(role: AllRoles | string | null | undefined): StandardRole {
  if (typeof role !== 'string') {
    return 'user'; // Default role for null/undefined or non-string inputs
  }

  const lowerCaseRole = role.toLowerCase();

  switch (lowerCaseRole) {
    case 'company_admin':
    case 'admin':
      return 'partner';
    case 'free_user':
    case 'paid_member':
      return 'user';
    case 'super_admin':
    case 'partner':
    case 'mentor':
    case 'ambassador':
    case 'team_leader':
    case 'user':
      return lowerCaseRole as StandardRole;
    default:
      console.warn(`Unknown role "${role}" normalized to "user".`);
      return 'user';
  }
}