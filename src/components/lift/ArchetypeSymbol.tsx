import React from 'react'
import type { Archetype } from '@/config/liftAssessment'

const GOLD = '#eab130'

/**
 * The six LIFT archetype symbols, recreated as clean inline SVGs (gold line
 * style, plus the Practitioner's four-quadrant diamond). Faithful redraws of
 * the official assets so the build is not blocked on files; to swap in the
 * official SVG/PNG later, replace the matching `case` body (or render an <img>).
 *
 * `color` controls the gold line work; pass the archetype accent if desired.
 * The Practitioner uses its own fixed palette and ignores `color`.
 */
export interface ArchetypeSymbolProps {
  archetype: Archetype
  size?: number
  color?: string
  title?: string
}

const HELM_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]
const RAD = Math.PI / 180
const pt = (cx: number, cy: number, r: number, deg: number): [number, number] => [
  cx + r * Math.cos(deg * RAD),
  cy + r * Math.sin(deg * RAD),
]

export const ArchetypeSymbol: React.FC<ArchetypeSymbolProps> = ({
  archetype,
  size = 72,
  color = GOLD,
  title,
}) => {
  const stroke = {
    stroke: color,
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  }

  const body = (() => {
    switch (archetype) {
      case 'Anchor':
        return (
          <>
            <circle cx="32" cy="10.5" r="4.5" {...stroke} />
            <line x1="32" y1="15" x2="32" y2="49.5" {...stroke} />
            <line x1="22.5" y1="21.5" x2="41.5" y2="21.5" {...stroke} />
            <path d="M15 37c0 11 8 14.5 17 14.5s17-3.5 17-14.5" {...stroke} />
            <path d="M15 37l-4.5 3 6.5 2.2z" fill={color} stroke="none" />
            <path d="M49 37l4.5 3-6.5 2.2z" fill={color} stroke="none" />
          </>
        )
      case 'Architect':
        return (
          <>
            <circle cx="32" cy="12" r="3.6" {...stroke} />
            <line x1="30.4" y1="15.2" x2="19.5" y2="52" {...stroke} />
            <line x1="33.6" y1="15.2" x2="44.5" y2="52" {...stroke} />
            <line x1="25" y1="35" x2="39" y2="35" {...stroke} />
          </>
        )
      case 'Catalyst':
        return (
          <>
            <line x1="32" y1="33" x2="32" y2="13" {...stroke} />
            <line x1="32" y1="33" x2="15.5" y2="49.5" {...stroke} />
            <line x1="32" y1="33" x2="48.5" y2="49.5" {...stroke} />
            <circle cx="32" cy="12" r="4.6" fill={color} />
            <circle cx="15" cy="50" r="4.6" fill={color} />
            <circle cx="49" cy="50" r="4.6" fill={color} />
            <circle cx="32" cy="33" r="5.6" fill={color} />
          </>
        )
      case 'Operator':
        return (
          <>
            <circle cx="32" cy="32" r="15" {...stroke} />
            <circle cx="32" cy="32" r="5" {...stroke} />
            <circle cx="32" cy="32" r="1.8" fill={color} />
            {HELM_ANGLES.map((deg) => {
              const [ix, iy] = pt(32, 32, 5, deg)
              const [mx, my] = pt(32, 32, 15, deg)
              const [ox, oy] = pt(32, 32, 21, deg)
              return (
                <React.Fragment key={deg}>
                  <line x1={ix} y1={iy} x2={mx} y2={my} {...stroke} />
                  <line x1={mx} y1={my} x2={ox} y2={oy} {...stroke} />
                </React.Fragment>
              )
            })}
          </>
        )
      case 'Practitioner': {
        const outline = '#1f2937'
        return (
          <>
            <polygon points="32,6 32,32 6,32" fill="#e7e1f6" />
            <polygon points="32,6 58,32 32,32" fill="#fbf0c4" />
            <polygon points="32,58 58,32 32,32" fill="#cfe3fb" />
            <polygon points="32,58 6,32 32,32" fill="#d6ecd8" />
            <polygon
              points="32,6 58,32 32,58 6,32"
              fill="none"
              stroke={outline}
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <line x1="32" y1="6" x2="32" y2="58" stroke={outline} strokeWidth="1.6" />
            <line x1="6" y1="32" x2="58" y2="32" stroke={outline} strokeWidth="1.6" />
          </>
        )
      }
      case 'Emerging Leader':
        return (
          <>
            <line x1="16" y1="52" x2="48" y2="52" stroke="#9ca3af" strokeWidth="3.4" strokeLinecap="round" />
            <line x1="32" y1="45" x2="32" y2="18" {...stroke} />
            <path d="M21 28 L32 15 L43 28" {...stroke} />
          </>
        )
      default:
        return null
    }
  })()

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title ?? `The ${archetype} symbol`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      {body}
    </svg>
  )
}

export default ArchetypeSymbol
