import { test, expect, type Page } from '@playwright/test'

type Viewport = { width: number; height: number }

const viewports: Array<{ name: string; viewport: Viewport }> = [
  { name: 'mobile', viewport: { width: 375, height: 667 } }, // iPhone SE-ish
  { name: 'tablet', viewport: { width: 768, height: 1024 } }, // iPad-ish
  { name: 'desktop', viewport: { width: 1280, height: 720 } },
]

const paths: Array<{ name: string; path: string }> = [
  { name: 'home', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'upgrade', path: '/upgrade' },
]

const getHorizontalScrollMetrics = async (page: Page) => {
  return page.evaluate(() => {
    const docEl = document.documentElement
    const body = document.body

    const clientWidth = docEl.clientWidth
    const scrollWidth = Math.max(docEl.scrollWidth, body?.scrollWidth ?? 0)
    const overflow = scrollWidth - clientWidth

    return {
      viewportWidth: window.innerWidth,
      clientWidth,
      scrollWidth,
      overflow,
      bodyOverflowX: body ? window.getComputedStyle(body).overflowX : null,
      docOverflowX: window.getComputedStyle(docEl).overflowX,
    }
  })
}

const getOverflowingElements = async (page: Page, limit = 8) => {
  return page.evaluate((limitValue) => {
    const clientWidth = document.documentElement.clientWidth
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('body *'))
    const results: Array<{
      tag: string
      id: string | null
      className: string | null
      left: number
      right: number
      width: number
    }> = []

    for (const node of nodes) {
      const rect = node.getBoundingClientRect()
      const left = Math.floor(rect.left)
      const right = Math.ceil(rect.right)

      if (right <= clientWidth + 1) continue
      if (rect.width <= 0 || rect.height <= 0) continue

      results.push({
        tag: node.tagName.toLowerCase(),
        id: node.id || null,
        className: node.className ? String(node.className).slice(0, 120) : null,
        left,
        right,
        width: Math.round(rect.width),
      })

      if (results.length >= limitValue) break
    }

    return { clientWidth, results }
  }, limit)
}

async function expectNoHorizontalScroll(page: Page, tolerancePx = 2) {
  const metrics = await getHorizontalScrollMetrics(page)

  if (metrics.overflow > tolerancePx) {
    const offenders = await getOverflowingElements(page)
    throw new Error(
      [
        `Horizontal overflow detected: +${metrics.overflow}px (tolerance ${tolerancePx}px)`,
        `viewportWidth=${metrics.viewportWidth} clientWidth=${metrics.clientWidth} scrollWidth=${metrics.scrollWidth}`,
        `overflowX: doc=${metrics.docOverflowX} body=${metrics.bodyOverflowX}`,
        `offenders: ${JSON.stringify(offenders, null, 2)}`,
      ].join('\n'),
    )
  }

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + tolerancePx)
}

test.describe('Responsive smoke: no horizontal scroll', () => {
  // This check is intended to catch regressions quickly, without multiplying runtime across all projects.
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Run once (chromium-desktop)')
  })

  for (const viewportCase of viewports) {
    for (const pathCase of paths) {
      test(`${viewportCase.name}: ${pathCase.name}`, async ({ page }) => {
        await page.setViewportSize(viewportCase.viewport)
        await page.goto(pathCase.path, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(250)

        await expectNoHorizontalScroll(page)
      })
    }
  }
})
