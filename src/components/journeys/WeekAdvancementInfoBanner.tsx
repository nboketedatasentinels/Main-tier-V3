import React from 'react'
import { Box, Heading, Stack, HStack, Text, Icon } from '@chakra-ui/react'
import { Info } from 'lucide-react'
import { JourneyType } from '@/config/pointsConfig'

export interface WeekAdvancementInfoBannerProps {
  currentWeek: number
  journeyType: JourneyType
  variant?: 'default' | 'compact'
}

export const WeekAdvancementInfoBanner: React.FC<WeekAdvancementInfoBannerProps> = ({
  currentWeek,
  variant = 'default'
}) => {
  // Generate appropriate message based on current week
  const getMessage = () => {
    if (currentWeek === 1) {
      return {
        title: 'Week Progression System',
        points: [
          'Weeks unlock when you complete milestones, not automatically over time',
          'Earn points and complete activities to progress to Week 2',
          'Progress is tracked across 2-week windows to ensure consistent engagement'
        ]
      }
    }

    return {
      title: 'How Week Advancement Works',
      points: [
        'Week advancement is based on milestone completion, not calendar time',
        'Meet minimum points and complete pending approvals to unlock next week',
        'Your progress is measured across 2-week windows for balanced growth'
      ]
    }
  }

  const content = getMessage()

  if (variant === 'compact') {
    return (
      <Box
        borderWidth="1px"
        borderColor="accent.purpleBorder"
        borderStyle="dashed"
        p={3}
        borderRadius="lg"
        bg="accent.purpleSubtle"
      >
        <HStack spacing={3} align="flex-start">
          <Icon as={Info} color="brand.primary" mt={0.5} flexShrink={0} />
          <Text fontSize="sm" color="text.secondary">
            <strong>Week Progression:</strong> Weeks unlock based on milestone completion, not time.
            Complete activities and earn target points to advance.
          </Text>
        </HStack>
      </Box>
    )
  }

  return (
    <Box
      borderWidth="1px"
      borderColor="accent.purpleBorder"
      borderStyle="dashed"
      p={4}
      borderRadius="lg"
      bg="accent.purpleSubtle"
    >
      <HStack spacing={2} mb={3}>
        <Icon as={Info} color="brand.primary" />
        <Heading size="sm" color="text.primary">
          {content.title}
        </Heading>
      </HStack>
      <Stack spacing={2} color="text.secondary" fontSize="sm">
        {content.points.map((point, index) => (
          <HStack key={index} spacing={2} align="flex-start">
            <Box
              w="4px"
              h="4px"
              borderRadius="full"
              bg="brand.primary"
              mt={2}
              flexShrink={0}
            />
            <Text>{point}</Text>
          </HStack>
        ))}
      </Stack>
    </Box>
  )
}
