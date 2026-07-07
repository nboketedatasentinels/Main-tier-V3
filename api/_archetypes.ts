/**
 * Shared result metadata for the social-share endpoints (api/share.ts and
 * api/og.tsx). Kept self-contained (no @/ imports) so the serverless/edge
 * bundles stay small and free of the app's UI dependencies.
 *
 * Files in /api that start with "_" are ignored by Vercel's router, so this is
 * a plain import target, not an endpoint.
 *
 * The archetype set and taglines mirror src/config/liftAssessment.ts. Blurbs
 * follow brand voice: plain, confident, no em dashes.
 */

export const PLUM = '#27062e'
export const GOLD = '#eab130'
export const SOFT_GOLD = '#f9db59'

export interface ArchetypeMeta {
  /** Display title, e.g. "The Architect". */
  title: string
  /** The pillar this archetype leads with. */
  tagline: string
  /** One-line description used in the card and OG description. */
  blurb: string
}

export const ARCHETYPES: Record<string, ArchetypeMeta> = {
  Anchor: {
    title: 'The Anchor',
    tagline: 'Leading Self in the Age of AI',
    blurb: 'The steady signal in a noisy change.',
  },
  Architect: {
    title: 'The Architect',
    tagline: 'Innovation and AI for Digital Transformation',
    blurb: 'Turns AI ideas into systems that hold.',
  },
  Catalyst: {
    title: 'The Catalyst',
    tagline: 'Fostering AI-Ready Teams',
    blurb: 'Moves people through change others would resist.',
  },
  Operator: {
    title: 'The Operator',
    tagline: 'Transforming Business with AI',
    blurb: 'Connects AI to outcomes the board can see.',
  },
  Practitioner: {
    title: 'The Practitioner',
    tagline: 'Balanced across all four pillars',
    blurb: 'Strong across every pillar of AI leadership.',
  },
  'Emerging Leader': {
    title: 'The Emerging Leader',
    tagline: 'Early across the four pillars',
    blurb: 'Building the foundations of AI leadership.',
  },
}

/** Resolve a raw ?a= value to a known archetype, defaulting to Emerging Leader. */
export const resolveArchetype = (raw: unknown): { key: string; meta: ArchetypeMeta } => {
  const key = typeof raw === 'string' && raw in ARCHETYPES ? raw : 'Emerging Leader'
  return { key, meta: ARCHETYPES[key] }
}

/** Parse and clamp a raw ?i= value to a 0-100 integer, or null if absent/invalid. */
export const clampIndex = (raw: unknown): number | null => {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, Math.round(n)))
}
