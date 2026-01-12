import {
  Badge,
  Box,
  Card,
  CardBody,
  Collapse,
  Divider,
  FormControl,
  FormLabel,
  Grid,
  HStack,
  Icon,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Skeleton,
  Stack,
  Tag,
  Text,
  UnorderedList,
  ListItem,
  Button,
  Checkbox,
  Tooltip,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { Award, ExternalLink, Sparkles } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { PersonalityProfile } from '@/hooks/useWeeklyGlanceData'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/services/firebase'
import { CORE_VALUES } from '@/config/personality-data'

interface PersonalityProfileCardProps {
  data: PersonalityProfile | null
  loading: boolean
}

export const PersonalityProfileCard = ({ data, loading }: PersonalityProfileCardProps) => {
  const { profile, user } = useAuth()
  const toast = useToast()
  const [expanded, setExpanded] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [localProfile, setLocalProfile] = useState<PersonalityProfile | null>(data)
  const [personalityType, setPersonalityType] = useState(localProfile?.personalityType || '')
  const [coreValues, setCoreValues] = useState<string[]>(localProfile?.coreValues || [])
  const [hasCompletedPersonalityTest, setHasCompletedPersonalityTest] = useState(
    Boolean(profile?.hasCompletedPersonalityTest),
  )
  const [hasCompletedValuesTest, setHasCompletedValuesTest] = useState(
    Boolean(profile?.hasCompletedValuesTest),
  )
  const [personalityTestError, setPersonalityTestError] = useState<string | null>(null)
  const [valuesTestError, setValuesTestError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    setLocalProfile(data)
    setPersonalityType(data?.personalityType || '')
    setCoreValues(data?.coreValues || [])
  }, [data])

  useEffect(() => {
    setHasCompletedPersonalityTest(Boolean(profile?.hasCompletedPersonalityTest))
    setHasCompletedValuesTest(Boolean(profile?.hasCompletedValuesTest))
  }, [profile?.hasCompletedPersonalityTest, profile?.hasCompletedValuesTest])

  useEffect(() => {
    if (isModalOpen) {
      setPersonalityTestError(null)
      setValuesTestError(null)
      setFormError(null)
    }
  }, [isModalOpen])

  const strengths = localProfile?.personalityStrengths || []
  const selectedCoreValues = localProfile?.coreValues || []
  const coreValuePreviewCount = expanded ? selectedCoreValues.length : 3
  const strengthPreviewCount = expanded ? strengths.length : 3
  const shouldShowToggle = strengths.length > 3 || selectedCoreValues.length > 3

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

  const handleCoreValueToggle = (value: string) => {
    setCoreValues(prev => {
      if (prev.includes(value)) {
        return prev.filter(item => item !== value)
      }
      if (prev.length < 5) {
        return [...prev, value]
      }
      return prev
    })
    setFormError(null)
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    setPersonalityTestError(null)
    setValuesTestError(null)
    if (!profile?.id || !user?.uid) return
    if (!hasCompletedPersonalityTest || !hasCompletedValuesTest) {
      if (!hasCompletedPersonalityTest) {
        setPersonalityTestError('Please confirm you have taken the 16 Personalities test.')
      }
      if (!hasCompletedValuesTest) {
        setValuesTestError('Please confirm you have taken the Personal Values test.')
      }
      window.alert('Please confirm you have completed the required tests before saving.')
      return
    }
    if (!personalityType) {
      setFormError('Please select your personality type.')
      return
    }
    if (coreValues.length !== 5) {
      setFormError('Please select exactly 5 core values.')
      return
    }
    setSaving(true)

    try {
      const updates = {
        personalityType,
        coreValues,
      }

      await Promise.all([
        updateDoc(doc(db, 'profiles', profile.id), updates),
        updateDoc(doc(db, 'users', user.uid), {
          ...updates,
          hasCompletedPersonalityTest,
          hasCompletedValuesTest,
        }),
      ])
      setLocalProfile(prev => ({
        ...(prev ?? {}),
        ...updates,
      }))
      setIsModalOpen(false)
      toast({
        title: 'Profile saved',
        description: 'Your personality profile has been updated.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Failed to update personality profile', error)
      setFormError('Unable to save your personality profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card h="100%" variant="outline" borderColor="border.subtle">
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
            <Stack spacing={2} color="brand.subtleText" fontSize="sm">
              <Text>{data?.personalityDescription || 'Share your personality insights to receive tailored guidance.'}</Text>
              {strengths.length > 0 && (
                <>
                  <Text fontWeight="semibold" color="brand.text">
                    Strengths
                  </Text>
                  <UnorderedList pl={5} spacing={1}>
                    {strengths.slice(0, strengthPreviewCount).map(item => (
                      <ListItem key={item}>{item}</ListItem>
                    ))}
                  </UnorderedList>
                </>
              )}
              <Stack spacing={2} pt={strengths.length > 0 ? 1 : 0}>
                <HStack spacing={2} color="brand.text">
                  <Icon as={Award} color="yellow.500" />
                  <Text fontWeight="semibold">Core Values</Text>
                </HStack>
                {selectedCoreValues.length > 0 ? (
                  <HStack spacing={2} flexWrap="wrap">
                    {selectedCoreValues.slice(0, coreValuePreviewCount).map(value => (
                      <Tag key={value} colorScheme="yellow" borderRadius="full" px={3} py={1} whiteSpace="nowrap">
                        <HStack spacing={1}>
                          <Icon as={Award} size={14} />
                          <Text>{value}</Text>
                        </HStack>
                      </Tag>
                    ))}
                  </HStack>
                ) : (
                  <Stack spacing={1}>
                    <Text color="brand.subtleText">No core values selected yet.</Text>
                    {localProfile?.personalityType && (
                      <Text fontSize="xs" color="brand.subtleText">
                        Complete the Personal Values test to add your core values.
                      </Text>
                    )}
                  </Stack>
                )}
              </Stack>
              <Collapse in={expanded} animateOpacity>
                {data?.personalityDescription && (
                  <Text pt={2}>
                    Understanding your type helps us match you with the right habits, allies, and learning experiences.
                  </Text>
                )}
              </Collapse>
              {shouldShowToggle && (
                <Button variant="ghost" size="sm" alignSelf="flex-start" onClick={() => setExpanded(prev => !prev)}>
                  {expanded ? 'Show less' : 'Show full assessment'}
                </Button>
              )}
              {!localProfile?.personalityType && (
                <Button colorScheme="purple" size="sm" onClick={() => setIsModalOpen(true)} alignSelf="flex-start">
                  Take Personality & Values Tests
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size={{ base: 'full', md: '4xl' }} scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={handleSave} maxH="90vh">
          <ModalHeader>Personality Profile</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Stack spacing={6}>
              <Box bg="blue.50" p={5} borderRadius="lg" borderWidth="2px" borderColor="blue.200">
                <VStack align="stretch" spacing={4}>
                  <Text fontWeight="semibold" color="blue.800">
                    Required Tests
                  </Text>
                  <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
                    <Box bg="white" p={4} borderRadius="lg" borderWidth="1px" borderColor="blue.200">
                      <VStack align="stretch" spacing={3}>
                        <Text fontWeight="semibold">16 Personalities Test</Text>
                        <Text fontSize="sm" color="brand.subtleText">
                          Take the assessment to unlock your personality type field.
                        </Text>
                        <Button
                          as={Link}
                          href="https://www.16personalities.com/free-personality-test"
                          isExternal
                          variant="outline"
                          colorScheme="blue"
                          rightIcon={<Icon as={ExternalLink} />}
                          alignSelf="flex-start"
                        >
                          Take the test
                        </Button>
                        <Checkbox
                          isChecked={hasCompletedPersonalityTest}
                          onChange={(event) => {
                            setHasCompletedPersonalityTest(event.target.checked)
                            setPersonalityTestError(null)
                          }}
                        >
                          I have completed the 16 Personalities test
                        </Checkbox>
                        {personalityTestError && (
                          <Text fontSize="sm" color="red.500">
                            {personalityTestError}
                          </Text>
                        )}
                      </VStack>
                    </Box>
                    <Box bg="white" p={4} borderRadius="lg" borderWidth="1px" borderColor="blue.200">
                      <VStack align="stretch" spacing={3}>
                        <Text fontWeight="semibold">Personal Values Test</Text>
                        <Text fontSize="sm" color="brand.subtleText">
                          Take the assessment to unlock your core values selection.
                        </Text>
                        <Button
                          as={Link}
                          href="https://personalvalu.es/"
                          isExternal
                          variant="outline"
                          colorScheme="blue"
                          rightIcon={<Icon as={ExternalLink} />}
                          alignSelf="flex-start"
                        >
                          Take the test
                        </Button>
                        <Checkbox
                          isChecked={hasCompletedValuesTest}
                          onChange={(event) => {
                            setHasCompletedValuesTest(event.target.checked)
                            setValuesTestError(null)
                          }}
                        >
                          I have completed the Personal Values test
                        </Checkbox>
                        {valuesTestError && (
                          <Text fontSize="sm" color="red.500">
                            {valuesTestError}
                          </Text>
                        )}
                      </VStack>
                    </Box>
                  </Grid>
                </VStack>
              </Box>

              <Stack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Personality Type</FormLabel>
                  <Tooltip
                    label="Complete the 16 Personalities test to unlock this field."
                    isDisabled={hasCompletedPersonalityTest}
                    hasArrow
                  >
                    <Box opacity={hasCompletedPersonalityTest ? 1 : 0.6}>
                      <Select
                        placeholder="Select your type"
                        value={personalityType}
                        onChange={event => {
                          setPersonalityType(event.target.value)
                          setFormError(null)
                        }}
                        isDisabled={!hasCompletedPersonalityTest}
                      >
                        {personalityOptions.map(option => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                    </Box>
                  </Tooltip>
                </FormControl>

                <Divider />

                <FormControl>
                  <FormLabel>Core Values (select exactly 5)</FormLabel>
                  <Tooltip
                    label="Complete the Personal Values test to unlock this section."
                    isDisabled={hasCompletedValuesTest}
                    hasArrow
                  >
                    <Box opacity={hasCompletedValuesTest ? 1 : 0.6}>
                      <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }} gap={3}>
                        {CORE_VALUES.map(value => {
                          const selected = coreValues.includes(value)
                          const disabled = !hasCompletedValuesTest || (!selected && coreValues.length >= 5)
                          return (
                            <Box
                              key={value}
                              border="1px solid"
                              borderColor={selected ? 'yellow.400' : 'brand.border'}
                              bg={selected ? 'yellow.50' : 'white'}
                              rounded="lg"
                              p={3}
                              cursor={disabled ? 'not-allowed' : 'pointer'}
                              opacity={disabled ? 0.5 : 1}
                              onClick={() => !disabled && handleCoreValueToggle(value)}
                            >
                              <HStack spacing={2}>
                                <Checkbox isChecked={selected} isDisabled={disabled} pointerEvents="none" />
                                <Text fontWeight="medium">{value}</Text>
                              </HStack>
                            </Box>
                          )
                        })}
                      </Grid>
                      <Text fontSize="xs" color="brand.subtleText" textAlign="right" mt={2}>
                        {coreValues.length}/5 values selected
                      </Text>
                    </Box>
                  </Tooltip>
                </FormControl>
              </Stack>

              {formError && (
                <Text fontSize="sm" color="red.500">
                  {formError}
                </Text>
              )}
            </Stack>
          </ModalBody>
          <ModalFooter gap={3} borderTop="1px" borderColor="brand.border">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              colorScheme="purple"
              type="submit"
              isLoading={saving}
              isDisabled={!hasCompletedPersonalityTest || !hasCompletedValuesTest || saving}
            >
              Save profile
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  )
}
