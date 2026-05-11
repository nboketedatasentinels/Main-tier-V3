import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  useToast,
  VStack,
  Text,
  Checkbox,
  useColorModeValue,
} from '@chakra-ui/react';
import { useAuth } from '@/hooks/useAuth';
import { usePartnerAdminSnapshot } from '@/hooks/partner/usePartnerAdminSnapshot';
import { usePartnerSelectedOrg } from '@/hooks/partner/usePartnerSelectedOrg';
import {
  getEligibleLearnersForActivity,
  assignActivityToLearner
} from '@/services/partnerAssignmentService';
import {
  getActivitiesForJourney,
  type JourneyType,
} from '@/config/pointsConfig';
import { UserProfile } from '@/types';

const JOURNEY_OPTIONS: { value: JourneyType; label: string }[] = [
  { value: '4W', label: '4-Week Intro' },
  { value: '6W', label: '6-Week Power' },
  { value: '3M', label: '3-Month' },
  { value: '6M', label: '6-Month' },
  { value: '9M', label: '9-Month' },
];

export const PartnerAssignmentPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { assignedOrganizationIds } = usePartnerAdminSnapshot({ enabled: true })
  const { selectedOrg: urlSelectedOrg } = usePartnerSelectedOrg();
  const toast = useToast();

  const [learners, setLearners] = useState<UserProfile[]>([]);
  const [selectedLearners, setSelectedLearners] = useState<string[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [journeyType, setJourneyType] = useState<JourneyType>('6W');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const partnerIssuedActivities = useMemo(
    () =>
      getActivitiesForJourney(journeyType).filter(
        (activity) => activity.approvalType === 'partner_issued' && activity.id !== 'book_club'
      ),
    [journeyType]
  );

  // Honor the org dropdown that's shared across /partner/* via ?org=<id>.
  // When an org is explicitly selected (URL param set, not 'all'), narrow
  // the learner pool to ONLY that org so a partner managing multiple
  // companies sees data for the one they currently picked. When 'all' or
  // unset, fall through to every assigned org.
  const organizationIds = useMemo(() => {
    const allAssigned = assignedOrganizationIds.length
      ? assignedOrganizationIds
      : (profile?.organizationId ? [profile.organizationId] : []);
    if (urlSelectedOrg && urlSelectedOrg !== 'all') {
      const scoped = allAssigned.filter((id) => id === urlSelectedOrg);
      // If the URL points at an org the partner isn't assigned to, fall back
      // to the full assigned list rather than render an empty page silently.
      return scoped.length ? scoped : allAssigned;
    }
    return allAssigned;
  }, [assignedOrganizationIds, profile?.organizationId, urlSelectedOrg]);

  useEffect(() => {
    const loadLearners = async () => {
      try {
        const data = await getEligibleLearnersForActivity('', organizationIds);
        setLearners(data);
      } catch (error) {
        console.error(error);
      }
    };
    if (organizationIds.length) {
      loadLearners();
    } else {
      setLearners([]);
    }
  }, [organizationIds]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    setSelectedActivity('');
    setSelectedLearners([]);
  }, [journeyType]);

  const handleAssign = async () => {
    if (!selectedActivity || selectedLearners.length === 0) {
      toast({
        title: 'Selection required',
        description: 'Please select an activity and at least one learner.',
        status: 'warning'
      });
      return;
    }

    if (!user?.uid) {
      toast({
        title: 'Sign-in required',
        description: 'Your session is missing identity context. Please sign out and sign back in.',
        status: 'error',
      });
      return;
    }

    setLoading(true);
    try {
      await Promise.all(
        selectedLearners.map(learnerId =>
          assignActivityToLearner({
            partnerId: user.uid,
            learnerId,
            activityId: selectedActivity,
            weekNumber
          })
        )
      );

      toast({
        title: 'Issue successful',
        description: `Activity issued to ${selectedLearners.length} learners.`,
        status: 'success'
      });
      setSelectedLearners([]);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error && error.message
        ? error.message
        : 'Something went wrong while issuing the activity.';
      toast({
        title: 'Issue failed',
        description: message,
        status: 'error',
        duration: 9000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLearners = useMemo(() => {
    const normalized = debouncedSearchTerm.toLowerCase();
    const byJourney = learners.filter(
      (learner) => (learner.journeyType ?? '6W') === journeyType
    );
    if (!normalized) return byJourney;
    return byJourney.filter((learner) =>
      learner.fullName.toLowerCase().includes(normalized) ||
      learner.email.toLowerCase().includes(normalized)
    );
  }, [learners, debouncedSearchTerm, journeyType]);

  const toggleLearner = (id: string) => {
    setSelectedLearners(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLearners.length === filteredLearners.length) {
      setSelectedLearners([]);
    } else {
      setSelectedLearners(filteredLearners.map(l => l.id));
    }
  };

  const isAllSelected = filteredLearners.length > 0 && selectedLearners.length === filteredLearners.length;

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('border.control', 'gray.700');

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading size="lg">Partner Activity Issuing</Heading>
          <Text color="gray.500">Issue partner-issued activities so learners can complete them in their weekly checklist.</Text>
        </Box>

        <Box p={6} bg={bgColor} borderRadius="lg" border="1px" borderColor={borderColor}>
          <VStack spacing={6} align="stretch">
            <HStack spacing={4} align="flex-end">
              <FormControl maxW="220px">
                <FormLabel>Journey</FormLabel>
                <Select
                  value={journeyType}
                  onChange={(e) => setJourneyType(e.target.value as JourneyType)}
                >
                  {JOURNEY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Select Activity</FormLabel>
                <Select
                  placeholder="Choose activity"
                  value={selectedActivity}
                  onChange={(e) => setSelectedActivity(e.target.value)}
                >
                  {partnerIssuedActivities.length > 0 ? (
                    partnerIssuedActivities.map(a => (
                      <option key={a.id} value={a.id}>{a.title} ({a.points} pts)</option>
                    ))
                  ) : (
                    <option disabled>No partner-issued activities defined</option>
                  )}
                </Select>
              </FormControl>

              <FormControl maxW="200px">
                <FormLabel>Week</FormLabel>
                <Select
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(parseInt(e.target.value))}
                >
                  {Array.from({ length: 18 }, (_, i) => i + 1).map((week) => (
                    <option key={week} value={week}>
                      Week {week}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </HStack>

            <FormControl>
              <FormLabel>Search Learners</FormLabel>
              <Input
                placeholder="Name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </FormControl>

            <Box overflowX="auto">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>
                      <Checkbox
                        isChecked={isAllSelected}
                        isIndeterminate={selectedLearners.length > 0 && selectedLearners.length < filteredLearners.length}
                        onChange={toggleSelectAll}
                      >
                        Select All
                      </Checkbox>
                    </Th>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Journey</Th>
                    <Th>Points</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredLearners.map(l => (
                    <Tr key={l.id}>
                      <Td>
                        <Checkbox
                          isChecked={selectedLearners.includes(l.id)}
                          onChange={() => toggleLearner(l.id)}
                        />
                      </Td>
                      <Td>{l.fullName}</Td>
                      <Td>{l.email}</Td>
                      <Td>{l.journeyType}</Td>
                      <Td>{(l.totalPoints ?? 0).toLocaleString()}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>

            <Button
              colorScheme="blue"
              onClick={handleAssign}
              isLoading={loading}
              isDisabled={selectedLearners.length === 0 || !selectedActivity || !user?.uid}
            >
              Issue Activity to {selectedLearners.length} Learners
            </Button>
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
};

export default PartnerAssignmentPage;
