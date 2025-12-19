import React, { useState, useEffect } from 'react';
import {
  Box, Button, FormControl, FormLabel, Input, Table, Tbody, Td, Th, Thead, Tr, VStack,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton, useDisclosure, useToast, HStack
} from '@chakra-ui/react';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { InspirationQuote } from '@/types';

export const QuoteManagement: React.FC = () => {
  const [quotes, setQuotes] = useState<InspirationQuote[]>([]);
  const [newQuote, setNewQuote] = useState<Omit<InspirationQuote, 'id'>>({
    week_number: 1,
    quote_text: '',
    author: '',
    category: '',
  });
  const [selectedQuote, setSelectedQuote] = useState<InspirationQuote | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const quotesCollection = collection(db, 'inspiration_quotes');

  const fetchQuotes = async () => {
    const snapshot = await getDocs(quotesCollection);
    const quotesData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as InspirationQuote));
    setQuotes(quotesData.sort((a, b) => a.week_number - b.week_number));
  };

  useEffect(() => {
    fetchQuotes();
  }, []);

  const handleAddQuote = async () => {
    try {
      await addDoc(quotesCollection, newQuote);
      toast({ title: 'Quote added successfully', status: 'success', duration: 3000, isClosable: true });
      setNewQuote({ week_number: 1, quote_text: '', author: '', category: '' });
      fetchQuotes();
    } catch (error) {
      toast({ title: 'Error adding quote', status: 'error', duration: 3000, isClosable: true });
      console.error('Error adding quote:', error);
    }
  };

  const handleUpdateQuote = async () => {
    if (!selectedQuote) return;
    try {
      const quoteDoc = doc(db, 'inspiration_quotes', selectedQuote.id);
      await updateDoc(quoteDoc, {
        week_number: selectedQuote.week_number,
        quote_text: selectedQuote.quote_text,
        author: selectedQuote.author,
        category: selectedQuote.category,
      });
      toast({ title: 'Quote updated successfully', status: 'success', duration: 3000, isClosable: true });
      fetchQuotes();
      onClose();
    } catch (error) {
      toast({ title: 'Error updating quote', status: 'error', duration: 3000, isClosable: true });
      console.error('Error updating quote:', error);
    }
  };

  const handleDeleteQuote = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this quote?')) {
      try {
        const quoteDoc = doc(db, 'inspiration_quotes', id);
        await deleteDoc(quoteDoc);
        toast({ title: 'Quote deleted successfully', status: 'success', duration: 3000, isClosable: true });
        fetchQuotes();
      } catch (error) {
        toast({ title: 'Error deleting quote', status: 'error', duration: 3000, isClosable: true });
        console.error('Error deleting quote:', error);
      }
    }
  };

  const openEditModal = (quote: InspirationQuote) => {
    setSelectedQuote(quote);
    onOpen();
  };

  return (
    <VStack spacing={8} align="stretch">
      <Box>
        <FormControl>
          <FormLabel>Week Number</FormLabel>
          <Input type="number" value={newQuote.week_number} onChange={(e) => setNewQuote({ ...newQuote, week_number: parseInt(e.target.value) })} />
        </FormControl>
        <FormControl>
          <FormLabel>Quote Text</FormLabel>
          <Input value={newQuote.quote_text} onChange={(e) => setNewQuote({ ...newQuote, quote_text: e.target.value })} />
        </FormControl>
        <FormControl>
          <FormLabel>Author</FormLabel>
          <Input value={newQuote.author} onChange={(e) => setNewQuote({ ...newQuote, author: e.target.value })} />
        </FormControl>
        <FormControl>
          <FormLabel>Category</FormLabel>
          <Input value={newQuote.category} onChange={(e) => setNewQuote({ ...newQuote, category: e.target.value })} />
        </FormControl>
        <Button onClick={handleAddQuote} mt={4}>Add Quote</Button>
      </Box>
      <Box>
        <Table>
          <Thead>
            <Tr>
              <Th>Week</Th>
              <Th>Quote</Th>
              <Th>Author</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {quotes.map(quote => (
              <Tr key={quote.id}>
                <Td>{quote.week_number}</Td>
                <Td>{quote.quote_text}</Td>
                <Td>{quote.author}</Td>
                <Td>
                  <HStack spacing={2}>
                    <Button onClick={() => openEditModal(quote)}>Update</Button>
                    <Button onClick={() => handleDeleteQuote(quote.id)}>Delete</Button>
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      {selectedQuote && (
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Edit Quote</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <FormControl>
                <FormLabel>Week Number</FormLabel>
                <Input type="number" value={selectedQuote.week_number} onChange={(e) => setSelectedQuote({ ...selectedQuote, week_number: parseInt(e.target.value) })} />
              </FormControl>
              <FormControl>
                <FormLabel>Quote Text</FormLabel>
                <Input value={selectedQuote.quote_text} onChange={(e) => setSelectedQuote({ ...selectedQuote, quote_text: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Author</FormLabel>
                <Input value={selectedQuote.author} onChange={(e) => setSelectedQuote({ ...selectedQuote, author: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Category</FormLabel>
                <Input value={selectedQuote.category} onChange={(e) => setSelectedQuote({ ...selectedQuote, category: e.target.value })} />
              </FormControl>
            </ModalBody>
            <ModalFooter>
              <Button onClick={handleUpdateQuote}>Save</Button>
              <Button onClick={onClose}>Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </VStack>
  );
};
