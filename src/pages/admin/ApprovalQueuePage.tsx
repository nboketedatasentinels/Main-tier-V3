import React, { useEffect, useState } from 'react';
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Textarea,
  useDisclosure,
  useToast,
  Checkbox,
  Badge,
  HStack,
  Select,
} from '@chakra-ui/react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { approveRequest, rejectRequest, bulkApproveRequests } from '@/services/approvalsService';
import { ApprovalRecord } from '@/types/approvals';
import { useAuth } from '@/hooks/useAuth';

const ApprovalQueuePage: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ApprovalRecord[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    const q = query(collection(db, 'approvals'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const approvalRequests: ApprovalRecord[] = [];
        querySnapshot.forEach((doc) => {
          approvalRequests.push({ id: doc.id, ...doc.data() } as ApprovalRecord);
        });
        setRequests(approvalRequests);
      },
      (error) => {
        console.error('[ApprovalQueuePage] Error loading approval queue:', error);
        toast({
          title: 'Unable to load approval queue',
          description: 'Please check your connection and refresh the page.',
          status: 'error',
        });
        setRequests([]);
      }
    );

    return () => unsubscribe();
  }, [toast]);

  const handleApprove = async (approvalId: string) => {
    if (!user) return;
    try {
      await approveRequest(approvalId, user.uid);
      toast({
        title: 'Request approved.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error approving request.',
        description: (error as Error).message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const openRejectModal = (request: ApprovalRecord) => {
    setSelectedRequest(request);
    onOpen();
  };

  const handleReject = async () => {
    if (!selectedRequest || !user) return;
    try {
      await rejectRequest(selectedRequest.id, user.uid, rejectionReason);
      toast({
        title: 'Request rejected.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onClose();
      setRejectionReason('');
    } catch (error) {
      toast({
        title: 'Error rejecting request.',
        description: (error as Error).message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRequests(requests.map((r) => r.id));
    } else {
      setSelectedRequests([]);
    }
  };

  const handleSelect = (approvalId: string) => {
    setSelectedRequests((prev) =>
      prev.includes(approvalId)
        ? prev.filter((id) => id !== approvalId)
        : [...prev, approvalId]
    );
  };

  const handleBulkApprove = async () => {
    if (!user) return;
    try {
      await bulkApproveRequests(selectedRequests, user.uid);
      toast({
        title: 'Bulk approval successful.',
        description: `${selectedRequests.length} requests approved.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      setSelectedRequests([]);
    } catch (error) {
      toast({
        title: 'Error in bulk approval.',
        description: (error as Error).message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const filteredRequests = requests.filter(r => {
    if (filterType === 'all') return true;
    if (filterType === 'partner_issued') return r.approvalType === 'partner_issued' || r.type === 'partner_issued';
    if (filterType === 'partner_approved') return r.approvalType === 'partner_approved' || r.type === 'points_verification';
    return true;
  });

  return (
    <Box>
      <Heading mb={4}>Approval Queue</Heading>
      <HStack mb={4} spacing={4}>
        <Button
          colorScheme="blue"
          onClick={handleBulkApprove}
          isDisabled={selectedRequests.length === 0}
        >
          Bulk Approve ({selectedRequests.length})
        </Button>
        <Select
          maxW="200px"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">All Types</option>
          <option value="partner_approved">Partner Approved</option>
          <option value="partner_issued">Partner Issued</option>
        </Select>
      </HStack>
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>
              <Checkbox
                isChecked={selectedRequests.length === requests.length && requests.length > 0}
                onChange={handleSelectAll}
              />
            </Th>
            <Th>User ID</Th>
            <Th>Type</Th>
            <Th>Title</Th>
            <Th>Points</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {filteredRequests.map((request) => (
            <Tr key={request.id}>
              <Td>
                <Checkbox
                  isChecked={selectedRequests.includes(request.id)}
                  onChange={() => handleSelect(request.id)}
                />
              </Td>
              <Td>{request.userId}</Td>
              <Td>
                <Badge colorScheme={request.approvalType === 'partner_issued' || request.type === 'partner_issued' ? 'blue' : 'purple'}>
                  {request.approvalType === 'partner_issued' || request.type === 'partner_issued' ? 'Partner Issued' : 'Partner Approved'}
                </Badge>
              </Td>
              <Td>{request.title}</Td>
              <Td>{request.points}</Td>
              <Td>
                <Button colorScheme="green" size="sm" onClick={() => handleApprove(request.id)}>
                  Approve
                </Button>
                <Button colorScheme="red" size="sm" ml={2} onClick={() => openRejectModal(request)}>
                  Reject
                </Button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Reject Request</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Textarea
              placeholder="Enter rejection reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="red" onClick={handleReject} isDisabled={!rejectionReason}>
              Reject
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ApprovalQueuePage;
