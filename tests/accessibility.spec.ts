import { test, expect } from '@playwright/test';

/**
 * Accessibility Tests
 * Tests WCAG 2.1 AA compliance and accessibility features
 */

test.describe('Accessibility', () => {

  test('should check for missing alt text on images', async ({ page }) => {
    await page.goto('/');

    const imageIssues = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      const missing: string[] = [];

      images.forEach(img => {
        if (!img.alt) {
          const src = img.src.substring(img.src.length - 50);
          missing.push(src);
        }
      });

      return {
        totalImages: images.length,
        missingAlt: missing.length,
        examples: missing.slice(0, 5)
      };
    });

    console.log('Image alt text:', imageIssues);

    if (imageIssues.missingAlt > 0) {
      console.warn(`⚠️ Found ${imageIssues.missingAlt} images without alt text`);
    }
  });

  test('should check for form label associations', async ({ page }) => {
    await page.goto('/login');

    const formIssues = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input, select, textarea');
      const unlabeled: string[] = [];

      inputs.forEach(input => {
        const id = input.id;
        const hasLabel = id && document.querySelector(`label[for="${id}"]`);
        const hasAriaLabel = input.getAttribute('aria-label');
        const hasAriaLabelledBy = input.getAttribute('aria-labelledby');

        if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
          const identifier = input.id || input.getAttribute('name') || input.getAttribute('type') || 'unknown';
          unlabeled.push(identifier);
        }
      });

      return {
        totalInputs: inputs.length,
        unlabeled: unlabeled.length,
        examples: unlabeled
      };
    });

    console.log('Form labels:', formIssues);

    if (formIssues.unlabeled > 0) {
      console.warn(`⚠️ Found ${formIssues.unlabeled} inputs without labels`);
    }
  });

  test('should check for ARIA landmarks', async ({ page }) => {
    await page.goto('/');

    const landmarks = await page.evaluate(() => {
      return {
        hasMain: !!document.querySelector('main, [role="main"]'),
        hasNav: !!document.querySelector('nav, [role="navigation"]'),
        hasBanner: !!document.querySelector('header, [role="banner"]'),
        hasContentInfo: !!document.querySelector('footer, [role="contentinfo"]'),
        hasSkipLink: !!document.querySelector('a[href="#main"], a[href="#content"], [class*="skip"]')
      };
    });

    console.log('ARIA landmarks:', landmarks);

    // Main landmark is critical
    expect(landmarks.hasMain).toBeTruthy();
  });

  test('should check button accessibility', async ({ page }) => {
    await page.goto('/');

    const buttonIssues = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, [role="button"]');
      const issues: string[] = [];

      buttons.forEach((btn, index) => {
        const text = btn.textContent?.trim();
        const ariaLabel = btn.getAttribute('aria-label');
        const ariaLabelledBy = btn.getAttribute('aria-labelledby');

        if (!text && !ariaLabel && !ariaLabelledBy) {
          issues.push(`Button ${index}: no accessible name`);
        }
      });

      return {
        totalButtons: buttons.length,
        issueCount: issues.length,
        issues: issues.slice(0, 5)
      };
    });

    console.log('Button accessibility:', buttonIssues);

    if (buttonIssues.issueCount > 0) {
      console.warn('⚠️ Buttons without accessible names:', buttonIssues.issues);
    }
  });

  test('should check heading hierarchy', async ({ page }) => {
    await page.goto('/');

    const headingInfo = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));

      const hierarchy = headings.map(h => ({
        level: parseInt(h.tagName.substring(1)),
        text: h.textContent?.substring(0, 50)
      }));

      const h1Count = headings.filter(h => h.tagName === 'H1').length;

      // Check for skipped levels
      const skipped: string[] = [];
      for (let i = 1; i < hierarchy.length; i++) {
        if (hierarchy[i].level - hierarchy[i - 1].level > 1) {
          skipped.push(`${hierarchy[i - 1].level} → ${hierarchy[i].level}`);
        }
      }

      return {
        totalHeadings: headings.length,
        h1Count,
        hierarchy: hierarchy.slice(0, 10),
        skippedLevels: skipped
      };
    });

    console.log('Heading hierarchy:', headingInfo);

    // Should have exactly one H1
    if (headingInfo.h1Count !== 1) {
      console.warn(`⚠️ Found ${headingInfo.h1Count} H1 tags (should be 1)`);
    }

    if (headingInfo.skippedLevels.length > 0) {
      console.warn('⚠️ Skipped heading levels:', headingInfo.skippedLevels);
    }
  });

  test('should check focusable elements', async ({ page }) => {
    await page.goto('/');

    const focusInfo = await page.evaluate(() => {
      const focusable = document.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      return {
        focusableCount: focusable.length,
        hasFocusIndicators: true // Would need to check CSS
      };
    });

    console.log('Focusable elements:', focusInfo);
    expect(focusInfo.focusableCount).toBeGreaterThan(0);
  });

  test('should test keyboard navigation on login', async ({ page }) => {
    await page.goto('/login');

    // Tab through form
    await page.keyboard.press('Tab'); // Focus email
    await page.keyboard.type('test@example.com');

    await page.keyboard.press('Tab'); // Focus password
    await page.keyboard.type('password123');

    await page.keyboard.press('Tab'); // Focus submit button
    await page.screenshot({ path: 'test-screenshots/40-keyboard-nav.png' });

    // Check that focus is visible (manual review needed)
    console.log('Keyboard navigation completed - check screenshot for focus indicators');
  });

  test('should check for color contrast issues (basic)', async ({ page }) => {
    await page.goto('/');

    // This is a simplified check - proper contrast checking requires more complex color math
    const contrastInfo = await page.evaluate(() => {
      const elements = document.querySelectorAll('p, span, button, a, h1, h2, h3, h4, h5, h6');
      let checkedCount = 0;

      // Sample first 50 elements
      Array.from(elements).slice(0, 50).forEach(el => {
        const style = window.getComputedStyle(el);
        const bg = style.backgroundColor;
        const color = style.color;

        if (bg && color) {
          checkedCount++;
        }
      });

      return {
        elementsChecked: checkedCount,
        note: 'Proper contrast checking requires color luminance calculation'
      };
    });

    console.log('Color contrast:', contrastInfo);
  });

  test('should check for lang attribute', async ({ page }) => {
    await page.goto('/');

    const langInfo = await page.evaluate(() => {
      const html = document.documentElement;
      return {
        hasLang: !!html.getAttribute('lang'),
        lang: html.getAttribute('lang')
      };
    });

    console.log('Language attribute:', langInfo);
    expect(langInfo.hasLang).toBeTruthy();
  });

  test('should check for page title', async ({ page }) => {
    await page.goto('/');

    const title = await page.title();
    console.log('Page title:', title);

    expect(title.length).toBeGreaterThan(0);
    expect(title).not.toBe('Document');
  });
});
