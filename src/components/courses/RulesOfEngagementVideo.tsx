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
import { motion, useReducedMotion } from 'framer-motion'
import { Play } from 'lucide-react'

const VIDEO_SRC = '/media/rules-of-engagement.mp4'

const MotionBox = motion(Box)

/**
 * Entrance for the player: it morphs in from a smaller, heavily rounded,
 * out-of-focus frame into the square-cornered 16:9 stage. Runs on every mount,
 * so it replays each time the page loads.
 */
const MORPH_INITIAL = {
  opacity: 0,
  scale: 0.94,
  y: 14,
  borderRadius: 56,
  filter: 'blur(10px)',
}

const MORPH_ANIMATE = {
  opacity: 1,
  scale: 1,
  y: 0,
  borderRadius: 8,
  filter: 'blur(0px)',
}

// Expo-out: quick to settle, no bounce - reads as deliberate rather than playful.
const MORPH_TRANSITION = { duration: 0.85, ease: [0.16, 1, 0.3, 1] as const }

interface RulesOfEngagementVideoProps {
  /**
   * Show the eyebrow / heading / description panel beside the player. The
   * weekly glance dashboard renders the player on its own, so it passes false.
   */
  showCopy?: boolean
}

export const RulesOfEngagementVideo: React.FC<RulesOfEngagementVideoProps> = ({ showCopy = true }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const handlePlay = () => {
    const v = videoRef.current
    if (!v) return
    v.play().catch(() => undefined)
  }

  return (
    <Box
      as="section"
      aria-label="Rules of Engagement orientation"
      // Without the copy panel this is just the player - no card behind it.
      bg={showCopy ? 'white' : 'transparent'}
      borderRadius="2xl"
      border={showCopy ? '1px solid' : 'none'}
      borderColor="gray.200"
      boxShadow={showCopy ? 'sm' : 'none'}
      overflow="hidden"
    >
      <Flex
        direction={{ base: 'column', md: 'row' }}
        align="stretch"
        gap={{ base: 5, md: 6 }}
        p={showCopy ? { base: 5, md: 6, lg: 8 } : 0}
      >
        <Box flex={{ base: 'none', md: '2 1 0%' }} minW={0} w="full" order={{ base: 1, md: 1 }}>
          <MotionBox
            initial={prefersReducedMotion ? false : MORPH_INITIAL}
            animate={prefersReducedMotion ? undefined : MORPH_ANIMATE}
            transition={MORPH_TRANSITION}
            // The morph animates border-radius, so let framer own it.
            style={{ borderRadius: prefersReducedMotion ? 8 : undefined }}
            overflow="hidden"
            border="1px solid"
            borderColor="gray.300"
            position="relative"
            bg="gray.900"
            willChange="transform, filter, opacity"
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
          </MotionBox>
        </Box>

        {showCopy && (
          <Stack
            spacing={4}
            flex={{ base: 'none', md: '1 1 0%' }}
            minW={0}
            w="full"
            justify="center"
            order={{ base: 2, md: 2 }}
          >
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
        )}
      </Flex>
    </Box>
  )
}

export default RulesOfEngagementVideo
