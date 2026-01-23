import { useUserBadges } from '@/hooks/useUserBadges';
import { useNavigate } from 'react-router-dom';
import { Box, Text, Button, Spinner, VStack, HStack, Center, Icon, Image } from '@chakra-ui/react';
import { Award, ChevronRight } from 'lucide-react';

const BadgeDisplay = () => {
  const { userBadges, loading, error } = useUserBadges();
  const navigate = useNavigate();

  if (loading) {
    return (
      <Center py={4}>
        <Spinner size="sm" color="brand.primary" />
      </Center>
    );
  }

  if (error) {
    return (
      <Text fontSize="sm" color="red.500">
        Error loading badges. Please try again later.
      </Text>
    );
  }

  if (userBadges.length === 0) {
    return (
      <VStack spacing={2} py={2} align="start">
        <HStack spacing={2}>
          <Center w="32px" h="32px" bg="gray.100" rounded="lg">
            <Icon as={Award} size={16} color="gray.400" />
          </Center>
          <Box>
            <Text fontSize="sm" color="brand.subtleText">
              No badges earned yet
            </Text>
            <Button
              size="xs"
              variant="ghost"
              color="brand.primary"
              rightIcon={<ChevronRight size={12} />}
              onClick={() => navigate('/app/journeys')}
              p={0}
              h="auto"
              _hover={{ textDecoration: 'underline' }}
            >
              Start earning badges
            </Button>
          </Box>
        </HStack>
      </VStack>
    );
  }

  return (
    <Box>
      <HStack spacing={3} flexWrap="wrap">
        {userBadges.slice(0, 6).map((badge) => (
          <VStack key={badge.id} spacing={1} w="60px">
            <Image
              src={badge.image}
              alt={badge.name}
              boxSize="48px"
              objectFit="contain"
              fallback={
                <Center w="48px" h="48px" bg="yellow.100" rounded="lg">
                  <Icon as={Award} size={20} color="yellow.600" />
                </Center>
              }
            />
            <Text fontSize="xs" fontWeight="medium" textAlign="center" noOfLines={1}>
              {badge.name}
            </Text>
          </VStack>
        ))}
      </HStack>
      {userBadges.length > 6 && (
        <Button
          size="xs"
          variant="ghost"
          color="brand.primary"
          mt={2}
          onClick={() => navigate('/app/achievements')}
          rightIcon={<ChevronRight size={12} />}
        >
          View all {userBadges.length} badges
        </Button>
      )}
    </Box>
  );
};

export default BadgeDisplay;
