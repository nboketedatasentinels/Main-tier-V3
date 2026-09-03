import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { getDisplayName } from '@/utils/displayName'
import { openMeetingMailto, buildMeetingMailtoHref } from '@/utils/meetingInvite'

const UPGRADE_INBOX = 'info@t4leader.com'

const JOURNEY_OPTIONS = [
  {
    id: '4W',
    name: '4-Week Intro',
    detail: 'Transformation Starter · the free starter journey',
    starter: true,
  },
  {
    id: '6W',
    name: '6-Week Power',
    detail: 'Guided 6 weeks with mentor and coach pathways',
    starter: false,
  },
  {
    id: '3M',
    name: '3-Month Journey',
    detail: 'Deeper transformation over 12 weeks',
    starter: false,
  },
  {
    id: '6M',
    name: '6-Month Journey',
    detail: 'Sustained leadership practice over 6 months',
    starter: false,
  },
  {
    id: '9M',
    name: '9-Month Journey',
    detail: 'Full programme arc over 9 months',
    starter: false,
  },
] as const

interface UpgradePromptModalProps {
  featureName: string
  benefits: string[]
  isOpen: boolean
  onClose: () => void
}

export const UpgradePromptModal: React.FC<UpgradePromptModalProps> = ({
  featureName,
  benefits,
  isOpen,
  onClose,
}) => {
  const { profile, user } = useAuth()
  const toast = useToast()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [journeyId, setJourneyId] = useState<string>('4W')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setFullName(getDisplayName(profile) || profile?.fullName || '')
    setEmail((profile?.email || user?.email || '').trim())
    setOrganisation((profile?.companyName || profile?.companyCode || '').trim())
    setJourneyId('4W')
    setNote('')
  }, [isOpen, profile, user?.email])

  const selectedJourney = useMemo(
    () => JOURNEY_OPTIONS.find((j) => j.id === journeyId) || JOURNEY_OPTIONS[0],
    [journeyId],
  )

  const canSend = fullName.trim().length > 1 && email.includes('@')

  const handleEmailTeam = () => {
    if (!canSend) {
      toast({
        status: 'warning',
        title: 'Add your name and email',
        description: 'We need those so the team can contact you about the next cohort.',
      })
      return
    }

    const subject = `Upgrade request · ${featureName} · ${fullName.trim()}`
    const body = [
      'Hello T4L team,',
      '',
      'I would like to be upgraded for guided access (not self-study).',
      '',
      `Feature requested: ${featureName}`,
      `Name: ${fullName.trim()}`,
      `Email: ${email.trim()}`,
      organisation.trim() ? `Organisation: ${organisation.trim()}` : null,
      `Journey interest: ${selectedJourney.name} (${selectedJourney.id})`,
      `Journey detail: ${selectedJourney.detail}`,
      note.trim() ? `Note: ${note.trim()}` : null,
      '',
      'Please contact me about the next cohort.',
      '',
      'Thanks,',
      fullName.trim(),
    ]
      .filter(Boolean)
      .join('\n')

    openMeetingMailto(
      buildMeetingMailtoHref({
        to: UPGRADE_INBOX,
        subject,
        body,
      }),
    )
    toast({
      status: 'success',
      title: 'Opening your email to info@t4leader.com',
      description: 'Send that message and we will contact you about the next cohort.',
      duration: 5000,
    })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent borderRadius="2xl" mx={3}>
        <ModalHeader pb={1}>
          <Text fontSize="lg" fontWeight="700" color="#27062e">
            Want to be upgraded?
          </Text>
          <Text fontSize="sm" fontWeight="500" color="gray.600" mt={1}>
            {featureName} is guided with a partner — not self-study. Email{' '}
            <Text as="span" fontWeight="700" color="#350e6f">
              {UPGRADE_INBOX}
            </Text>{' '}
            and we will place you on the next cohort.
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Box bg="purple.50" borderWidth="1px" borderColor="purple.100" rounded="xl" p={3}>
              <Text fontSize="xs" fontWeight="700" color="purple.800" textTransform="uppercase" letterSpacing="0.06em">
                Upgrading for
              </Text>
              <Text fontWeight="700" color="#27062e" mt={1}>
                {featureName}
              </Text>
              <Stack spacing={1} mt={2}>
                {benefits.slice(0, 4).map((benefit) => (
                  <Text key={benefit} fontSize="sm" color="gray.700">
                    · {benefit}
                  </Text>
                ))}
              </Stack>
            </Box>

            <SimpleGrid columns={{ base: 1, sm: 2 }} gap={3}>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Your name</FormLabel>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Email</FormLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </FormControl>
            </SimpleGrid>

            <FormControl>
              <FormLabel fontSize="sm">Organisation (optional)</FormLabel>
              <Input
                value={organisation}
                onChange={(e) => setOrganisation(e.target.value)}
                placeholder="Company or team"
              />
            </FormControl>

            <Box>
              <Text fontSize="sm" fontWeight="600" mb={2} color="black">
                Which journey are you interested in?
              </Text>
              <Text fontSize="xs" color="gray.600" mb={2}>
                Free accounts start on the 4-Week Intro. Pick what you want next — we will confirm cohort dates by email.
              </Text>
              <Stack spacing={2}>
                {JOURNEY_OPTIONS.map((journey) => {
                  const selected = journeyId === journey.id
                  return (
                    <Button
                      key={journey.id}
                      onClick={() => setJourneyId(journey.id)}
                      variant="outline"
                      justifyContent="flex-start"
                      h="auto"
                      py={3}
                      px={3}
                      whiteSpace="normal"
                      textAlign="left"
                      borderWidth="2px"
                      borderColor={selected ? '#350e6f' : 'gray.200'}
                      bg={selected ? 'purple.50' : 'white'}
                      _hover={{ borderColor: '#350e6f', bg: 'purple.50' }}
                    >
                      <Box>
                        <Text fontWeight="700" color="#27062e" fontSize="sm">
                          {journey.name}
                          {journey.starter ? ' · current starter' : ''}
                        </Text>
                        <Text fontSize="xs" color="gray.600" fontWeight="500">
                          {journey.detail}
                        </Text>
                      </Box>
                    </Button>
                  )
                })}
              </Stack>
            </Box>

            <FormControl>
              <FormLabel fontSize="sm">Anything else? (optional)</FormLabel>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Timing, team size, or a question for the team"
              />
              <FormHelperText>This goes in the email to {UPGRADE_INBOX}.</FormHelperText>
            </FormControl>
          </Stack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={onClose}>
            Maybe later
          </Button>
          <Button
            bg="#350e6f"
            color="white"
            _hover={{ bg: '#27062e' }}
            onClick={handleEmailTeam}
            isDisabled={!canSend}
          >
            Email info@ to upgrade
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
