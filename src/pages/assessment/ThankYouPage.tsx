import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, Button, Container, Flex, HStack, Text, VStack } from '@chakra-ui/react'
import { Check, CheckCircle2, Copy, Linkedin, Share2, Sparkles } from 'lucide-react'
import { ARCHETYPE_CONTENT } from '@/config/liftAssessment'
import { ArchetypeSymbol } from '@/components/lift/ArchetypeSymbol'
import type { LiftResult } from '@/utils/liftScoring'

const PLUM = '#27062e'
const GOLD = '#eab130'

const SITE_URL = 'https://app.t4leader.com'
// Where we send people to take the assessment (used in the caption CTA).
const ASSESSMENT_URL = `${SITE_URL}/assessment`

// The per-result share link. Its OG card (served by api/share.ts + api/og.tsx)
// shows the person's ACTUAL result - archetype + LIFT Index - and the page it
// links to invites the viewer to take the assessment. Falls back to the plain
// assessment link when the result is missing (refresh / direct visit).
const buildShareUrl = (result: LiftResult | null): string => {
  if (!result) return ASSESSMENT_URL
  const params = new URLSearchParams({ a: result.archetype, i: String(result.liftIndex) })
  return `${SITE_URL}/r?${params.toString()}`
}

/**
 * The ready-to-post caption. It carries the person's ACTUAL result (archetype +
 * LIFT Index) and the assessment link, so a share both shows how they rated and
 * invites their network to find out how they'd rate. Degrades to a generic
 * invite when the result is missing (direct visit / refresh). No em dashes, per
 * brand voice.
 */
const buildCaption = (result: LiftResult | null): string => {
  const cta = `Curious how you'd rate? Take the free 4-minute LIFT Index: ${ASSESSMENT_URL}`
  if (!result) {
    return `I just mapped my leadership profile with the LIFT Index, a quick read on how you lead AI and digital transformation across four pillars. ${cta}`
  }
  const profile =
    result.archetype === 'Emerging Leader' ? 'an Emerging Leader' : `The ${result.archetype}`
  return `My LIFT Index is ${result.liftIndex} and my leadership profile is ${profile}. The LIFT Index scores how you lead AI and digital transformation across four pillars. ${cta}`
}

/**
 * Public, end-of-funnel thank-you. Anonymous visitors land here after seeing
 * their LIFT results pop-up - we recap their archetype/index and confirm we'll
 * be in touch. No account, no platform access; this is the funnel's last stop.
 *
 * The result is passed via router state; on a refresh/direct visit it may be
 * absent, so the recap degrades gracefully to a plain thank-you.
 */
