import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Badge,
  Box,
  Button,
  Collapse,
  Flex,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import {
  Award,
  BookMarked,
  Wrench,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react'
import {
  PILLAR_PROGRAMME_COMPONENTS,
  PROGRAMME_COMPONENT_LABEL,
  type ProgrammeComponentEntry,
  type ProgrammeComponentType,
} from '@/config/pillarProgrammeComponents'
import { PILLAR_METADATA, type Pillar } from '@/types/pillar'

interface Props {
  pillar: Pillar | null
  /** When true, render only the three cards (no section chrome). Used under Week 1 on the checklist. */
  cardsOnly?: boolean
}

export const PillarProgrammeComponentsSection: React.FC<Props> = ({ pillar, cardsOnly = false }) => {
  const location = useLocation()
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (cardsOnly) return
    if (location.hash !== '#programme-components') return
    const node = containerRef.current
    if (!node) return
    // Defer to next frame so layout is settled before we scroll.
    const id = window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(id)
  }, [cardsOnly, location.hash, pillar])

  if (!pillar) return null
  const entries = PILLAR_PROGRAMME_COMPONENTS[pillar] ?? []
  if (entries.length === 0) return null
  const pillarLabel = PILLAR_METADATA[pillar].shortName

  const cards = (
    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} alignItems="start">
      {entries.map((entry) => (
        <ProgrammeComponentCard key={entry.id} entry={entry} />
      ))}
    </SimpleGrid>
  )

  if (cardsOnly) {
    return (
      <Box px={{ base: 3, md: 4 }} py={4} bg="white" borderBottom="1px solid" borderColor="gray.100">
        {cards}
      </Box>
    )
  }

  return (
    <Box
      ref={containerRef}
      id="programme-components"
      scrollMarginTop="80px"
      borderRadius="2xl"
      p={{ base: 5, md: 7 }}
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      boxShadow="sm"
    >
      <Stack spacing={6}>
        <Stack spacing={2}>
          <HStack spacing={2} align="center" wrap="wrap">
            <Text
              color="#350e6f"
              textTransform="uppercase"
              letterSpacing="0.16em"
              fontSize="xs"
              fontWeight="bold"
            >
              {pillarLabel}
            </Text>
            <Box boxSize={1} borderRadius="full" bg="gray.300" />
            <Text
              color="gray.500"
              textTransform="uppercase"
              letterSpacing="0.16em"
              fontSize="xs"
              fontWeight="semibold"
            >
              Required to complete the programme
            </Text>
          </HStack>
          <Heading
            size="lg"
            color="#27062e"
            letterSpacing="-0.02em"
            fontWeight="bold"
          >
            Programme components
          </Heading>
          <Text color="gray.700" fontSize="sm" maxW="2xl" lineHeight="1.65">
            {pillar === 'starter_kit'
              ? 'Complete Capstone Parts A (One-Page Proposal), B (Project Scope), and C (Status Report) in order. All three are marked together as your Combined Capstone.'
              : 'Three applied deliverables that, alongside your courses, complete the programme.'}
          </Text>
        </Stack>

        {cards}
      </Stack>
    </Box>
  )
}

interface TypeVisual {
  icon: LucideIcon
  brand: string
  brandHover: string
  iconBg: string
  iconColor: string
  eyebrowColor: string
  focusBorder: string
}

const TYPE_VISUALS: Record<ProgrammeComponentType, TypeVisual> = {
  capstone: {
    icon: Award,
    brand: '#350e6f',
    brandHover: '#27062e',
    iconBg: '#f4f0fb',
    iconColor: '#350e6f',
    eyebrowColor: '#350e6f',
    focusBorder: '#350e6f',
  },
  case_study: {
    icon: BookMarked,
    brand: '#eab130',
    brandHover: '#b58721',
    iconBg: '#fdf6e3',
    iconColor: '#8a6310',
    eyebrowColor: '#8a6310',
    focusBorder: '#eab130',
  },
  practical: {
    icon: Wrench,
    brand: '#f4540c',
    brandHover: '#c4400a',
    iconBg: '#fdece1',
    iconColor: '#c4400a',
    eyebrowColor: '#c4400a',
    focusBorder: '#f4540c',
  },
}

const STATUS_BADGE: Record<ProgrammeComponentEntry['status'], { label: string; bg: string; color: string }> = {
  available: { label: 'Available', bg: 'gray.100', color: 'gray.700' },
  coming_soon: { label: 'Coming soon', bg: 'gray.100', color: 'gray.600' },
  locked: { label: 'Locked', bg: 'orange.50', color: 'orange.700' },
}

const cleanTitle = (raw: string): string => raw.replace(/\s*\(.*?\)\s*$/, '').trim()

/** Dark purple - the action colour for every part row in the dropdown. */
const PART_BUTTON_BG = '#350e6f'
const PART_BUTTON_BG_HOVER = '#27062e'

