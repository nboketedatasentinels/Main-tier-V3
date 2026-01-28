import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for T4L platform testing
 * Tests across Chrome, Firefox, and Safari on multiple viewports
 */
export default defineConfig({
  testDir: './tests',

  // Maximum time one test can run
  timeout: 30 * 1000,

  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list']
  ],

  // Shared settings for all projects
  use: {
    // Base URL for all tests
    baseURL: 'http://localhost:3000',

    // Collect trace on failure for debugging
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Maximum time for each action (click, fill, etc.)
    actionTimeout: 10 * 1000,
  },

  // Web server configuration - disabled since server runs externally
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3001',
  //   reuseExistingServer: true,
  //   timeout: 120 * 1000,
  // },

  // Test projects for different browsers and viewports
  projects: [
    // Desktop Chrome
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
    },

    // Desktop Firefox
    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 }
      },
    },

    // Desktop Safari
    {
      name: 'webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 }
      },
    },

    // Mobile Chrome (iPhone SE)
    {
      name: 'mobile-chrome',
      use: { ...devices['iPhone SE'] },
    },

    // Mobile Safari (iPhone SE)
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone SE'] },
    },

    // Tablet (iPad Mini)
    {
      name: 'tablet-ipad',
      use: { ...devices['iPad Mini'] },
    },
  ],
});
