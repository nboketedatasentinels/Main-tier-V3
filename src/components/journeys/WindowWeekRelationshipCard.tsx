import React from 'react'
import { Box, Card, CardBody, HStack, Stack, Text, Badge, Icon, Flex } from '@chakra-ui/react'
import { Calendar } from 'lucide-react'
import { JourneyType } from '@/config/pointsConfig'
import { PARALLEL_WINDOW_SIZE_WEEKS } from '@/utils/windowCalculations'

export interface WindowWeekRelationshipCardProps {
  currentWeek: number
  windowNumber: number
  windowStartWeek: number
  windowEndWeek: number
  journeyType: JourneyType
  totalWeeks?: number
}

export const WindowWeekRelationshipCard: React.FC<WindowWeekRelationshipCardProps> = ({
  currentWeek,
  windowNumber,
  windowStartWeek,
  windowEndWeek,
  totalWeeks = 12
}) => {
  // Calculate total windows
  const totalWindows = Math.ceil(totalWeeks / PARALLEL_WINDOW_SIZE_WEEKS)

  // Generate window data for visualization
  const windows = Array.from({ length: Math.min(totalWindows, 6) }, (_, i) => {
    const winNum = i + 1
    const startWeek = (winNum - 1) * PARALLEL_WINDOW_SIZE_WEEKS + 1
    const endWeek = Math.min(startWeek + PARALLEL_WINDOW_SIZE_WEEKS - 1, totalWeeks)
    const isCurrent = winNum === windowNumber
    const isPast = winNum < windowNumber

    return {
      windowNumber: winNum,
      startWeek,
      endWeek,
      isCurrent,
      isPast,
      weeks: endWeek - startWeek + 1
    }
  })

  const showMoreWindows = totalWindows > 6

  return (
    <Card variant="outline" borderColor="border.subtle" h="100%">
      <CardBody p={6}>
        <Stack spacing={4}>
          {/* Header */}
          <HStack spacing={2}>
            <Icon as={Calendar} color="brand.primary" />
            <Text fontWeight="bold" fontSize="md" color="text.primary">
              Cycle & Week System
            </Text>
          </HStack>

          {/* Current Status */}
          <Box
            borderWidth="1px"
            borderColor="purple.200"
            bg="purple.50"
            rounded="md"
            p={3}
          >
            <Text fontSize="sm" fontWeight="semibold" color="text.primary" mb={1}>
              You are in Week {currentWeek} of Cycle {windowNumber}
            </Text>
            <Text fontSize="xs" color="text.secondary">
              Cycle {windowNumber} covers Weeks {windowStartWeek}-{windowEndWeek}
            </Text>
          </Box>

          {/* Visual Timeline */}
          <Stack spacing={2}>
            <Text fontSize="xs" fontWeight="medium" color="text.secondary">
              Cycle Timeline
            </Text>

            <Stack spacing={2}>
              {windows.map((win) => (
                <Flex key={win.windowNumber} align="center" gap={3}>
                  {/* Window Badge */}
                  <Badge
                    colorScheme={win.isCurrent ? 'purple' : win.isPast ? 'green' : 'gray'}
                    variant={win.isCurrent ? 'solid' : 'subtle'}
                    minW="70px"
                    textAlign="center"
                    fontSize="xs"
                  >
                    Cycle {win.windowNumber}
                  </Badge>

                  {/* Week Range */}
                  <Box flex={1}>
                    <Box
                      h="24px"
                      bg={
                        win.isCurrent
                          ? 'purple.100'
                          : win.isPast
                          ? 'green.50'
                          : 'gray.50'
                      }
                      borderWidth="1px"
                      borderColor={
                        win.isCurrent
                          ? 'purple.300'
                          : win.isPast
                          ? 'green.200'
                          : 'border.control'
                      }
                      borderRadius="md"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      position="relative"
                    >
                      <Text fontSize="xs" fontWeight="medium" color="text.primary">
                        Weeks {win.startWeek}-{win.endWeek}
                      </Text>

                      {/* Current week indicator */}
                      {win.isCurrent && (
                        <Box
                          position="absolute"
                          left={`${((currentWeek - win.startWeek) / win.weeks) * 100}%`}
                          top="-2px"
                          w="2px"
                          h="28px"
                          bg="brand.primary"
                        />
                      )}
                    </Box>
                  </Box>
                </Flex>
              ))}

              {showMoreWindows && (
                <Text fontSize="xs" color="text.secondary" textAlign="center">
                  ... {totalWindows - 6} more cycles
                </Text>
              )}
            </Stack>
          </Stack>

          {/* Explanation */}
          <Box
            borderWidth="1px"
            borderColor="blue.200"
            bg="blue.50"
            borderRadius="md"
            p={3}
          >
            <Text fontSize="xs" color="text.secondary">
              <strong>What are Cycles?</strong> Cycles are 2-week periods used to track your progress consistently.
              Your advancement is measured across cycles to ensure balanced engagement.
            </Text>
          </Box>
        </Stack>
      </CardBody>
    </Card>
  )
}
