import { useUserBadges } from '@/hooks/useUserBadges';
import { useAuth } from '@/hooks/useAuth';
import { badges as allBadges } from '@/config/badges';
import { Badge } from '@/types/badge';
import {
  Box,
  SimpleGrid,
  Heading,
  Text,
  VStack,
  Image,
  Center,
  Icon,
  Spinner,
  Card,
  CardBody,
  Badge as ChakraBadge,
  Container,
  Divider,
} from '@chakra-ui/react';
import { Award, Lock } from 'lucide-react';
import { format } from 'date-fns';

const BadgeGalleryPage = () => {
  const { profile } = useAuth();
  const { userBadges, loading, error } = useUserBadges();

  if (loading) {
    return (
      <Center h="60vh">
        <VStack spacing={4}>
          <Spinner size="xl" color="brand.primary" thickness="4px" />
          <Text color="brand.subtleText">Loading your achievements...</Text>
        </VStack>
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="60vh">
        <VStack spacing={4}>
          <Icon as={Award} size={48} color="red.400" />
          <Heading size="md">Error loading badge gallery</Heading>
          <Text color="brand.subtleText">Please try again later.</Text>
        </VStack>
      </Center>
    );
  }

  const journeyType = profile?.journeyType;
  const earnedBadgeIds = new Set(userBadges.map((b) => b.id));

  // Filter available badges: only those for the user's journey or universal ones, that haven't been earned yet.
  const availableBadges = allBadges.filter(
    (badge) =>
      (!badge.journeyType || badge.journeyType === journeyType) &&
      !earnedBadgeIds.has(badge.id)
  );

  const BadgeItem = ({ badge, isEarned }: { badge: Badge; isEarned?: boolean }) => (
    <Card
      h="full"
      variant={isEarned ? 'elevated' : 'muted'}
      borderColor={isEarned ? 'brand.gold' : 'border.subtle'}
      transition="all 0.2s"
      _hover={isEarned ? { transform: 'translateY(-4px)', boxShadow: 'lg' } : {}}
    >
      <CardBody>
        <VStack spacing={4} align="center" textAlign="center">
          <Box position="relative">
            <Image
              src={badge.image}
              alt={badge.name}
              boxSize="100px"
              objectFit="contain"
              filter={isEarned ? 'none' : 'grayscale(100%)'}
              opacity={isEarned ? 1 : 0.6}
              fallback={
                <Center boxSize="100px" bg={isEarned ? 'yellow.50' : 'gray.50'} rounded="full">
                  <Icon
                    as={isEarned ? Award : Lock}
                    size={40}
                    color={isEarned ? 'brand.gold' : 'gray.400'}
                  />
                </Center>
              }
            />
          </Box>
          <VStack spacing={1}>
            <Heading size="sm" color="brand.text">
              {badge.name}
            </Heading>
            <Text fontSize="xs" color="brand.subtleText" noOfLines={3}>
              {badge.description}
            </Text>
          </VStack>
          {isEarned ? (
            <VStack spacing={0}>
              <ChakraBadge colorScheme="green" variant="subtle">
                Earned
              </ChakraBadge>
              {badge.earnedAt && (
                <Text fontSize="10px" color="brand.subtleText" mt={1}>
                  {format(new Date(badge.earnedAt), 'MMM d, yyyy')}
                </Text>
              )}
            </VStack>
          ) : (
            <ChakraBadge colorScheme="gray" variant="outline">
              Locked
            </ChakraBadge>
          )}
        </VStack>
      </CardBody>
    </Card>
  );

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={10} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>
            Badge Gallery
          </Heading>
          <Text color="brand.subtleText">
            Track your progress and celebrate your leadership milestones.
          </Text>
        </Box>

        <Box>
          <Heading size="md" mb={6} display="flex" alignItems="center" gap={2}>
            <Icon as={Award} color="brand.gold" />
            Your Achievements ({userBadges.length})
          </Heading>
          {userBadges.length > 0 ? (
            <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6}>
              {userBadges.map((badge) => (
                <BadgeItem key={badge.id} badge={badge} isEarned />
              ))}
            </SimpleGrid>
          ) : (
            <Center p={10} border="1px dashed" borderColor="border.subtle" rounded="xl">
              <VStack spacing={2}>
                <Text color="brand.subtleText">You haven't earned any badges yet.</Text>
                <Text fontSize="sm" color="brand.subtleText">
                  Keep engaging with your activities to unlock them!
                </Text>
              </VStack>
            </Center>
          )}
        </Box>

        <Divider />

        <Box>
          <Heading size="md" mb={6} display="flex" alignItems="center" gap={2}>
            <Icon as={Lock} color="gray.400" />
            Available to Earn
          </Heading>
          {availableBadges.length > 0 ? (
            <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6}>
              {availableBadges.map((badge) => (
                <BadgeItem key={badge.id} badge={badge} />
              ))}
            </SimpleGrid>
          ) : (
            <Center p={10}>
              <Text color="brand.subtleText">You've earned all available badges for your journey! Well done!</Text>
            </Center>
          )}
        </Box>
      </VStack>
    </Container>
  );
};

export default BadgeGalleryPage;
