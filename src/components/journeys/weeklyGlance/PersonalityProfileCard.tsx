import {
  Box,
  Card,
  CardBody,
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
  const persistedHasCompletedPersonalityTest = Boolean(profile?.hasCompletedPersonalityTest)
  const persistedHasCompletedValuesTest = Boolean(profile?.hasCompletedValuesTest)
  const confirmedTestsCount = Number(hasCompletedPersonalityTest) + Number(hasCompletedValuesTest)

  const resolveTestStatus = (isChecked: boolean, isPersisted: boolean) => {
    if (!isChecked) {
      return { label: 'Not completed', colorScheme: 'gray' }
    }
    if (isPersisted) {
      return { label: 'Submitted', colorScheme: 'green' }
    }
    return { label: 'Completed - save to submit', colorScheme: 'blue' }
  }

  const personalityTestStatus = resolveTestStatus(hasCompletedPersonalityTest, persistedHasCompletedPersonalityTest)
  const valuesTestStatus = resolveTestStatus(hasCompletedValuesTest, persistedHasCompletedValuesTest)

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
  const selectedPersonalityType = localProfile?.personalityType?.trim() || ''
  const strengthPreviewCount = strengths.length

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
    <Card h="100%" bg="white" borderWidth="1px" borderColor="blue.400" borderRadius="xl">
      <CardBody p={5}>
        <Stack spacing={5}>
          {/* Header */}
          <HStack spacing={2}>
            <Icon as={Sparkles} color="blue.500" boxSize={5} />
            <Text fontWeight="semibold" fontSize="md" color="gray.800" fontFamily="heading">Personality Profile</Text>
          </HStack>

          <Skeleton isLoaded={!loading} rounded="md">
            <Stack spacing={4}>
              {/* Personality Type */}
              <Box bg="gray.50" rounded="lg" p={4}>
                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wide" mb={2}>
                  Personality Type
                </Text>
                {selectedPersonalityType ? (
                  <Tag colorScheme="purple" borderRadius="full" px={4} py={2} fontSize="md" fontWeight="semibold">
                    {selectedPersonalityType}
                  </Tag>
                ) : (
                  <Text color="gray.400" fontStyle="italic">Not set yet</Text>
                )}
              </Box>

              {/* Core Values */}
              <Box>
                <HStack spacing={2} mb={3}>
                  <Icon as={Award} color="yellow.500" boxSize={4} />
                  <Text fontSize="sm" fontWeight="semibold" color="gray.700">Core Values</Text>
                </HStack>
                {selectedCoreValues.length > 0 ? (
                  <HStack spacing={2} flexWrap="wrap">
                    {selectedCoreValues.map(value => (
                      <Tag key={value} colorScheme="yellow" borderRadius="full" px={3} py={1} fontSize="sm">
                        {value}
                      </Tag>
                    ))}
                  </HStack>
                ) : (
                  <Text fontSize="sm" color="gray.400" fontStyle="italic">No core values selected yet</Text>
                )}
              </Box>

              {/* Strengths */}
              {strengths.length > 0 && (
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" color="gray.700" mb={2}>Strengths</Text>
                  <UnorderedList pl={4} spacing={1} fontSize="sm" color="gray.600">
                    {strengths.slice(0, strengthPreviewCount).map(item => (
                      <ListItem key={item}>{item}</ListItem>
                    ))}
                  </UnorderedList>
                </Box>
              )}

              {/* Action Button */}
              <Button
                variant="solid"
                bg="purple.800"
                color="white"
                _hover={{ bg: 'purple.700' }}
                size="sm"
                onClick={() => setIsModalOpen(true)}
                alignSelf="flex-start"
                mt={2}
              >
                View & Edit Profile
              </Button>
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
              <Box bg="blue.50" p={5} borderRadius="lg" borderWidth="1px" borderColor="blue.200">
                <VStack align="stretch" spacing={4}>
                  <HStack justify="space-between" align="center">
                    <Text fontWeight="semibold" color="blue.800">
                      Required Tests
                    </Text>
                    <Tag colorScheme={confirmedTestsCount === 2 ? 'green' : 'blue'}>
                      {confirmedTestsCount}/2 confirmed
                    </Tag>
                  </HStack>
                  <Text fontSize="sm" color="blue.700">
                    Complete each test externally, then submit your confirmation by checking the box and saving this profile.
                  </Text>
                  <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
                    <Box bg="white" p={4} borderRadius="lg" borderWidth="1px" borderColor="blue.200">
                      <VStack align="stretch" spacing={3}>
                        <HStack justify="space-between" align="center">
                          <Text fontWeight="semibold">16 Personalities Test</Text>
                          <Tag colorScheme={personalityTestStatus.colorScheme}>{personalityTestStatus.label}</Tag>
                        </HStack>
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
                          I completed this test and I am ready to submit confirmation
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
                        <HStack justify="space-between" align="center">
                          <Text fontWeight="semibold">Personal Values Test</Text>
                          <Tag colorScheme={valuesTestStatus.colorScheme}>{valuesTestStatus.label}</Tag>
                        </HStack>
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
                          I completed this test and I am ready to submit confirmation
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
              Submit confirmations & save profile
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  )
}
