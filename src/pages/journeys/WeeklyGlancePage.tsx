import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  Heading,
  HStack,
  Input,
  Popover,
  PopoverAnchor,
  PopoverBody,
  PopoverContent,
  Portal,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Tag,
  TagCloseButton,
  TagLabel,
  Text,
  useToast,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc, FirestoreError } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { ORG_COLLECTION } from '@/constants/organizations'
import { resolveJourneyType } from '@/utils/journeyType'
import type { JourneyType } from '@/config/pointsConfig'
import {
  ArrowUpRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Fingerprint,
  Lock,
  Star,
  Target,
  TrendingUp,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { useWeeklyGlanceData, type LedgerEntry } from '@/hooks/useWeeklyGlanceData'
import { BuildVillageModal } from '@/components/modals/BuildVillageModal'
import { PreCourseSurveyScreen } from '@/components/survey/PreCourseSurveyScreen'
import { PERSONALITY_TYPES, CORE_VALUES, type PersonalityType } from '@/config/personality-data'
import { usePreCourseSurvey } from '@/hooks/usePreCourseSurvey'
import {
  completePreCourseSurvey,
  type PreCourseSurveyAnswers,
} from '@/services/preCourseSurveyService'
import { useAuth } from '@/hooks/useAuth'
import { TransformationTier, type UserProfile } from '@/types'
import { updateUserVillageId } from '@/services/userProfileService'
import { checkVillageNameExists, createVillage } from '@/services/villageService'
import { getJourneyTiming } from '@/utils/weekCalculations'
import { JOURNEY_META } from '@/config/pointsConfig'

function isCorporateUser(profile: UserProfile | null | undefined) {
  const tier = profile?.transformationTier
  return tier === TransformationTier.CORPORATE_MEMBER || tier === TransformationTier.CORPORATE_LEADER
}

function canCreateVillage(profile: UserProfile | null | undefined) {
  const hasVillageContext =
    !!profile?.villageId ||
    !!profile?.corporateVillageId ||
    !!profile?.companyId ||
    !!profile?.companyCode ||
    !!profile?.organizationId
  if (hasVillageContext) return false
  if (profile?.membershipStatus === 'paid') return false
  if (isCorporateUser(profile)) return false
  return true
}

interface PaceInfo {
  label: string
  detail: string
  tone: 'green' | 'yellow' | 'red'
}

/**
 * Pace measures the learner against a per-day linear target.
 *
 *   timeProgress       = daysElapsed / (totalWeeks * 7)
 *   expectedPointsNow  = timeProgress * journey max points
 *   delta%             = earned / expectedPointsNow - 1
 *
 * For a 6-week / 60,000-point journey the per-week ramp is:
 *   end of week 1 -> 10,000   week 4 -> 40,000
 *   end of week 2 -> 20,000   week 5 -> 50,000
 *   end of week 3 -> 30,000   week 6 -> 60,000
 *
 * Days 0-1 fall back to a "Just starting" label so a brand-new learner is not
 * flagged as 100% below pace on their first morning.
 */
function computeJourneyPace(params: {
  totalEarned: number
  journeyMax: number
  daysElapsed: number
  totalWeeks: number
}): PaceInfo {
  const { totalEarned, journeyMax, daysElapsed, totalWeeks } = params
  const totalDays = totalWeeks * 7

  if (journeyMax <= 0 || totalDays <= 0) {
    return { label: 'Just starting', detail: 'Tracking begins once your journey starts', tone: 'yellow' }
  }

  if (daysElapsed < 1) {
    return { label: 'Just starting', detail: 'Pace tracking starts after day 1', tone: 'yellow' }
  }

  const timeProgress = Math.min(1, daysElapsed / totalDays)
  const expectedPointsNow = timeProgress * journeyMax
  const deltaPct = expectedPointsNow > 0 ? Math.round((totalEarned / expectedPointsNow - 1) * 100) : 0

  if (deltaPct >= 5) {
    return { label: 'Ahead of pace', detail: `${Math.abs(deltaPct)}% above expected`, tone: 'green' }
  }
  if (deltaPct <= -10) {
    return { label: 'Behind pace', detail: `${Math.abs(deltaPct)}% below expected`, tone: 'red' }
  }
  return { label: 'On track', detail: 'Pace matches your journey timeline', tone: 'green' }
}

type KpiTheme = 'purple' | 'orange' | 'green' | 'yellow' | 'red' | 'blue' | 'slate'

interface KpiThemeStyles {
  iconBg: string
  iconShadow: string
  /** Soft pastel for the clean top-right corner quarter-circle ornament. */
  ornamentBg: string
  hoverShadow: string
  hoverBorder: string
  /** Soft accent color reused for badges / accents within the card. */
  accent: string
}

const kpiThemes: Record<KpiTheme, KpiThemeStyles> = {
  purple: {
    iconBg: 'linear-gradient(135deg, #4c1d95 0%, #27062e 100%)',
    iconShadow: '0 10px 24px rgba(53, 14, 111, 0.35)',
    ornamentBg: 'purple.50',
    hoverShadow: '0 18px 40px rgba(53, 14, 111, 0.18), 0 4px 12px rgba(53, 14, 111, 0.08)',
    hoverBorder: '#c4b5fd',
    accent: '#7c3aed',
  },
  orange: {
    iconBg: 'linear-gradient(135deg, #f4540c 0%, #9a3412 100%)',
    iconShadow: '0 10px 24px rgba(244, 84, 12, 0.35)',
    ornamentBg: 'orange.50',
    hoverShadow: '0 18px 40px rgba(244, 84, 12, 0.2), 0 4px 12px rgba(244, 84, 12, 0.08)',
    hoverBorder: '#fdba74',
    accent: '#c2410c',
  },
  green: {
    iconBg: 'linear-gradient(135deg, #059669 0%, #064e3b 100%)',
    iconShadow: '0 10px 24px rgba(4, 120, 87, 0.35)',
    ornamentBg: 'green.50',
    hoverShadow: '0 18px 40px rgba(4, 120, 87, 0.18), 0 4px 12px rgba(4, 120, 87, 0.08)',
    hoverBorder: '#86efac',
    accent: '#047857',
  },
  yellow: {
    iconBg: 'linear-gradient(135deg, #eab130 0%, #b45309 100%)',
    iconShadow: '0 10px 24px rgba(217, 119, 6, 0.35)',
    ornamentBg: 'yellow.50',
    hoverShadow: '0 18px 40px rgba(217, 119, 6, 0.18), 0 4px 12px rgba(217, 119, 6, 0.08)',
    hoverBorder: '#fcd34d',
    accent: '#b45309',
  },
  red: {
    iconBg: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)',
    iconShadow: '0 10px 24px rgba(220, 38, 38, 0.35)',
    ornamentBg: 'red.50',
    hoverShadow: '0 18px 40px rgba(220, 38, 38, 0.18), 0 4px 12px rgba(220, 38, 38, 0.08)',
    hoverBorder: '#fca5a5',
    accent: '#b91c1c',
  },
  blue: {
    iconBg: 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)',
    iconShadow: '0 10px 24px rgba(37, 99, 235, 0.35)',
    ornamentBg: 'blue.50',
    hoverShadow: '0 18px 40px rgba(37, 99, 235, 0.18), 0 4px 12px rgba(37, 99, 235, 0.08)',
    hoverBorder: '#93c5fd',
    accent: '#1d4ed8',
  },
  // Restrained, executive-grade slate. Used for "action needed" without the
  // alarm of red/orange.
  slate: {
    iconBg: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)',
    iconShadow: '0 10px 24px rgba(15, 23, 42, 0.35)',
    ornamentBg: 'slate.50',
    hoverShadow: '0 18px 40px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(15, 23, 42, 0.08)',
    hoverBorder: '#cbd5e1',
    accent: '#1e293b',
  },
}

