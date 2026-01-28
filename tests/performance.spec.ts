import { test, expect } from '@playwright/test';

/**
 * Performance Tests
 * Tests Core Web Vitals and performance metrics
 */

test.describe('Performance', () => {

  test('should measure page load performance', async ({ page }) => {
    await page.goto('/');

    const performanceMetrics = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');

      return {
        // Core timing metrics
        loadTime: Math.round(perf.loadEventEnd - perf.startTime),
        domContentLoaded: Math.round(perf.domContentLoadedEventEnd - perf.startTime),
        domInteractive: Math.round(perf.domInteractive - perf.startTime),

        // Paint metrics
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime,

        // Network
        responseTime: Math.round(perf.responseEnd - perf.requestStart),
        transferSize: perf.transferSize,
      };
    });

    console.log('Performance metrics:', performanceMetrics);

    // Performance assertions (adjust thresholds as needed)
    expect(performanceMetrics.loadTime).toBeLessThan(5000); // 5 seconds
    expect(performanceMetrics.domContentLoaded).toBeLessThan(3000); // 3 seconds

    if (performanceMetrics.firstContentfulPaint) {
      expect(performanceMetrics.firstContentfulPaint).toBeLessThan(2500); // Good FCP
    }

    // Log warnings for slow metrics
    if (performanceMetrics.loadTime > 2000) {
      console.warn(`⚠️ Load time is ${performanceMetrics.loadTime}ms (target: <2000ms)`);
    }

    if (performanceMetrics.firstContentfulPaint && performanceMetrics.firstContentfulPaint > 1800) {
      console.warn(`⚠️ FCP is ${performanceMetrics.firstContentfulPaint}ms (target: <1800ms)`);
    }
  });

  test('should analyze resource loading', async ({ page }) => {
    await page.goto('/');

    const resourceMetrics = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

      // Categorize resources
      const scripts = resources.filter(r => r.initiatorType === 'script');
      const stylesheets = resources.filter(r => r.initiatorType === 'css' || r.initiatorType === 'link');
      const images = resources.filter(r => r.initiatorType === 'img');
      const fonts = resources.filter(r => r.name.includes('font') || r.name.includes('woff'));
      const xhr = resources.filter(r => r.initiatorType === 'xmlhttprequest' || r.initiatorType === 'fetch');

      // Find slow resources
      const slowResources = resources
        .filter(r => r.duration > 500)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
        .map(r => ({
          name: r.name.split('/').pop()?.substring(0, 40) || 'unknown',
          duration: Math.round(r.duration),
          size: Math.round((r.transferSize || 0) / 1024),
          type: r.initiatorType
        }));

      // Calculate total transfer size
      const totalTransferSize = Math.round(
        resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024
      );

      return {
        totalResources: resources.length,
        breakdown: {
          scripts: scripts.length,
          stylesheets: stylesheets.length,
          images: images.length,
          fonts: fonts.length,
          xhr: xhr.length
        },
        totalTransferSizeKB: totalTransferSize,
        slowResources
      };
    });

    console.log('Resource metrics:', resourceMetrics);

    // Resource count warnings
    if (resourceMetrics.totalResources > 100) {
      console.warn(`⚠️ High resource count: ${resourceMetrics.totalResources} (target: <50)`);
    }

    if (resourceMetrics.totalTransferSizeKB > 3000) {
      console.warn(`⚠️ Large transfer size: ${resourceMetrics.totalTransferSizeKB}KB (target: <1000KB)`);
    }

    if (resourceMetrics.slowResources.length > 0) {
      console.warn('⚠️ Slow resources detected:', resourceMetrics.slowResources);
    }

    // Assertions
    expect(resourceMetrics.totalResources).toBeLessThan(200); // Hard limit
  });

  test('should check for largest contentful paint', async ({ page }) => {
    await page.goto('/');

    // Wait a bit for LCP to settle
    await page.waitForTimeout(2000);

    const lcpMetric = await page.evaluate(() => {
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      const lcp = lcpEntries[lcpEntries.length - 1] as any;

      return {
        hasLCP: !!lcp,
        lcpTime: lcp?.startTime,
        lcpElement: lcp?.element?.tagName
      };
    });

    console.log('LCP metric:', lcpMetric);

    if (lcpMetric.hasLCP && lcpMetric.lcpTime) {
      expect(lcpMetric.lcpTime).toBeLessThan(4000); // Acceptable LCP

      if (lcpMetric.lcpTime > 2500) {
        console.warn(`⚠️ LCP is ${lcpMetric.lcpTime}ms (target: <2500ms)`);
      }
    }
  });

  test('should test login page performance', async ({ page }) => {
    await page.goto('/login');

    const loginPerf = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      return {
        loadTime: Math.round(perf.loadEventEnd - perf.startTime),
        domContentLoaded: Math.round(perf.domContentLoadedEventEnd - perf.startTime)
      };
    });

    console.log('Login page performance:', loginPerf);

    expect(loginPerf.loadTime).toBeLessThan(4000);
  });

  test('should test dashboard performance after login', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-learner@example.com');
    await page.fill('input[type="password"]', 'testpass123');

    // Click and measure navigation
    const startTime = Date.now();
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|learner)/, { timeout: 15000 });
    const navigationTime = Date.now() - startTime;

    console.log('Dashboard navigation time:', navigationTime, 'ms');

    // Get performance metrics after navigation
    const dashboardPerf = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      return {
        loadTime: Math.round(perf.loadEventEnd - perf.startTime),
        domContentLoaded: Math.round(perf.domContentLoadedEventEnd - perf.startTime)
      };
    });

    console.log('Dashboard performance:', dashboardPerf);

    if (navigationTime > 3000) {
      console.warn(`⚠️ Dashboard navigation took ${navigationTime}ms (target: <3000ms)`);
    }
  });

  test('should check memory usage (basic)', async ({ page }) => {
    await page.goto('/');

    const memoryInfo = await page.evaluate(() => {
      const perf = performance as any;

      if (perf.memory) {
        return {
          usedJSHeapSize: Math.round(perf.memory.usedJSHeapSize / 1048576), // MB
          totalJSHeapSize: Math.round(perf.memory.totalJSHeapSize / 1048576), // MB
          jsHeapSizeLimit: Math.round(perf.memory.jsHeapSizeLimit / 1048576) // MB
        };
      }

      return {
        note: 'Memory API not available in this browser'
      };
    });

    console.log('Memory info:', memoryInfo);
  });

  test('should generate performance summary', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const summary = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const lcp = performance.getEntriesByType('largest-contentful-paint');

      return {
        timing: {
          loadTime: Math.round(perf.loadEventEnd - perf.startTime),
          domContentLoaded: Math.round(perf.domContentLoadedEventEnd - perf.startTime),
          firstPaint: paint.find(p => p.name === 'first-paint')?.startTime,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime,
          largestContentfulPaint: (lcp[lcp.length - 1] as any)?.startTime
        },
        resources: {
          count: resources.length,
          totalSizeKB: Math.round(resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024)
        },
        url: window.location.href,
        timestamp: new Date().toISOString()
      };
    });

    console.log('\n=== PERFORMANCE SUMMARY ===');
    console.log('Load Time:', summary.timing.loadTime, 'ms');
    console.log('DOM Content Loaded:', summary.timing.domContentLoaded, 'ms');
    console.log('First Paint:', summary.timing.firstPaint, 'ms');
    console.log('First Contentful Paint:', summary.timing.firstContentfulPaint, 'ms');
    console.log('Largest Contentful Paint:', summary.timing.largestContentfulPaint, 'ms');
    console.log('Total Resources:', summary.resources.count);
    console.log('Total Transfer:', summary.resources.totalSizeKB, 'KB');
    console.log('========================\n');
  });
});
