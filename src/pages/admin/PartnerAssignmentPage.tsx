import React, { useState, useEffect } from 'react';
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

  const partnerIssuedActivities = FULL_ACTIVITIES.filter(
    a => a.approvalType === 'partner_issued'
  );

  useEffect(() => {
    const loadLearners = async () => {
      try {
        // Partners might only see learners in their assigned organizations
        const organizationIds = assignedOrganizationIds.length
          ? assignedOrganizationIds
          : profile?.organizationId
            ? [profile.organizationId]
            : [];
        const data = await getEligibleLearnersForActivity('', organizationIds);
        setLearners(data);
      } catch (error) {
        console.error(error);
      }
    };
    loadLearners();
  }, [assignedOrganizationIds, profile]);

  const handleAssign = async () => {
    if (!selectedActivity || selectedLearners.length === 0) {
      toast({
        title: 'Selection required',
        description: 'Please select an activity and at least one learner.',
        status: 'warning'
      });
      return;
    }

    setLoading(true);
    try {
      await Promise.all(
        selectedLearners.map(learnerId =>
          assignActivityToLearner({
            partnerId: user?.uid || '',
            learnerId,
            activityId: selectedActivity,
            weekNumber
          })
        )
      );

      toast({
        title: 'Assignment successful',
        description: `Activity assigned to ${selectedLearners.length} learners.`,
        status: 'success'
      });
      setSelectedLearners([]);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Assignment failed',
        description: 'Something went wrong during assignment.',
        status: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLearners = learners.filter(l =>
    l.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleLearner = (id: string) => {
    setSelectedLearners(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading size="lg">Partner Activity Assignment</Heading>
          <Text color="gray.500">Proactively assign activities to learners in your organizations.</Text>
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
              isDisabled={selectedLearners.length === 0 || !selectedActivity}
            >
              Assign Activity to {selectedLearners.length} Learners
            </Button>
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
};

export default PartnerAssignmentPage;
