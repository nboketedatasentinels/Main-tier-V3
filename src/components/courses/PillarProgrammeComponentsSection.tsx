import React, { useState } from 'react'
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
import { Award, BookMarked, Wrench, AlertCircle, ExternalLink, type LucideIcon } from 'lucide-react'
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

/**
 * Renders the three pillar-scoped programme components (Capstone, Case
 * Study, Practical) on the user's courses page. Returns null when the org
 * has no pillar set so the section is hidden rather than showing an empty
 * state.
 *
 * Visual weight matches the courses timeline above it: these are NOT
 * optional — they're a parallel completion track learners must finish
 * alongside their pillar courses. Each component type has its own color +
 * icon so a learner sees three distinct deliverables, not three of the
 * same thing.
 */
export const PillarProgrammeComponentsSection: React.FC<Props> = ({ pillar }) => {
  if (!pillar) return null
  const entries = PILLAR_PROGRAMME_COMPONENTS[pillar] ?? []
  if (entries.length === 0) return null
  const pillarLabel = PILLAR_METADATA[pillar].shortName

  return (
    <Box
      borderWidth="2px"
      borderColor="purple.200"
      borderRadius="2xl"
      p={{ base: 5, md: 6 }}
      bg="white"
      boxShadow="md"
    >
      <Stack spacing={5}>
        <Stack spacing={3}>
          <HStack spacing={3} align="center" wrap="wrap">
            <Heading size="md" color="gray.900">
              Programme components
            </Heading>
            <Badge colorScheme="red" textTransform="none" px={2} py={1}>
              Required
            </Badge>
            <Badge colorScheme="purple" textTransform="none" px={2} py={1}>
              {pillarLabel}
            </Badge>
          </HStack>
          <Text color="gray.700" fontSize="sm">
            Three applied deliverables to demonstrate mastery of your pillar.{' '}
            <Text as="span" fontWeight="semibold" color="gray.900">
              All three must be completed
            </Text>{' '}
            alongside your courses to finish the programme.
          </Text>
          <HStack
            spacing={2}
            align="center"
            bg="orange.50"
            borderWidth="1px"
            borderColor="orange.200"
            borderRadius="md"
            px={3}
            py={2}
          >
            <Icon as={AlertCircle} boxSize={4} color="orange.600" />
            <Text fontSize="xs" color="orange.800" fontWeight="medium">
              Courses + Capstone + Case Study + Practical are all required.
              Finishing only the courses won&apos;t complete your programme.
            </Text>
          </HStack>
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

const TYPE_VISUALS: Record<ProgrammeComponentType, { icon: LucideIcon; accent: string; iconBg: string; iconColor: string }> = {
  capstone: { icon: Award, accent: 'purple', iconBg: 'purple.50', iconColor: 'purple.600' },
  case_study: { icon: BookMarked, accent: 'blue', iconBg: 'blue.50', iconColor: 'blue.600' },
  practical: { icon: Wrench, accent: 'teal', iconBg: 'teal.50', iconColor: 'teal.600' },
}

const STATUS_BADGE: Record<ProgrammeComponentEntry['status'], { label: string; colorScheme: string }> = {
  available: { label: 'Available', colorScheme: 'green' },
  coming_soon: { label: 'Coming soon', colorScheme: 'gray' },
  locked: { label: 'Locked', colorScheme: 'orange' },
}

const ProgrammeComponentCard: React.FC<{ entry: ProgrammeComponentEntry }> = ({ entry }) => {
  const visual = TYPE_VISUALS[entry.type]
  const status = STATUS_BADGE[entry.status]
  const isDisabled = entry.status !== 'available'
  const hasParts = !!entry.parts && entry.parts.length > 0

  const [selectedPartId, setSelectedPartId] = useState<string>(
    hasParts ? entry.parts![0].id : '',
  )
  const selectedPart = hasParts
    ? entry.parts!.find((p) => p.id === selectedPartId) ?? entry.parts![0]
    : null

  return (
    <Box
      id={`pillar-component-${entry.type}`}
      scrollMarginTop="20px"
      borderWidth="1px"
      borderColor={`${visual.accent}.100`}
      borderRadius="xl"
      p={4}
      bg="gray.50"
      h="full"
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
      _hover={isDisabled ? undefined : { borderColor: `${visual.accent}.400`, bg: 'white', boxShadow: 'sm' }}
      transition="all 0.15s"
    >
      <Stack spacing={3} mb={3}>
        <HStack justify="space-between" align="flex-start">
          <HStack spacing={2}>
            <Box p={2} borderRadius="lg" bg={visual.iconBg} color={visual.iconColor}>
              <Icon as={visual.icon} boxSize={4} />
            </Box>
            <Badge colorScheme={visual.accent} textTransform="none">
              {PROGRAMME_COMPONENT_LABEL[entry.type]}
            </Badge>
          </HStack>
          <Badge colorScheme={status.colorScheme} textTransform="none">
            {status.label}
          </Badge>
        </HStack>
        <Stack spacing={1}>
          <Text fontWeight="bold" color="gray.900" fontSize="md">
            {entry.title}
          </Text>
          <Text color="gray.600" fontSize="sm">
            {entry.description}
          </Text>
        </Stack>
        <Badge
          colorScheme="red"
          variant="subtle"
          textTransform="none"
          alignSelf="flex-start"
          fontSize="2xs"
        >
          Required
        </Badge>
      </Stack>

      {hasParts && !isDisabled && selectedPart ? (
        <Stack spacing={2} mt={1}>
          <Text fontSize="xs" color="gray.600" fontWeight="medium">
            Choose a part to open
          </Text>
          <Select
            size="sm"
            bg="white"
            borderColor={`${visual.accent}.200`}
            focusBorderColor={`${visual.accent}.500`}
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
            <Text fontSize="xs" color="gray.600" lineHeight="1.5">
              {selectedPart.description}
            </Text>
          )}
          <Button
            as="a"
            href={selectedPart.href}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            colorScheme={visual.accent}
            rightIcon={<Icon as={ExternalLink} boxSize={3.5} />}
            alignSelf="flex-start"
            mt={1}
          >
            Open part
          </Button>
          <Text fontSize="xs" color="gray.500" fontStyle="italic" mt={1}>
            {entry.parts!.length === 2
              ? 'Both parts required.'
              : `All ${entry.parts!.length} parts required.`}
          </Text>
        </Stack>
      ) : (
        <Button
          as={entry.href && !isDisabled ? 'a' : undefined}
          href={entry.href && !isDisabled ? entry.href : undefined}
          target={entry.href && !isDisabled ? '_blank' : undefined}
          rel={entry.href && !isDisabled ? 'noopener noreferrer' : undefined}
          size="sm"
          colorScheme={visual.accent}
          variant={isDisabled ? 'outline' : 'solid'}
          isDisabled={isDisabled}
          alignSelf="flex-start"
        >
          {isDisabled ? status.label : `Start ${PROGRAMME_COMPONENT_LABEL[entry.type].toLowerCase()}`}
        </Button>
      )}
    </Box>
  )
}
