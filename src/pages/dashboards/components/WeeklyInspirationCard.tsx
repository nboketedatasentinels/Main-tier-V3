import { Card, CardBody, Text, VStack } from '@chakra-ui/react';
import React from 'react';

interface WeeklyInspirationCardProps {
  quote: string;
  author: string;
}

export const WeeklyInspirationCard: React.FC<WeeklyInspirationCardProps> = ({ quote, author }) => {
  return (
    <Card bg="brand.royalPurple" color="white">
      <CardBody>
        <VStack spacing={4} align="start">
          <Text fontSize="lg" fontStyle="italic">"{quote}"</Text>
          <Text fontWeight="bold" alignSelf="flex-end">- {author}</Text>
        </VStack>
      </CardBody>
    </Card>
  );
};
