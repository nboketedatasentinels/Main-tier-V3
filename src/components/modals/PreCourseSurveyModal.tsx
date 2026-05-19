import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Icon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import { ArrowRight, CheckCircle2, ClipboardList, ExternalLink, Lock } from 'lucide-react'

export const PRE_COURSE_SURVEY_URL = 'https://www.surveymonkey.com/r/KFM9TPH'

interface PreCourseSurveyModalProps {
  isOpen: boolean
  onClose: () => void
  onCompleted: () => Promise<void> | void
  isSubmitting?: boolean
}

export function PreCourseSurveyModal({
  isOpen,
  onClose,
  onCompleted,
  isSubmitting = false,
}: PreCourseSurveyModalProps) {
  const toast = useToast()
  const [hasOpenedSurvey, setHasOpenedSurvey] = useState(false)

  useEffect(() => {
    if (isOpen) setHasOpenedSurvey(false)
  }, [isOpen])

  const handleOpenSurvey = () => {
    window.open(PRE_COURSE_SURVEY_URL, '_blank', 'noopener,noreferrer')
    setHasOpenedSurvey(true)
  }

  const handleDone = async () => {
    try {
      await onCompleted()
    } catch (err) {
      console.error('[PreCourseSurveyModal] completion failed', err)
      toast({
        status: 'error',
        title: 'Could not save your progress',
        description: 'Please try again in a moment.',
      })
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered closeOnOverlayClick={false}>
      <ModalOverlay bg="blackAlpha.600" />
      <ModalContent borderRadius="xl" overflow="hidden">
        <Box bg="#27062e" color="white" px={6} pt={6} pb={5} position="relative">
          <ModalCloseButton color="white" top={3} right={3} />
          <HStack spacing={3} align="center">
            <Flex
              w={11}
              h={11}
              bg="rgba(255,255,255,0.12)"
              borderRadius="lg"
              align="center"
              justify="center"
              flexShrink={0}
            >
              <Icon as={ClipboardList} boxSize={5} color="white" />
            </Flex>
            <Stack spacing={0}>
              <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.1em" opacity={0.7}>
                One-time check-in
              </Text>
              <Heading size="md" lineHeight="1.2">
                Take 2 minutes before you start
              </Heading>
            </Stack>
          </HStack>
        </Box>

        <ModalBody p={6} bg="white">
          <Stack spacing={5}>
            <Text color="gray.700" fontSize="sm" lineHeight="1.7">
              We&apos;ll ask a few quick questions so your partner can tailor the programme to you.
              You only need to do this once - after you submit, you&apos;ll go straight into your
              courses every time.
            </Text>

            {/* Step 1 */}
            <Box
              p={4}
              border="1px solid"
              borderColor={hasOpenedSurvey ? 'yellow.200' : '#350e6f'}
              bg={hasOpenedSurvey ? 'yellow.50' : 'white'}
              borderRadius="md"
              transition="all 0.2s"
            >
              <HStack spacing={3} align="flex-start" justify="space-between">
                <HStack spacing={3} align="flex-start" flex={1}>
                  <Flex
                    w={7}
                    h={7}
                    borderRadius="full"
                    bg={hasOpenedSurvey ? 'yellow.500' : '#350e6f'}
                    color="white"
                    align="center"
                    justify="center"
                    fontSize="sm"
                    fontWeight="bold"
                    flexShrink={0}
                  >
                    {hasOpenedSurvey ? <Icon as={CheckCircle2} boxSize={4} /> : '1'}
                  </Flex>
                  <Stack spacing={0.5} flex={1}>
                    <Text fontWeight="semibold" color="gray.900" fontSize="sm">
                      Open the short survey
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      Opens in a new tab. Come back here when you submit it.
                    </Text>
                  </Stack>
                </HStack>
                <Button
                  size="sm"
                  bg="#350e6f"
                  color="white"
                  _hover={{ bg: '#27062e' }}
                  rightIcon={<Icon as={ExternalLink} boxSize={3.5} />}
                  onClick={handleOpenSurvey}
                  flexShrink={0}
                >
                  {hasOpenedSurvey ? 'Open again' : 'Open survey'}
                </Button>
              </HStack>
            </Box>

            {/* Step 2 */}
            <Box
              p={4}
              border="1px solid"
              borderColor={hasOpenedSurvey ? '#350e6f' : 'gray.200'}
              bg={hasOpenedSurvey ? 'white' : 'gray.50'}
              borderRadius="md"
              transition="all 0.2s"
              opacity={hasOpenedSurvey ? 1 : 0.7}
            >
              <HStack spacing={3} align="flex-start" justify="space-between">
                <HStack spacing={3} align="flex-start" flex={1}>
                  <Flex
                    w={7}
                    h={7}
                    borderRadius="full"
                    bg={hasOpenedSurvey ? '#350e6f' : 'gray.300'}
                    color="white"
                    align="center"
                    justify="center"
                    fontSize="sm"
                    fontWeight="bold"
                    flexShrink={0}
                  >
                    {hasOpenedSurvey ? '2' : <Icon as={Lock} boxSize={3.5} />}
                  </Flex>
                  <Stack spacing={0.5} flex={1}>
                    <Text fontWeight="semibold" color="gray.900" fontSize="sm">
                      Confirm and continue
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      After you submit on SurveyMonkey, click below to open your course.
                    </Text>
                  </Stack>
                </HStack>
                <Button
                  size="sm"
                  bg={hasOpenedSurvey ? '#350e6f' : 'gray.300'}
                  color="white"
                  _hover={hasOpenedSurvey ? { bg: '#27062e' } : { bg: 'gray.300' }}
                  rightIcon={<Icon as={ArrowRight} boxSize={3.5} />}
                  isDisabled={!hasOpenedSurvey}
                  isLoading={isSubmitting}
                  onClick={handleDone}
                  flexShrink={0}
                >
                  I&apos;m done
                </Button>
              </HStack>
            </Box>

            <Text fontSize="xs" color="gray.400" textAlign="center">
              You won&apos;t see this message again after you confirm.
            </Text>
          </Stack>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default PreCourseSurveyModal
