
import { UserRole, UserProfile } from '@/types';
import { getLandingPathForRole } from './routes';

describe('getLandingPathForRole', () => {
  it('should return the redirectUrl if it exists', () => {
    const path = getLandingPathForRole(UserRole.USER, null, '/some/redirect');
    expect(path).toBe('/some/redirect');
  });

  it('should return the super admin dashboard for SUPER_ADMIN role', () => {
    const path = getLandingPathForRole(UserRole.SUPER_ADMIN);
    expect(path).toBe('/super-admin/dashboard');
  });

  it('should return the admin dashboard for ADMIN role', () => {
    const path = getLandingPathForRole(UserRole.ADMIN);
    expect(path).toBe('/admin/dashboard');
  });

  it('should return the admin dashboard for COMPANY_ADMIN role', () => {
    const path = getLandingPathForRole(UserRole.COMPANY_ADMIN);
    expect(path).toBe('/admin/dashboard');
  });

  it('should return the mentor dashboard for MENTOR role', () => {
    const path = getLandingPathForRole(UserRole.MENTOR);
    expect(path).toBe('/mentor/dashboard');
  });

  it('should return the ambassador dashboard for AMBASSADOR role', () => {
    const path = getLandingPathForRole(UserRole.AMBASSADOR);
    expect(path).toBe('/ambassador/dashboard');
  });

  it('should return /welcome for a user who has not completed onboarding', () => {
    const profile = { onboardingComplete: false, onboardingSkipped: false } as UserProfile;
    const path = getLandingPathForRole(UserRole.USER, profile);
    expect(path).toBe('/welcome');
  });

  it('should return the preferred dashboard route if it exists', () => {
    const profile = {
      onboardingComplete: true,
      dashboardPreferences: { defaultRoute: '/my/custom/dashboard' },
    } as UserProfile;
    const path = getLandingPathForRole(UserRole.USER, profile);
    expect(path).toBe('/my/custom/dashboard');
  });

  it('should return the default dashboard route by membership if no preferred route', () => {
    const profile = {
      onboardingComplete: true,
      role: UserRole.PAID_MEMBER,
    } as UserProfile;
    const path = getLandingPathForRole(UserRole.PAID_MEMBER, profile);
    expect(path).toBe('/app/weekly-glance');
  });

  it('should return the free dashboard for a free user as a fallback', () => {
    const path = getLandingPathForRole(UserRole.FREE_USER);
    expect(path).toBe('/app/dashboard/free');
  });
});
