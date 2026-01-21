export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  PARTNER = 'partner',
  MENTOR = 'mentor',
  AMBASSADOR = 'ambassador',
  USER = 'user',
  FREE_USER = 'free_user',
  PAID_MEMBER = 'paid_member',
}

// Defines the set of roles that are considered "standard" and stored in Firestore.
export type StandardRole =
  | 'super_admin'
  | 'partner'
  | 'mentor'
  | 'ambassador'
  | 'user'
  | 'free_user'
  | 'paid_member';

// All possible role inputs, including legacy string values and UserRole enum values
export type AllRoles = StandardRole | UserRole | string;

export const ALL_STANDARD_ROLES: StandardRole[] = [
  'super_admin',
  'partner',
  'mentor',
  'ambassador',
  'user',
  'free_user',
  'paid_member',
];
