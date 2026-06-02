import { useState } from 'react'
import { Button, HStack, Icon, Stack, Text } from '@chakra-ui/react'
import { ArrowUpRight, Check } from 'lucide-react'
import {
  PROGRAMME_COMPONENT_LABEL,
  type ProgrammeComponentPart,
  type ProgrammeComponentType,
} from '@/config/pillarProgrammeComponents'
import { TYPE_VISUALS } from './programmeComponentVisuals'

interface ProgrammeComponentPartsPickerProps {
  parts: ProgrammeComponentPart[]
  type: ProgrammeComponentType
}

/**
 * The inline "pick a part" control shared by the courses page card and the
 * weekly-checklist row: lists every part as a directly-selectable option,
 * then shows the chosen part's description and a launch button.
 */
export const ProgrammeComponentPartsPicker = ({ parts, type }: ProgrammeComponentPartsPickerProps) => {
  const visual = TYPE_VISUALS[type]
  const [selectedPartId, setSelectedPartId] = useState<string>(parts[0]?.id ?? '')
  const selectedPart = parts.find((p) => p.id === selectedPartId) ?? parts[0]
  if (!selectedPart) return null

  return (
    <Stack spacing={3}>
      <Stack spacing={1.5}>
        {parts.map((part) => {
          const isSelected = part.id === selectedPartId
          return (
            <HStack
              key={part.id}
              as="button"
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelectedPartId(part.id)}
              spacing={2.5}
              w="full"
              cursor="pointer"
              px={3}
              py={2}
              borderRadius="md"
              border="1px solid"
              borderColor={isSelected ? visual.brand : 'brand.border'}
              bg={isSelected ? visual.iconBg : 'white'}
              transition="all 0.15s ease"
              _hover={{ borderColor: visual.brand, bg: visual.iconBg }}
              _focusVisible={{
                outline: 'none',
                borderColor: visual.focusBorder,
                boxShadow: `0 0 0 1px ${visual.focusBorder}`,
              }}
            >
              <Text
                flex="1"
                textAlign="left"
                fontSize="sm"
                fontWeight={isSelected ? 'semibold' : 'medium'}
                color={isSelected ? '#27062e' : 'gray.700'}
                noOfLines={1}
              >
                {part.title}
              </Text>
              {isSelected && <Icon as={Check} boxSize={4} color={visual.brand} flexShrink={0} />}
            </HStack>
          )
        })}
      </Stack>

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
        alignSelf="flex-start"
      >
        Begin {PROGRAMME_COMPONENT_LABEL[type].toLowerCase()} part
      </Button>
    </Stack>
  )
}

export default ProgrammeComponentPartsPicker
