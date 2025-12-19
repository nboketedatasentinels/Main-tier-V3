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
          <Text color="brand.subtleText">Explore and select your transformation journey.</Text>
        </Stack>

        <Box bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.200" p={{ base: 6, md: 8 }} shadow="sm">
          <Stack spacing={4}>
            <Heading size="md" color="brand.text">Journey Flexibility Offered</Heading>
            <Text color="brand.subtleText">
              Supports multiple journey lengths, allowing personalized pacing while ensuring timely course completion.
            </Text>
            <List spacing={3} color="brand.subtleText">
              <ListItem display="flex" alignItems="flex-start" gap={2}>
                <ListIcon as={CheckCircle2} color="green.500" mt={1} />
                Supports various journey lengths, including four-week, six-week, and three-month options, catering to
                different participant needs.
              </ListItem>
              <ListItem display="flex" alignItems="flex-start" gap={2}>
                <ListIcon as={CheckCircle2} color="green.500" mt={1} />
                Allows participants to choose their preferred pace, enabling them to balance course commitments with
                personal and professional responsibilities.
              </ListItem>
              <ListItem display="flex" alignItems="flex-start" gap={2}>
                <ListIcon as={CheckCircle2} color="green.500" mt={1} />
                Ensures that all participants can complete their courses within a designated timeframe while still having
                the flexibility to manage their learning experience.
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
              borderColor="gray.200"
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
