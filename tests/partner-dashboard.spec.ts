import { test, expect } from '@playwright/test';

/**
 * Partner Dashboard Tests
 * Tests partner dashboard functionality, user management, and approvals
 */

test.describe('Partner Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    // Login as partner before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-partner@example.com');
    await page.fill('input[type="password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/partner/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/partner/);
  });

  test('should display partner dashboard', async ({ page }) => {
    await page.waitForSelector('[data-testid="partner-dashboard"], [class*="partner"]', { timeout: 10000 });

    // Take full screenshot
    await page.screenshot({ path: 'test-screenshots/20-partner-dashboard-full.png', fullPage: true });

    const dashboardInfo = await page.evaluate(() => {
      return {
        hasUserList: !!document.querySelector('table, [class*="user-list"], [data-testid="learners-table"]'),
        userCount: document.querySelectorAll('table tbody tr, [class*="user-row"]').length,
        hasOrgInfo: !!document.querySelector('[class*="organization"], [data-testid="org-info"]'),
        hasMetrics: !!document.querySelector('[class*="metric"], [class*="stat"]'),
        hasCharts: !!document.querySelector('canvas, svg[class*="chart"]'),
      };
    });

    console.log('Partner dashboard info:', dashboardInfo);
    expect(dashboardInfo.hasUserList || dashboardInfo.hasOrgInfo || dashboardInfo.hasMetrics).toBeTruthy();
  });

  test('should display organization information', async ({ page }) => {
    await page.waitForSelector('[data-testid="partner-dashboard"], [class*="partner"]');

    const orgInfo = await page.evaluate(() => {
      const orgElement = document.querySelector('[class*="organization"], [data-testid="org-info"]');

      return {
        hasOrgElement: !!orgElement,
        orgText: orgElement?.textContent?.substring(0, 200)
      };
    });

    console.log('Organization info:', orgInfo);
    expect(orgInfo.hasOrgElement).toBeTruthy();

    await page.screenshot({ path: 'test-screenshots/21-organization-info.png' });
  });

  test('should display learner list', async ({ page }) => {
    await page.waitForSelector('[data-testid="partner-dashboard"], [class*="partner"]');

    // Look for user/learner table or list
    const userListInfo = await page.evaluate(() => {
      const table = document.querySelector('table');
      const rows = document.querySelectorAll('table tbody tr, [class*="user-row"]');

      return {
        hasTable: !!table,
        rowCount: rows.length,
        headers: Array.from(table?.querySelectorAll('th') || []).map(th => th.textContent?.trim())
      };
    });

    console.log('Learner list info:', userListInfo);
    expect(userListInfo.hasTable || userListInfo.rowCount > 0).toBeTruthy();

    await page.screenshot({ path: 'test-screenshots/22-learner-list.png', fullPage: true });
  });

  test('should test search functionality if available', async ({ page }) => {
    await page.waitForSelector('[data-testid="partner-dashboard"], [class*="partner"]');

    // Try to find search input
    const searchSelectors = [
      'input[placeholder*="search" i]',
      'input[type="search"]',
      '[data-testid="search-input"]'
    ];

    let searchFound = false;

    for (const selector of searchSelectors) {
      try {
        const searchInput = page.locator(selector).first();
        if (await searchInput.isVisible({ timeout: 2000 })) {
          await searchInput.fill('test');
          searchFound = true;
          await page.screenshot({ path: 'test-screenshots/23-partner-search.png' });
          break;
        }
      } catch (e) {
        continue;
      }
    }

    console.log('Search functionality found:', searchFound);
  });

  test('should check for filters and controls', async ({ page }) => {
    await page.waitForSelector('[data-testid="partner-dashboard"], [class*="partner"]');

    const controls = await page.evaluate(() => {
      return {
        hasFilters: !!document.querySelector('select[class*="filter"], [data-testid*="filter"]'),
        hasDropdowns: document.querySelectorAll('select').length,
        hasButtons: document.querySelectorAll('button').length,
        buttonTexts: Array.from(document.querySelectorAll('button'))
          .map(b => b.textContent?.trim())
          .filter(Boolean)
          .slice(0, 10)
      };
    });

    console.log('Dashboard controls:', controls);
    expect(controls.hasButtons).toBeGreaterThan(0);
  });

  test('should check for metrics and analytics', async ({ page }) => {
    await page.waitForSelector('[data-testid="partner-dashboard"], [class*="partner"]');

    const metrics = await page.evaluate(() => {
      const metricElements = document.querySelectorAll('[class*="metric"], [class*="stat"], [class*="card"]');

      return {
        metricCount: metricElements.length,
        hasCharts: !!document.querySelector('canvas, svg'),
        metricTexts: Array.from(metricElements)
          .map(m => m.textContent?.substring(0, 50))
          .slice(0, 5)
      };
    });

    console.log('Metrics info:', metrics);
    expect(metrics.metricCount > 0 || metrics.hasCharts).toBeTruthy();

    await page.screenshot({ path: 'test-screenshots/24-partner-metrics.png', fullPage: true });
  });

  test('should check for approvals section', async ({ page }) => {
    await page.waitForSelector('[data-testid="partner-dashboard"], [class*="partner"]');

    const approvalsInfo = await page.evaluate(() => {
      const pageText = document.body.textContent?.toLowerCase() || '';
      const hasApprovalsText = pageText.includes('approv') || pageText.includes('pending');

      const approvalElements = document.querySelectorAll('[class*="approval"], [data-status="pending"]');

      return {
        hasApprovalsText,
        pendingCount: approvalElements.length
      };
    });

    console.log('Approvals info:', approvalsInfo);
  });
});
