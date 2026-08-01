import { useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { Check, ChevronDown, Search } from 'lucide-react'

export interface ResultOption {
  /** Stored value, e.g. 'INTJ' or 'Adventure'. */
  value: string
  /** Display text, e.g. 'INTJ - The Architect'. */
  label: string
  group?: string
}

interface TestResultPickerProps {
  /** 'single' commits on pick; 'multi' accumulates up to maxSelections. */
  mode: 'single' | 'multi'
  options: ResultOption[]
  /** Current selection - a value for 'single', values for 'multi'. */
  selected: string[]
  onChange: (next: string[]) => void
  placeholder: string
  maxSelections?: number
  isDisabled?: boolean
  isSaving?: boolean
}

/**
 * Compact searchable picker for test results. Learners pick the score they
 * actually got rather than typing it, and typing filters by code OR full name -
 * so "intj" and "architect" both land on `INTJ - The Architect`, and the closed
 * trigger always shows the full name rather than the bare code.
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
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const labelByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option.label])),
    [options],
  )

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return options
    // Match the code and the full name, so either half of "INTJ - The
    // Architect" finds the option.
    return options.filter(
      (option) =>
        option.value.toLowerCase().includes(term) ||
        option.label.toLowerCase().includes(term),
    )
  }, [options, query])

  /** Preserve the source ordering of groups while grouping for display. */
  const grouped = useMemo(() => {
    const groups: Array<{ name: string | undefined; items: ResultOption[] }> = []
    filtered.forEach((option) => {
      const last = groups[groups.length - 1]
      if (last && last.name === option.group) last.items.push(option)
      else groups.push({ name: option.group, items: [option] })
    })
    return groups
  }, [filtered])

  const atLimit =
    mode === 'multi' && maxSelections !== undefined && selected.length >= maxSelections

  const triggerLabel = useMemo(() => {
    if (!selected.length) return placeholder
    if (mode === 'single') return labelByValue.get(selected[0]) ?? selected[0]
    if (selected.length === 1) return labelByValue.get(selected[0]) ?? selected[0]
    return `${selected.length} selected`
  }, [labelByValue, mode, placeholder, selected])

  const toggle = (value: string) => {
    if (mode === 'single') {
      onChange([value])
      setQuery('')
      onClose()
      return
    }
    if (selected.includes(value)) {
      onChange(selected.filter((entry) => entry !== value))
      return
    }
    if (atLimit) return
    onChange([...selected, value])
  }

  return (
    <Popover
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={() => {
        setQuery('')
        onClose()
      }}
      placement="bottom-start"
      initialFocusRef={searchRef}
      matchWidth
    >
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
      <PopoverContent w="full" maxW="320px">
        <PopoverBody p={0}>
          <Stack spacing={0}>
            <HStack px={2} py={1.5} borderBottomWidth="1px" borderColor="gray.100" spacing={1.5}>
              <Box as={Search} w={3} h={3} color="gray.400" flexShrink={0} />
              <Input
                ref={searchRef}
                size="xs"
                variant="unstyled"
                placeholder="Type your result..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                fontSize="2xs"
              />
            </HStack>

            {mode === 'multi' && maxSelections !== undefined && (
              <Text px={2} py={1} fontSize="2xs" color="gray.500" bg="gray.50">
                {selected.length} of {maxSelections} selected
              </Text>
            )}

            <Box maxH="220px" overflowY="auto">
              {!filtered.length && (
                <Text px={2} py={3} fontSize="2xs" color="gray.500" textAlign="center">
                  No match for "{query}"
                </Text>
              )}

              {grouped.map((group) => (
                <Box key={group.name ?? '_'}>
                  {group.name && (
                    <Text
                      px={2}
                      py={1}
                      fontSize="2xs"
                      fontWeight="bold"
                      textTransform="uppercase"
                      letterSpacing="wide"
                      color="gray.500"
                      bg="gray.50"
                      position="sticky"
                      top={0}
                    >
                      {group.name}
                    </Text>
                  )}
                  {group.items.map((option) => {
                    const isSelected = selected.includes(option.value)
                    // Unselected options stop being pickable once the cap is hit,
                    // but selected ones must stay clickable to deselect.
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
              ))}
            </Box>
          </Stack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  )
}
