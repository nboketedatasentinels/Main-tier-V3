/**
 * Load "What good looks like" criteria from the same programme HTML the learner used.
 * Partners see the standard while deciding whether to accept the AI grade.
 */
export async function fetchWhatGoodLooksLike(params: {
  sourcePage?: string | null
  componentId?: string | null
}): Promise<{ title: string | null; items: string[] }> {
  const page =
    (params.sourcePage && params.sourcePage.trim()) ||
    (params.componentId ? `/capstones/${params.componentId.trim()}.html` : null)
  if (!page) return { title: null, items: [] }

  try {
    const res = await fetch(page, { credentials: 'same-origin' })
    if (!res.ok) return { title: null, items: [] }
    const html = await res.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const title =
      doc.querySelector('.standard-title')?.textContent?.trim() ||
      doc.querySelector('.standard-label')?.textContent?.trim() ||
      null
    const items = Array.from(doc.querySelectorAll('.standard-list li'))
      .map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    return { title, items }
  } catch {
    return { title: null, items: [] }
  }
}
