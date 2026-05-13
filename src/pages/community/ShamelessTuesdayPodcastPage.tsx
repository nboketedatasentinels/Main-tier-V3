import React from 'react'
import {
  AspectRatio,
  Box,
  Button,
  chakra,
  Heading,
  HStack,
  Icon,
  Stack,
  Text,
} from '@chakra-ui/react'
import { ArrowUpRight, MessageSquare, Play, Youtube } from 'lucide-react'

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
      <Box px={{ base: 5, md: 7 }} py={{ base: 5, md: 6 }}>
        <Stack spacing={2}>
          <HStack spacing={2} color="whiteAlpha.900">
            <Text
              fontSize="xs"
              fontWeight="bold"
              letterSpacing="0.16em"
              textTransform="uppercase"
            >
              Leadership Conversations
            </Text>
            <Box boxSize={1} borderRadius="full" bg="whiteAlpha.500" />
            <Text
              fontSize="xs"
              fontWeight="semibold"
              letterSpacing="0.14em"
              textTransform="uppercase"
            >
              New episode every Tuesday
            </Text>
          </HStack>
          <Heading
            size="lg"
            color="white"
            letterSpacing="-0.02em"
            fontWeight="bold"
            lineHeight="1.15"
          >
            Shameless Tuesday
          </Heading>
          <Text color="whiteAlpha.800" fontSize="sm" lineHeight="1.6" maxW="2xl">
            Honest conversations with leaders who&apos;ve stopped apologising for their ambition.
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
      <Box h="3px" bg="#350e6f" />
      <Stack spacing={5} p={{ base: 5, md: 6 }}>
        <HStack spacing={2} align="center">
          <Icon as={Play} color="#350e6f" boxSize={4} fill="#350e6f" strokeWidth={0} />
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

        <AspectRatio
          ratio={16 / 9}
          borderRadius="xl"
          overflow="hidden"
          border="1px solid"
          borderColor="gray.200"
        >
          <chakra.iframe
            src={YOUTUBE_EMBED_SRC}
            title="Shameless Tuesday — latest episode"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </AspectRatio>

        <HStack spacing={3} flexWrap="wrap">
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
          >
            More episodes on YouTube
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
          >
            Join the Shameless Circle
          </Button>
        </HStack>
      </Stack>
    </Box>
  </Stack>
)

export default ShamelessTuesdayPodcastPage
