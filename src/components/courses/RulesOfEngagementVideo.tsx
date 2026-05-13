import React, { useRef, useState } from 'react'
import {
  AspectRatio,
  Badge,
  Box,
  Flex,
  HStack,
  Heading,
  Icon,
  Stack,
  Text,
} from '@chakra-ui/react'
import { Play, Sparkles } from 'lucide-react'

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
      position="relative"
      borderRadius="3xl"
      overflow="hidden"
      bgGradient="linear(135deg, #27062e 0%, #350e6f 55%, #4a1280 100%)"
      boxShadow="0 24px 60px -28px rgba(39, 6, 46, 0.55)"
      border="1px solid"
      borderColor="purple.900"
      as="section"
      aria-label="Rules of Engagement introduction"
    >
      <Box
        position="absolute"
        inset={0}
        opacity={0.18}
        pointerEvents="none"
        bgImage="radial-gradient(circle at 18% 22%, rgba(244,84,12,0.45) 0%, transparent 38%), radial-gradient(circle at 82% 78%, rgba(249,219,89,0.55) 0%, transparent 42%)"
      />

      <Flex
        direction={{ base: 'column', lg: 'row' }}
        position="relative"
        zIndex={1}
        gap={{ base: 6, lg: 10 }}
        p={{ base: 6, md: 8, lg: 10 }}
        align="stretch"
      >
        <Stack spacing={5} flex="1 1 0" maxW={{ lg: '420px' }} justify="center">
          <HStack spacing={2}>
            <Badge
              variant="subtle"
              colorScheme="yellow"
              bg="rgba(249, 219, 89, 0.15)"
              color="#f9db59"
              border="1px solid"
              borderColor="rgba(249, 219, 89, 0.35)"
              borderRadius="full"
              px={3}
              py={1}
              textTransform="uppercase"
              letterSpacing="0.12em"
              fontSize="xs"
              fontWeight="bold"
            >
              <HStack spacing={1.5}>
                <Icon as={Sparkles} boxSize={3} />
                <Text>Watch first</Text>
              </HStack>
            </Badge>
            <Badge
              variant="subtle"
              bg="rgba(244, 84, 12, 0.15)"
              color="#ffb88a"
              border="1px solid"
              borderColor="rgba(244, 84, 12, 0.35)"
              borderRadius="full"
              px={3}
              py={1}
              textTransform="uppercase"
              letterSpacing="0.1em"
              fontSize="xs"
              fontWeight="bold"
            >
              New
            </Badge>
          </HStack>

          <Stack spacing={3}>
            <Heading
              as="h2"
              size="lg"
              color="white"
              lineHeight="1.15"
              letterSpacing="-0.01em"
            >
              Rules of <Box as="span" color="#f9db59" fontStyle="italic">Engagement</Box>
            </Heading>
            <Text color="rgba(255, 255, 255, 0.78)" fontSize="md" lineHeight="1.65">
              A short orientation from the T4L team. Watch this before you dive
              into your courses — it sets the tone, the cadence, and the
              standard we hold each other to throughout the journey.
            </Text>
          </Stack>
        </Stack>

        <Box flex="1 1 0" minW={0}>
          <Box
            borderRadius="2xl"
            overflow="hidden"
            border="1px solid"
            borderColor="rgba(249, 219, 89, 0.25)"
            boxShadow="0 18px 40px -22px rgba(0, 0, 0, 0.55)"
            position="relative"
            bg="black"
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
                style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
              />
            </AspectRatio>

            {!isPlaying && (
              <Flex
                position="absolute"
                inset={0}
                align="center"
                justify="center"
                bgGradient="linear(180deg, rgba(39,6,46,0.05) 0%, rgba(39,6,46,0.55) 100%)"
                pointerEvents="none"
              >
                <Flex
                  align="center"
                  justify="center"
                  bg="#f4540c"
                  color="white"
                  boxSize={{ base: 14, md: 16 }}
                  borderRadius="full"
                  boxShadow="0 12px 30px -8px rgba(244, 84, 12, 0.65)"
                  cursor="pointer"
                  pointerEvents="auto"
                  onClick={handlePlay}
                  transition="transform 0.18s ease"
                  _hover={{ transform: 'scale(1.06)' }}
                  aria-label="Play Rules of Engagement video"
                  role="button"
                >
                  <Icon as={Play} boxSize={6} fill="white" strokeWidth={0} />
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
