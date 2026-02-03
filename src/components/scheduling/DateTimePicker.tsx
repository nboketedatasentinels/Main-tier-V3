import React, { useMemo } from 'react'
import {
  Box,
  FormControl,
  FormLabel,
  Icon,
  Input,
  InputGroup,
  InputRightElement,
  Select,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react'
import { format, addDays, setHours, setMinutes } from 'date-fns'
import { Calendar } from 'lucide-react'

// Comprehensive world timezones grouped by region
const TIMEZONE_GROUPS = {
  'Africa': [
    { value: 'Africa/Accra', label: 'Accra (GMT)' },
    { value: 'Africa/Addis_Ababa', label: 'Addis Ababa (EAT)' },
    { value: 'Africa/Algiers', label: 'Algiers (CET)' },
    { value: 'Africa/Cairo', label: 'Cairo (EET)' },
    { value: 'Africa/Casablanca', label: 'Casablanca (WET)' },
    { value: 'Africa/Dar_es_Salaam', label: 'Dar es Salaam (EAT)' },
    { value: 'Africa/Harare', label: 'Harare (CAT)' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
    { value: 'Africa/Kampala', label: 'Kampala (EAT)' },
    { value: 'Africa/Kigali', label: 'Kigali (CAT)' },
    { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
    { value: 'Africa/Luanda', label: 'Luanda (WAT)' },
    { value: 'Africa/Lusaka', label: 'Lusaka (CAT)' },
    { value: 'Africa/Maputo', label: 'Maputo (CAT)' },
    { value: 'Africa/Nairobi', label: 'Nairobi (EAT)' },
    { value: 'Africa/Tunis', label: 'Tunis (CET)' },
  ],
  'Americas': [
    { value: 'America/New_York', label: 'New York (ET)' },
    { value: 'America/Chicago', label: 'Chicago (CT)' },
    { value: 'America/Denver', label: 'Denver (MT)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
    { value: 'America/Toronto', label: 'Toronto (ET)' },
    { value: 'America/Vancouver', label: 'Vancouver (PT)' },
    { value: 'America/Mexico_City', label: 'Mexico City (CT)' },
    { value: 'America/Bogota', label: 'Bogota (COT)' },
    { value: 'America/Lima', label: 'Lima (PET)' },
    { value: 'America/Santiago', label: 'Santiago (CLT)' },
    { value: 'America/Buenos_Aires', label: 'Buenos Aires (ART)' },
    { value: 'America/Sao_Paulo', label: 'Sao Paulo (BRT)' },
    { value: 'America/Caracas', label: 'Caracas (VET)' },
    { value: 'America/Panama', label: 'Panama (EST)' },
  ],
  'Asia': [
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Riyadh', label: 'Riyadh (AST)' },
    { value: 'Asia/Kuwait', label: 'Kuwait (AST)' },
    { value: 'Asia/Jerusalem', label: 'Jerusalem (IST)' },
    { value: 'Asia/Tehran', label: 'Tehran (IRST)' },
    { value: 'Asia/Karachi', label: 'Karachi (PKT)' },
    { value: 'Asia/Kolkata', label: 'Kolkata (IST)' },
    { value: 'Asia/Mumbai', label: 'Mumbai (IST)' },
    { value: 'Asia/Dhaka', label: 'Dhaka (BST)' },
    { value: 'Asia/Bangkok', label: 'Bangkok (ICT)' },
    { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh (ICT)' },
    { value: 'Asia/Jakarta', label: 'Jakarta (WIB)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur (MYT)' },
    { value: 'Asia/Manila', label: 'Manila (PHT)' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Seoul', label: 'Seoul (KST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Baghdad', label: 'Baghdad (AST)' },
  ],
  'Europe': [
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Dublin', label: 'Dublin (GMT/IST)' },
    { value: 'Europe/Lisbon', label: 'Lisbon (WET)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET)' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam (CET)' },
    { value: 'Europe/Brussels', label: 'Brussels (CET)' },
    { value: 'Europe/Madrid', label: 'Madrid (CET)' },
    { value: 'Europe/Rome', label: 'Rome (CET)' },
    { value: 'Europe/Zurich', label: 'Zurich (CET)' },
    { value: 'Europe/Stockholm', label: 'Stockholm (CET)' },
    { value: 'Europe/Warsaw', label: 'Warsaw (CET)' },
    { value: 'Europe/Athens', label: 'Athens (EET)' },
    { value: 'Europe/Istanbul', label: 'Istanbul (TRT)' },
    { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
  ],
  'Oceania': [
    { value: 'Australia/Perth', label: 'Perth (AWST)' },
    { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
    { value: 'Pacific/Fiji', label: 'Fiji (FJT)' },
    { value: 'Pacific/Honolulu', label: 'Honolulu (HST)' },
  ],
}

// Generate time slots from 6 AM to 10 PM in 30-minute intervals
const generateTimeSlots = (): { value: string; label: string }[] => {
  const slots: { value: string; label: string }[] = []
  for (let hour = 6; hour <= 22; hour++) {
    for (const minute of [0, 30]) {
      if (hour === 22 && minute === 30) continue // Skip 10:30 PM
      const date = setMinutes(setHours(new Date(), hour), minute)
      slots.push({
        value: format(date, 'HH:mm'),
        label: format(date, 'h:mm a'),
      })
    }
  }
  return slots
}

const TIME_SLOTS = generateTimeSlots()

export interface DateTimePickerProps {
  selectedDate: Date | null
  selectedTime: string
  selectedTimezone: string
  onDateChange: (date: Date | null) => void
  onTimeChange: (time: string) => void
  onTimezoneChange: (timezone: string) => void
  minDate?: Date
  maxDate?: Date
  dateLabel?: string
  timeLabel?: string
  timezoneLabel?: string
  dateError?: string
  timeError?: string
  timezoneError?: string
  isRequired?: boolean
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  selectedDate,
  selectedTime,
  selectedTimezone,
  onDateChange,
  onTimeChange,
  onTimezoneChange,
  minDate = addDays(new Date(), 1), // Default: tomorrow
  maxDate,
  dateLabel = 'Date',
  timeLabel = 'Time',
  timezoneLabel = 'Time Zone',
  dateError,
  timeError,
  timezoneError,
  isRequired = false,
}) => {
  // Detect user's timezone
  const detectedTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return 'UTC'
    }
  }, [])

  const selectedDateValue = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''
  const minDateValue = minDate ? format(minDate, 'yyyy-MM-dd') : undefined
  const maxDateValue = maxDate ? format(maxDate, 'yyyy-MM-dd') : undefined

  return (
    <VStack spacing={4} align="stretch" w="100%">
      {/* Date Picker */}
      <FormControl isInvalid={Boolean(dateError)} isRequired={isRequired}>
        <FormLabel fontSize="sm" mb={1}>{dateLabel}</FormLabel>
        <InputGroup>
          <Input
            type="date"
            value={selectedDateValue}
            min={minDateValue}
            max={maxDateValue}
            onChange={(event) => {
              const value = event.target.value
              onDateChange(value ? new Date(`${value}T00:00:00`) : null)
            }}
          />
          <InputRightElement pointerEvents="none">
            <Icon as={Calendar} boxSize={4} color="brand.subtleText" />
          </InputRightElement>
        </InputGroup>
        {dateError && (
          <Text fontSize="xs" color="red.500" mt={1}>
            {dateError}
          </Text>
        )}
      </FormControl>

      <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
        {/* Time Picker */}
        <FormControl isInvalid={Boolean(timeError)} isRequired={isRequired}>
          <FormLabel fontSize="sm" mb={1}>{timeLabel}</FormLabel>
          <Select
            value={selectedTime}
            onChange={(e) => onTimeChange(e.target.value)}
            placeholder="Select time"
          >
            {TIME_SLOTS.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </Select>
          {timeError && (
            <Text fontSize="xs" color="red.500" mt={1}>
              {timeError}
            </Text>
          )}
        </FormControl>

        {/* Timezone Picker */}
        <FormControl isInvalid={Boolean(timezoneError)} isRequired={isRequired}>
          <FormLabel fontSize="sm" mb={1}>{timezoneLabel}</FormLabel>
          <Select
            value={selectedTimezone}
            onChange={(e) => onTimezoneChange(e.target.value)}
            placeholder="Select timezone"
          >
            {/* Show detected timezone at top if it's valid */}
            {detectedTimezone && detectedTimezone !== 'UTC' && (
              <option value={detectedTimezone}>
                {detectedTimezone.replace(/_/g, ' ')} (Your timezone)
              </option>
            )}
            <option disabled>────────────</option>
            {Object.entries(TIMEZONE_GROUPS).map(([region, zones]) => (
              <optgroup key={region} label={region}>
                {zones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          {timezoneError && (
            <Text fontSize="xs" color="red.500" mt={1}>
              {timezoneError}
            </Text>
          )}
        </FormControl>
      </SimpleGrid>

      {/* Selected DateTime Preview */}
      {selectedDate && selectedTime && selectedTimezone && (
        <Box
          p={3}
          bg="surface.subtle"
          borderRadius="lg"
          border="1px solid"
          borderColor="border.subtle"
        >
          <Text fontSize="sm" color="brand.subtleText">
            Session scheduled for:
          </Text>
          <Text fontWeight="semibold" color="brand.text">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')} at {TIME_SLOTS.find(s => s.value === selectedTime)?.label || selectedTime}
          </Text>
          <Text fontSize="sm" color="brand.subtleText">
            Timezone: {selectedTimezone.replace(/_/g, ' ')}
          </Text>
        </Box>
      )}
    </VStack>
  )
}

export default DateTimePicker