export const ThankYouPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const result = (location.state as { result?: LiftResult } | null)?.result ?? null
  const content = result ? ARCHETYPE_CONTENT[result.archetype] : null
  const caption = buildCaption(result)
  const shareUrl = buildShareUrl(result)
  const linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
  const [copied, setCopied] = useState(false)
  const [pasteHint, setPasteHint] = useState(false)

  // Copy the result caption for the user to paste, then open the LinkedIn
  // composer on the per-result share link. The link's OG card already shows
  // their archetype + LIFT Index; LinkedIn can't pre-fill the caption text, so
  // copying it lets them add the written result too.
  const shareOnLinkedIn = async () => {
    try {
      await navigator.clipboard.writeText(caption)
      setPasteHint(true)
      window.setTimeout(() => setPasteHint(false), 6000)
    } catch {
      /* clipboard blocked - they can still copy the caption manually below */
    }
    window.open(linkedInShareUrl, '_blank', 'noopener,noreferrer')
  }

  // Native share sheet (mobile / supported browsers) pre-fills the caption for
  // real. Falls back to the LinkedIn flow when unavailable.
  const shareNative = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ text: caption, url: shareUrl })
        return
      } catch {
        /* user cancelled - do nothing */
        return
      }
    }
    await shareOnLinkedIn()
  }

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <Box minH="100vh" bg="white" position="relative" overflow="hidden">
      {/* Soft gold blobs - mirrors the assessment page */}
      <Box
        aria-hidden
        position="absolute"
        top="-130px"
        right="-130px"
        w={{ base: '280px', md: '420px' }}
        h={{ base: '280px', md: '420px' }}
        borderRadius="full"
        bg="#eab130"
        opacity={0.2}
        filter="blur(90px)"
        pointerEvents="none"
      />
      <Box
        aria-hidden
        position="absolute"
        bottom="-150px"
        left="-150px"
        w={{ base: '320px', md: '460px' }}
        h={{ base: '320px', md: '460px' }}
        borderRadius="full"
        bg="#f9db59"
        opacity={0.28}
        filter="blur(100px)"
        pointerEvents="none"
      />

      {/* Minimal brand mark */}
      <Box position="relative" zIndex={1} px={{ base: 4, sm: 6 }} pt={5}>
        <Box
          as="button"
          onClick={() => navigate('/')}
          display="flex"
          alignItems="center"
          gap={2.5}
          aria-label="Transformation Leader home"
        >
          <img src="/t4.png" alt="" style={{ height: 36, width: 36, borderRadius: '9999px', objectFit: 'cover' }} />
          <Box as="span" fontWeight="extrabold" letterSpacing="wide" color={PLUM} fontSize="sm">
            TRANSFORMATION <Box as="span" color={GOLD}>LEADER</Box>
          </Box>
        </Box>
      </Box>

      <Container maxW="xl" position="relative" zIndex={1} py={{ base: 12, md: 20 }}>
        <VStack spacing={7} textAlign="center">
          {/* Success mark */}
          <Flex
            align="center"
            justify="center"
            boxSize="76px"
            borderRadius="full"
            bgGradient={`linear(to-br, ${PLUM}, ${GOLD})`}
            color="white"
            shadow="lg"
          >
            <CheckCircle2 size={40} />
          </Flex>

          <VStack spacing={3}>
            <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="extrabold" color={PLUM} lineHeight="1.15">
              Thank you - you&apos;re all set
            </Text>
            <Text fontSize={{ base: 'sm', md: 'md' }} color="gray.600" maxW="md">
              We&apos;ve received your details and your LIFT profile. Our team will be in touch shortly with your
              next steps and where to take this from here.
            </Text>
          </VStack>

          {/* Result recap card */}
          {result && (
            <Box
              w="full"
              borderRadius="2xl"
              borderWidth="1px"
              borderColor="#f3e2b3"
              bgGradient="linear(to-b, #fffaf0, white)"
              px={{ base: 6, md: 8 }}
              py={{ base: 6, md: 7 }}
              shadow="sm"
            >
              <Flex
                display="inline-flex"
                align="center"
                gap={2}
                px={3}
                py={1}
                mb={4}
                borderRadius="full"
                bg="#fbf2d8"
                color="#9c6f15"
                fontWeight="bold"
                fontSize="xs"
                letterSpacing="0.06em"
                textTransform="uppercase"
              >
                <Sparkles size={14} /> Your LIFT result
              </Flex>

              <Flex direction="column" align="center" gap={2}>
                <ArchetypeSymbol archetype={result.archetype} size={64} />
                <Flex align="baseline" justify="center" gap={3} wrap="wrap">
                  <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="extrabold" color={PLUM}>
                    {result.archetype === 'Emerging Leader' ? 'The Emerging Leader' : `The ${result.archetype}`}
                  </Text>
                  <Text
                    fontSize={{ base: 'lg', md: 'xl' }}
                    fontWeight="bold"
                    bgGradient={`linear(to-r, ${PLUM}, ${GOLD})`}
                    bgClip="text"
                  >
                    LIFT Index {result.liftIndex}
                  </Text>
                </Flex>
              </Flex>

              {content && (
                <Text mt={3} fontSize="sm" color="gray.600" lineHeight="1.6">
                  {content.reveal}
                </Text>
              )}
            </Box>
          )}

          {/* Share your result - turn each taker into a referral */}
          <Box
            w="full"
            borderRadius="2xl"
            borderWidth="1px"
            borderColor="gray.100"
            bg="white"
            px={{ base: 6, md: 8 }}
            py={{ base: 6, md: 7 }}
            shadow="sm"
          >
            <VStack spacing={4}>
              <VStack spacing={1}>
                <Text fontSize="md" fontWeight="bold" color={PLUM}>
                  Share your result
                </Text>
                <Text fontSize="sm" color="gray.600" textAlign="center" maxW="sm">
                  Post your LIFT profile and challenge your network to see how they rate.
                </Text>
              </VStack>

              {/* The exact caption that gets posted - shows their actual result. */}
              <Box
                w="full"
                textAlign="left"
                borderRadius="xl"
                borderWidth="1px"
                borderColor="gray.200"
                bg="gray.50"
                px={4}
                py={3}
              >
                <Text fontSize="sm" color="gray.700" lineHeight="1.6" whiteSpace="pre-wrap">
                  {caption}
                </Text>
              </Box>

              <HStack spacing={3} flexWrap="wrap" justify="center">
                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
                  <Button
                    onClick={shareNative}
                    leftIcon={<Share2 size={18} />}
                    px={6}
                    borderRadius="full"
                    bg={PLUM}
                    color="white"
                    fontWeight="bold"
                    _hover={{ bg: '#3a0d44' }}
                    _active={{ transform: 'scale(0.99)' }}
                  >
                    Share your result
                  </Button>
                ) : (
                  <Button
                    onClick={shareOnLinkedIn}
                    leftIcon={<Linkedin size={18} />}
                    px={6}
                    borderRadius="full"
                    bg="#0A66C2"
                    color="white"
                    fontWeight="bold"
                    _hover={{ bg: '#004182' }}
                    _active={{ transform: 'scale(0.99)' }}
                  >
                    Share on LinkedIn
                  </Button>
                )}
                <Button
                  onClick={copyCaption}
                  leftIcon={copied ? <Check size={18} /> : <Copy size={18} />}
                  px={6}
                  borderRadius="full"
                  variant="outline"
                  borderColor="gray.300"
                  color={PLUM}
                  fontWeight="semibold"
                  _hover={{ bg: 'gray.50' }}
                  _active={{ transform: 'scale(0.99)' }}
                >
                  {copied ? 'Caption copied' : 'Copy caption'}
                </Button>
              </HStack>

              {pasteHint && (
                <Text fontSize="xs" color="#9c6f15" textAlign="center">
                  We copied your caption. Paste it into the post (Ctrl / Cmd + V), then share.
                </Text>
              )}
            </VStack>
          </Box>

          <Button
            onClick={() => navigate('/')}
            px={10}
            py={6}
            borderRadius="full"
            bg={PLUM}
            color="white"
            fontWeight="bold"
            _hover={{ bg: '#3a0d44' }}
            _active={{ transform: 'scale(0.99)' }}
          >
            Back to home
          </Button>
        </VStack>
      </Container>
    </Box>
  )
}

export default ThankYouPage
