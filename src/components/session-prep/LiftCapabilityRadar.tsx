import React, { useMemo } from 'react'
import { Box, List, ListItem, Text } from '@chakra-ui/react'
import { PILLARS, type PillarKey } from '@/config/liftAssessment'

interface LiftCapabilityRadarProps {
  pillars: Record<PillarKey, number> | null
  chosenPillar?: PillarKey | null
  gapPillar?: PillarKey | null
  showScores?: boolean
}

/** Map score 0-100 onto radar radius from center. */
const pointFor = (key: PillarKey, score: number, cx: number, cy: number, maxR: number) => {
  const t = Math.max(0, Math.min(100, score)) / 100
  const r = 18 + t * maxR
  const angles: Record<PillarKey, number> = {
    L: -Math.PI / 2,
    I: 0,
    F: Math.PI / 2,
    T: Math.PI,
  }
  const a = angles[key]
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

export const LiftCapabilityRadar: React.FC<LiftCapabilityRadarProps> = ({
  pillars,
  chosenPillar,
  gapPillar,
  showScores = false,
}) => {
  const hasScores = Boolean(pillars)

  const shape = useMemo(() => {
    // Neutral placeholder ring only - never invent learner scores.
    const scores = pillars ?? { L: 50, I: 50, F: 50, T: 50 }
    const cx = 120
    const cy = 95
    const maxR = 68
    const pts = (['L', 'I', 'F', 'T'] as PillarKey[]).map((k) => pointFor(k, scores[k], cx, cy, maxR))
    return { scores, cx, cy, maxR, pts, poly: pts.map((p) => `${p.x},${p.y}`).join(' ') }
  }, [pillars])

  const chosen = hasScores ? chosenPillar : null
  const gap = hasScores && gapPillar && gapPillar !== chosenPillar ? gapPillar : null
  const chosenPt = chosen
    ? shape.pts[['L', 'I', 'F', 'T'].indexOf(chosen)]
    : null
  const gapPt = gap ? shape.pts[['L', 'I', 'F', 'T'].indexOf(gap)] : null

  return (
    <Box>
      <Box as="svg" className="radar" viewBox="0 0 240 200" w="100%" h="auto" role="img" aria-label="LIFT capability shape">
        {[0.25, 0.5, 0.75, 1].map((scale) => {
          const pts = (['L', 'I', 'F', 'T'] as PillarKey[])
            .map((k) => pointFor(k, scale * 100, shape.cx, shape.cy, shape.maxR))
            .map((p) => `${p.x},${p.y}`)
            .join(' ')
          return (
            <polygon
              key={scale}
              points={pts}
              fill="none"
              stroke={scale === 1 ? 'rgba(35,31,48,.28)' : 'rgba(35,31,48,.14)'}
              strokeWidth={1}
            />
          )
        })}
        <line x1={120} y1={95} x2={120} y2={27} stroke="rgba(35,31,48,.14)" />
        <line x1={120} y1={95} x2={188} y2={95} stroke="rgba(35,31,48,.14)" />
        <line x1={120} y1={95} x2={120} y2={163} stroke="rgba(35,31,48,.14)" />
        <line x1={120} y1={95} x2={52} y2={95} stroke="rgba(35,31,48,.14)" />
        {hasScores ? (
          <polygon
            points={shape.poly}
            fill="rgba(45,42,62,.13)"
            stroke="#2D2A3E"
            strokeWidth={1.75}
            strokeLinejoin="round"
          />
        ) : (
          <polygon
            points={shape.poly}
            fill="rgba(35,31,48,.04)"
            stroke="rgba(35,31,48,.22)"
            strokeWidth={1.25}
            strokeDasharray="4 4"
            strokeLinejoin="round"
          />
        )}
        {chosenPt && (
          <>
            <circle cx={chosenPt.x} cy={chosenPt.y} r={9} fill="none" stroke="#D4A017" strokeWidth={1.25} opacity={0.55} />
            <circle cx={chosenPt.x} cy={chosenPt.y} r={4.5} fill="#D4A017" stroke="#FDF8EF" strokeWidth={1.5} />
          </>
        )}
        {gapPt && (
          <circle cx={gapPt.x} cy={gapPt.y} r={4.5} fill="#FDF8EF" stroke="#B33A3A" strokeWidth={1.75} />
        )}
        <text x={120} y={16} textAnchor="middle" fill={gap === 'L' ? '#B33A3A' : chosen === 'L' ? '#D4A017' : '#6B6579'} fontFamily="DM Mono, monospace" fontSize={12}>
          L
        </text>
        <text x={212} y={99} textAnchor="middle" fill={gap === 'I' ? '#B33A3A' : chosen === 'I' ? '#D4A017' : '#6B6579'} fontFamily="DM Mono, monospace" fontSize={12}>
          I
        </text>
        <text x={120} y={184} textAnchor="middle" fill={gap === 'F' ? '#B33A3A' : chosen === 'F' ? '#D4A017' : '#6B6579'} fontFamily="DM Mono, monospace" fontSize={12}>
          F
        </text>
        <text x={28} y={99} textAnchor="middle" fill={gap === 'T' ? '#B33A3A' : chosen === 'T' ? '#D4A017' : '#6B6579'} fontFamily="DM Mono, monospace" fontSize={12}>
          T
        </text>
        {showScores &&
          hasScores &&
          (['L', 'I', 'F', 'T'] as PillarKey[]).map((k, i) => {
            const p = shape.pts[i]
            const offsets = [
              { x: 0, y: -12 },
              { x: 14, y: -6 },
              { x: 0, y: 14 },
              { x: -14, y: -6 },
            ][i]
            return (
              <text
                key={k}
                x={p.x + offsets.x}
                y={p.y + offsets.y}
                textAnchor="middle"
                fill="#6B6579"
                fontFamily="DM Mono, monospace"
                fontSize={9.5}
              >
                {Math.round(shape.scores[k])}
              </text>
            )
          })}
      </Box>

      {!hasScores ? (
        <Text fontSize="12.5px" color="#6B6579" mt={2} lineHeight="1.55">
          No LIFT Index on file yet. The radar stays empty until they complete the assessment.
        </Text>
      ) : (
        <List spacing={1.5} mt={2} styleType="none" ml={0}>
          {PILLARS.map((p) => (
            <ListItem key={p.key} display="flex" gap={2} alignItems="baseline" fontSize="12px" color="#6B6579">
              <Text as="b" fontFamily="mono" fontSize="11px" color="#2D2A3E" w="14px">
                {p.key}
              </Text>
              <Text flex="1">
                {p.name}
                {showScores ? (
                  <Text as="span" ml={2} fontFamily="mono" fontSize="11px" color="#2D2A3E">
                    {Math.round(pillars![p.key])}
                  </Text>
                ) : null}
              </Text>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  )
}
