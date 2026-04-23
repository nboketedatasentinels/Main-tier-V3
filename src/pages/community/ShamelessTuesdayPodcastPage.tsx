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
import { ExternalLink, Headphones, MessageSquare, Youtube } from 'lucide-react'

const YOUTUBE_EMBED_SRC = 'https://www.youtube.com/embed/Du71f-J9s2A?si=gcMvAtmRINGoIvYU'
const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@T4Leaders/podcasts'
const WHATSAPP_CIRCLE_URL = 'https://chat.whatsapp.com/GU834qw8x6JHYgrzDBUT5i?mode=ems_copy_t'

export const ShamelessTuesdayPodcastPage: React.FC = () => (
  <Stack spacing={6} pb={10}>
    <Box bg="white" p={6} borderRadius="3xl" borderWidth={1} borderColor="brand.border" boxShadow="sm">
      <Stack spacing={2}>
        <HStack spacing={2} color="purple.600">
          <Icon as={Headphones} boxSize={5} />
          <Text fontSize="xs" fontWeight="bold" letterSpacing="widest">
            SHAMELESS TUESDAY
          </Text>
        </HStack>
        <Heading size="lg" color="brand.text">
          Shameless Tuesday Podcast
        </Heading>
        <Text color="brand.subtleText" fontSize="md">
          Honest conversations with leaders who've stopped apologising for their ambition. New
          episodes drop every Tuesday.
        </Text>
      </Stack>
    </Box>

    <Box borderWidth={1} borderColor="border.subtle" bg="surface.default" borderRadius="3xl" p={{ base: 4, md: 6 }} boxShadow="sm">
      <Stack spacing={4}>
        <Heading size="md" color="text.primary">
          Latest episode
        </Heading>
        <AspectRatio ratio={16 / 9} borderRadius="2xl" overflow="hidden">
          <chakra.iframe
            src={YOUTUBE_EMBED_SRC}
            title="Shameless Tuesday Podcast — latest episode"
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
            colorScheme="red"
            leftIcon={<Icon as={Youtube} boxSize={4} />}
            rightIcon={<Icon as={ExternalLink} boxSize={4} />}
          >
            View more episodes on YouTube
          </Button>
          <Button
            as={chakra.a}
            href={WHATSAPP_CIRCLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            colorScheme="green"
            leftIcon={<Icon as={MessageSquare} boxSize={4} />}
            rightIcon={<Icon as={ExternalLink} boxSize={4} />}
          >
            Join the Shameless Circle on WhatsApp
          </Button>
        </HStack>
      </Stack>
    </Box>

    <Box borderWidth={1} borderColor="border.subtle" bg="surface.subtle" borderRadius="3xl" p={6}>
      <Stack spacing={2}>
        <Heading size="sm" color="text.primary">
          Why listen?
        </Heading>
        <Text color="text.secondary" fontSize="sm">
          Every episode is a candid, unvarnished conversation about leadership, transformation, and
          the things no one else is saying out loud. Pair it with the Shameless Circle WhatsApp to
          dig into episode moments with fellow listeners.
        </Text>
      </Stack>
    </Box>
  </Stack>
)

export default ShamelessTuesdayPodcastPage
