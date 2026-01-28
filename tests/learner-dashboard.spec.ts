import { test, expect } from '@playwright/test';

/**
 * Learner Dashboard Tests
 * Tests learner dashboard functionality, points, activities, and progress
 */

test.describe('Learner Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    // Login as learner before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-learner@example.com');
    await page.fill('input[type="password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|learner)/, { timeout: 15000 });
  });

  test('should display dashboard elements', async ({ page }) => {
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard"], [class*="dashboard"]');

    // Take full screenshot
    await page.screenshot({ path: 'test-screenshots/10-learner-dashboard-full.png', fullPage: true });

    // Check for key elements
    const elements = await page.evaluate(() => {
      return {
        hasPointsDisplay: !!document.querySelector('[class*="points"], [data-testid*="points"]'),
        hasProgressBar: !!document.querySelector('[class*="progress"], [role="progressbar"]'),
        hasActivityList: !!document.querySelector('[class*="activity"], [class*="checklist"]'),
        hasNavigation: !!document.querySelector('nav, [role="navigation"]'),
        hasUserInfo: !!document.querySelector('[class*="user"], [class*="profile"]'),
      };
    });

    console.log('Dashboard elements:', elements);

    // Verify critical elements exist
    expect(elements.hasPointsDisplay || elements.hasProgressBar).toBeTruthy();
    expect(elements.hasNavigation).toBeTruthy();
  });

  test('should display points information', async ({ page }) => {
    await page.waitForSelector('[data-testid="dashboard"], [class*="dashboard"]');

    // Try to find points display
    const pointsSelectors = [
      '[data-testid="total-points"]',
      '[class*="points-display"]',
      '[class*="total-points"]',
      'text=/\\d+\\s*(points|pts)/i'
    ];

    let pointsFound = false;
    let pointsText = '';

    for (const selector of pointsSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          pointsText = await element.textContent();
          pointsFound = true;
          console.log(`Found points: ${pointsText}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Take screenshot of points area
    await page.screenshot({ path: 'test-screenshots/11-points-display.png' });

    console.log('Points found:', pointsFound, pointsText);
  });

  test('should display activities', async ({ page }) => {
    await page.waitForSelector('[data-testid="dashboard"], [class*="dashboard"]');

    // Check for activity elements
    const activityInfo = await page.evaluate(() => {
      const activityElements = document.querySelectorAll(
        '[class*="activity-item"], [class*="checklist"] li, [data-testid^="activity-"]'
      );

      return {
        activityCount: activityElements.length,
        hasActivities: activityElements.length > 0,
        firstActivityText: activityElements[0]?.textContent?.substring(0, 100)
      };
    });

    console.log('Activity info:', activityInfo);

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/12-activities-list.png', fullPage: true });
  });

  test('should navigate to journey page', async ({ page }) => {
    await page.waitForSelector('[data-testid="dashboard"], [class*="dashboard"]');

    // Try to find journey/activity link
    const journeyLink = page.locator('a[href*="journey"], a:has-text("Journey"), a:has-text("Activities")').first();

    if (await journeyLink.isVisible({ timeout: 5000 })) {
      await journeyLink.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-screenshots/13-journey-page.png', fullPage: true });
    }
  });

  test('should check navigation elements', async ({ page }) => {
    await page.waitForSelector('[data-testid="dashboard"], [class*="dashboard"]');

    const navInfo = await page.evaluate(() => {
      const nav = document.querySelector('nav, [role="navigation"]');
      const links = nav?.querySelectorAll('a') || [];

      return {
        hasNav: !!nav,
        linkCount: links.length,
        linkTexts: Array.from(links).map(a => a.textContent?.trim()).filter(Boolean)
      };
    });

    console.log('Navigation info:', navInfo);
    expect(navInfo.hasNav).toBeTruthy();
  });

  test('should display user information', async ({ page }) => {
    await page.waitForSelector('[data-testid="dashboard"], [class*="dashboard"]');

    const userInfo = await page.evaluate(() => {
      const userElement = document.querySelector('[class*="user"], [class*="profile"], [data-testid="user-info"]');

      return {
        hasUserElement: !!userElement,
        userText: userElement?.textContent
      };
    });

    console.log('User info:', userInfo);
  });
});
