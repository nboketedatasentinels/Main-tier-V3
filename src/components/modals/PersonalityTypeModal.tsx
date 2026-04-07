import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  VStack,
  HStack,
  Box,
  Grid,
  Select,
  Alert,
  AlertIcon,
  Link,
  Collapse,
  Checkbox,
  Flex,
  Icon,
  Tooltip,
  useToast,
} from '@chakra-ui/react';
import { Brain, Heart, Globe, ExternalLink, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/services/firebase';
import { doc, getDoc, Timestamp, setDoc } from 'firebase/firestore';

import {
  PERSONALITY_TYPES,
  CORE_VALUES,
  COUNTRY_TIMEZONE_SUGGESTIONS,
  COMMUNITY_REDIRECT_LINK,
  getPersonalityDescription,
  PersonalityType,
} from '@/config/personality-data';
import { COUNTRIES_DATA } from '@/constants/countries';


// --- INTERFACES ---
interface PersonalityTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface ExistingData {
  personalityType?: PersonalityType | '';
  coreValues?: string[];
  country?: string;
  region?: string;
  hasCompletedPersonalityTest?: boolean;
  hasCompletedValuesTest?: boolean;
}

// --- HELPER COMPONENTS ---
const BenefitCard = ({ icon, color, title, description }: { icon: React.ElementType, color: string, title: string, description: string }) => (
    <HStack spacing={4} align="start">
        <Box bg={`${color}-100`} p="2" borderRadius="full">
            <Icon as={icon} w={5} h={5} color={`${color}-600`} />
        </Box>
        <VStack align="start" spacing={1}>
            <Text fontWeight="medium" color="neutral-800">{title}</Text>
            <Text fontSize="sm" color="neutral-600">{description}</Text>
        </VStack>
    </HStack>
);

// --- COMPONENT ---
export const PersonalityTypeModal: React.FC<PersonalityTypeModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  // --- STATE MANAGEMENT ---
  const { user, refreshProfile } = useAuth();
  const toast = useToast();

  // Form data state
  const [personalityType, setPersonalityType] = useState<PersonalityType | ''>('');
  const [coreValues, setCoreValues] = useState<string[]>([]);
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [hasCompletedPersonalityTest, setHasCompletedPersonalityTest] = useState(false);
  const [hasCompletedValuesTest, setHasCompletedValuesTest] = useState(false);
  const [personalityTestError, setPersonalityTestError] = useState<string | null>(null);
  const [valuesTestError, setValuesTestError] = useState<string | null>(null);

  // UI state
  const [suggestedTimezone, setSuggestedTimezone] = useState('');
  const [isValuesDropdownOpen, setIsValuesDropdownOpen] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Change detection state
  const [existingData, setExistingData] = useState<ExistingData | null>(null);

  // --- REFS ---
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- DATA FETCHING & STATE RESET ---
  const resetForm = () => {
    setPersonalityType('');
    setCoreValues([]);
    setCountry('');
    setRegion('');
    setHasCompletedPersonalityTest(false);
    setHasCompletedValuesTest(false);
    setPersonalityTestError(null);
    setValuesTestError(null);
    setError(null);
    setSuccess(false);
    setIsSubmitting(false);
    setHasScrolledToBottom(false);
    setExistingData(null);
    setIsValuesDropdownOpen(false);
  };

  const fetchExistingData = useCallback(async () => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        const currentData = {
          personalityType: data.personalityType || '',
          coreValues: data.coreValues || [],
          country: data.country || '',
          region: data.region || '',
          hasCompletedPersonalityTest: Boolean(data.hasCompletedPersonalityTest),
          hasCompletedValuesTest: Boolean(data.hasCompletedValuesTest),
        };
        setPersonalityType(currentData.personalityType);
        setCoreValues(currentData.coreValues);
        setCountry(currentData.country);
        setRegion(currentData.region);
        setHasCompletedPersonalityTest(currentData.hasCompletedPersonalityTest);
        setHasCompletedValuesTest(currentData.hasCompletedValuesTest);
        setExistingData(currentData);
      }
    } catch (err) {
      setError("Failed to load your profile data. Please try again.");
      console.error(err);
    }
  }, [user]);

  // --- EFFECTS ---
  useEffect(() => {
    if (isOpen) {
      fetchExistingData();
      // Check if scrolling is needed
      setTimeout(() => {
        if (scrollRef.current && scrollRef.current.scrollHeight <= scrollRef.current.clientHeight) {
          setHasScrolledToBottom(true);
        }
      }, 100);
    } else {
      setTimeout(() => resetForm(), 300); // Delay for closing animation
    }
  }, [isOpen, fetchExistingData]);

  const handleToggleValue = (value: string) => {
    setCoreValues(prev => {
      if (prev.includes(value)) {
        return prev.filter(v => v !== value);
      }
      if (prev.length < 5) {
        return [...prev, value];
      }
      return prev;
    });
  };

  const handleCountryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCountry = event.target.value;
    setCountry(selectedCountry);
    const countryData = COUNTRIES_DATA.find(c => c.name === selectedCountry);
    setRegion(countryData?.region || '');
  };

  useEffect(() => {
    if (country) {
      setSuggestedTimezone(COUNTRY_TIMEZONE_SUGGESTIONS[country] || '');
    } else {
      setSuggestedTimezone('');
    }
  }, [country]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsValuesDropdownOpen(false);
      }
    };
    if (isValuesDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isValuesDropdownOpen]);

  useEffect(() => {
    if (!hasCompletedValuesTest) {
      setIsValuesDropdownOpen(false);
    }
  }, [hasCompletedValuesTest]);


  const handleSubmit = async () => {
    setError(null);
    setPersonalityTestError(null);
    setValuesTestError(null);
    // Validation
    if (!user) {
      setError("You must be logged in to save your profile.");
      return;
    }
    if (!hasCompletedPersonalityTest || !hasCompletedValuesTest) {
      if (!hasCompletedPersonalityTest) {
        setPersonalityTestError("Please confirm you have taken the 16 Personalities test.");
      }
      if (!hasCompletedValuesTest) {
        setValuesTestError("Please confirm you have taken the Personal Values test.");
      }
      window.alert('Please confirm you have completed the required tests before saving.');
      return;
    }
    if (!personalityType) {
      setError("Please select your personality type.");
      return;
    }
    if (coreValues.length !== 5) {
      setError("Please select exactly 5 core values.");
      return;
    }

    setIsSubmitting(true);

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const profileDocRef = doc(db, 'profiles', user.uid);
      const dataToSave = {
        personalityType,
        coreValues,
        country,
        region,
        hasCompletedPersonalityTest,
        hasCompletedValuesTest,
        updatedAt: Timestamp.now(),
      };
      await Promise.all([
        setDoc(userDocRef, dataToSave, { merge: true }),
        setDoc(profileDocRef, dataToSave, { merge: true }),
      ]);

      // Refresh the profile to update AuthContext state with the new personality data
      await refreshProfile({ reason: 'personality-profile-saved' });

      setSuccess(true);
      toast({
        title: 'Profile saved',
        description: 'Your personality type and core values have been updated.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      });

      if (onComplete) {
        setTimeout(() => {
            onComplete();
        }, 1500);
      }

      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err) {
      setError("Failed to save your profile. Please try again.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 5) { // 5px buffer
        setHasScrolledToBottom(true);
      }
    }
  };
  // --- RENDER ---
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size={{ base: 'full', md: '4xl' }} scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxH="90vh">
        <ModalHeader borderBottomWidth="1px" borderColor="neutral.200" p={6}>
            <HStack>
                <Box bg="brand-indigo-100" p="2" borderRadius="full">
                    <Icon as={Brain} size={20} color="brand-indigo-600" />
                </Box>
                <Text fontSize="xl" fontWeight="semibold" color="neutral.900" fontFamily="display">
                    Discover Your Leadership Superpowers!
                </Text>
            </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={6} ref={scrollRef} onScroll={handleScroll}>
          {success ? (
            <VStack spacing={4} justify="center" h="100%" textAlign="center" p={8}>
                <Box bg="success-100" p="3" borderRadius="full">
                    <Icon as={CheckCircle} w={10} h={10} color="success-700" />
                </Box>
                <Text fontSize="2xl" fontWeight="semibold" color="neutral-900">Profile Updated Successfully!</Text>
                <Text color="neutral-600">Your personality type and core values have been saved.</Text>
            </VStack>
          ) : (
            <VStack spacing={6} align="stretch">
              {/* Prerequisites Section */}
              <Box bg="blue.50" p={6} borderRadius="lg" borderWidth="2px" borderColor="blue.200">
                <VStack spacing={4} align="stretch">
                  <Text fontSize="lg" fontWeight="semibold" color="blue.800">Prerequisites</Text>
                  <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
                    <Box bg="white" p={4} borderRadius="lg" borderWidth="1px" borderColor="blue.200">
                      <VStack spacing={3} align="stretch">
                        <Text fontWeight="semibold" color="neutral-800">16 Personalities Test</Text>
                        <Text fontSize="sm" color="neutral-600">
                          Complete the 16 Personalities assessment to unlock the personality type field.
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
                          onChange={(e) => {
                            setHasCompletedPersonalityTest(e.target.checked);
                            setPersonalityTestError(null);
                          }}
                        >
                          I have completed this test
                        </Checkbox>
                        {personalityTestError && (
                          <Text fontSize="sm" color="red.500">
                            {personalityTestError}
                          </Text>
                        )}
                      </VStack>
                    </Box>
                    <Box bg="white" p={4} borderRadius="lg" borderWidth="1px" borderColor="blue.200">
                      <VStack spacing={3} align="stretch">
                        <Text fontWeight="semibold" color="neutral-800">Personal Values Test</Text>
                        <Text fontSize="sm" color="neutral-600">
                          Complete the Personal Values assessment to unlock core values selection.
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
                          onChange={(e) => {
                            setHasCompletedValuesTest(e.target.checked);
                            setValuesTestError(null);
                          }}
                        >
                          I have completed this test
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

              {/* Introduction Section */}
              <VStack spacing={4} textAlign="center">
                <Box bg="brand-indigo-100" p="2" borderRadius="full">
                    <Icon as={Brain} w={5} h={5} color="brand-indigo-600" />
                </Box>
                <Text fontSize="lg" fontWeight="medium" color="neutral-800">
                  Take the Personality Type Test to unlock insights about your leadership style.
                </Text>
                <Text color="neutral-600" maxW="2xl">
                  Understanding your personality helps tailor your development journey, revealing your natural strengths and areas for growth.
                </Text>
              </VStack>

              {/* Personality Type Section */}
              <Box bg="brand-indigo-50" p={6} borderRadius="lg" borderWidth="1px" borderColor="brand-indigo-200">
                <VStack spacing={4} align="stretch">
                  <HStack spacing={3}>
                    <Icon as={Brain} w={5} h={5} color="brand-indigo-800" />
                    <Text fontSize="lg" fontWeight="semibold" color="brand-indigo-800">Personality Type</Text>
                  </HStack>
                  <Text color="neutral-600" fontSize="sm">
                    Discover your personality type by taking the free 16Personalities test. It takes less than 12 minutes.
                  </Text>
                  <Button
                    as={Link}
                    href="https://www.16personalities.com/free-personality-test"
                    isExternal
                    variant="outline"
                    colorScheme="blue"
                    rightIcon={<Icon as={ExternalLink} />}
                    alignSelf="flex-start"
                    size="sm"
                  >
                    Take the test
                  </Button>
                  <Tooltip
                    label="Complete the 16 Personalities test to unlock this field."
                    isDisabled={hasCompletedPersonalityTest}
                    placement="top"
                    hasArrow
                  >
                    <Box opacity={hasCompletedPersonalityTest ? 1 : 0.6}>
                      <Select
                        placeholder="Select your type"
                        value={personalityType}
                        onChange={(e) => setPersonalityType(e.target.value as PersonalityType)}
                        borderColor="brand-indigo-300"
                        focusBorderColor="brand-indigo-500"
                        isDisabled={!hasCompletedPersonalityTest}
                      >
                        {PERSONALITY_TYPES.map(pt => (
                          <option key={pt.type} value={pt.type}>{pt.type} - {pt.name}</option>
                        ))}
                      </Select>
                    </Box>
                  </Tooltip>
                  {personalityType && (
                    <Box bg="white" p={4} borderRadius="md" borderWidth="1px" borderColor="brand-indigo-200">
                      <Text fontWeight="semibold" color="brand-indigo-800">About {personalityType} Types</Text>
                      <Text fontSize="sm" color="neutral-600">{getPersonalityDescription(personalityType)}</Text>
                    </Box>
                  )}
                  {existingData?.personalityType && personalityType !== existingData.personalityType && (
                    <Alert status="warning" borderRadius="lg">
                      <AlertIcon />
                      You're changing from {existingData.personalityType} to {personalityType}.
                    </Alert>
                  )}
                </VStack>
              </Box>

              {/* Core Values Section */}
              <Box bg="accent-gold-50" p={6} borderRadius="lg" borderWidth="1px" borderColor="accent-gold-200" pos="relative" ref={dropdownRef}>
                <VStack spacing={4} align="stretch">
                  <HStack spacing={3}>
                    <Icon as={Heart} w={5} h={5} color="accent-gold-800" />
                    <Text fontSize="lg" fontWeight="semibold" color="accent-gold-800">Core Values</Text>
                  </HStack>
                  <Text color="neutral-600" fontSize="sm">
                    Select exactly 5 core values that are most important to you.
                  </Text>
                  <Button
                    as={Link}
                    href="https://personalvalu.es/"
                    isExternal
                    variant="outline"
                    colorScheme="yellow"
                    rightIcon={<Icon as={ExternalLink} />}
                    alignSelf="flex-start"
                    size="sm"
                  >
                    Take the values test
                  </Button>

                  <Tooltip
                    label="Complete the Personal Values test to unlock core values."
                    isDisabled={hasCompletedValuesTest}
                    placement="top"
                    hasArrow
                  >
                    <Box opacity={hasCompletedValuesTest ? 1 : 0.6}>
                      <Button
                        onClick={() => setIsValuesDropdownOpen(!isValuesDropdownOpen)}
                        variant="outline"
                        borderColor="accent-gold-300"
                        _hover={{ bg: 'accent-gold-100' }}
                        textAlign="left"
                        fontWeight="normal"
                        isDisabled={!hasCompletedValuesTest}
                      >
                        <HStack justify="space-between" w="full">
                          <Text isTruncated>
                            {coreValues.length > 0 ? coreValues.join(', ') : 'Select core values (max 5)'}
                          </Text>
                          <Icon as={isValuesDropdownOpen ? ChevronUp : ChevronDown} />
                        </HStack>
                      </Button>
                    </Box>
                  </Tooltip>
                  <Text fontSize="xs" color="neutral-500" textAlign="right">{coreValues.length}/5 values selected</Text>

                  <Collapse in={isValuesDropdownOpen} animateOpacity>
                    <Box
                      p={4}
                      mt={2}
                      bg="white"
                      borderWidth="1px"
                      borderColor="neutral-200"
                      borderRadius="lg"
                      maxH="240px"
                      overflowY="auto"
                      shadow="lg"
                    >
                      <Grid templateColumns="repeat(3, 1fr)" gap={4}>
                        {CORE_VALUES.map(value => (
                          <Flex
                            as="label"
                            key={value}
                            p={2}
                            borderRadius="md"
                            _hover={{ bg: 'neutral.50' }}
                            cursor="pointer"
                            opacity={coreValues.length >= 5 && !coreValues.includes(value) ? 0.5 : 1}
                            htmlFor={`value-${value}`}
                          >
                            <HStack>
                                <Checkbox
                                    id={`value-${value}`}
                                    isChecked={coreValues.includes(value)}
                                    isDisabled={!hasCompletedValuesTest || (coreValues.length >= 5 && !coreValues.includes(value))}
                                    onChange={() => handleToggleValue(value)}
                                    mr={2}
                                />
                                <Icon as={Heart} color={coreValues.includes(value) ? "accent-gold-600" : "neutral-400"} />
                                <Text color={coreValues.includes(value) ? "accent-gold-800" : "neutral-700"}>{value}</Text>
                            </HStack>
                          </Flex>
                        ))}
                      </Grid>
                    </Box>
                  </Collapse>
                  {existingData?.coreValues && JSON.stringify(coreValues.sort()) !== JSON.stringify(existingData.coreValues.sort()) && (
                    <Alert status="warning" borderRadius="lg">
                      <AlertIcon />
                      You're changing your core values.
                    </Alert>
                  )}
                </VStack>
              </Box>

              {/* Location Section */}
              <Box bg="neutral-50" p={6} borderRadius="lg" borderWidth="1px" borderColor="neutral-200">
                <VStack spacing={4} align="stretch">
                    <HStack spacing={3}>
                        <Icon as={Globe} w={5} h={5} color="neutral-800" />
                        <Text fontSize="lg" fontWeight="semibold" color="neutral-800">Your Location</Text>
                    </HStack>
                    <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
                        <Select placeholder="Select your country" value={country} onChange={handleCountryChange}>
                            {COUNTRIES_DATA.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </Select>
                        <Box>
                            <Text as="label" fontSize="sm" color="neutral-600">Region</Text>
                            <Text bg="neutral-100" p={2} borderRadius="md" cursor="not-allowed">{region || 'Region will auto-fill'}</Text>
                        </Box>
                    </Grid>
                    {suggestedTimezone && <Text fontSize="xs" color="neutral-500">Suggested timezone for calendar sync: {suggestedTimezone}</Text>}
                    <Link href={COMMUNITY_REDIRECT_LINK} isExternal textDecoration="underline" color="brand-indigo-600" fontSize="sm">
                        Explore community groups in your region <Icon as={ExternalLink} w={4} h={4} display="inline-block" />
                    </Link>
                    {existingData?.country && country !== existingData.country && (
                        <Alert status="warning" borderRadius="lg">
                            <AlertIcon />
                            You're changing from {existingData.country} to {country}.
                        </Alert>
                    )}
                </VStack>
              </Box>

              {/* Why This Matters Section */}
              <Box bg="neutral-50" p={6} borderRadius="lg" borderWidth="1px" borderColor="neutral-200">
                <VStack spacing={4} align="stretch">
                    <Text fontSize="lg" fontWeight="semibold" color="neutral-800">Why This Matters</Text>
                    <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={6}>
                        <BenefitCard icon={Brain} color="brand-indigo" title="Personalized Learning" description="Your personality type helps us tailor content to your learning style." />
                        <BenefitCard icon={Brain} color="brand-indigo" title="Team Dynamics" description="Understanding your type improves collaboration and communication." />
                        <BenefitCard icon={Heart} color="accent-gold" title="Authentic Leadership" description="Core values guide your decision-making and build trust." />
                        <BenefitCard icon={Heart} color="accent-gold" title="Growth Focus" description="Identifying values helps prioritize your development goals." />
                    </Grid>
                </VStack>
              </Box>

              {error && (
                <Alert status="error" borderRadius="lg">
                  <AlertIcon />
                  {error}
                </Alert>
              )}

              {!hasScrolledToBottom && (
                 <Text textAlign="center" fontSize="sm" color="neutral-500">
                    Scroll to the bottom to enable saving.
                 </Text>
              )}

            </VStack>
          )}
        </ModalBody>
        <ModalFooter borderTopWidth="1px" borderColor="neutral.200" p={6} gap={3}>
            <Button variant="ghost" onClick={onClose}>
                Cancel
            </Button>
            <Button
                colorScheme="brand"
                isLoading={isSubmitting}
                onClick={handleSubmit}
                isDisabled={!hasScrolledToBottom || isSubmitting}
            >
                Save Profile
            </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
