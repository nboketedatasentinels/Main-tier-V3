import React, { useState, useEffect, useCallback } from 'react';
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
  Textarea,
  Select,
  Spinner,
  Alert,
  AlertIcon,
  FormControl,
  FormLabel,
  Radio,
  Center,
  Divider,
  Badge,
} from '@chakra-ui/react';
import { Swords, Users, Trophy, Filter, User, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/services/firebase';
import { ORG_COLLECTION } from '@/constants/organizations';
import { fetchOrgMembers, getOrgScope } from '@/utils/organizationScope';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { UserProfile, Organization } from '@/types';


// --- INTERFACES ---
interface PreselectedUser {
  id: string;
  name: string;
  email?: string;
}

interface StartChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChallengeCreated: () => void;
  preselectedUser?: PreselectedUser | null;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  level: number;
  points: number;
  recommended: boolean;
}

type ChallengeType = 'competitive' | 'collaborative';
type OpponentFilter = 'suggested' | 'similar-level' | 'all';
type DurationPreset = 'weekly' | 'monthly';

// --- HELPER: Check if two profiles are in the same organization ---
// This handles the ID/code mismatch by checking ALL possible identifier combinations
const areProfilesInSameOrg = (profile1: UserProfile | null, profile2: UserProfile | null): boolean => {
  if (!profile1 || !profile2) return false;

  // Collect all organization identifiers for each profile
  const getOrgIdentifiers = (profile: UserProfile): Set<string> => {
    const identifiers = new Set<string>();
    
    if (profile.companyId) identifiers.add(profile.companyId);
    if (profile.companyCode) identifiers.add(profile.companyCode);
    if (profile.organizationId) identifiers.add(profile.organizationId);
    if (profile.organizationCode) identifiers.add(profile.organizationCode);
    // Handle snake_case variants if they exist
    const p = profile as Record<string, unknown>;
    if (p.company_id && typeof p.company_id === 'string') identifiers.add(p.company_id);
    if (p.company_code && typeof p.company_code === 'string') identifiers.add(p.company_code);
    if (p.organization_id && typeof p.organization_id === 'string') identifiers.add(p.organization_id);
    if (p.organization_code && typeof p.organization_code === 'string') identifiers.add(p.organization_code);
    
    return identifiers;
  };

  const ids1 = getOrgIdentifiers(profile1);
  const ids2 = getOrgIdentifiers(profile2);

  // Check if there's ANY overlap between the two sets
  for (const id of ids1) {
    if (ids2.has(id)) {
      console.log('[Challenge] ✅ Organization match found:', id);
      return true;
    }
  }

  console.log('[Challenge] ❌ No organization match:', { 
    challenger: Array.from(ids1), 
    challenged: Array.from(ids2) 
  });
  return false;
};

// --- HELPER: Resolve organization details from profile ---
// Fetches the organization document to get both ID and code
const resolveOrganization = async (profile: UserProfile): Promise<Organization | null> => {
  // Try to find organization by companyId first
  if (profile.companyId) {
    const orgDoc = await getDoc(doc(db, ORG_COLLECTION, profile.companyId));
    if (orgDoc.exists()) {
      return { ...orgDoc.data(), id: orgDoc.id } as Organization;
    }
  }

  // Try by organizationId
  if (profile.organizationId && profile.organizationId !== profile.companyId) {
    const orgDoc = await getDoc(doc(db, ORG_COLLECTION, profile.organizationId));
    if (orgDoc.exists()) {
      return { ...orgDoc.data(), id: orgDoc.id } as Organization;
    }
  }

  // Try to find by companyCode
  if (profile.companyCode) {
    const codeQuery = query(collection(db, ORG_COLLECTION), where('code', '==', profile.companyCode));
    const snapshot = await getDocs(codeQuery);
    if (!snapshot.empty) {
      return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as Organization;
    }
  }

  // Try by organizationCode
  if (profile.organizationCode && profile.organizationCode !== profile.companyCode) {
    const codeQuery = query(collection(db, ORG_COLLECTION), where('code', '==', profile.organizationCode));
    const snapshot = await getDocs(codeQuery);
    if (!snapshot.empty) {
      return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as Organization;
    }
  }

  return null;
};