const toneToTheme = (tone: 'default' | 'green' | 'yellow' | 'red'): KpiTheme => {
  if (tone === 'green') return 'green'
  if (tone === 'yellow') return 'yellow'
  if (tone === 'red') return 'red'
  return 'purple'
}

interface KpiTileProps {
  label: string
  value: string | number
  sub?: string
  icon: LucideIcon
  theme: KpiTheme
}

const KpiTile = ({ label, value, sub, icon, theme }: KpiTileProps) => {
  const styles = kpiThemes[theme]
  return (
    <Box
      p={6}
      bg="white"
      borderRadius="2xl"
      border="1px solid"
      borderColor="gray.100"
      boxShadow="0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.04)"
      _hover={{
        transform: 'translateY(-3px)',
        boxShadow: styles.hoverShadow,
        borderColor: styles.hoverBorder,
      }}
      transition="transform 0.35s cubic-bezier(0.4,0,0.2,1), box-shadow 0.35s ease, border-color 0.35s ease"
      position="relative"
      overflow="hidden"
      h="100%"
      minH="190px"
    >
      {/* Clean solid quarter-circle ornament in the top-right corner */}
      <Box
        position="absolute"
        top={0}
        right={0}
        w="80px"
        h="80px"
        bg={styles.ornamentBg}
        borderRadius="0 0 0 100%"
        pointerEvents="none"
      />

      <Stack spacing={4} position="relative" zIndex={1} h="100%">
        <Flex
          w={12}
          h={12}
          bg={styles.iconBg}
          borderRadius="2xl"
          align="center"
          justify="center"
          boxShadow={styles.iconShadow}
        >
          <Box as={icon} w={5} h={5} color="white" strokeWidth={2.25} />
        </Flex>

        <Stack spacing={1.5} flex={1}>
          <Text
            fontSize="xs"
            color="gray.500"
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="0.12em"
          >
            {label}
          </Text>
          <Text
            fontWeight="extrabold"
            fontSize={{ base: '3xl', lg: '4xl' }}
            color="gray.900"
            lineHeight="1"
            letterSpacing="-0.025em"
            sx={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {value}
          </Text>
          {sub && (
            <Text fontSize="sm" color="gray.500" fontWeight="medium" mt={1}>
              {sub}
            </Text>
          )}
        </Stack>
      </Stack>
    </Box>
  )
}

interface ActivityRowProps {
  entry: LedgerEntry
}

const ActivityRow = ({ entry }: ActivityRowProps) => {
  const positive = entry.points > 0
  return (
    <Flex
      justify="space-between"
      align="center"
      py={3}
      borderBottomWidth="1px"
      borderColor="gray.100"
      _last={{ borderBottomWidth: 0 }}
    >
      <HStack spacing={3} minW={0} flex={1}>
        <Box
          w={8}
          h={8}
          rounded="full"
          bg={positive ? 'green.50' : 'gray.100'}
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Box as={CheckCircle2} w={4} h={4} color={positive ? 'green.500' : 'gray.400'} />
        </Box>
        <Stack spacing={0} minW={0} flex={1}>
          <Text fontSize="sm" fontWeight="medium" color="gray.800" noOfLines={1}>
            {entry.activityTitle}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {formatDistanceToNow(entry.createdAt, { addSuffix: true })}
          </Text>
        </Stack>
      </HStack>
      <Text
        fontSize="sm"
        fontWeight="semibold"
        color={positive ? 'green.600' : 'gray.500'}
        ml={3}
      >
        {positive ? '+' : ''}
        {entry.points.toLocaleString()}
      </Text>
    </Flex>
  )
}

interface SlotShellProps {
  label: string
  helper: string
  saved: boolean
  children: React.ReactNode
}

const SlotShell = ({ label, helper, saved, children }: SlotShellProps) => (
  <Box
    borderWidth="1px"
    borderStyle="dashed"
    borderColor={saved ? 'slate.300' : 'gray.300'}
    bg={saved ? 'slate.50' : 'gray.50'}
    borderRadius="md"
    p={2}
  >
    <Stack spacing={1.5}>
      <HStack spacing={2} align="center">
        <Flex
          w={6}
          h={6}
          borderRadius="sm"
          bg={saved ? 'slate.100' : 'white'}
          borderWidth="1px"
          borderColor={saved ? 'slate.300' : 'gray.200'}
          align="center"
          justify="center"
          flexShrink={0}
        >
          <Box
            as={saved ? CheckCircle2 : Upload}
            w={3}
            h={3}
            color={saved ? 'slate.600' : 'gray.500'}
          />
        </Flex>
        <Stack spacing={0} flex={1} minW={0}>
          <Text fontSize="xs" fontWeight="semibold" color="gray.800" noOfLines={1}>
            {label}
          </Text>
          <Text fontSize="2xs" color="gray.500" noOfLines={1}>
            {saved ? 'Saved - change below' : helper}
          </Text>
        </Stack>
      </HStack>
      {children}
    </Stack>
  </Box>
)

interface PersonalityTypeSlotProps {
  label: string
  savedType: PersonalityType | undefined
  isSubmitting: boolean
  onSave: (next: PersonalityType) => void
}

const labelForType = (type: PersonalityType | '') => {
  const found = PERSONALITY_TYPES.find((pt) => pt.type === type)
  return found ? `${found.type} · ${found.name}` : ''
}

const PersonalityTypeSlot = ({ label, savedType, isSubmitting, onSave }: PersonalityTypeSlotProps) => {
  const [selected, setSelected] = useState<PersonalityType | ''>(savedType ?? '')
  const [inputText, setInputText] = useState(() => labelForType(savedType ?? ''))
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  useEffect(() => {
    setSelected(savedType ?? '')
    setInputText(labelForType(savedType ?? ''))
  }, [savedType])

  const selectedLabel = labelForType(selected)
  const dirty = selected !== '' && selected !== savedType

  // Type to filter by either the 4-letter code (e.g. "intj") or the name
  // (e.g. "architect"). When the field still shows the committed selection,
  // list everything so reopening reveals the full set.
  const matches = useMemo(() => {
    const query = inputText.trim().toLowerCase()
    if (!query || inputText === selectedLabel) return PERSONALITY_TYPES
    return PERSONALITY_TYPES.filter(
      (pt) => pt.type.toLowerCase().includes(query) || pt.name.toLowerCase().includes(query),
    )
  }, [inputText, selectedLabel])

  const activeIndex = matches.length === 0 ? -1 : Math.min(highlight, matches.length - 1)

  const choose = (type: PersonalityType) => {
    setSelected(type)
    setInputText(labelForType(type))
    setOpen(false)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true)
      setHighlight((h) => Math.min(h + 1, matches.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (event.key === 'Enter') {
      if (open && activeIndex >= 0) {
        event.preventDefault()
        choose(matches[activeIndex].type)
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
      setInputText(selectedLabel)
    }
  }

  return (
    <SlotShell label={label} helper="Type or pick your 4-letter type" saved={Boolean(savedType)}>
      <HStack spacing={1.5} align="center">
        <Popover
          isOpen={open && matches.length > 0}
          onClose={() => setOpen(false)}
          placement="bottom-start"
          autoFocus={false}
          closeOnBlur={false}
          isLazy
        >
          <PopoverAnchor>
            <Box position="relative" flex={1} minW={0}>
              <Input
                size="xs"
                bg="white"
                fontSize="2xs"
                pr={5}
                placeholder="Type or select your type"
                value={inputText}
                role="combobox"
                aria-expanded={open}
                aria-autocomplete="list"
                onFocus={() => {
                  setOpen(true)
                  setHighlight(0)
                }}
                onChange={(event) => {
                  setInputText(event.target.value)
                  setOpen(true)
                  setHighlight(0)
                }}
                onKeyDown={handleKeyDown}
                onBlur={() => window.setTimeout(() => setOpen(false), 120)}
              />
              <Box
                as={ChevronDown}
                position="absolute"
                right="6px"
                top="50%"
                transform="translateY(-50%)"
                w={3}
                h={3}
                color="text.muted"
                pointerEvents="none"
              />
            </Box>
          </PopoverAnchor>
          <Portal>
            <PopoverContent w="240px" maxH="200px" overflowY="auto" boxShadow="lg" borderColor="brand.border">
              <PopoverBody p={1}>
                <Stack spacing={0} role="listbox">
                  {matches.map((pt, index) => {
                    const isActive = index === activeIndex
                    const isCurrent = pt.type === selected
                    return (
                      <Box
                        key={pt.type}
                        role="option"
                        aria-selected={isActive}
                        px={2}
                        py={1.5}
                        borderRadius="sm"
                        cursor="pointer"
                        fontSize="2xs"
                        bg={isActive ? 'slate.100' : isCurrent ? 'slate.50' : 'white'}
                        _hover={{ bg: 'slate.100' }}
                        onMouseEnter={() => setHighlight(index)}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          choose(pt.type)
                        }}
                      >
                        <Text as="span" fontWeight="semibold">
                          {pt.type}
                        </Text>{' '}
                        · {pt.name}
                      </Box>
                    )
                  })}
                </Stack>
              </PopoverBody>
            </PopoverContent>
          </Portal>
        </Popover>
        <Button
          size="xs"
          bg="slate.700"
          color="white"
          _hover={{ bg: 'slate.800' }}
          onClick={() => selected && onSave(selected as PersonalityType)}
          isLoading={isSubmitting}
          isDisabled={isSubmitting || !dirty}
          flexShrink={0}
          fontSize="2xs"
        >
          {savedType ? 'Update' : 'Save'}
        </Button>
      </HStack>
    </SlotShell>
  )
}

interface CoreValuesSlotProps {
  label: string
  savedValues: string[]
  isSubmitting: boolean
  onSave: (next: string[]) => void
}

const CoreValuesSlot = ({ label, savedValues, isSubmitting, onSave }: CoreValuesSlotProps) => {
  const [selected, setSelected] = useState<string[]>(savedValues)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  useEffect(() => {
    setSelected(savedValues)
  }, [savedValues])

  const sameAsSaved =
    selected.length === savedValues.length &&
    selected.every((v) => savedValues.includes(v))
  const dirty = selected.length === 5 && !sameAsSaved
  const atLimit = selected.length >= 5

  const filteredValues = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? CORE_VALUES.filter((value) => value.toLowerCase().includes(query)) : CORE_VALUES
  }, [search])

  const activeIndex = filteredValues.length === 0 ? -1 : Math.min(highlight, filteredValues.length - 1)

  const toggle = (value: string) =>
    setSelected((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value)
      if (prev.length >= 5) return prev
      return [...prev, value]
    })

  const pickFromList = (value: string) => {
    toggle(value)
    setSearch('')
    setHighlight(0)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true)
      setHighlight((h) => Math.min(h + 1, filteredValues.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (event.key === 'Enter') {
      if (open && activeIndex >= 0) {
        event.preventDefault()
        const value = filteredValues[activeIndex]
        if (selected.includes(value) || !atLimit) pickFromList(value)
      }
    } else if (event.key === 'Backspace') {
      if (search === '' && selected.length > 0) setSelected((prev) => prev.slice(0, -1))
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const placeholder =
    selected.length === 0
      ? 'Type to pick 5 values'
      : selected.length < 5
        ? `Type to add (${selected.length}/5)`
        : 'All 5 picked - type to change'

  return (
    <SlotShell label={label} helper="Type to pick exactly 5" saved={savedValues.length === 5}>
      <Stack spacing={1.5}>
        <HStack spacing={1.5} align="center">
          <Popover
            isOpen={open && filteredValues.length > 0}
            onClose={() => setOpen(false)}
            placement="bottom-start"
            autoFocus={false}
            closeOnBlur={false}
            isLazy
          >
            <PopoverAnchor>
              <Box position="relative" flex={1} minW={0}>
                <Input
                  size="xs"
                  bg="white"
                  fontSize="2xs"
                  pr={5}
                  placeholder={placeholder}
                  value={search}
                  role="combobox"
                  aria-expanded={open}
                  aria-autocomplete="list"
                  onFocus={() => {
                    setOpen(true)
                    setHighlight(0)
                  }}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setOpen(true)
                    setHighlight(0)
                  }}
                  onKeyDown={handleKeyDown}
                  onBlur={() => window.setTimeout(() => setOpen(false), 120)}
                />
                <Box
                  as={ChevronDown}
                  position="absolute"
                  right="6px"
                  top="50%"
                  transform="translateY(-50%)"
                  w={3}
                  h={3}
                  color="text.muted"
                  pointerEvents="none"
                />
              </Box>
            </PopoverAnchor>
            <Portal>
              <PopoverContent w="240px" maxH="220px" overflowY="auto" boxShadow="lg" borderColor="brand.border">
                <PopoverBody p={1}>
                  <Stack spacing={0} role="listbox">
                    {filteredValues.map((value, index) => {
                      const isActive = index === activeIndex
                      const isChecked = selected.includes(value)
                      const isDisabled = !isChecked && atLimit
                      return (
                        <HStack
                          key={value}
                          role="option"
                          aria-selected={isChecked}
                          spacing={2}
                          px={2}
                          py={1.5}
                          borderRadius="sm"
                          cursor={isDisabled ? 'not-allowed' : 'pointer'}
                          opacity={isDisabled ? 0.45 : 1}
                          bg={isActive ? 'slate.100' : isChecked ? 'slate.50' : 'white'}
                          _hover={isDisabled ? undefined : { bg: 'slate.100' }}
                          onMouseEnter={() => setHighlight(index)}
                          onMouseDown={(event) => {
                            event.preventDefault()
                            if (!isDisabled) pickFromList(value)
                          }}
                        >
                          <Checkbox size="sm" isChecked={isChecked} isDisabled={isDisabled} pointerEvents="none" />
                          <Text fontSize="2xs">{value}</Text>
                        </HStack>
                      )
                    })}
                  </Stack>
                </PopoverBody>
              </PopoverContent>
            </Portal>
          </Popover>
          <Button
            size="xs"
            bg="slate.700"
            color="white"
            _hover={{ bg: 'slate.800' }}
            onClick={() => onSave(selected)}
            isLoading={isSubmitting}
            isDisabled={isSubmitting || !dirty}
            flexShrink={0}
            fontSize="2xs"
          >
            {savedValues.length === 5 ? 'Update' : 'Save'}
          </Button>
        </HStack>

        {selected.length > 0 && (
          <Wrap spacing={1}>
            {selected.map((value) => (
              <WrapItem key={value}>
                <Tag size="sm" variant="subtle" colorScheme="purple" borderRadius="full">
                  <TagLabel fontSize="2xs">{value}</TagLabel>
                  <TagCloseButton onClick={() => toggle(value)} />
                </Tag>
              </WrapItem>
            ))}
          </Wrap>
        )}
      </Stack>
    </SlotShell>
  )
}

