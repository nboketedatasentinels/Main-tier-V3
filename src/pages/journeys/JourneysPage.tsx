import React from 'react'
import { Box, Heading, List, ListIcon, ListItem, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { CheckCircle2 } from 'lucide-react'

const journeyOptions = [
  {
    title: '4-week Sprint',
    description: 'Intensive pace with clear weekly checkpoints to build momentum quickly.',
    promise: 'Perfect when you need quick wins without losing sight of quality.',
  },
  {
    title: '6-week Builder',
    description: 'Balanced cadence that leaves room for iteration and collaboration.',
    promise: 'Ideal for leaders juggling course commitments with day-to-day demands.',
  },
  {
    title: '3-month Accelerator',
    description: 'Extended runway for deeper transformation with sustainable milestones.',
    promise: 'Supports complex initiatives while keeping everyone on track to finish.',
  },
]

export const JourneysPage: React.FC = () => {
  return (
    <Box>
      <Stack spacing={8}>
        <Stack spacing={2}>
          <Heading color="brand.text">Journeys</Heading>
          <Text color="brand.subtleText">Explore how transformation journeys are structured.</Text>
        </Stack>

        <Box bg="white" borderRadius="lg" borderWidth="1px" borderColor="border.control" p={{ base: 6, md: 8 }} shadow="sm">
          <Stack spacing={4}>
            <Heading size="md" color="brand.text">Journey Flexibility Offered</Heading>
            <Text color="brand.subtleText">
              Organizations can run multiple journey lengths to match different program pacing needs.
            </Text>
            <List spacing={3} color="brand.subtleText">
              <ListItem display="flex" alignItems="flex-start" gap={2}>
                <ListIcon as={CheckCircle2} color="green.500" mt={1} />
                Includes four-week, six-week, and three-month options to support different implementation timelines.
              </ListItem>
              <ListItem display="flex" alignItems="flex-start" gap={2}>
                <ListIcon as={CheckCircle2} color="green.500" mt={1} />
                Program pacing is set at the organization level so members move through a shared cadence.
              </ListItem>
              <ListItem display="flex" alignItems="flex-start" gap={2}>
                <ListIcon as={CheckCircle2} color="green.500" mt={1} />
                Shared timelines help teams complete courses within a defined timeframe while keeping expectations clear.
              </ListItem>
            </List>
          </Stack>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
          {journeyOptions.map((journey) => (
            <Box
              key={journey.title}
              bg="white"
              borderWidth="1px"
              borderColor="border.control"
              borderRadius="lg"
              p={5}
              shadow="xs"
              _hover={{ shadow: 'md', borderColor: 'purple.200' }}
              transition="all 0.2s ease-in-out"
            >
              <Stack spacing={3}>
                <Heading size="md" color="brand.text">{journey.title}</Heading>
                <Text color="brand.subtleText">{journey.description}</Text>
                <Text color="brand.text" fontWeight="semibold">{journey.promise}</Text>
              </Stack>
            </Box>
          ))}
        </SimpleGrid>
      </Stack>
    </Box>
  )
}
