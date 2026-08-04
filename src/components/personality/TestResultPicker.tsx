import { useMemo, useRef, useState } from 'react'
import {
  Box,
  Flex,
  Input,
  InputGroup,
  InputRightElement,
  Popover,
  PopoverAnchor,
  PopoverBody,
  PopoverContent,
  Portal,
  Stack,
  Text,
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
  /** 'single' replaces the selection; 'multi' accumulates up to maxSelections. */
  mode: 'single' | 'multi'
  options: ResultOption[]
  /** Current selection - one value for 'single', many for 'multi'. */
  selected: string[]
  onChange: (next: string[]) => void
  placeholder: string
  maxSelections?: number
  isDisabled?: boolean
  isSaving?: boolean
  /**
   * Soft lock (e.g. waiting for the 1-hour test cooldown). Field stays clickable
   * so we can show a "finish your test / wait X minutes" message instead of
   * silently disabling.
   */
  isLocked?: boolean
  onLockedAttempt?: () => void
}

/**
 * Typeahead dropdown of every possible outcome of a test. Typing filters from
 * the first character against BOTH the code and the full name, so "i" narrows
 * to the I-types and "arch" finds `INTJ - The Architect`. Clicking the field
 * with no text shows the whole list, so it still works as a plain dropdown.
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
  isLocked,
  onLockedAttempt,
}: TestResultPickerProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const labelByValue = useMemo(
    () => new Map(options.map(option => [option.value, option.label])),
    [options]
  )

  const atLimit = maxSelections !== undefined && selected.length >= maxSelections

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return options
    return options.filter(
      option =>
        option.value.toLowerCase().includes(term) || option.label.toLowerCase().includes(term)
    )
  }, [options, query])

  /** What the closed field reads as: the picked result, or a count for sets. */
  const settledLabel = useMemo(() => {
    if (!selected.length) return ''
    if (selected.length === 1) return (labelByValue.get(selected[0]) ?? selected[0])
    return `${selected.length} selected`
  }, [labelByValue, selected])

  const tryOpen = () => {
    if (isDisabled || isSaving) return
    if (isLocked) {
      onLockedAttempt?.()
      return
    }
    setIsOpen(true)
    // Highlight whatever is already showing so the first keystroke replaces it.
    // Without this, typing appends to "INTJ - The Architect" and matches nothing.
    inputRef.current?.select()
  }

  const close = () => {
    setIsOpen(false)
    setIsTyping(false)
    setQuery('')
  }

  const commit = (value: string) => {
    if (mode === 'single') {
      onChange([value])
      close()
      return
    }
    if (selected.includes(value)) {
      onChange(selected.filter(entry => entry !== value))
      return
    }
    if (atLimit) return
    onChange([...selected, value])
    // Clear the term so the next value can be typed straight away, but keep the
    // list open - a set of 5 is picked in one sitting.
    setQuery('')
    setIsTyping(false)
    inputRef.current?.focus()
  }

  return (
    <Popover
      isOpen={isOpen}
      onClose={close}
      placement="bottom-start"
      matchWidth
      autoFocus={false}
      closeOnBlur
    >
      <PopoverAnchor>
        <InputGroup size="xs">
          <Input
            ref={inputRef}
            bg={isLocked ? 'orange.50' : 'white'}
            borderColor={isLocked ? 'orange.200' : 'gray.300'}
            color={isLocked ? 'orange.800' : undefined}
            fontSize="2xs"
            pr={6}
            placeholder={placeholder}
            // While typing the field shows the term; otherwise it shows what is
            // actually saved, so the full name is always visible when settled.
            value={isTyping ? query : settledLabel}
            isDisabled={isDisabled || isSaving}
            readOnly={Boolean(isLocked)}
            cursor={isLocked ? 'pointer' : undefined}
            _placeholder={isLocked ? { color: 'orange.600', opacity: 1 } : undefined}
            onFocus={tryOpen}
            onClick={tryOpen}
            onChange={event => {
              if (isLocked) {
                onLockedAttempt?.()
                return
              }
              setQuery(event.target.value)
              setIsTyping(true)
              setIsOpen(true)
            }}
            onKeyDown={event => {
              if (isLocked) {
                event.preventDefault()
                onLockedAttempt?.()
                return
              }
              if (event.key === 'Escape') {
                close()
                return
              }
              if (event.key === 'Enter' && isOpen && filtered.length) {
                event.preventDefault()
                commit(filtered[0].value)
              }
            }}
          />
          <InputRightElement w={6} pointerEvents="none">
            <Box as={ChevronDown} w={3} h={3} color={isLocked ? 'gray.400' : 'gray.500'} />
          </InputRightElement>
        </InputGroup>
      </PopoverAnchor>

      {/* Portalled so the list escapes the surrounding card's overflow. */}
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
                {!filtered.length && (
                  <Text px={2} py={3} fontSize="2xs" color="gray.500" textAlign="center">
                    No match for "{query}"
                  </Text>
                )}

                {filtered.map(option => {
                  const isSelected = selected.includes(option.value)
                  // Unselected options stop being pickable at the cap, but
                  // selected ones stay clickable so they can be removed.
                  const isBlocked = mode === 'multi' && !isSelected && atLimit
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
                      // Keep focus in the input so the field does not blur and
                      // close the list before the click lands.
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => !isBlocked && commit(option.value)}
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
