import { test, expect } from '@playwright/test';

/**
 * Authentication Flow Tests
 * Tests login, logout, and authentication error handling
 */

test.describe('Authentication Flows', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load login page', async ({ page }) => {
    await page.goto('/login');

    // Wait for form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/01-login-page.png', fullPage: true });
  });

  test('should show error on invalid login', async ({ page }) => {
    await page.goto('/login');

    // Fill invalid credentials
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForSelector('[class*="error"], [role="alert"]', { timeout: 10000 });

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/02-login-error.png', fullPage: true });

    // Verify error is visible
    const errorElement = page.locator('[class*="error"], [role="alert"]');
    await expect(errorElement).toBeVisible();
  });

  test('should successfully login as learner', async ({ page }) => {
    await page.goto('/login');

    // Fill valid learner credentials
    await page.fill('input[type="email"]', 'test-learner@example.com');
    await page.fill('input[type="password"]', 'testpass123');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL(/\/(dashboard|learner)/, { timeout: 15000 });

    // Verify dashboard loaded
    await page.waitForSelector('[data-testid="dashboard"], [class*="dashboard"]', { timeout: 10000 });

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/03-learner-logged-in.png', fullPage: true });

    // Verify URL changed
    expect(page.url()).not.toContain('/login');
  });

  test('should successfully logout', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-learner@example.com');
    await page.fill('input[type="password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|learner)/, { timeout: 15000 });

    // Find and click logout
    const logoutButton = page.locator('[data-testid="logout"], button:has-text("Logout"), [aria-label="Logout"]').first();
    await logoutButton.click();

    // Wait for redirect to login
    await page.waitForURL(/\/login/, { timeout: 10000 });

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/04-after-logout.png', fullPage: true });

    // Verify we're on login page
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('should successfully login as partner', async ({ page }) => {
    await page.goto('/login');

    // Fill valid partner credentials
    await page.fill('input[type="email"]', 'test-partner@example.com');
    await page.fill('input[type="password"]', 'testpass123');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation to partner dashboard
    await page.waitForURL(/\/partner/, { timeout: 15000 });

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/05-partner-logged-in.png', fullPage: true });
  });

  test('should have forgot password link', async ({ page }) => {
    await page.goto('/login');

    const forgotLink = page.locator('a[href*="forgot"], a[href*="reset"]');
    await expect(forgotLink).toBeVisible();
  });
});
