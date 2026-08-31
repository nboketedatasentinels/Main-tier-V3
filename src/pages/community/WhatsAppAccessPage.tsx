import React from 'react'
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  Stack,
  Text,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import { BOOK_CLUB_JOIN_URL } from '@/config/communityLinks'
import { ArrowUpRight, Circle, MessageCircle } from 'lucide-react'

/** Free Practitioner Community / Global Book Club application (Zoho survey). */
const JOIN_NOW_URL = BOOK_CLUB_JOIN_URL

const STATS = [
  {
    value: '15+',
    label: 'COUNTRIES',
    description: 'Active members across Africa, US, UK, and India',
  },
  {
    value: '86%',
    label: 'DIRECTOR+',
    description: 'Every member reviewed before joining',
  },
  {
    value: '12+',
    label: 'INDUSTRIES',
    description: 'Mining, FinTech, Health, Government, EdTech and more',
  },
  {
    value: '15+',
    label: 'YRS EXP.',
    description: 'Median member experience in transformation work',
  },
  {
    value: 'CEO+',
    label: 'SENIORITY',
    description: 'CEOs, CDOs, Heads of Transformation, Independent Consultants',
  },
] as const

const INDUSTRIES = [
  'Mining & Resources',
  'Finance & FinTech',
  'EdTech & Workforce',
  'Health & HealthTech',
  'Marketing & Creative',
  'Government & Public Sector',
  'IT & Infrastructure',
  'GreenTech & Climate',
  'Organisational Psychology',
] as const

const WHO_CAN_APPLY = ['T4L Practitioners', 'Emerging Leaders', 'AI Curious'] as const

const WHATS_INSIDE = [
  'Shameless Circle',
  'Global Book Club',
  'Network of AI and Digital Transformation Practitioners',
] as const

export const WhatsAppAccessPage: React.FC = () => {
  return (
    <Stack spacing={8} pb={10}>
      <Box
        bg="white"
        p={{ base: 5, md: 8 }}
        borderRadius="2xl"
        borderWidth={1}
        borderColor="gray.200"
      >
        <Stack spacing={6}>
          <Stack spacing={2}>
            <Text
              fontSize="xs"
              fontWeight="semibold"
              letterSpacing="0.12em"
              textTransform="uppercase"
              color="gray.400"
            >
              Free Community
            </Text>
            <Heading size="lg" color="gray.900" letterSpacing="-0.02em">
              The Practitioner Community
            </Heading>
            <Text color="gray.600" fontSize="md" maxW="2xl">
              For active transformation practitioners across Africa and globally. Applications
              reviewed. No cost to join.
            </Text>
          </Stack>

          <Button
            as="a"
            href={JOIN_NOW_URL}
            target="_blank"
            rel="noopener noreferrer"
            alignSelf={{ base: 'stretch', sm: 'flex-start' }}
            size="lg"
            bg="#350e6f"
            color="white"
            _hover={{ bg: '#27062e' }}
            rightIcon={<Icon as={ArrowUpRight} boxSize={4} />}
            leftIcon={<Icon as={MessageCircle} boxSize={4} />}
            fontWeight="semibold"
            px={8}
          >
            Join Now
          </Button>
        </Stack>
      </Box>

      <Box
        bg="white"
        borderRadius="2xl"
        borderWidth={1}
        borderColor="gray.200"
        overflow="hidden"
      >
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 5 }} spacing={0}>
          {STATS.map((stat, index) => (
            <Box
              key={stat.label}
              px={{ base: 5, md: 6 }}
              py={{ base: 5, md: 6 }}
              borderRightWidth={{ base: 0, lg: index < STATS.length - 1 ? '1px' : 0 }}
              borderBottomWidth={{
                base: index < STATS.length - 1 ? '1px' : 0,
                lg: 0,
              }}
              borderColor="gray.200"
            >
              <Text
                fontSize={{ base: '3xl', md: '4xl' }}
                fontWeight="bold"
                color="gray.900"
                lineHeight="1"
                letterSpacing="-0.03em"
              >
                {stat.value}
              </Text>
              <Text
                mt={2}
                fontSize="xs"
                fontWeight="bold"
                letterSpacing="0.1em"
                color="#c9a227"
              >
                {stat.label}
              </Text>
              <Text mt={2} fontSize="sm" color="gray.500" lineHeight="1.45">
                {stat.description}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      </Box>

      <Wrap spacing={2}>
        {INDUSTRIES.map((industry) => (
          <WrapItem key={industry}>
            <Box
              px={4}
              py={2}
              borderRadius="full"
              bg="purple.50"
              color="gray.800"
              fontSize="sm"
              fontWeight="medium"
            >
              {industry}
            </Box>
          </WrapItem>
        ))}
      </Wrap>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
        <Box
          bg="white"
          p={{ base: 5, md: 6 }}
          borderRadius="2xl"
          borderWidth={1}
          borderColor="gray.200"
        >
          <Heading size="md" color="gray.900" mb={4}>
            Who can apply
          </Heading>
          <Stack spacing={3}>
            {WHO_CAN_APPLY.map((item) => (
              <HStack key={item} align="flex-start" spacing={3}>
                <Icon as={Circle} boxSize={2.5} color="gray.500" fill="currentColor" mt={1.5} />
                <Text color="gray.800" fontSize="md">
                  {item}
                </Text>
              </HStack>
            ))}
          </Stack>
        </Box>

        <Box
          bg="white"
          p={{ base: 5, md: 6 }}
          borderRadius="2xl"
          borderWidth={1}
          borderColor="gray.200"
        >
          <Heading size="md" color="gray.900" mb={4}>
            What&apos;s inside
          </Heading>
          <Stack spacing={3}>
            {WHATS_INSIDE.map((item) => (
              <HStack key={item} align="flex-start" spacing={3}>
                <Icon as={Circle} boxSize={2.5} color="gray.500" fill="currentColor" mt={1.5} />
                <Text color="gray.800" fontSize="md">
                  {item}
                </Text>
              </HStack>
            ))}
          </Stack>
        </Box>
      </SimpleGrid>

      <Flex justify={{ base: 'stretch', sm: 'flex-start' }}>
        <Button
          as="a"
          href={JOIN_NOW_URL}
          target="_blank"
          rel="noopener noreferrer"
          size="md"
          variant="outline"
          borderColor="#350e6f"
          color="#350e6f"
          _hover={{ bg: 'purple.50' }}
          rightIcon={<Icon as={ArrowUpRight} boxSize={3.5} />}
          fontWeight="semibold"
          w={{ base: 'full', sm: 'auto' }}
        >
          Join Now
        </Button>
      </Flex>
    </Stack>
  )
}

export default WhatsAppAccessPage
