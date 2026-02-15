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
import {
  getEligibleLearnersForActivity,
  assignActivityToLearner
} from '@/services/partnerAssignmentService';
import { FULL_ACTIVITIES } from '@/config/pointsConfig';
import { UserProfile } from '@/types';

export const PartnerAssignmentPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { assignedOrganizationIds } = usePartnerAdminSnapshot({ enabled: true })
  const toast = useToast();

  const [learners, setLearners] = useState<UserProfile[]>([]);
  const [selectedLearners, setSelectedLearners] = useState<string[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const partnerIssuedActivities = useMemo(
    () => FULL_ACTIVITIES.filter((activity) => activity.approvalType === 'partner_issued'),
    []
  );

  const organizationIds = useMemo(() => {
    if (assignedOrganizationIds.length) return assignedOrganizationIds;
    if (profile?.organizationId) return [profile.organizationId];
    return [];
  }, [assignedOrganizationIds, profile?.organizationId]);

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
      toast({
        title: 'Issue failed',
        description: 'Something went wrong while issuing the activity.',
        status: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLearners = useMemo(() => {
    const normalized = debouncedSearchTerm.toLowerCase();
    if (!normalized) return learners;
    return learners.filter((learner) =>
      learner.fullName.toLowerCase().includes(normalized) ||
      learner.email.toLowerCase().includes(normalized)
    );
  }, [learners, debouncedSearchTerm]);

  const toggleLearner = (id: string) => {
    setSelectedLearners(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

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
            <HStack spacing={4}>
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
                <FormLabel>Target Week</FormLabel>
                <Input
                  type="number"
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(parseInt(e.target.value))}
                />
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
                    <Th width="40px"></Th>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Journey</Th>
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
