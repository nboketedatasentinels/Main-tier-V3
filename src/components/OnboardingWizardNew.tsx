import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  Progress,
  Stack,
  Tag,
  TagLabel,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { CheckCircle, Clock4 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useOnboardingSteps } from '@/hooks/useOnboardingSteps'
import { InputMicroTask, OnboardingStepItem } from '@/types/onboarding'
import { useAuth } from '@/hooks/useAuth'
import { UserRole } from '@/types'
import { applyDeadlinePenalty } from '@/services/onboardingService'

interface CountdownState {
  days: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
}

const MICRO_TASK_SUCCESS = 'success'

export const OnboardingWizardNew: React.FC = () => {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const resume = searchParams.get('resume') === 'true'
  const transformationTier = (profile as { transformationTier?: string } | null | undefined)?.transformationTier
  const roleKey = transformationTier || (profile?.role === UserRole.PAID_MEMBER ? 'individual_paid' : 'individual_free')
  const {
    steps,
    activeStep,
    setActiveStepId,
    progress,
    loading,
    completedPercentage,
    totalItemCount,
    markItemComplete,
    markStepComplete,
    skipOnboarding,
    applyPenalty,
  } = useOnboardingSteps({ userId: user?.uid, roleKey, resume })

  const [countdown, setCountdown] = useState<CountdownState>({
    days: 14,
    hours: 0,
    minutes: 0,
    seconds: 0,
    expired: false,
  })
  const [microTaskState, setMicroTaskState] = useState<Record<string, string>>({})

  const startTime = useMemo(() => {
    if (progress?.onboardingStartTime) return new Date(progress.onboardingStartTime)
    return new Date()
  }, [progress?.onboardingStartTime])

  const deadline = useMemo(() => {
    const deadlineDate = new Date(startTime)
    deadlineDate.setDate(deadlineDate.getDate() + 14)
    return deadlineDate
  }, [startTime])

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      const diff = deadline.getTime() - now.getTime()

      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true })
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((diff / (1000 * 60)) % 60)
      const seconds = Math.floor((diff / 1000) % 60)

      setCountdown({ days, hours, minutes, seconds, expired: false })
    }, 1000)

    return () => clearInterval(timer)
  }, [deadline])

  useEffect(() => {
    if (countdown.expired && progress && !progress.pointsDeducted) {
      applyPenalty(-500)
      if (user?.uid) {
        applyDeadlinePenalty(user.uid, -500)
      }
      toast({
        title: 'Deadline reached',
        description: '500 XP deducted for missing the onboarding window.',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      })
    }
  }, [applyPenalty, countdown.expired, progress, toast, user?.uid])

  const quickStartItems = useMemo(() => {
    if (!activeStep) return []

    const incompleteItems = steps
      .flatMap((step, stepIndex) =>
        step.items
          .filter((item) => !progress?.completedItems.includes(item.id))
          .map((item, itemIndex) => ({ step, item, itemIndex, stepIndex })),
      )
      .sort((a, b) => {
        if (a.itemIndex !== b.itemIndex) return a.itemIndex - b.itemIndex
        return a.stepIndex - b.stepIndex
      })

    return incompleteItems.slice(0, 3)
  }, [activeStep, progress?.completedItems, steps])

  const urgencyColor = useMemo(() => {
    if (countdown.expired) return 'red.400'
    if (countdown.days <= 3) return 'orange.400'
    if (countdown.days <= 7) return 'yellow.400'
    return 'green.400'
  }, [countdown])

  const handleMicroTaskSubmit = (item: OnboardingStepItem) => {
    setMicroTaskState((current) => ({ ...current, [item.id]: MICRO_TASK_SUCCESS }))
    markItemComplete(item, activeStep?.id || '')
    toast({
      title: `${item.title} complete`,
      description: `You earned ${item.points} XP`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  const canMarkComplete = (item: OnboardingStepItem) => {
    if (!item.microTask) return true
    return microTaskState[item.id] === MICRO_TASK_SUCCESS
  }

  const renderMicroTask = (item: OnboardingStepItem) => {
    if (!item.microTask) return null

    switch (item.microTask.type) {
      case 'button':
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleMicroTaskSubmit(item)}
            isDisabled={microTaskState[item.id] === MICRO_TASK_SUCCESS}
          >
            {microTaskState[item.id] === MICRO_TASK_SUCCESS
              ? item.microTask.successLabel
              : item.microTask.actionLabel}
          </Button>
        )
      case 'confirm':
        return (
          <Button
            size="sm"
            colorScheme="purple"
            onClick={() => handleMicroTaskSubmit(item)}
            isDisabled={microTaskState[item.id] === MICRO_TASK_SUCCESS}
          >
            {microTaskState[item.id] === MICRO_TASK_SUCCESS
              ? item.microTask.successLabel
              : item.microTask.actionLabel}
          </Button>
        )
      case 'input': {
        const microTask = item.microTask as InputMicroTask
        return (
          <Stack spacing={3} mt={2} width="100%">
            <Textarea
              placeholder={microTask.placeholder}
              minLength={microTask.minLength}
              onChange={(event) => setMicroTaskState((state) => ({ ...state, [item.id]: event.target.value }))}
              rows={microTask.multiline ? 4 : 2}
              isDisabled={microTaskState[item.id] === MICRO_TASK_SUCCESS}
            />
            <Button
              size="sm"
              alignSelf="flex-start"
              onClick={() => {
                const value = microTaskState[item.id] || ''
                if (microTask?.minLength && value.length < microTask.minLength) {
                  toast({
                    title: 'Keep going',
                    description: `Please enter at least ${microTask.minLength} characters to finish this task.`,
                    status: 'error',
                    duration: 3000,
                    isClosable: true,
                  })
                  return
                }
                handleMicroTaskSubmit(item)
              }}
              colorScheme="green"
            >
              {microTask.successLabel}
            </Button>
            {microTask.helperText && (
              <Text fontSize="sm" color="gray.500">
                {microTask.helperText}
              </Text>
            )}
          </Stack>
        )
      }
      default:
        return null
    }
  }

  if (loading) {
    return (
      <Box p={8} bg="gray.900" color="white">
        <Text>Loading onboarding wizard...</Text>
      </Box>
    )
  }

  if (!activeStep) {
    return (
      <Box p={8} bg="gray.900" color="white">
        <Text>No onboarding steps are configured for your role yet.</Text>
      </Box>
    )
  }

  return (
    <Box minH="100vh" bg="gray.900" color="gray.50" p={6}>
      <Grid templateColumns={{ base: '1fr', lg: '320px 1fr' }} gap={6}>
        <GridItem>
          <Card bg="purple.900" border="1px solid" borderColor="purple.700" position="sticky" top={6}>
            <CardHeader>
              <Heading size="md" color="yellow.200">
                Onboarding Progress
              </Heading>
              <Text fontSize="sm" color="purple.100">
                14-day sprint to master the platform
              </Text>
            </CardHeader>
            <CardBody>
              <Stack spacing={4}>
                <Box>
                  <Flex justify="space-between" align="center">
                    <Text fontWeight="semibold">Overall</Text>
                    <Text fontSize="sm">{completedPercentage}%</Text>
                  </Flex>
                  <Progress value={completedPercentage} size="sm" colorScheme="yellow" bg="purple.800" />
                  <Text fontSize="xs" color="purple.100" mt={1}>
                    {progress?.completedItems.length || 0} / {totalItemCount} tasks completed
                  </Text>
                </Box>
                <Box>
                  <HStack spacing={2}>
                    <Icon as={Clock4} color={urgencyColor} />
                    <Text color={urgencyColor} fontWeight="bold">
                      Deadline {deadline.toLocaleString()}
                    </Text>
                  </HStack>
                  <Text mt={2}>
                    {countdown.expired
                      ? 'Deadline passed: penalty applied (-500 XP)'
                      : `${countdown.days}d ${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s remaining`}
                  </Text>
                </Box>
                <Divider borderColor="purple.700" />
                <Stack spacing={3}>
                  {steps.map((step) => {
                    const completed = progress?.completedSteps.includes(step.id)
                    const isActive = activeStep.id === step.id
                    return (
                      <Button
                        key={step.id}
                        justifyContent="space-between"
                        onClick={() => setActiveStepId(step.id)}
                        leftIcon={<Icon as={CheckCircle} color={completed ? 'green.300' : 'gray.500'} />}
                        bg={isActive ? 'purple.700' : 'purple.800'}
                        _hover={{ bg: 'purple.700' }}
                        color={completed ? 'green.100' : 'gray.50'}
                      >
                        <Flex direction="column" alignItems="flex-start">
                          <Text fontWeight="bold">{step.title}</Text>
                          <Text fontSize="xs" color="purple.100">
                            {step.items.length} tasks · {step.points} XP bonus
                          </Text>
                        </Flex>
                      </Button>
                    )
                  })}
                </Stack>
              </Stack>
            </CardBody>
          </Card>
        </GridItem>

        <GridItem>
          <Stack spacing={6}>
            <Card bg="gray.800" border="1px solid" borderColor="gray.700">
              <CardBody>
                <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} direction={{ base: 'column', md: 'row' }}>
                  <Box>
                    <Heading size="lg" color="yellow.200">
                      Welcome, {profile?.firstName || 'leader'}
                    </Heading>
                    <Text color="gray.200" maxW="2xl" mt={2}>
                      Complete your onboarding within 14 days to avoid penalties and unlock your badges. Each task awards XP and syncs instantly to Firebase.
                    </Text>
                  </Box>
                  <Tag size="lg" colorScheme={countdown.expired ? 'red' : 'yellow'} variant="subtle">
                    <TagLabel>{progress?.totalPoints || 0} XP earned</TagLabel>
                  </Tag>
                </Flex>
              </CardBody>
            </Card>

            <Card bg="gray.800" border="1px solid" borderColor="gray.700">
              <CardHeader pb={0}>
                <Heading size="md" color="yellow.200">
                  Quick Start
                </Heading>
                <Text color="gray.300" fontSize="sm">
                  Your top priority actions. Jump straight into the most impactful wins.
                </Text>
              </CardHeader>
              <CardBody>
                <Stack spacing={3}>
                  {quickStartItems.map(({ step, item }) => (
                    <Flex
                      key={item.id}
                      p={3}
                      borderRadius="md"
                      bg="gray.700"
                      border="1px solid"
                      borderColor="gray.600"
                      align="center"
                      justify="space-between"
                    >
                      <Box>
                        <Text fontWeight="bold">{item.title}</Text>
                        <Text fontSize="sm" color="gray.300">
                          {step.title} · {item.points} XP
                        </Text>
                      </Box>
                      <HStack>
                        <Button size="sm" onClick={() => setActiveStepId(step.id)}>
                          Go to step
                        </Button>
                        <Button
                          size="sm"
                          colorScheme="green"
                          onClick={() => markItemComplete(item, step.id)}
                          isDisabled={progress?.completedItems.includes(item.id)}
                        >
                          Mark complete
                        </Button>
                      </HStack>
                    </Flex>
                  ))}
                  {quickStartItems.length === 0 && <Text color="gray.400">All quick start items are complete. Keep going!</Text>}
                </Stack>
              </CardBody>
            </Card>

            <Card bg="gray.800" border="1px solid" borderColor="gray.700">
              <CardHeader pb={0}>
                <Flex justify="space-between" align="center">
                  <Box>
                    <Heading size="md" color="yellow.200">
                      {activeStep.title}
                    </Heading>
                    <Text color="gray.300" mt={1}>
                      {activeStep.description}
                    </Text>
                  </Box>
                  <Tag colorScheme={progress?.completedSteps.includes(activeStep.id) ? 'green' : 'purple'}>
                    {progress?.completedSteps.includes(activeStep.id) ? 'Completed' : 'In progress'}
                  </Tag>
                </Flex>
              </CardHeader>
              <CardBody>
                <Stack spacing={4}>
                  {activeStep.items.map((item) => {
                    const completed = progress?.completedItems.includes(item.id)
                    return (
                      <Box
                        key={item.id}
                        p={4}
                        borderRadius="md"
                        bg="gray.700"
                        border="1px solid"
                        borderColor={completed ? 'green.500' : 'gray.600'}
                      >
                        <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={3}>
                          <Box>
                            <HStack spacing={3}>
                              <Icon as={CheckCircle} color={completed ? 'green.300' : 'gray.500'} />
                              <Text fontWeight="bold">{item.title}</Text>
                              <Tag size="sm" colorScheme="yellow">
                                +{item.points} XP
                              </Tag>
                            </HStack>
                            {item.description && (
                              <Text color="gray.300" mt={2}>
                                {item.description}
                              </Text>
                            )}
                            {item.microTask && <Box mt={3}>{renderMicroTask(item)}</Box>}
                          </Box>
                          <HStack>
                            {item.link && (
                              <Button
                                as="a"
                                href={item.link}
                                target="_blank"
                                rel="noreferrer"
                                size="sm"
                                variant="outline"
                              >
                                View resources
                              </Button>
                            )}
                            <Button
                              size="sm"
                              colorScheme="green"
                              onClick={() => markItemComplete(item, activeStep.id)}
                              isDisabled={completed || !canMarkComplete(item)}
                            >
                              {completed ? 'Done' : 'Mark complete'}
                            </Button>
                          </HStack>
                        </Flex>
                      </Box>
                    )
                  })}
                </Stack>
                <Button
                  mt={4}
                  colorScheme="yellow"
                  onClick={() => markStepComplete(activeStep)}
                  isDisabled={progress?.completedSteps.includes(activeStep.id)}
                >
                  Mark step complete (+{activeStep.points} XP)
                </Button>
              </CardBody>
            </Card>

            <Flex gap={3} justify="flex-end">
              <Button variant="ghost" onClick={skipOnboarding}>
                Skip onboarding
              </Button>
            </Flex>
          </Stack>
        </GridItem>
      </Grid>
    </Box>
  )
}
