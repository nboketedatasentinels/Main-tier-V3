import {
  Badge,
  Card,
  CardBody,
  Collapse,
  Divider,
  FormControl,
  FormLabel,
  HStack,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Skeleton,
  Stack,
  Textarea,
  Text,
  UnorderedList,
  ListItem,
  Button,
  Checkbox,
  CheckboxGroup,
} from '@chakra-ui/react'
import { Sparkles } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { PersonalityProfile } from '@/hooks/useWeeklyGlanceData'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/services/firebase'

interface PersonalityProfileCardProps {
  data: PersonalityProfile | null
  loading: boolean
}

export const PersonalityProfileCard = ({ data, loading }: PersonalityProfileCardProps) => {
  const { profile } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [localProfile, setLocalProfile] = useState<PersonalityProfile | null>(data)
  const [personalityType, setPersonalityType] = useState(localProfile?.personalityType || '')
  const [personalityDescription, setPersonalityDescription] = useState(
    localProfile?.personalityDescription || '',
  )
  const [personalityStrengths, setPersonalityStrengths] = useState<string[]>(
    localProfile?.personalityStrengths || [],
  )

  useEffect(() => {
    setLocalProfile(data)
    setPersonalityType(data?.personalityType || '')
    setPersonalityDescription(data?.personalityDescription || '')
    setPersonalityStrengths(data?.personalityStrengths || [])
  }, [data])

  const strengths = localProfile?.personalityStrengths || []

  const personalityOptions = useMemo(
    () => [
      'ISTJ',
      'ISFJ',
      'INFJ',
      'INTJ',
      'ISTP',
      'ISFP',
      'INFP',
      'INTP',
      'ESTP',
      'ESFP',
      'ENFP',
      'ENTP',
      'ESTJ',
      'ESFJ',
      'ENFJ',
      'ENTJ',
    ],
    [],
  )

  const strengthOptions = useMemo(
    () => [
      'Analytical thinking',
      'Empathy',
      'Creativity',
      'Strategic planning',
      'Collaboration',
      'Adaptability',
      'Communication',
      'Problem solving',
      'Organization',
      'Vision casting',
    ],
    [],
  )

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!profile?.id) return
    setSaving(true)

    try {
      const updates = {
        personalityType,
        personalityStrengths,
        personalityDescription,
      }

      await updateDoc(doc(db, 'profiles', profile.id), updates)
      setLocalProfile(updates)
      setIsModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card h="100%" variant="outline" borderColor="brand.border">
      <CardBody>
        <Stack spacing={3}>
          <HStack justify="space-between">
            <HStack>
              <Icon as={Sparkles} color="brand.primary" />
              <Text fontWeight="bold" color="#273240">Personality Profile</Text>
            </HStack>
            {localProfile?.personalityType && <Badge colorScheme="purple">{localProfile.personalityType}</Badge>}
          </HStack>

          <Skeleton isLoaded={!loading} rounded="md">
            <Stack spacing={2} color="#273240" fontSize="sm">
              <Text>
                {localProfile?.personalityDescription ||
                  'Share your personality insights to receive tailored guidance.'}
              </Text>
              {strengths.length > 0 && (
                <>
                  <Text fontWeight="semibold" color="#273240">
                    Strengths
                  </Text>
                  <UnorderedList pl={5} spacing={1}>
                    {strengths.slice(0, expanded ? strengths.length : 3).map(item => (
                      <ListItem key={item}>{item}</ListItem>
                    ))}
                  </UnorderedList>
                </>
              )}
              <Collapse in={expanded} animateOpacity>
                {data?.personalityDescription && (
                  <Text pt={2}>
                    Understanding your type helps us match you with the right habits, allies, and learning experiences.
                  </Text>
                )}
              </Collapse>
              {strengths.length > 3 && (
                <Button variant="ghost" size="sm" alignSelf="flex-start" onClick={() => setExpanded(prev => !prev)}>
                  {expanded ? 'Show less' : 'Show full assessment'}
                </Button>
              )}
              {!localProfile?.personalityType && (
                <Button colorScheme="purple" size="sm" onClick={() => setIsModalOpen(true)} alignSelf="flex-start">
                  Take Personality Test
                </Button>
              )}
              {localProfile?.personalityType && (
                <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(true)} alignSelf="flex-start">
                  Update personality details
                </Button>
              )}
            </Stack>
          </Skeleton>
        </Stack>
      </CardBody>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="lg" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={handleSave} maxH="90vh">
          <ModalHeader>Personality Profile</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Stack spacing={4}>
              <Text color="brand.subtleText" fontSize="sm">
                Record your 16 Personalities type and a few key strengths so we can personalize your leadership journey.
              </Text>

              <FormControl isRequired>
                <FormLabel>Personality Type</FormLabel>
                <Input
                  list="personality-types"
                  placeholder="e.g. ENFJ"
                  value={personalityType}
                  onChange={event => setPersonalityType(event.target.value.toUpperCase())}
                />
                <datalist id="personality-types">
                  {personalityOptions.map(option => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </FormControl>

              <FormControl>
                <FormLabel>Top Strengths</FormLabel>
                <CheckboxGroup value={personalityStrengths} onChange={values => setPersonalityStrengths(values as string[])}>
                  <Stack spacing={2} direction={{ base: 'column', md: 'row' }} flexWrap="wrap">
                    {strengthOptions.map(item => (
                      <Checkbox key={item} value={item} width={{ base: '100%', md: '45%' }}>
                        {item}
                      </Checkbox>
                    ))}
                  </Stack>
                </CheckboxGroup>
              </FormControl>

              <Divider />

              <FormControl>
                <FormLabel>How would you describe this type?</FormLabel>
                <Textarea
                  placeholder="Share a short description or takeaway from your assessment"
                  value={personalityDescription}
                  onChange={event => setPersonalityDescription(event.target.value)}
                  rows={4}
                />
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter gap={3} borderTop="1px" borderColor="brand.border">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button colorScheme="purple" type="submit" isLoading={saving} isDisabled={!personalityType}>
              Save profile
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  )
}
