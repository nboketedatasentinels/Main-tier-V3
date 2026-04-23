import React, { useEffect, useState } from 'react'
import {
  Box,
  Button,
  HStack,
  Icon,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverHeader,
  PopoverTrigger,
  Portal,
  Text,
  VStack,
} from '@chakra-ui/react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface TourStep {
  target: string
  title: string
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

const tourSteps: TourStep[] = [
  {
    target: '[data-tour="dashboard"]',
    title: 'Your Dashboard',
    content: 'Track your window progress, points, and weekly momentum here. Everything you need is in one place.',
    placement: 'right',
  },
  {
    target: '[data-tour="weekly-checklist"]',
    title: 'Weekly Checklist',
    content:
      'Complete activities to earn points toward your window target. New activities unlock throughout your journey.',
    placement: 'right',
  },
  {
    target: '[data-tour="impact-log"]',
    title: 'Impact Log',
    content:
      'Document real-world outcomes: hours invested, people impacted, and USD value created. Your impact matters.',
    placement: 'right',
  },
  {
    target: '[data-tour="community"]',
    title: 'Ecosystem',
    content: 'Connect with peers, join villages, and engage with mentors. Leadership is a team sport.',
    placement: 'bottom',
  },
]

interface PlatformTourProps {
  isOpen: boolean
  onClose: () => void
}

export const PlatformTour: React.FC<PlatformTourProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)

  const currentTourStep = tourSteps[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === tourSteps.length - 1

  // Find target element when step changes or tour opens
  useEffect(() => {
    if (!isOpen) return

    const findElement = () => {
      const element = document.querySelector(currentTourStep.target) as HTMLElement
      setTargetElement(element)
    }

    // Try immediately
    findElement()

    // Retry after a short delay in case elements aren't mounted yet
    const timeoutId = setTimeout(findElement, 100)

    return () => clearTimeout(timeoutId)
  }, [currentStep, isOpen, currentTourStep.target])

  const handleNext = () => {
    if (isLastStep) {
      handleComplete()
    } else {
      setCurrentStep((prev) => prev + 1)
      updateProgress(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1)
      updateProgress(currentStep - 1)
    }
  }

  const handleSkip = () => {
    localStorage.setItem('t4l.dashboard_tour_skipped', 'true')
    onClose()
  }

  const handleComplete = async () => {
    try {
      if (user?.uid) {
        await updateProfile({
          hasSeenDashboardTour: true,
        })
      }
      localStorage.setItem('t4l.dashboard_tour_completed', 'true')
      localStorage.removeItem('t4l.dashboard_tour_progress')
      onClose()
    } catch (error) {
      console.error('Error completing tour:', error)
      onClose()
    }
  }

  const updateProgress = (step: number) => {
    const progress = Math.round(((step + 1) / tourSteps.length) * 100)
    localStorage.setItem('t4l.dashboard_tour_progress', progress.toString())
  }

  // Don't render if tour is closed or target element not found
  if (!isOpen || !targetElement) {
    return null
  }

  return (
    <Popover
      isOpen={isOpen}
      placement={currentTourStep.placement || 'right'}
      closeOnBlur={false}
      closeOnEsc={true}
      onClose={handleSkip}
      returnFocusOnClose={false}
      autoFocus={false}
    >
      <PopoverTrigger>
        <Box
          position="absolute"
          top={`${targetElement.offsetTop}px`}
          left={`${targetElement.offsetLeft}px`}
          width={`${targetElement.offsetWidth}px`}
          height={`${targetElement.offsetHeight}px`}
          pointerEvents="none"
        />
      </PopoverTrigger>
      <Portal>
        <PopoverContent
          bg="brand.sidebar"
          border="1px solid"
          borderColor="brand.gold"
          boxShadow="2xl"
          maxW="340px"
          _focus={{ outline: 'none' }}
        >
          <PopoverArrow bg="brand.sidebar" borderColor="brand.gold" />
          <PopoverHeader
            borderBottom="1px solid"
            borderColor="brand.border"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <VStack align="flex-start" spacing={0}>
              <Text fontWeight="semibold" color="brand.text">
                {currentTourStep.title}
              </Text>
              <Text fontSize="xs" color="brand.subtleText">
                Step {currentStep + 1} of {tourSteps.length}
              </Text>
            </VStack>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleSkip}
              aria-label="Close tour"
              color="brand.subtleText"
              _hover={{ color: 'brand.text' }}
            >
              <Icon as={X} />
            </Button>
          </PopoverHeader>
          <PopoverBody>
            <Text fontSize="sm" color="brand.subtleText">
              {currentTourStep.content}
            </Text>
          </PopoverBody>
          <PopoverFooter border="0" display="flex" justifyContent="space-between">
            <HStack spacing={2}>
              {!isFirstStep && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handlePrevious}
                  leftIcon={<Icon as={ArrowLeft} />}
                  color="brand.subtleText"
                  _hover={{ color: 'brand.text', bg: 'brand.primaryMuted' }}
                >
                  Back
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSkip}
                color="brand.subtleText"
                _hover={{ color: 'brand.text', bg: 'brand.primaryMuted' }}
              >
                Skip tour
              </Button>
            </HStack>
            <Button
              size="sm"
              colorScheme="yellow"
              onClick={handleNext}
              rightIcon={<Icon as={ArrowRight} />}
            >
              {isLastStep ? 'Finish' : 'Next'}
            </Button>
          </PopoverFooter>
        </PopoverContent>
      </Portal>
    </Popover>
  )
}