// --- COMPONENT ---
export const StartChallengeModal: React.FC<StartChallengeModalProps> = ({
  isOpen,
  onClose,
  onChallengeCreated,
  preselectedUser,
}) => {
  // --- STATE MANAGEMENT ---
  const [challengeType, setChallengeType] = useState<ChallengeType>('competitive');
  const [customGoal, setCustomGoal] = useState('');
  const [opponentFilter, setOpponentFilter] = useState<OpponentFilter>('suggested');
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('weekly');
  const [description, setDescription] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [userLevel, setUserLevel] = useState(1);

  const { user, profile } = useAuth();

  // --- DATA FETCHING ---
  const fetchPotentialOpponents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const orgScope = getOrgScope(profile);
      if (!orgScope.isValid) {
        setUsers([]);
        setError('Organization details are missing. Please refresh your profile.');
        return;
      }

      const members = await fetchOrgMembers(db, orgScope, user.uid);
      const userOptions: UserOption[] = members.map((member) => {
        const p = member as unknown as UserProfile;
        return ({
        id: p.id,
        name: p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
        email: p.email,
        level: p.level || 1,
        points: p.totalPoints || 0,
        recommended: false,
        });
      });

      if (userOptions.length === 0) {
        setError('No users available to challenge right now.');
      }
      setUsers(userOptions);
    } catch (err) {
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [profile, user]);

  // --- FILTERING LOGIC ---
  const applyOpponentFilter = useCallback(() => {
    let sortedUsers = [...users];
    if (opponentFilter === 'suggested') {
      sortedUsers.sort((a, b) => {
        const levelDiffA = Math.abs(a.level - userLevel);
        const levelDiffB = Math.abs(b.level - userLevel);
        if (levelDiffA !== levelDiffB) return levelDiffA - levelDiffB;
        return b.points - a.points;
      });
      sortedUsers = sortedUsers.map((u, i) => ({ ...u, recommended: i < 3 }));
    } else if (opponentFilter === 'similar-level') {
      sortedUsers = sortedUsers.filter(u => Math.abs(u.level - userLevel) <= 2);
    } else { // 'all'
      sortedUsers.sort((a, b) => a.name.localeCompare(b.name));
    }
    setFilteredUsers(sortedUsers);
  }, [users, opponentFilter, userLevel]);

  // --- FORM LOGIC & VALIDATION ---
  const validateForm = () => {
    if (!user) {
      setError('You must be logged in to create a challenge.');
      return false;
    }
    if (!preselectedUser && !selectedUserId) {
      setError('Please select a user to challenge.');
      return false;
    }
    return true;
  };

  const resetForm = () => {
    setChallengeType('competitive');
    setCustomGoal('');
    setOpponentFilter('suggested');
    setDurationPreset('weekly');
    setDescription('');
    setSelectedUserId(null);
    setError(null);
    setSuccess(false);
  };

  // --- SUBMISSION LOGIC ---
  const handleCreateChallenge = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      const challengedUserId = preselectedUser ? preselectedUser.id : selectedUserId;
      if (!challengedUserId || !user) {
        throw new Error('User data is missing.');
      }

      const fetchProfile = async (userId: string) => {
        if (profile?.id === userId) return profile;
        const profileDoc = await getDoc(doc(db, 'profiles', userId));
        return profileDoc.exists() ? ({ ...profileDoc.data(), id: profileDoc.id } as UserProfile) : null;
      };

      const challenger = await fetchProfile(user.uid);
      const challenged = await fetchProfile(challengedUserId);

      if (!challenger) {
        throw new Error('Your profile could not be loaded.');
      }
      if (!challenged) {
        throw new Error('Opponent profile could not be loaded.');
      }

      // FIX: Use the new organization matching function that handles ID/code mismatches
      if (!areProfilesInSameOrg(challenger, challenged)) {
        console.error('[Challenge] Organization mismatch:', {
          challenger: {
            id: challenger.id,
            companyId: challenger.companyId,
            companyCode: challenger.companyCode,
            organizationId: challenger.organizationId,
            organizationCode: challenger.organizationCode,
          },
          challenged: {
            id: challenged.id,
            companyId: challenged.companyId,
            companyCode: challenged.companyCode,
            organizationId: challenged.organizationId,
            organizationCode: challenged.organizationCode,
          },
        });
        throw new Error('You can only challenge members of your organization.');
      }

      // FIX: Resolve the organization to get BOTH the ID and code
      // This ensures challenges are stored with complete org info for querying
      const company = await resolveOrganization(challenger);
      
      if (!company) {
        console.warn('[Challenge] Could not resolve organization, using profile values');
      }

      // Calculate dates
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      if (durationPreset === 'weekly') {
        endDate.setDate(endDate.getDate() + 7);
      } else {
        endDate.setDate(endDate.getDate() + 30);
      }

      // Auto-generated description
      const finalDescription = description ||
        `${durationPreset.charAt(0).toUpperCase() + durationPreset.slice(1)} ${challengeType} challenge`;

      // FIX: Build challenge object with BOTH company_id AND company_code
      // This ensures challenges can be queried by either identifier
      const challengeData = {
        challenger_id: challenger.id,
        challenger_name: challenger.fullName,
        challenged_id: challenged.id,
        challenged_name: challenged.fullName,
        // Store BOTH identifiers to support queries by either
        company_id: company?.id || challenger.companyId || challenger.organizationId || null,
        company_code: company?.code || challenger.companyCode || challenger.organizationCode || null,
        company_name: company?.name || null,
        // Also store as participants array for easier querying
        participants: [challenger.id, challenged.id],
        status: 'pending',
        type: challengeType,
        custom_goal: challengeType === 'collaborative' ? customGoal : '',
        description: finalDescription,
        start_date: Timestamp.fromDate(startDate),
        end_date: Timestamp.fromDate(endDate),
        created_at: Timestamp.now(),
        transformation_partner_id: company?.transformation_partner_id || null,
        metrics: {
          challenger: { completion: 0, speed: 0, consistency: 0, bonus: 0, total: 0 },
          challenged: { completion: 0, speed: 0, consistency: 0, bonus: 0, total: 0 },
        },
        daily_points: {
          challenger: {},
          challenged: {},
        },
        result: { challengerScore: 0, challengedScore: 0 },
      };

      console.log('[Challenge] Creating challenge with data:', {
        challenger_id: challengeData.challenger_id,
        challenged_id: challengeData.challenged_id,
        company_id: challengeData.company_id,
        company_code: challengeData.company_code,
        participants: challengeData.participants,
      });

      // Insert into challenges table
      const challengeDocRef = await addDoc(collection(db, 'challenges'), challengeData);

      // Create notification
      await addDoc(collection(db, 'notifications'), {
        user_id: challengedUserId,
        type: 'challenge_request',
        message: `You have a new battle challenge from ${challenger.fullName}`,
        is_read: false,
        related_id: challengeDocRef.id,
        created_at: Timestamp.now(),
      });

      console.log('[Challenge] ✅ Challenge created successfully:', challengeDocRef.id);

      setSuccess(true);
      setTimeout(() => {
        onChallengeCreated();
        onClose();
        resetForm();
      }, 2000);

    } catch (err) {
      console.error('[Challenge] ❌ Error creating challenge:', err);
      setError(err instanceof Error ? err.message : 'Failed to create challenge.');
    } finally {
      setLoading(false);
    }
  };

  // --- EFFECTS ---
  useEffect(() => {
    if (profile?.level) {
      setUserLevel(profile.level);
    }
  }, [profile]);

  useEffect(() => {
    if (isOpen) {
      if (preselectedUser) {
        setSelectedUserId(preselectedUser.id);
      } else {
        fetchPotentialOpponents();
      }
    } else {
      // Reset form when modal closes
      setTimeout(resetForm, 300); // Delay to allow animation
    }
  }, [isOpen, preselectedUser, fetchPotentialOpponents]);

  useEffect(() => {
    applyOpponentFilter();
  }, [users, opponentFilter, applyOpponentFilter]);


  // --- DERIVED STATE & CONSTANTS ---
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);

  const getEndDate = () => {
    const end = new Date(startDate);
    if (durationPreset === 'weekly') {
      end.setDate(end.getDate() + 7);
    } else {
      end.setDate(end.getDate() + 30);
    }
    return end;
  };
  const endDate = getEndDate();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // --- RENDER ---
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxH="90vh">
        <ModalHeader borderBottomWidth="1px" borderColor="neutral.200">
          <HStack>
            <Box bg="brand.100" p="2" borderRadius="full">
              <Swords size={20} color="var(--chakra-colors-brand-600)" />
            </Box>
            <Text fontSize="xl" fontWeight="semibold" color="neutral.900">
              Start a Challenge
            </Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={6}>
          {success ? (
            <Alert status="success" borderRadius="lg">
              <AlertIcon />
              Challenge Created! Your challenge has been sent.
            </Alert>
          ) : (
            <VStack spacing={6} align="stretch">
              {error && (
                <Alert status="error" borderRadius="lg">
                  <AlertIcon />
                  {error}
                </Alert>
              )}

              {/* Challenge Type Selector */}
              <FormControl>
                <FormLabel>Challenge Type</FormLabel>
                <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                  <Box
                    p={4}
                    borderWidth="1px"
                    borderRadius="lg"
                    cursor="pointer"
                    borderColor={challengeType === 'competitive' ? 'brand.500' : 'neutral.200'}
                    bg={challengeType === 'competitive' ? 'brand.50' : 'transparent'}
                    onClick={() => setChallengeType('competitive')}
                    textAlign="center"
                  >
                    <Swords size={24} style={{ margin: 'auto' }} />
                    <Text fontWeight="medium" mt={2}>Competitive</Text>
                    <Text fontSize="xs">1v1 points battle</Text>
                  </Box>
                  <Box
                    p={4}
                    borderWidth="1px"
                    borderRadius="lg"
                    cursor="pointer"
                    borderColor={challengeType === 'collaborative' ? 'brand.500' : 'neutral.200'}
                    bg={challengeType === 'collaborative' ? 'brand.50' : 'transparent'}
                    onClick={() => setChallengeType('collaborative')}
                    textAlign="center"
                  >
                    <Users size={24} style={{ margin: 'auto' }} />
                    <Text fontWeight="medium" mt={2}>Collaborative</Text>
                    <Text fontSize="xs">Team towards goal</Text>
                  </Box>
                </Grid>
              </FormControl>

              {/* Collaborative Goal Input */}
              {challengeType === 'collaborative' && (
                <FormControl>
                  <FormLabel>Challenge Goal</FormLabel>
                  <Textarea
                    placeholder="e.g., Complete 50 modules together"
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                  />
                </FormControl>
              )}

              {/* Opponent Selection */}
              {!preselectedUser ? (
                <FormControl>
                  <FormLabel>Select Opponent</FormLabel>
                  <HStack spacing={2} mb={4}>
                    <Button
                      leftIcon={<Trophy size={16} />}
                      size="sm"
                      variant={opponentFilter === 'suggested' ? 'solid' : 'outline'}
                      colorScheme={opponentFilter === 'suggested' ? 'brand' : 'neutral'}
                      onClick={() => setOpponentFilter('suggested')}
                    >
                      Suggested
                    </Button>
                    <Button
                      leftIcon={<Filter size={16} />}
                      size="sm"
                      variant={opponentFilter === 'similar-level' ? 'solid' : 'outline'}
                      colorScheme={opponentFilter === 'similar-level' ? 'brand' : 'neutral'}
                      onClick={() => setOpponentFilter('similar-level')}
                    >
                      Similar Level
                    </Button>
                    <Button
                      leftIcon={<Users size={16} />}
                      size="sm"
                      variant={opponentFilter === 'all' ? 'solid' : 'outline'}
                      colorScheme={opponentFilter === 'all' ? 'brand' : 'neutral'}
                      onClick={() => setOpponentFilter('all')}
                    >
                      All
                    </Button>
                  </HStack>
                  <VStack
                    borderWidth="1px"
                    borderColor="neutral.200"
                    borderRadius="lg"
                    maxH="240px"
                    overflowY="auto"
                    spacing={0}
                    divider={<Divider />}
                  >
                    {loading ? (
                      <Center p={8}>
                        <Spinner />
                        <Text ml={4}>Loading users...</Text>
                      </Center>
                    ) : filteredUsers.length === 0 ? (
                      <Center p={8} flexDirection="column" color="neutral.500">
                        <User size={32} />
                        <Text mt={2}>No users found.</Text>
                      </Center>
                    ) : (
                      filteredUsers.map((u) => (
                        <HStack
                          key={u.id}
                          p={4}
                          w="full"
                          cursor="pointer"
                          bg={selectedUserId === u.id ? 'brand.50' : 'transparent'}
                          _hover={{ bg: 'neutral.50' }}
                          onClick={() => setSelectedUserId(u.id)}
                          justifyContent="space-between"
                        >
                          <HStack>
                            <Radio isChecked={selectedUserId === u.id} readOnly />
                            <VStack align="flex-start" spacing={0} ml={3}>
                              <HStack>
                                <Text fontWeight="medium" color="neutral.800">{u.name}</Text>
                                {u.recommended && <Badge colorScheme="yellow">Recommended</Badge>}
                              </HStack>
                              <Text fontSize="xs" color="neutral.500">{u.email}</Text>
                            </VStack>
                          </HStack>
                          <VStack align="flex-end" spacing={0}>
                            <Text fontSize="sm" color="neutral.700">Level {u.level}</Text>
                            <Text fontSize="xs" color="neutral.500">{u.points.toLocaleString()} XP</Text>
                          </VStack>
                        </HStack>
                      ))
                    )}
                  </VStack>
                </FormControl>
              ) : (
                <FormControl>
                    <FormLabel>Opponent</FormLabel>
                    <HStack borderWidth="1px" borderColor="neutral.200" borderRadius="lg" p={4} justifyContent="space-between">
                        <VStack align="flex-start" spacing={0}>
                            <Text fontWeight="medium" color="neutral.800">{preselectedUser.name}</Text>
                            {preselectedUser.email && <Text fontSize="xs" color="neutral.500">{preselectedUser.email}</Text>}
                        </VStack>
                        <Lock size={16} color="var(--chakra-colors-neutral-500)" />
                    </HStack>
                </FormControl>
              )}

              <FormControl>
                <FormLabel>Description (optional)</FormLabel>
                <Textarea
                  placeholder="Add a personal message..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Duration</FormLabel>
                <Select value={durationPreset} onChange={(e) => setDurationPreset(e.target.value as DurationPreset)}>
                  <option value="weekly">Weekly Challenge (7 days)</option>
                  <option value="monthly">Monthly Challenge (30 days)</option>
                </Select>
              </FormControl>

              {/* How Challenges Work */}
              <Box bg="brand.50" p={4} borderRadius="lg" borderWidth="1px" borderColor="brand.100">
                <HStack spacing={3} mb={2}>
                  <Trophy size={20} color="var(--chakra-colors-brand-700)" />
                  <Text fontWeight="semibold" color="brand.800">How Challenges Work</Text>
                </HStack>
                <VStack align="stretch" spacing={1} fontSize="sm" color="brand.700">
                  {challengeType === 'competitive' ? (
                    <>
                      <Text>• The person with the most points at the end wins.</Text>
                      <Text>• Winners receive bonus XP and bragging rights.</Text>
                    </>
                  ) : (
                    <>
                      <Text>• Work together towards a shared goal.</Text>
                      <Text>• Both participants earn bonus XP if the goal is reached.</Text>
                    </>
                  )}
                   <Text>• The challenged person must accept to start.</Text>
                </VStack>
              </Box>

              {/* Duration Display */}
              <Box bg="neutral.50" p={4} borderRadius="lg" borderWidth="1px" borderColor="neutral.200">
                <Text fontWeight="medium" mb={2}>Challenge Duration</Text>
                <HStack justify="space-between">
                  <Text>Starts:</Text>
                  <Text fontWeight="semibold">{formatDate(startDate)}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text>Ends:</Text>
                  <Text fontWeight="semibold">{formatDate(endDate)}</Text>
                </HStack>
              </Box>
            </VStack>
          )}
        </ModalBody>
        <ModalFooter borderTopWidth="1px" borderColor="neutral.200" gap={3}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="brand"
            isLoading={loading}
            onClick={handleCreateChallenge}
            isDisabled={!selectedUserId && !preselectedUser}
          >
            Send Challenge
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};