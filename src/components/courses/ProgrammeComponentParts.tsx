import React from 'react'
import { Box, Button, Flex, Icon, Stack, Text } from '@chakra-ui/react'
import { ExternalLink } from 'lucide-react'
import {
  PILLAR_PROGRAMME_COMPONENTS,
  PROGRAMME_COMPONENT_LABEL,
  type ProgrammeComponentPart,
  type ProgrammeComponentType,
} from '@/config/pillarProgrammeComponents'
import { useUserPillar } from '@/hooks/useUserPillar'

/**
 * Shared "parts dropdown" rows for the three pillar programme components
 * (capstone / case study / practical).
 *
 * Same row design as the podcast series panel - white row, 3px left accent,
 * title + description, launch button on the right - but the action button is
 * dark purple rather than flame orange. Rendered both on the courses page
 * (inside each component card) and in the weekly checklist (when the learner
 * expands the Capstone / Case Study activity), so the two stay identical.
 */

/** Dark purple - the action colour for every part row. */
export const PART_BUTTON_BG = '#350e6f'
export const PART_BUTTON_BG_HOVER = '#27062e'

/** Left accent bar per component type, matching the courses-page cards. */
export const PROGRAMME_COMPONENT_ACCENT: Record<ProgrammeComponentType, string> = {
  capstone: '#350e6f',
  case_study: '#eab130',
  practical: '#f4540c',
}

const PlainNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box p={3} bg="gray.50" rounded="md" border="1px solid" borderColor="gray.200">
    <Text fontSize="sm" color="gray.600">
      {children}
    </Text>
  </Box>
)

export const ProgrammeComponentPartsList: React.FC<{
  parts: ProgrammeComponentPart[]
  accentColor: string
  ctaLabel?: string
}> = ({ parts, accentColor, ctaLabel = 'Begin part' }) => (
  <Stack spacing={2}>
    {parts.map((part) => (
      <Box
        key={part.id}
        p={3}
        bg="white"
        border="1px solid"
        borderColor="gray.200"
        borderLeftWidth="3px"
        borderLeftColor={accentColor}
        rounded="md"
        transition="all 0.15s"
        _hover={{ borderColor: 'gray.300' }}
      >
        <Flex
          justify="space-between"
          align="flex-start"
          gap={3}
          direction={{ base: 'column', md: 'row' }}
        >
          <Stack spacing={1} flex={1} minW={0}>
            <Text fontWeight="semibold" color="#27062e" fontSize="sm" lineHeight="1.4">
              {part.title}
            </Text>
            {part.description && (
              <Text fontSize="xs" color="gray.500" lineHeight="1.55">
                {part.description}
              </Text>
            )}
          </Stack>

          <Button
            as="a"
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            flexShrink={0}
            bg={PART_BUTTON_BG}
            color="white"
            _hover={{ bg: PART_BUTTON_BG_HOVER, textDecoration: 'none' }}
            _active={{ bg: PART_BUTTON_BG_HOVER }}
            rightIcon={<Icon as={ExternalLink} boxSize={3} />}
            borderRadius="md"
            fontWeight="semibold"
            letterSpacing="0.01em"
            onClick={(e) => e.stopPropagation()}
          >
            {ctaLabel}
          </Button>
        </Flex>
      </Box>
    ))}
  </Stack>
)

/**
 * Pillar-aware wrapper: resolves the learner's pillar, finds the entry for
 * `type`, and renders its parts (or its single deliverable). Used by the
 * weekly checklist, where only the activity id is known.
 */
export const ProgrammeComponentPartsPanel: React.FC<{ type: ProgrammeComponentType }> = ({
  type,
}) => {
  const { pillar, loading } = useUserPillar()
  const label = PROGRAMME_COMPONENT_LABEL[type].toLowerCase()

  if (loading) {
    return <PlainNote>Loading your {label}…</PlainNote>
  }

  if (!pillar) {
    return (
      <PlainNote>
        Your {label} appears once your pathway is set. Free practitioners use the Digital
        Transformation Starter Kit - open Courses to begin Capstone Part A. Organisation learners:
        ask your partner if this stays empty.
      </PlainNote>
    )
  }

  const entry = (PILLAR_PROGRAMME_COMPONENTS[pillar] ?? []).find((item) => item.type === type)

  if (!entry || entry.status !== 'available') {
    return <PlainNote>Your {label} brief is being finalised - it will appear here shortly.</PlainNote>
  }

  const accentColor = PROGRAMME_COMPONENT_ACCENT[type]

  // Single-deliverable components (no parts) still render as one row so the
  // checklist and the courses page look the same.
  const parts: ProgrammeComponentPart[] =
    entry.parts && entry.parts.length > 0
      ? entry.parts
      : entry.href
        ? [{ id: entry.id, title: entry.title, description: entry.description, href: entry.href }]
        : []

  if (parts.length === 0) {
    return <PlainNote>Your {label} brief is being finalised - it will appear here shortly.</PlainNote>
  }

  return (
    <ProgrammeComponentPartsList
      parts={parts}
      accentColor={accentColor}
      ctaLabel={parts.length === 1 ? `Open ${label}` : 'Begin part'}
    />
  )
}
