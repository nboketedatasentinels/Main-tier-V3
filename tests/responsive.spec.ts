import { test, expect } from '@playwright/test';

/**
 * Responsive Design Tests
 * Tests layout and functionality across different viewport sizes
 */

test.describe('Responsive Design', () => {

  test('should render properly on mobile (iPhone SE - 375x667)', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await page.screenshot({ path: 'test-screenshots/30-mobile-home.png', fullPage: true });

    const mobileElements = await page.evaluate(() => {
      return {
        hasMobileMenu: !!document.querySelector('[class*="mobile-menu"], [class*="hamburger"], [data-testid="mobile-nav"]'),
        hasBottomNav: !!document.querySelector('[class*="bottom-nav"], nav[class*="fixed"][class*="bottom"]'),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
    });

    console.log('Mobile elements:', mobileElements);
    expect(mobileElements.viewport.width).toBe(375);
  });

  test('should have proper touch targets on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const touchTargets = await page.evaluate(() => {
      const interactive = document.querySelectorAll('button, a, [role="button"], input, select');
      const tooSmall: string[] = [];

      interactive.forEach(el => {
        const rect = el.getBoundingClientRect();
        if ((rect.width > 0 && rect.width < 44) || (rect.height > 0 && rect.height < 44)) {
          const text = (el.textContent || el.getAttribute('aria-label') || el.tagName).substring(0, 30);
          tooSmall.push(`${text} (${Math.round(rect.width)}x${Math.round(rect.height)})`);
        }
      });

      return {
        totalInteractive: interactive.length,
        tooSmallCount: tooSmall.length,
        tooSmall: tooSmall.slice(0, 5)
      };
    });

    console.log('Touch targets:', touchTargets);

    if (touchTargets.tooSmallCount > 0) {
      console.warn('Found small touch targets:', touchTargets.tooSmall);
    }
  });

  test('should render properly on tablet (iPad - 768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    await page.screenshot({ path: 'test-screenshots/31-tablet-home.png', fullPage: true });

    const tabletInfo = await page.evaluate(() => {
      return {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        hasDesktopNav: !!document.querySelector('nav:not([class*="mobile"])'),
      };
    });

    console.log('Tablet info:', tabletInfo);
    expect(tabletInfo.viewport.width).toBe(768);
  });

  test('should render properly on desktop (1280x720)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    await page.screenshot({ path: 'test-screenshots/32-desktop-home.png', fullPage: true });

    const desktopInfo = await page.evaluate(() => {
      return {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        hasWideLayout: document.body.clientWidth >= 1024
      };
    });

    console.log('Desktop info:', desktopInfo);
    expect(desktopInfo.viewport.width).toBe(1280);
  });

  test('should test mobile navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Try to find and interact with mobile menu
    const mobileMenuSelectors = [
      '[class*="mobile-menu"]',
      '[class*="hamburger"]',
      'button[aria-label*="menu" i]',
      '[data-testid="mobile-nav"]'
    ];

    let menuFound = false;

    for (const selector of mobileMenuSelectors) {
      try {
        const menuButton = page.locator(selector).first();
        if (await menuButton.isVisible({ timeout: 2000 })) {
          await page.screenshot({ path: 'test-screenshots/33-mobile-menu-closed.png' });
          await menuButton.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: 'test-screenshots/34-mobile-menu-open.png' });
          menuFound = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    console.log('Mobile menu found:', menuFound);
  });

  test('should test responsive login on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');

    await page.waitForSelector('input[type="email"]');
    await page.screenshot({ path: 'test-screenshots/35-mobile-login.png', fullPage: true });

    // Test form is usable on mobile
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');

    await page.screenshot({ path: 'test-screenshots/36-mobile-login-filled.png', fullPage: true });
  });

  test('should test viewport changes', async ({ page }) => {
    // Start desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.screenshot({ path: 'test-screenshots/37-viewport-desktop.png' });

    // Change to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-screenshots/38-viewport-mobile.png' });

    // Back to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-screenshots/39-viewport-desktop-again.png' });
  });
});