const ProgrammeComponentCard: React.FC<{ entry: ProgrammeComponentEntry }> = ({ entry }) => {
  const location = useLocation()
  const visual = TYPE_VISUALS[entry.type]
  const status = STATUS_BADGE[entry.status]
  const isDisabled = entry.status !== 'available'
  const hasParts = !!entry.parts && entry.parts.length > 0
  const partCount = entry.parts?.length ?? 0
  const isExpandable = hasParts && !isDisabled

  const [isExpanded, setIsExpanded] = useState(false)

  // Deep links from the "Programme requirements" chips point at
  // #pillar-component-<type> - open the dropdown so the learner lands on the
  // parts, not on a card they have to click again.
  useEffect(() => {
    if (!isExpandable) return
    if (location.hash !== `#pillar-component-${entry.type}`) return
    setIsExpanded(true)
  }, [entry.type, isExpandable, location.hash])

  const title = cleanTitle(entry.title)

  return (
    <Box
      id={`pillar-component-${entry.type}`}
      scrollMarginTop="20px"
      position="relative"
      borderRadius="xl"
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      overflow="hidden"
      // Height follows content only - never stretch to match an expanded sibling.
      h="auto"
      alignSelf="start"
      display="flex"
      flexDirection="column"
      transition="all 0.2s ease"
      _hover={
        isDisabled
          ? undefined
          : {
              borderColor: visual.brand,
              boxShadow: '0 8px 24px -12px rgba(39, 6, 46, 0.18)',
              transform: 'translateY(-2px)',
            }
      }
    >
      <Box h="3px" bg={visual.brand} />

      <Stack spacing={4} p={{ base: 4, md: 5 }}>
        <Stack
          spacing={4}
          as={isExpandable ? 'button' : undefined}
          type={isExpandable ? 'button' : undefined}
          onClick={isExpandable ? () => setIsExpanded((prev) => !prev) : undefined}
          textAlign={isExpandable ? 'left' : undefined}
          w={isExpandable ? 'full' : undefined}
          cursor={isExpandable ? 'pointer' : undefined}
          aria-expanded={isExpandable ? isExpanded : undefined}
          aria-controls={isExpandable ? `pillar-component-parts-${entry.type}` : undefined}
          _focusVisible={
            isExpandable
              ? { outline: '2px solid', outlineColor: visual.focusBorder, outlineOffset: '2px' }
              : undefined
          }
        >
          <HStack justify="space-between" align="center">
            <HStack spacing={2.5} align="center">
              <Box
                p={2}
                borderRadius="lg"
                bg={visual.iconBg}
                color={visual.iconColor}
                display="inline-flex"
              >
                <Icon as={visual.icon} boxSize={4} />
              </Box>
              <Text
                fontSize="xs"
                fontWeight="bold"
                letterSpacing="0.14em"
                textTransform="uppercase"
                color={visual.eyebrowColor}
              >
                {PROGRAMME_COMPONENT_LABEL[entry.type]}
              </Text>
            </HStack>
            {isDisabled && (
              <Badge
                bg={status.bg}
                color={status.color}
                textTransform="none"
                fontSize="2xs"
                fontWeight="semibold"
                px={2}
                py={0.5}
                borderRadius="full"
              >
                {status.label}
              </Badge>
            )}
            {isExpandable && (
              <Icon
                as={isExpanded ? ChevronDown : ChevronRight}
                boxSize={4}
                color="gray.400"
                flexShrink={0}
              />
            )}
          </HStack>

          <Stack spacing={1.5}>
            <Heading
              as="h3"
              size="md"
              color="#27062e"
              fontWeight="bold"
              letterSpacing="-0.01em"
              lineHeight="1.25"
            >
              {title}
            </Heading>
            {hasParts ? (
              <Text fontSize="xs" color="gray.500" fontWeight="medium">
                {partCount} parts &middot; all required
              </Text>
            ) : (
              entry.description && (
                <Text fontSize="sm" color="gray.600" lineHeight="1.55">
                  {entry.description}
                </Text>
              )
            )}
          </Stack>
        </Stack>

        {isExpandable ? (
          <Stack spacing={3}>
            <Button
              size="sm"
              bg={PART_BUTTON_BG}
              color="white"
              _hover={{ bg: PART_BUTTON_BG_HOVER }}
              _active={{ bg: PART_BUTTON_BG_HOVER }}
              rightIcon={<Icon as={isExpanded ? ChevronDown : ChevronRight} boxSize={3.5} />}
              borderRadius="md"
              fontWeight="semibold"
              letterSpacing="0.01em"
              alignSelf="flex-start"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
              aria-controls={`pillar-component-parts-${entry.type}`}
            >
              {isExpanded ? 'Hide parts' : `View ${partCount} parts`}
            </Button>

            <Collapse in={isExpanded} animateOpacity>
              <Stack spacing={2} id={`pillar-component-parts-${entry.type}`}>
                {entry.parts!.map((part) => (
                  <Box
                    key={part.id}
                    p={3}
                    bg="white"
                    border="1px solid"
                    borderColor="gray.200"
                    borderLeftWidth="3px"
                    borderLeftColor={visual.brand}
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
                      >
                        Begin part
                      </Button>
                    </Flex>
                  </Box>
                ))}
              </Stack>
            </Collapse>
          </Stack>
        ) : (
          <Button
            as={entry.href && !isDisabled ? 'a' : undefined}
            href={entry.href && !isDisabled ? entry.href : undefined}
            target={entry.href && !isDisabled ? '_blank' : undefined}
            rel={entry.href && !isDisabled ? 'noopener noreferrer' : undefined}
            size="sm"
            bg={isDisabled ? 'transparent' : visual.brand}
            color={isDisabled ? 'gray.600' : 'white'}
            border={isDisabled ? '1px solid' : 'none'}
            borderColor="gray.300"
            _hover={isDisabled ? undefined : { bg: visual.brandHover }}
            _active={isDisabled ? undefined : { bg: visual.brandHover }}
            isDisabled={isDisabled}
            rightIcon={!isDisabled ? <Icon as={ArrowUpRight} boxSize={3.5} /> : undefined}
            borderRadius="md"
            fontWeight="semibold"
            letterSpacing="0.01em"
            alignSelf="flex-start"
          >
            {isDisabled ? status.label : `Begin ${PROGRAMME_COMPONENT_LABEL[entry.type].toLowerCase()}`}
          </Button>
        )}
      </Stack>
    </Box>
  )
}
