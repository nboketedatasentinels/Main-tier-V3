import { useEffect, useRef, useState } from 'react'
import {
  AspectRatio,
  Box,
  Button,
  Flex,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react'
import { Volume2, VolumeX } from 'lucide-react'

const VIDEO_SRC = '/media/rules-of-engagement.mp4'

export const weeklyGlanceRoeStorageKey = (userId: string) =>
  `t4l.weeklyGlance.roeVideo.${userId}`

type RulesOfEngagementWelcomeModalProps = {
  isOpen: boolean
  onClose: () => void
}

/**
 * First-visit popup for Weekly Glance: Rules of Engagement video autoplays.
 * Browsers may force mute until the learner unmutes.
 */
export const RulesOfEngagementWelcomeModal = ({
  isOpen,
  onClose,
}: RulesOfEngagementWelcomeModalProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isMuted, setIsMuted] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const video = videoRef.current
    if (!video) return

    let cancelled = false
    const tryPlay = async () => {
      video.currentTime = 0
      video.muted = false
      setIsMuted(false)
      try {
        await video.play()
      } catch {
        if (cancelled) return
        // Autoplay with sound is often blocked - fall back to muted play.
        video.muted = true
        setIsMuted(true)
        try {
          await video.play()
        } catch {
          // User can press play via native controls.
        }
      }
    }

    void tryPlay()
    return () => {
      cancelled = true
      video.pause()
    }
  }, [isOpen])

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
    if (!video.muted) {
      void video.play().catch(() => undefined)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCentered
      size="3xl"
      closeOnOverlayClick={false}
    >
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
      <ModalContent borderRadius="xl" overflow="hidden" mx={4}>
        <ModalHeader pb={2} pr={12}>
          <Heading as="h2" size="md" color="#27062e">
            Rules of Engagement
          </Heading>
          <Text mt={1} fontSize="sm" color="gray.600" fontWeight="normal">
            A short orientation before you begin. This only plays automatically the
            first time you open Weekly Glance.
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Box
            borderRadius="lg"
            overflow="hidden"
            border="1px solid"
            borderColor="gray.200"
            bg="gray.900"
            position="relative"
          >
            <AspectRatio ratio={16 / 9}>
              <video
                ref={videoRef}
                src={VIDEO_SRC}
                controls
                playsInline
                autoPlay
                preload="auto"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  background: '#111',
                }}
              />
            </AspectRatio>
            {isMuted && (
              <Flex
                position="absolute"
                bottom={3}
                left={3}
                zIndex={1}
              >
                <Button
                  size="sm"
                  leftIcon={<VolumeX size={16} />}
                  bg="blackAlpha.700"
                  color="white"
                  border="1px solid"
                  borderColor="whiteAlpha.400"
                  _hover={{ bg: 'blackAlpha.800' }}
                  onClick={toggleMute}
                >
                  Tap to unmute
                </Button>
              </Flex>
            )}
          </Box>
        </ModalBody>
        <ModalFooter gap={2}>
          {!isMuted && (
            <Button
              variant="ghost"
              leftIcon={<Volume2 size={16} />}
              onClick={toggleMute}
              mr="auto"
            >
              Mute
            </Button>
          )}
          <Button
            bg="#350e6f"
            color="white"
            _hover={{ bg: '#27062e' }}
            onClick={onClose}
          >
            Continue to dashboard
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
