import { useEffect, useState } from 'react'
import { Button, Modal, ModalBody, ModalCloseButton, ModalContent, ModalOverlay, Stack, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'framer-motion'

export type CourseTestStepStatus = 'not_started' | 'needs_result' | 'done'

interface CourseTestsRequiredModalProps {
  isOpen: boolean
  onClose: () => void
  courseTitle?: string | null
  personalityStatus: CourseTestStepStatus
  valuesStatus: CourseTestStepStatus
  onStartPersonality: () => void
  onStartValues: () => void
  onPickPersonality: () => void
  onPickValues: () => void
  onProceed?: () => void
}

const MotionStack = motion(Stack)

export const CourseTestsRequiredModal: React.FC<CourseTestsRequiredModalProps> = ({
  isOpen,
  onClose,
  courseTitle,
  personalityStatus,
  valuesStatus,
  onStartPersonality,
  onStartValues,
  onPickPersonality,
  onPickValues,
  onProceed,
}) => {
  const [count, setCount] = useState<3 | 2 | 1 | 0>(3)
  const personalityDone = personalityStatus === 'done'
  const valuesDone = valuesStatus === 'done'
  const bothDone = personalityDone && valuesDone

  useEffect(() => {
    if (!isOpen) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setCount(0)
      return
    }
    setCount(3)
    const timers = [
      window.setTimeout(() => setCount(2), 700),
      window.setTimeout(() => setCount(1), 1400),
      window.setTimeout(() => setCount(0), 2100),
    ]
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [isOpen])

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay bg="blackAlpha.600" />
      <ModalContent borderRadius="2xl" mx={3} overflow="hidden">
        <ModalCloseButton zIndex={2} />
        <ModalBody py={8} px={6}>
          <AnimatePresence mode="wait">
            {count > 0 ? (
              <MotionStack
                key={count}
                spacing={2}
                align="center"
                justify="center"
                minH="220px"
                initial={{ opacity: 0, scale: 0.82 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.08 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              >
                <Text fontSize="xs" fontWeight="700" letterSpacing="0.16em" textTransform="uppercase" color="#8A6708">
                  Get ready
                </Text>
                <Text
                  fontFamily="heading"
                  fontSize="7xl"
                  fontWeight="700"
                  lineHeight="1"
                  color="#27062e"
                >
                  {count}
                </Text>
              </MotionStack>
            ) : (
              <MotionStack
                key="ready"
                spacing={4}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              >
                <Stack spacing={1}>
                  <Text fontSize="lg" fontWeight="700" color="#27062e">
                    To proceed to the course
                  </Text>
                  {courseTitle ? (
                    <Text fontSize="sm" color="gray.600">
                      {courseTitle}
                    </Text>
                  ) : null}
                </Stack>

                {bothDone && onProceed ? (
                  <Button w="full" bg="#27062e" color="white" _hover={{ bg: '#3a0d44' }} onClick={onProceed}>
                    Proceed to the course
                  </Button>
                ) : (
                  <Stack spacing={3}>
                    <Stack spacing={1}>
                      <Button
                        w="full"
                        h="auto"
                        py={3}
                        bg={personalityDone ? 'green.50' : '#27062e'}
                        color={personalityDone ? 'green.800' : 'white'}
                        _hover={personalityDone ? undefined : { bg: '#3a0d44' }}
                        isDisabled={personalityDone}
                        _disabled={{ bg: 'green.50', color: 'green.800', opacity: 1 }}
                        onClick={onStartPersonality}
                      >
                        <Stack spacing={0}>
                          <Text>Complete personality test</Text>
                          {!personalityDone ? (
                            <Text fontSize="xs" fontWeight="500" opacity={0.85}>
                              to proceed to the course
                            </Text>
                          ) : null}
                        </Stack>
                      </Button>
                      {!personalityDone ? (
                        <Button variant="ghost" size="sm" color="gray.600" onClick={onPickPersonality}>
                          Choose my result
                        </Button>
                      ) : null}
                    </Stack>
                    <Stack spacing={1}>
                      <Button
                        w="full"
                        variant={valuesDone ? 'solid' : 'outline'}
                        borderColor="#27062e"
                        bg={valuesDone ? 'green.50' : 'transparent'}
                        color={valuesDone ? 'green.800' : '#27062e'}
                        isDisabled={valuesDone}
                        _disabled={{ bg: 'green.50', color: 'green.800', opacity: 1 }}
                        onClick={onStartValues}
                      >
                        {valuesDone ? 'Values test done' : 'Complete values test'}
                      </Button>
                      {!valuesDone ? (
                        <Button variant="ghost" size="sm" color="gray.600" onClick={onPickValues}>
                          Choose my result
                        </Button>
                      ) : null}
                    </Stack>
                  </Stack>
                )}
              </MotionStack>
            )}
          </AnimatePresence>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
