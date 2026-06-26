import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, Button, Container, Flex, Text, VStack } from '@chakra-ui/react'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { ARCHETYPE_CONTENT } from '@/config/liftAssessment'
import { ArchetypeSymbol } from '@/components/lift/ArchetypeSymbol'
import type { LiftResult } from '@/utils/liftScoring'

const PLUM = '#27062e'
const GOLD = '#eab130'

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
