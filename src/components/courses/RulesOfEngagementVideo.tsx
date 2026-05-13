import React, { useRef, useState } from 'react'
import {
  AspectRatio,
  Box,
  Flex,
  Heading,
  Icon,
  Stack,
  Text,
} from '@chakra-ui/react'
import { Play } from 'lucide-react'

const VIDEO_SRC = '/media/rules-of-engagement.mp4'

export const RulesOfEngagementVideo: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const handlePlay = () => {
    const v = videoRef.current
    if (!v) return
    v.play().catch(() => undefined)
  }

  return (
    <Box
      as="section"
      aria-label="Rules of Engagement orientation"
      bg="white"
      borderRadius="2xl"
      border="1px solid"
      borderColor="gray.200"
      boxShadow="sm"
      overflow="hidden"
    >
      <Flex
        direction={{ base: 'column', lg: 'row' }}
        align="stretch"
        gap={{ base: 5, lg: 8 }}
        p={{ base: 5, md: 6, lg: 8 }}
      >
        <Stack spacing={4} flex="1 1 0" maxW={{ lg: '380px' }} justify="center">
          <Text
            color="purple.700"
            textTransform="uppercase"
            letterSpacing="0.16em"
            fontSize="xs"
            fontWeight="semibold"
          >
            Programme Orientation
          </Text>

          <Heading
            as="h2"
            size="lg"
            color="gray.900"
            lineHeight="1.2"
            letterSpacing="-0.01em"
            fontWeight="semibold"
          >
            Rules of Engagement
          </Heading>

          <Text color="gray.600" fontSize="sm" lineHeight="1.7">
            A short orientation from the T4L team. Please review before
            beginning the programme. It outlines the expectations, the
            cadence, and the professional standards that apply throughout
            your journey.
          </Text>
        </Stack>

        <Box flex="1 1 0" minW={0}>
          <Box
            borderRadius="lg"
            overflow="hidden"
            border="1px solid"
            borderColor="gray.300"
            position="relative"
            bg="gray.900"
          >
            <AspectRatio ratio={16 / 9}>
              <video
                ref={videoRef}
                src={VIDEO_SRC}
                controls
                playsInline
                preload="metadata"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#111' }}
              />
            </AspectRatio>

            {!isPlaying && (
              <Flex
                position="absolute"
                inset={0}
                align="center"
                justify="center"
                pointerEvents="none"
                bg="blackAlpha.300"
              >
                <Flex
                  align="center"
                  justify="center"
                  bg="blackAlpha.700"
                  color="white"
                  boxSize={{ base: 12, md: 14 }}
                  borderRadius="full"
                  border="1px solid"
                  borderColor="whiteAlpha.400"
                  cursor="pointer"
                  pointerEvents="auto"
                  onClick={handlePlay}
                  transition="background 0.18s ease, transform 0.18s ease"
                  _hover={{ bg: 'blackAlpha.800', transform: 'scale(1.04)' }}
                  aria-label="Play Rules of Engagement video"
                  role="button"
                >
                  <Icon as={Play} boxSize={5} fill="currentColor" strokeWidth={0} />
                </Flex>
              </Flex>
            )}
          </Box>
        </Box>
      </Flex>
    </Box>
  )
}

export default RulesOfEngagementVideo
