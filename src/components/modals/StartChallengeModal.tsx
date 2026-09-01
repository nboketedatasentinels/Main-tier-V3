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
import { Swords, Users, Trophy, User, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getOrgScope } from '@/utils/organizationScope';
import { listOrgPeers } from '@/services/supabasePeerService';
import {
  createChallenge,
  listChallengeBusyUserIds,
} from '@/services/supabaseChallengeService';
import { getDisplayName } from '@/utils/displayName';
import { getVillageMembers } from '@/services/villageService';
import type { UserProfile } from '@/types';


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
  points: number;
  recommended: boolean;
  /** Already in a pending/active challenge — not selectable. */
  busy: boolean;
}

type ChallengeType = 'competitive' | 'collaborative';
type OpponentFilter = 'suggested' | 'all';
type DurationPreset = 'weekly' | 'monthly';

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

  const { user, profile } = useAuth();

  // --- DATA FETCHING ---
  const buildUserOptions = (members: Record<string, unknown>[], busyIds: Set<string>) => {
    return members.map((member) => {
      const p = member as unknown as UserProfile;
      return {
        id: p.id,
        name: getDisplayName(p, 'Member'),
        email: p.email,
        points: p.totalPoints || 0,
        recommended: false,
        busy: busyIds.has(p.id),
      };
    });
  };

  const fetchPotentialOpponents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const orgScope = getOrgScope(profile);
      const busyIds = await listChallengeBusyUserIds();
      let userOptions: UserOption[] = [];

      if (orgScope.isValid) {
        const members = await listOrgPeers();
        userOptions = buildUserOptions(members, busyIds);
      } else if (profile?.villageId) {
        const villageMembers = await getVillageMembers(profile.villageId);
        const villageOptions = buildUserOptions(
          villageMembers.filter((member) => member.id !== user.uid),
          busyIds,
        );
        userOptions = villageOptions;
      } else {
        setUsers([]);
        setError('You have to be a part of an organisation to start a challenge');
        return;
      }

      const selectable = userOptions.filter((u) => !u.busy);
      if (userOptions.length === 0) {
        setError('No users available to challenge right now.');
      } else if (selectable.length === 0) {
        setError('Everyone available already has a challenge this week. Try again later.');
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
      sortedUsers.sort((a, b) => b.points - a.points);
      sortedUsers = sortedUsers.map((u, i) => ({ ...u, recommended: i < 3 }));
    } else { // 'all'
      sortedUsers.sort((a, b) => a.name.localeCompare(b.name));
    }
    setFilteredUsers(sortedUsers);
  }, [users, opponentFilter]);

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
  // Creates via Supabase RPC (0040). Points are NOT awarded here - they land
  // only after the challenge week ends and the challenge was accepted/completed.
  const handleCreateChallenge = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      const challengedUserId = preselectedUser ? preselectedUser.id : selectedUserId;
      if (!challengedUserId || !user) {
        throw new Error('User data is missing.');
      }

      await createChallenge({
        challengedId: challengedUserId,
        type: challengeType,
        duration: durationPreset,
        description: description.trim() || undefined,
        customGoal: challengeType === 'collaborative' ? customGoal.trim() || undefined : undefined,
      });

      setSuccess(true);
      setTimeout(() => {
        onChallengeCreated();
        onClose();
        resetForm();
      }, 2000);
    } catch (err) {
      console.error('[Challenge] Error creating challenge:', err);
      setError(err instanceof Error ? err.message : 'Failed to create challenge.');
    } finally {
      setLoading(false);
    }
  };

  // --- EFFECTS ---
  useEffect(() => {
    if (isOpen) {
      if (preselectedUser) {
        setSelectedUserId(preselectedUser.id);
        void (async () => {
          const busyIds = await listChallengeBusyUserIds();
          if (busyIds.has(preselectedUser.id)) {
            setError(
              'This person already has a challenge this week. Choose someone who is free.',
            );
            setSelectedUserId(null);
          }
        })();
      } else {
        fetchPotentialOpponents();
      }
    } else {
      // Reset form when modal closes
      setTimeout(() => resetForm(), 300); // Delay to allow animation
    }
  }, [isOpen, preselectedUser, fetchPotentialOpponents]);

  useEffect(() => {
    applyOpponentFilter();
  }, [users, opponentFilter, applyOpponentFilter]);


  // --- DERIVED STATE & CONSTANTS ---
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  const getEndDate = () => {
    const end = new Date(startDate);
    if (durationPreset === 'weekly') {
      end.setDate(end.getDate() + 7);
    } else {
      end.setDate(end.getDate() + 30);
    }
    end.setHours(23, 59, 59, 999);
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
          <Text mt={2} fontSize="sm" color="neutral.600" fontWeight="normal">
            7 days. We count points each of you gains during the challenge — not lifetime totals. Only
            the winner earns Challenger checklist points.
          </Text>
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
                          cursor={u.busy ? 'not-allowed' : 'pointer'}
                          opacity={u.busy ? 0.55 : 1}
                          bg={selectedUserId === u.id ? 'brand.50' : 'transparent'}
                          _hover={u.busy ? undefined : { bg: 'neutral.50' }}
                          onClick={() => {
                            if (u.busy) return;
                            setSelectedUserId(u.id);
                          }}
                          justifyContent="space-between"
                        >
                          <HStack>
                            <Radio
                              isChecked={selectedUserId === u.id}
                              isDisabled={u.busy}
                              readOnly
                            />
                            <VStack align="flex-start" spacing={0} ml={3}>
                              <HStack>
                                <Text fontWeight="medium" color="neutral.800">{u.name}</Text>
                                {u.recommended && !u.busy && (
                                  <Badge colorScheme="yellow">Recommended</Badge>
                                )}
                                {u.busy && (
                                  <Badge colorScheme="gray">In a challenge</Badge>
                                )}
                              </HStack>
                              <Text fontSize="xs" color="neutral.500">
                                {u.busy
                                  ? 'Already paired this week — pick someone free'
                                  : u.email}
                              </Text>
                            </VStack>
                          </HStack>
                          <VStack align="flex-end" spacing={0}>
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
                  <Text>• Earn points by completing your Weekly Checklist.</Text>
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
            isDisabled={(!selectedUserId && !preselectedUser) || Boolean(error && preselectedUser && !selectedUserId)}
          >
            Send Challenge
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
