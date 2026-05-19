import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Icon,
  Select,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { Award, BookMarked, Wrench, ArrowUpRight, type LucideIcon } from 'lucide-react'
import {
  PILLAR_PROGRAMME_COMPONENTS,
  PROGRAMME_COMPONENT_LABEL,
  type ProgrammeComponentEntry,
  type ProgrammeComponentType,
} from '@/config/pillarProgrammeComponents'
import { PILLAR_METADATA, type Pillar } from '@/types/pillar'

interface Props {
  pillar: Pillar | null
}

export const PillarProgrammeComponentsSection: React.FC<Props> = ({ pillar }) => {
  const location = useLocation()
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (location.hash !== '#programme-components') return
    const node = containerRef.current
    if (!node) return
    // Defer to next frame so layout is settled before we scroll.
    const id = window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(id)
  }, [location.hash, pillar])

  if (!pillar) return null
  const entries = PILLAR_PROGRAMME_COMPONENTS[pillar] ?? []
  if (entries.length === 0) return null
  const pillarLabel = PILLAR_METADATA[pillar].shortName

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
            Three applied deliverables that, alongside your courses, complete the programme.
          </Text>
        </Stack>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          {entries.map((entry) => (
            <ProgrammeComponentCard key={entry.id} entry={entry} />
          ))}
        </SimpleGrid>
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

const ProgrammeComponentCard: React.FC<{ entry: ProgrammeComponentEntry }> = ({ entry }) => {
  const visual = TYPE_VISUALS[entry.type]
  const status = STATUS_BADGE[entry.status]
  const isDisabled = entry.status !== 'available'
  const hasParts = !!entry.parts && entry.parts.length > 0
  const partCount = entry.parts?.length ?? 0

  const [selectedPartId, setSelectedPartId] = useState<string>(
    hasParts ? entry.parts![0].id : '',
  )
  const selectedPart = hasParts
    ? entry.parts!.find((p) => p.id === selectedPartId) ?? entry.parts![0]
    : null

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
      h="full"
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

      <Stack
        spacing={4}
        p={{ base: 4, md: 5 }}
        flex="1"
        justify="space-between"
      >
        <Stack spacing={4}>
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

        {hasParts && !isDisabled && selectedPart ? (
          <Stack spacing={3}>
            <Select
              size="sm"
              bg="gray.50"
              borderColor="gray.200"
              borderRadius="md"
              fontWeight="medium"
              fontSize="sm"
              _focusVisible={{ borderColor: visual.focusBorder, boxShadow: `0 0 0 1px ${visual.focusBorder}` }}
              value={selectedPartId}
              onChange={(e) => setSelectedPartId(e.target.value)}
              aria-label={`Select ${PROGRAMME_COMPONENT_LABEL[entry.type]} part`}
            >
              {entry.parts!.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.title}
                </option>
              ))}
            </Select>
            {selectedPart.description && (
              <Text fontSize="xs" color="gray.500" lineHeight="1.55" minH="2.5em">
                {selectedPart.description}
              </Text>
            )}
            <Button
              as="a"
              href={selectedPart.href}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              bg={visual.brand}
              color="white"
              _hover={{ bg: visual.brandHover }}
              _active={{ bg: visual.brandHover }}
              rightIcon={<Icon as={ArrowUpRight} boxSize={3.5} />}
              borderRadius="md"
              fontWeight="semibold"
              letterSpacing="0.01em"
            >
              Begin part
            </Button>
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
