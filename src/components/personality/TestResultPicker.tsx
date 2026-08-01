import { useMemo } from 'react'
import {
  Box,
  Button,
  Flex,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Portal,
  Select,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { Check, ChevronDown } from 'lucide-react'

export interface ResultOption {
  /** Stored value, e.g. 'INTJ' or 'Adventure'. */
  value: string
  /** Display text, e.g. 'INTJ - The Architect'. */
  label: string
  group?: string
}

interface TestResultPickerProps {
  /** 'single' is a plain dropdown; 'multi' accumulates up to maxSelections. */
  mode: 'single' | 'multi'
  options: ResultOption[]
  /** Current selection - one value for 'single', many for 'multi'. */
  selected: string[]
  onChange: (next: string[]) => void
  placeholder: string
  maxSelections?: number
  isDisabled?: boolean
  isSaving?: boolean
}

/** Preserve source ordering while grouping options for display. */
const groupOptions = (options: ResultOption[]) => {
  const groups: Array<{ name: string | undefined; items: ResultOption[] }> = []
  options.forEach(option => {
    const last = groups[groups.length - 1]
    if (last && last.name === option.group) last.items.push(option)
    else groups.push({ name: option.group, items: [option] })
  })
  return groups
}

/**
 * Dropdown of every possible outcome of a test, so learners select the score
 * they got. Single-result tests use a native select (options read as the full
 * name, e.g. `INTJ - The Architect`); tests that yield a set of results use a
 * checkbox dropdown capped at maxSelections.
 */
export const TestResultPicker = ({
  mode,
  options,
  selected,
  onChange,
  placeholder,
  maxSelections,
  isDisabled,
  isSaving,
}: TestResultPickerProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  const labelByValue = useMemo(
    () => new Map(options.map(option => [option.value, option.label])),
    [options]
  )
  const grouped = useMemo(() => groupOptions(options), [options])

  if (mode === 'single') {
    return (
      <Select
        size="xs"
        bg="white"
        borderColor="gray.300"
        fontSize="2xs"
        placeholder={placeholder}
        value={selected[0] ?? ''}
        onChange={event => onChange(event.target.value ? [event.target.value] : [])}
        isDisabled={isDisabled || isSaving}
      >
        {grouped.map(group =>
          group.name ? (
            <optgroup key={group.name} label={group.name}>
              {group.items.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ) : (
            group.items.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          )
        )}
      </Select>
    )
  }

  const atLimit = maxSelections !== undefined && selected.length >= maxSelections

  const triggerLabel = selected.length
    ? selected.length === 1
      ? (labelByValue.get(selected[0]) ?? selected[0])
      : `${selected.length} selected`
    : placeholder

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(entry => entry !== value))
      return
    }
    if (atLimit) return
    onChange([...selected, value])
  }

  return (
    <Popover isOpen={isOpen} onOpen={onOpen} onClose={onClose} placement="bottom-start" matchWidth>
      <PopoverTrigger>
        <Button
          size="xs"
          w="full"
          bg="white"
          variant="outline"
          borderColor="gray.300"
          fontWeight="normal"
          fontSize="2xs"
          justifyContent="space-between"
          rightIcon={<Box as={ChevronDown} w={3} h={3} />}
          isDisabled={isDisabled}
          isLoading={isSaving}
        >
          <Text
            noOfLines={1}
            color={selected.length ? 'gray.800' : 'gray.400'}
            fontSize="2xs"
            textAlign="left"
          >
            {triggerLabel}
          </Text>
        </Button>
      </PopoverTrigger>
      {/* Portalled so the list escapes the surrounding card - without this the
          dropdown is clipped by the card's overflow, unlike the native select
          used for single-result tests, which the browser always paints on top. */}
      <Portal>
        <PopoverContent w="full" maxW="320px" zIndex="popover">
          <PopoverBody p={0}>
            <Stack spacing={0}>
              {maxSelections !== undefined && (
                <Text
                  px={2}
                  py={1}
                  fontSize="2xs"
                  color="gray.500"
                  bg="gray.50"
                  borderBottomWidth="1px"
                  borderColor="gray.100"
                >
                  {selected.length} of {maxSelections} selected
                </Text>
              )}
              <Box maxH="220px" overflowY="auto">
                {options.map(option => {
                  const isSelected = selected.includes(option.value)
                  // Unselected options stop being pickable at the cap, but
                  // selected ones stay clickable so they can be removed.
                  const isBlocked = !isSelected && atLimit
                  return (
                    <Flex
                      key={option.value}
                      as="button"
                      type="button"
                      w="full"
                      align="center"
                      justify="space-between"
                      px={2}
                      py={1.5}
                      textAlign="left"
                      bg={isSelected ? 'purple.50' : 'transparent'}
                      opacity={isBlocked ? 0.4 : 1}
                      cursor={isBlocked ? 'not-allowed' : 'pointer'}
                      _hover={{ bg: isBlocked ? 'transparent' : 'gray.50' }}
                      onClick={() => !isBlocked && toggle(option.value)}
                      disabled={isBlocked}
                    >
                      <Text fontSize="2xs" color="gray.800" noOfLines={1}>
                        {option.label}
                      </Text>
                      {isSelected && (
                        <Box as={Check} w={3} h={3} color="purple.600" flexShrink={0} />
                      )}
                    </Flex>
                  )
                })}
              </Box>
            </Stack>
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  )
}