export const WeeklyGlancePage = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const { profile, refreshProfile } = useAuth()
  const data = useWeeklyGlanceData()

  const [isBuildVillageOpen, setIsBuildVillageOpen] = useState(false)
  const [villageName, setVillageName] = useState('')
  const [villagePurpose, setVillagePurpose] = useState('')
  const [isCreatingVillage, setIsCreatingVillage] = useState(false)
  const [villageError, setVillageError] = useState<string | undefined>()

  const [orgCohortStartDate, setOrgCohortStartDate] = useState<string | null>(null)
  const [orgJourneyType, setOrgJourneyType] = useState<JourneyType | null>(null)

  const [submittingProof, setSubmittingProof] = useState<'personality' | 'values' | null>(null)
  const [proofError, setProofError] = useState<string | null>(null)

  // Pre-course survey gating for the "Courses" KPI tile. Clicking the button
  // opens the in-app survey; submitting saves the answers and marks the survey
  // complete so the courses step unlocks immediately.
  const { state: preCourseSurveyState, loading: preCourseSurveyLoading } = usePreCourseSurvey(profile?.id ?? null)
  const [isSurveyOpen, setIsSurveyOpen] = useState(false)
  const [isSurveySubmitting, setIsSurveySubmitting] = useState(false)
  const handleTakeSurvey = useCallback(() => {
    setIsSurveyOpen(true)
  }, [])
  const handleSurveySubmit = useCallback(
    async (answers: PreCourseSurveyAnswers) => {
      if (!profile?.id) return
      setIsSurveySubmitting(true)
      try {
        await completePreCourseSurvey(profile.id, answers, {
          organizationId: profile.organizationId ?? profile.companyId ?? null,
          companyId: profile.companyId ?? null,
          displayName: profile.fullName ?? null,
        })
        setIsSurveyOpen(false)
      } catch (err) {
        console.error('[WeeklyGlance] survey completion failed', err)
        toast({
          status: 'error',
          title: 'Could not save your progress',
          description: 'Please try again in a moment.',
        })
      } finally {
        setIsSurveySubmitting(false)
      }
    },
    [profile?.id, profile?.organizationId, profile?.companyId, profile?.fullName, toast],
  )

  const handleProofSelectionSubmit = useCallback(
    async (
      kind: 'personality' | 'values',
      value: PersonalityType | string[],
    ) => {
      if (!profile?.id) {
        setProofError('You need to be signed in to save your results.')
        return
      }
      if (kind === 'values' && (!Array.isArray(value) || value.length !== 5)) {
        setProofError('Pick exactly 5 core values.')
        return
      }
      if (kind === 'personality' && typeof value !== 'string') {
        setProofError('Select your personality type.')
        return
      }
      setProofError(null)
      setSubmittingProof(kind)
      const completedFlag = kind === 'personality' ? 'hasCompletedPersonalityTest' : 'hasCompletedValuesTest'
      const payload: Record<string, unknown> = {
        [completedFlag]: true,
        updatedAt: new Date().toISOString(),
      }
      if (kind === 'personality') payload.personalityType = value
      else payload.coreValues = value
      try {
        await updateDoc(doc(db, 'profiles', profile.id), payload)
      } catch (error) {
        console.error('[WeeklyGlance] profile update on result save failed', error)
        setProofError('Could not save your results. Please try again.')
        setSubmittingProof(null)
        return
      }
      void (async () => {
        try {
          if (!profile.companyId) return
          const orgSnapshot = await getDoc(doc(db, ORG_COLLECTION, profile.companyId))
          if (!orgSnapshot.exists()) return
          const orgData = orgSnapshot.data() as Record<string, unknown>
          const partnerId =
            (orgData.transformation_partner_id as string | null | undefined) ||
            (orgData.partnerId as string | null | undefined) ||
            null
          if (!partnerId) return
          const learnerName = profile.firstName || profile.fullName || profile.email || 'A learner'
          const testLabel = kind === 'personality' ? '16Personalities' : 'Personal Values'
          const summary = kind === 'personality' ? String(value) : (value as string[]).join(', ')
          await addDoc(collection(db, 'notifications'), {
            user_id: partnerId,
            type: 'engagement_alert',
            title: `${learnerName} shared ${testLabel} results`,
            message: `${learnerName} selected: ${summary}.`,
            metadata: {
              learnerId: profile.id,
              learnerName,
              kind,
              result: value,
            },
            read: false,
            created_at: serverTimestamp(),
          })
        } catch (notifyError) {
          console.warn('[WeeklyGlance] partner notification failed (non-fatal)', notifyError)
        }
      })()
      toast({
        title: 'Results saved',
        description: 'Your partner has been notified.',
        status: 'success',
        duration: 3500,
      })
      setSubmittingProof(null)
    },
    [profile?.id, profile?.companyId, profile?.firstName, profile?.fullName, profile?.email, toast],
  )

  useEffect(() => {
    if (!profile?.companyId) {
      setOrgCohortStartDate(null)
      setOrgJourneyType(null)
      return
    }
    let cancelled = false
    void getDoc(doc(db, ORG_COLLECTION, profile.companyId)).then((snap) => {
      if (cancelled || !snap.exists()) return
      const orgData = snap.data() as Record<string, unknown>
      const raw = orgData.cohortStartDate
      if (typeof raw === 'string') {
        setOrgCohortStartDate(raw)
      } else if (raw && typeof raw === 'object' && 'toDate' in raw && typeof (raw as { toDate?: () => Date }).toDate === 'function') {
        setOrgCohortStartDate((raw as { toDate: () => Date }).toDate().toISOString())
      }
      const resolved = resolveJourneyType(orgData) as JourneyType | undefined
      if (resolved) setOrgJourneyType(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [profile?.companyId])

  const effectiveJourneyType = (orgJourneyType ?? profile?.journeyType ?? '6W') as JourneyType
  const effectiveStartDate = orgCohortStartDate ?? profile?.journeyStartDate ?? null
  const effectiveDurationWeeks = JOURNEY_META[effectiveJourneyType]?.weeks ?? profile?.programDurationWeeks ?? 6

  const journeyTiming = useMemo(
    () => getJourneyTiming(effectiveStartDate, effectiveDurationWeeks),
    [effectiveStartDate, effectiveDurationWeeks]
  )

  const currentWeek = journeyTiming?.currentWeek ?? data.weekNumber
  const totalWeeks = effectiveDurationWeeks
  const daysRemaining = journeyTiming?.daysRemaining ?? 0
  const cycleNumber = Math.ceil(currentWeek / 2)
  const totalCycles = Math.max(1, Math.ceil(totalWeeks / 2))

  const journeyMax = JOURNEY_META[effectiveJourneyType]?.maxPossiblePoints ?? 0
  const passMark = JOURNEY_META[effectiveJourneyType]?.passMarkPoints ?? 0
  const totalEarned = useMemo(
    () => (data.ledgerEntries ?? []).reduce((sum, entry) => sum + (entry.points ?? 0), 0),
    [data.ledgerEntries],
  )
  const journeyProgress = journeyMax > 0 ? Math.min(100, Math.round((totalEarned / journeyMax) * 100)) : 0
  const daysElapsed = journeyTiming?.totalDaysElapsed ?? 0
  const pace = useMemo(
    () =>
      computeJourneyPace({
        totalEarned,
        journeyMax,
        daysElapsed,
        totalWeeks,
      }),
    [totalEarned, journeyMax, daysElapsed, totalWeeks],
  )

  const recentActivity = useMemo(
    () =>
      (data.ledgerEntries ?? [])
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5),
    [data.ledgerEntries]
  )

  const shouldShowBuildVillageCard = canCreateVillage(profile)
  const hasError = Object.values(data.errors ?? {}).some(Boolean)

  const personalityIncomplete = useMemo(() => {
    if (data.loading.profile) return false
    const hasPersonalityType = Boolean(profile?.hasCompletedPersonalityTest) && Boolean(data.personality?.personalityType)
    const hasCoreValues = Boolean(profile?.hasCompletedValuesTest) && (data.personality?.coreValues?.length ?? 0) > 0
    return !hasPersonalityType || !hasCoreValues
  }, [data.loading.profile, data.personality, profile?.hasCompletedPersonalityTest, profile?.hasCompletedValuesTest])

  const handleNavigateProfile = useCallback(() => {
    navigate('/app/profile')
  }, [navigate])

  const firstName = useMemo(() => {
    const name = profile?.firstName ?? profile?.fullName ?? profile?.email ?? ''
    return name.split(' ')[0] || 'there'
  }, [profile?.firstName, profile?.fullName, profile?.email])

  const today = useMemo(() => format(new Date(), 'EEEE, MMMM d'), [])

  const resetVillageForm = useCallback(() => {
    setVillageName('')
    setVillagePurpose('')
    setVillageError(undefined)
  }, [])

  const openVillageModal = useCallback(() => {
    setVillageError(undefined)
    setIsBuildVillageOpen(true)
  }, [])

  const closeVillageModal = useCallback(() => {
    if (isCreatingVillage) return
    setIsBuildVillageOpen(false)
    setVillageError(undefined)
  }, [isCreatingVillage])

  const resolveVillageErrorMessage = useCallback((error: unknown): string => {
    if (error && typeof error === 'object' && 'code' in error) {
      const firestoreError = error as FirestoreError
      switch (firestoreError.code) {
        case 'permission-denied':
          return "You don't have permission to create a village. Please contact support."
        case 'unavailable':
        case 'deadline-exceeded':
          return 'Unable to create village. Please check your connection and try again.'
        default:
          return 'Something went wrong. Please try again.'
      }
    }
    if (error instanceof Error) return error.message
    return 'Something went wrong. Please try again.'
  }, [])

  const handleCreateVillage = useCallback(async () => {
    const trimmedName = villageName.trim()
    const trimmedPurpose = villagePurpose.trim()
    const profileId = profile?.id?.trim()

    if (!trimmedName) {
      setVillageError('Please enter a village name.')
      return
    }
    if (!profileId) {
      const message = 'We could not verify your profile. Please refresh and try again.'
      setVillageError(message)
      toast({ status: 'error', title: 'Unable to create village', description: message })
      return
    }

    setIsCreatingVillage(true)
    setVillageError(undefined)

    try {
      const nameExists = await checkVillageNameExists(trimmedName)
      if (nameExists) {
        const message = 'A village with this name already exists. Please choose a different name.'
        setVillageError(message)
        toast({ status: 'error', title: 'Village name taken', description: message })
        return
      }

      const villageId = await createVillage({
        name: trimmedName,
        description: trimmedPurpose,
        creatorId: profileId,
      })
      await updateUserVillageId(profileId, villageId)
      await refreshProfile({ reason: 'village-created' })

      toast({
        status: 'success',
        title: `Your village "${trimmedName}" has been created!`,
        description: 'You can access your village anytime from the navigation.',
      })

      setIsBuildVillageOpen(false)
      resetVillageForm()
    } catch (error) {
      console.error('Failed to create village', error)
      const message = resolveVillageErrorMessage(error)
      setVillageError(message)
      toast({ status: 'error', title: 'Unable to create village', description: message })
    } finally {
      setIsCreatingVillage(false)
    }
  }, [
    profile?.id,
    refreshProfile,
    resetVillageForm,
    resolveVillageErrorMessage,
    toast,
    villageName,
    villagePurpose,
  ])

  const handleNavigateChecklist = useCallback(() => {
    navigate('/app/weekly-checklist')
  }, [navigate])

  return (
    <Box bg="gray.50" minH="100%" p={{ base: 4, md: 8 }} pt={{ base: 4, md: 6 }}>
      <Stack spacing={8} maxW="1400px" mx="auto">
        {/* Header */}
        <Flex
          justify="space-between"
          align={{ base: 'flex-start', md: 'flex-end' }}
          direction={{ base: 'column', md: 'row' }}
          gap={3}
        >
          <Stack spacing={1}>
            <Heading
              size="lg"
              color="gray.900"
              letterSpacing="-0.02em"
              fontWeight="bold"
            >
              Hello, {firstName}
            </Heading>
            <HStack spacing={2} color="gray.500" fontSize="sm">
              <Box as={Calendar} w={4} h={4} />
              <Text>{today}</Text>
              <Text color="gray.300">·</Text>
              <Text>
                Week {currentWeek} of {totalWeeks} · Cycle {cycleNumber} of {totalCycles}
              </Text>
            </HStack>
          </Stack>
          <Button
            onClick={handleNavigateChecklist}
            bg="brand.primary"
            color="white"
            _hover={{ bg: 'brand.dark' }}
            rightIcon={<Box as={ArrowUpRight} w={4} h={4} />}
            size="md"
          >
            Open weekly checklist
          </Button>
        </Flex>

        {hasError && (
          <Alert status="warning" rounded="md" borderWidth="1px" borderColor="yellow.200">
            <AlertIcon />
            <Box>
              <AlertTitle>Some sections failed to load</AlertTitle>
              <AlertDescription>Data may be incomplete. Try refreshing the page.</AlertDescription>
            </Box>
          </Alert>
        )}

        {personalityIncomplete && (
          <Box
            bg="white"
            p={5}
            borderRadius="xl"
            boxShadow="0 2px 8px rgba(0,0,0,0.04)"
            position="relative"
            overflow="hidden"
            borderLeftWidth="4px"
            borderLeftColor="brand.primary"
          >
            <Box position="absolute" top={0} right={0} w="60px" h="60px" bg="purple.50" borderRadius="0 0 0 100%" />
            <Stack spacing={4} position="relative" zIndex={1}>
              <Flex
                justify="space-between"
                align={{ base: 'flex-start', md: 'center' }}
                direction={{ base: 'column', md: 'row' }}
                gap={4}
              >
                <HStack spacing={3} align="center">
                  <Flex
                    w={10}
                    h={10}
                    bg="#350e6f"
                    borderRadius="xl"
                    align="center"
                    justify="center"
                    boxShadow="0 4px 12px rgba(53, 14, 111, 0.3)"
                    flexShrink={0}
                  >
                    <Box as={Fingerprint} w={5} h={5} color="white" />
                  </Flex>
                  <Stack spacing={0}>
                    <Text
                      fontSize="xs"
                      fontWeight="semibold"
                      textTransform="uppercase"
                      letterSpacing="wide"
                      color="orange.600"
                    >
                      Action required
                    </Text>
                    <Heading size="sm" color="gray.900">
                      Complete your personality profile
                    </Heading>
                    <Text fontSize="sm" color="gray.600" mt={0.5}>
                      Select your results below so your partner can tailor your programme.
                    </Text>
                  </Stack>
                </HStack>
                <Button
                  onClick={handleNavigateProfile}
                  bg="brand.primary"
                  color="white"
                  _hover={{ bg: 'brand.dark' }}
                  rightIcon={<Box as={ArrowUpRight} w={4} h={4} />}
                  size="md"
                  flexShrink={0}
                >
                  Complete now
                </Button>
              </Flex>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <PersonalityTypeSlot
                  label="16Personalities result"
                  savedType={profile?.personalityType as PersonalityType | undefined}
                  isSubmitting={submittingProof === 'personality'}
                  onSave={(next) => void handleProofSelectionSubmit('personality', next)}
                />
                <CoreValuesSlot
                  label="Personal Values result"
                  savedValues={(profile?.coreValues as string[] | undefined) ?? []}
                  isSubmitting={submittingProof === 'values'}
                  onSave={(next) => void handleProofSelectionSubmit('values', next)}
                />
              </SimpleGrid>

              {proofError && (
                <Text fontSize="xs" color="red.500">
                  {proofError}
                </Text>
              )}
            </Stack>
          </Box>
        )}

        {/* KPI Strip */}
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4}>
          <Skeleton isLoaded={!data.loading.points} rounded="xl">
            <KpiTile
              label="Points earned"
              value={totalEarned.toLocaleString()}
              sub={`of ${passMark.toLocaleString()} pass mark`}
              icon={Star}
              theme="purple"
            />
          </Skeleton>
          <KpiTile
            label="Days left in cycle"
            value={daysRemaining}
            sub={daysRemaining <= 2 ? 'Closing soon' : 'Time remaining'}
            icon={Clock}
            theme={daysRemaining <= 2 ? 'red' : 'orange'}
          />
          <Skeleton isLoaded={!data.loading.points} rounded="xl">
            <KpiTile
              label="Pace"
              value={pace.label}
              sub={pace.detail}
              icon={TrendingUp}
              theme={toneToTheme(pace.tone)}
            />
          </Skeleton>

          {/* Courses tile - two clearly numbered steps so the user can't miss
              that the survey has to happen before they can open their courses.
              Matches the premium KpiTile language for a consistent strip. */}
          <Skeleton isLoaded={!preCourseSurveyLoading} rounded="2xl">
            {(() => {
              const courseTheme = preCourseSurveyState.completed
                ? kpiThemes.purple
                : kpiThemes.slate
              return (
                <Box
                  p={5}
                  bg="white"
                  borderRadius="2xl"
                  border="1px solid"
                  borderColor={preCourseSurveyState.completed ? 'gray.100' : 'slate.200'}
                  boxShadow="0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.04)"
                  _hover={{
                    transform: 'translateY(-3px)',
                    boxShadow: courseTheme.hoverShadow,
                    borderColor: courseTheme.hoverBorder,
                  }}
                  transition="transform 0.35s cubic-bezier(0.4,0,0.2,1), box-shadow 0.35s ease, border-color 0.35s ease"
                  position="relative"
                  overflow="hidden"
                  h="100%"
                >
                  {/* Clean solid quarter-circle ornament in the top-right corner */}
                  <Box
                    position="absolute"
                    top={0}
                    right={0}
                    w="80px"
                    h="80px"
                    bg={courseTheme.ornamentBg}
                    borderRadius="0 0 0 100%"
                    pointerEvents="none"
                  />

                  <Stack spacing={3.5} position="relative" zIndex={1} h="100%">
                    <Flex justify="space-between" align="flex-start">
                      <Flex
                        w={12}
                        h={12}
                        bg={courseTheme.iconBg}
                        borderRadius="2xl"
                        align="center"
                        justify="center"
                        boxShadow={courseTheme.iconShadow}
                      >
                        <Box as={BookOpen} w={5} h={5} color="white" strokeWidth={2.25} />
                      </Flex>
                      <Badge
                        variant="subtle"
                        fontSize="2xs"
                        px={2.5}
                        py={1}
                        rounded="full"
                        textTransform="uppercase"
                        letterSpacing="0.08em"
                        fontWeight="bold"
                        bg="slate.50"
                        color="#1e293b"
                        border="1px solid"
                        borderColor="slate.200"
                      >
                        {preCourseSurveyState.completed ? 'Unlocked' : 'Action needed'}
                      </Badge>
                    </Flex>

                    <Text
                      fontSize="xs"
                      color="gray.500"
                      fontWeight="bold"
                      textTransform="uppercase"
                      letterSpacing="0.12em"
                    >
                      Your courses
                    </Text>

                    {/* Stepper with a thin connector line between the two steps */}
                    <Stack spacing={2.5} position="relative">
                      {/* connector line behind the step circles */}
                      <Box
                        position="absolute"
                        left="13px"
                        top="22px"
                        bottom="22px"
                        w="2px"
                        bg="gray.200"
                        opacity={0.6}
                        borderRadius="full"
                      />

                      {/* STEP 1 - Pre-course survey */}
                      <HStack spacing={3} align="center" position="relative">
                        <Flex
                          w={7}
                          h={7}
                          bg="linear-gradient(135deg, #334155 0%, #0f172a 100%)"
                          color="white"
                          borderRadius="full"
                          align="center"
                          justify="center"
                          flexShrink={0}
                          boxShadow="0 4px 10px rgba(15, 23, 42, 0.25), 0 0 0 4px rgba(15, 23, 42, 0.06)"
                        >
                          {preCourseSurveyState.completed ? (
                            <Box as={CheckCircle2} w={3.5} h={3.5} strokeWidth={2.75} />
                          ) : (
                            <Text fontSize="xs" fontWeight="bold" lineHeight="1">
                              1
                            </Text>
                          )}
                        </Flex>
                        {preCourseSurveyState.completed ? (
                          <Text fontSize="sm" fontWeight="semibold" color="gray.700" flex={1}>
                            Pre-course survey
                          </Text>
                        ) : (
                          <Button
                            size="sm"
                            h={8}
                            bg="linear-gradient(135deg, #334155 0%, #0f172a 100%)"
                            color="white"
                            fontWeight="semibold"
                            flex={1}
                            _hover={{
                              bg: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)',
                              transform: 'translateY(-1px)',
                              boxShadow: '0 6px 14px rgba(15, 23, 42, 0.35)',
                            }}
                            _active={{ transform: 'translateY(0)' }}
                            transition="all 0.2s ease"
                            boxShadow="0 4px 10px rgba(15, 23, 42, 0.22)"
                            rightIcon={<Box as={ArrowUpRight} w={3.5} h={3.5} />}
                            onClick={handleTakeSurvey}
                            borderRadius="lg"
                          >
                            Take survey · 2 min
                          </Button>
                        )}
                      </HStack>

                      {/* STEP 2 - Open courses */}
                      <HStack spacing={3} align="center" position="relative">
                        <Flex
                          w={7}
                          h={7}
                          bg={
                            preCourseSurveyState.completed
                              ? 'linear-gradient(135deg, #64748b 0%, #475569 100%)'
                              : 'gray.200'
                          }
                          color={preCourseSurveyState.completed ? 'white' : 'gray.500'}
                          borderRadius="full"
                          align="center"
                          justify="center"
                          flexShrink={0}
                          boxShadow={
                            preCourseSurveyState.completed
                              ? '0 4px 10px rgba(71, 85, 105, 0.25), 0 0 0 4px rgba(100, 116, 139, 0.08)'
                              : 'inset 0 0 0 1px rgba(0,0,0,0.04)'
                          }
                        >
                          {preCourseSurveyState.completed ? (
                            <Text fontSize="xs" fontWeight="bold" lineHeight="1">
                              2
                            </Text>
                          ) : (
                            <Box as={Lock} w={3.5} h={3.5} strokeWidth={2.5} />
                          )}
                        </Flex>
                        {preCourseSurveyState.completed ? (
                          <Button
                            size="sm"
                            h={8}
                            bg="linear-gradient(135deg, #64748b 0%, #475569 100%)"
                            color="white"
                            fontWeight="semibold"
                            flex={1}
                            _hover={{
                              bg: 'linear-gradient(135deg, #94a3b8 0%, #334155 100%)',
                              transform: 'translateY(-1px)',
                              boxShadow: '0 6px 14px rgba(71, 85, 105, 0.3)',
                            }}
                            _active={{ transform: 'translateY(0)' }}
                            transition="all 0.2s ease"
                            boxShadow="0 4px 10px rgba(71, 85, 105, 0.22)"
                            rightIcon={<Box as={ArrowUpRight} w={3.5} h={3.5} />}
                            onClick={() => navigate('/app/courses')}
                            borderRadius="lg"
                          >
                            Open courses
                          </Button>
                        ) : (
                          <Text fontSize="sm" fontWeight="medium" color="gray.400" flex={1}>
                            Courses · locked
                          </Text>
                        )}
                      </HStack>
                    </Stack>
                  </Stack>
                </Box>
              )
            })()}
          </Skeleton>
        </SimpleGrid>

        {/* Hero - Cycle progress */}
        <Box
          bg="white"
          p={{ base: 5, md: 7 }}
          borderRadius="xl"
          boxShadow="0 2px 8px rgba(0,0,0,0.04)"
          _hover={{
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 25px rgba(139, 92, 246, 0.15)',
          }}
          transition="all 0.3s ease"
          position="relative"
          overflow="hidden"
        >
          <Box
            position="absolute"
            top={0}
            right={0}
            w="90px"
            h="90px"
            bg="purple.50"
            borderRadius="0 0 0 100%"
          />
          <Stack spacing={6}>
            <Flex
              justify="space-between"
              align={{ base: 'flex-start', md: 'center' }}
              direction={{ base: 'column', md: 'row' }}
              gap={3}
            >
              <HStack spacing={3} align="center">
                <Flex
                  w={10}
                  h={10}
                  bg="#350e6f"
                  borderRadius="xl"
                  align="center"
                  justify="center"
                  boxShadow="0 4px 12px rgba(53, 14, 111, 0.3)"
                  flexShrink={0}
                >
                  <Box as={Target} w={5} h={5} color="white" />
                </Flex>
                <Stack spacing={0}>
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    textTransform="uppercase"
                    letterSpacing="wide"
                    color="gray.500"
                  >
                    Journey progress
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    Week {currentWeek} of {totalWeeks} · Cycle {cycleNumber} of {totalCycles}
                  </Text>
                </Stack>
              </HStack>
              <Badge
                colorScheme={pace.tone}
                variant="subtle"
                fontSize="xs"
                px={3}
                py={1}
                rounded="full"
                textTransform="none"
                fontWeight="medium"
                position="relative"
                zIndex={1}
              >
                {pace.label}
              </Badge>
            </Flex>

              <Skeleton isLoaded={!data.loading.points} rounded="md">
                <Stack spacing={4}>
                  <Flex align="baseline" gap={2}>
                    <Text
                      fontSize={{ base: '5xl', md: '6xl' }}
                      fontWeight="bold"
                      lineHeight="1"
                      letterSpacing="-0.03em"
                      color="gray.900"
                    >
                      {journeyProgress}%
                    </Text>
                    <Text fontSize="md" color="gray.500" fontWeight="medium">
                      complete
                    </Text>
                  </Flex>

                  <Progress
                    value={journeyProgress}
                    size="sm"
                    rounded="full"
                    colorScheme={journeyProgress >= 100 ? 'green' : 'purple'}
                    bg="gray.100"
                  />
                </Stack>
              </Skeleton>
            </Stack>
        </Box>

        {/* Recent activity */}
        <SimpleGrid columns={1} spacing={6}>
          <Box
            bg="white"
            p={6}
            borderRadius="xl"
            border="1px solid"
            borderColor="gray.100"
            boxShadow="0 2px 8px rgba(0,0,0,0.04)"
            _hover={{
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 25px rgba(16, 185, 129, 0.15)',
              borderColor: 'green.200',
            }}
            transition="all 0.3s ease"
            position="relative"
            overflow="hidden"
          >
            <Box
              position="absolute"
              top={0}
              right={0}
              w="60px"
              h="60px"
              bg="green.50"
              borderRadius="0 0 0 100%"
            />
            <Stack spacing={4}>
              <Flex justify="space-between" align="center">
                <HStack spacing={3} align="center">
                  <Flex
                    w={10}
                    h={10}
                    bg="linear-gradient(135deg, #047857 0%, #065f46 100%)"
                    borderRadius="xl"
                    align="center"
                    justify="center"
                    boxShadow="0 4px 12px rgba(4, 120, 87, 0.3)"
                    flexShrink={0}
                  >
                    <Box as={Users} w={5} h={5} color="white" />
                  </Flex>
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    textTransform="uppercase"
                    letterSpacing="wide"
                    color="gray.500"
                  >
                    Recent activity
                  </Text>
                </HStack>
                {recentActivity.length > 0 && (
                  <Text fontSize="xs" color="gray.400">
                    Last {recentActivity.length}
                  </Text>
                )}
              </Flex>

              {data.loading.ledger ? (
                <Stack spacing={3}>
                  <Skeleton h="40px" rounded="md" />
                  <Skeleton h="40px" rounded="md" />
                  <Skeleton h="40px" rounded="md" />
                </Stack>
              ) : recentActivity.length > 0 ? (
                <Stack spacing={0}>
                  {recentActivity.map((entry) => (
                    <ActivityRow key={entry.id} entry={entry} />
                  ))}
                </Stack>
              ) : (
                <Box py={6} textAlign="center">
                  <Text fontSize="sm" color="gray.500">
                    No activity logged yet this cycle.
                  </Text>
                  <Text fontSize="xs" color="gray.400" mt={1}>
                    Complete an activity to see it appear here.
                  </Text>
                </Box>
              )}
            </Stack>
          </Box>
        </SimpleGrid>

        {shouldShowBuildVillageCard && (
          <Box
            bg="white"
            p={6}
            borderRadius="xl"
            border="1px solid"
            borderColor="purple.200"
            boxShadow="0 2px 8px rgba(0,0,0,0.04)"
            _hover={{
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 25px rgba(139, 92, 246, 0.15)',
              borderColor: 'purple.300',
            }}
            transition="all 0.3s ease"
            position="relative"
            overflow="hidden"
          >
            <Box
              position="absolute"
              top={0}
              right={0}
              w="60px"
              h="60px"
              bg="purple.50"
              borderRadius="0 0 0 100%"
            />
            <Flex
              direction={{ base: 'column', md: 'row' }}
              justify="space-between"
              align={{ base: 'flex-start', md: 'center' }}
              gap={4}
            >
              <HStack spacing={3} align="flex-start">
                <Flex
                  w={10}
                  h={10}
                  bg="#350e6f"
                  borderRadius="xl"
                  align="center"
                  justify="center"
                  boxShadow="0 4px 12px rgba(53, 14, 111, 0.3)"
                  flexShrink={0}
                >
                  <Box as={Users} w={5} h={5} color="white" />
                </Flex>
                <Stack spacing={1}>
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    textTransform="uppercase"
                    letterSpacing="wide"
                    color="brand.primary"
                  >
                    Optional
                  </Text>
                  <Heading size="sm" color="gray.900">
                    Build your village
                  </Heading>
                  <Text fontSize="sm" color="gray.600">
                    Rally your peers into a private group to collaborate and track collective impact.
                  </Text>
                </Stack>
              </HStack>
              <Button
                onClick={openVillageModal}
                bg="brand.primary"
                color="white"
                _hover={{ bg: 'brand.dark' }}
                size="md"
                flexShrink={0}
              >
                Create village
              </Button>
            </Flex>
          </Box>
        )}
      </Stack>

      <BuildVillageModal
        isOpen={isBuildVillageOpen}
        onCreate={handleCreateVillage}
        onSkip={closeVillageModal}
        villageName={villageName}
        villagePurpose={villagePurpose}
        onVillageNameChange={setVillageName}
        onVillagePurposeChange={setVillagePurpose}
        isLoading={isCreatingVillage}
        error={villageError}
      />

      <PreCourseSurveyScreen
        isOpen={isSurveyOpen}
        isSubmitting={isSurveySubmitting}
        initialValues={{
          email: profile?.email ?? '',
          firstName: profile?.firstName ?? '',
          lastName: profile?.lastName ?? '',
          organization: profile?.companyName ?? '',
        }}
        onClose={() => setIsSurveyOpen(false)}
        onSubmit={handleSurveySubmit}
      />

    </Box>
  )
}
