import React from 'react'
import {
  AspectRatio,
  Box,
  Button,
  chakra,
  Flex,
  Heading,
  HStack,
  Icon,
  Stack,
  Text,
} from '@chakra-ui/react'
import { ArrowUpRight, MessageSquare, Mic, Play, Youtube } from 'lucide-react'

const YOUTUBE_EMBED_SRC = 'https://www.youtube.com/embed/Du71f-J9s2A?si=gcMvAtmRINGoIvYU'
const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@T4Leaders/podcasts'
const WHATSAPP_CIRCLE_URL = 'https://chat.whatsapp.com/GU834qw8x6JHYgrzDBUT5i?mode=ems_copy_t'

export const ShamelessTuesdayPodcastPage: React.FC = () => (
  <Stack spacing={6} pb={10}>
    <Box
      bgGradient="linear(to-r, #350e6f, #8b5a3c)"
      borderRadius="2xl"
      overflow="hidden"
      boxShadow="sm"
    >
      <Box px={{ base: 5, md: 8 }} py={{ base: 6, md: 8 }}>
        <Stack spacing={3} maxW="2xl">
          <HStack spacing={2} align="center">
            <Box
              bg="whiteAlpha.200"
              borderRadius="full"
              p={1.5}
              border="1px solid"
              borderColor="whiteAlpha.300"
            >
              <Icon as={Mic} boxSize={3.5} color="white" />
            </Box>
            <Text
              color="white"
              fontSize="xs"
              fontWeight="bold"
              letterSpacing="0.18em"
              textTransform="uppercase"
            >
              A T4L Podcast
            </Text>
          </HStack>
          <Heading
            size="2xl"
            color="white"
            letterSpacing="-0.025em"
            fontWeight="bold"
            lineHeight="1.05"
          >
            Shameless Tuesday
          </Heading>
          <Text
            color="whiteAlpha.900"
            fontSize={{ base: 'sm', md: 'md' }}
            lineHeight="1.6"
          >
            Honest conversations with leaders who&apos;ve stopped apologising for their ambition.
            New episode every Tuesday.
          </Text>
        </Stack>
      </Box>
    </Box>

    <Box
      bg="white"
      borderRadius="2xl"
      border="1px solid"
      borderColor="gray.200"
      boxShadow="sm"
      overflow="hidden"
    >
      <Flex direction={{ base: 'column', lg: 'row' }} align="stretch">
        <Box
          flex={{ base: '1', lg: '0 0 60%' }}
          bg="#0a0a0a"
          maxW={{ base: '100%', lg: '60%' }}
        >
          <AspectRatio ratio={16 / 9}>
            <chakra.iframe
              src={YOUTUBE_EMBED_SRC}
              title="Shameless Tuesday — latest episode"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </AspectRatio>
        </Box>

        <Stack
          flex="1"
          spacing={4}
          p={{ base: 5, md: 6 }}
          justify="center"
          borderTopWidth={{ base: '1px', lg: '0' }}
          borderLeftWidth={{ base: '0', lg: '1px' }}
          borderColor="gray.100"
        >
          <HStack spacing={2}>
            <Icon as={Play} color="#350e6f" boxSize={3.5} fill="#350e6f" strokeWidth={0} />
            <Text
              fontSize="xs"
              fontWeight="bold"
              letterSpacing="0.14em"
              textTransform="uppercase"
              color="#350e6f"
            >
              Latest episode
            </Text>
          </HStack>

          <Heading
            as="h2"
            size="md"
            color="#27062e"
            fontWeight="bold"
            letterSpacing="-0.01em"
            lineHeight="1.3"
          >
            This week&apos;s conversation
          </Heading>

          <Text fontSize="sm" color="gray.600" lineHeight="1.65">
            Press play above for the most recent drop, or jump to the full archive on YouTube.
            Want to talk back? The Shameless Circle on WhatsApp is where it happens.
          </Text>

          <Stack spacing={2} pt={1}>
            <Button
              as={chakra.a}
              href={YOUTUBE_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              size="md"
              bg="#350e6f"
              color="white"
              _hover={{ bg: '#27062e' }}
              _active={{ bg: '#27062e' }}
              leftIcon={<Icon as={Youtube} boxSize={4} />}
              rightIcon={<Icon as={ArrowUpRight} boxSize={3.5} />}
              borderRadius="md"
              fontWeight="semibold"
              w="full"
            >
              More episodes
            </Button>
            <Button
              as={chakra.a}
              href={WHATSAPP_CIRCLE_URL}
              target="_blank"
              rel="noopener noreferrer"
              size="md"
              variant="outline"
              color="gray.700"
              borderColor="gray.300"
              _hover={{ bg: 'gray.50', borderColor: '#350e6f', color: '#350e6f' }}
              leftIcon={<Icon as={MessageSquare} boxSize={4} />}
              rightIcon={<Icon as={ArrowUpRight} boxSize={3.5} />}
              borderRadius="md"
              fontWeight="semibold"
              w="full"
            >
              Join the Shameless Circle
            </Button>
          </Stack>
        </Stack>
      </Flex>
    </Box>
  </Stack>
)

export default ShamelessTuesdayPodcastPage
