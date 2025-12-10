import React from 'react'
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { ArrowRight, CheckCircle2, PlayCircle, Shield, Sparkles } from 'lucide-react'
import { Link as RouterLink } from 'react-router-dom'

const StatCard = ({ title, value }: { title: string; value: string }) => (
  <VStack
    spacing={1}
    align="flex-start"
    bg="white"
    p={5}
    borderRadius="lg"
    boxShadow="md"
    border="1px solid"
    borderColor="rgba(23, 18, 67, 0.08)"
  >
    <Text fontSize="sm" color="#4b5563" fontWeight="semibold">
      {title}
    </Text>
    <Text fontSize="3xl" fontWeight="bold" color="#111827">
      {value}
    </Text>
  </VStack>
)

const FeatureCard = ({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ElementType
  title: string
  description: string
  color: string
}) => (
  <Stack direction="row" spacing={4} align="flex-start">
    <Flex
      boxSize={10}
      align="center"
      justify="center"
      borderRadius="full"
      bg={`${color}10`}
      color={color}
    >
      <Icon as={icon} />
    </Flex>
    <Box>
      <Text fontWeight="bold" color="#111827">
        {title}
      </Text>
      <Text color="#4b5563">{description}</Text>
    </Box>
  </Stack>
)

export const HomePage: React.FC = () => {
  return (
    <Box bg="#f8f7ff" minH="100vh" color="#111827">
      <Box position="absolute" inset={0} overflow="hidden" pointerEvents="none">
        <Box
          position="absolute"
          w="500px"
          h="500px"
          top="-120px"
          left="-160px"
          bgGradient="radial-gradient(circle, #f5d0fe, #f8f7ff)"
          filter="blur(40px)"
        />
        <Box
          position="absolute"
          w="600px"
          h="600px"
          bottom="-200px"
          right="-220px"
          bgGradient="radial-gradient(circle, #fef08a, #f8f7ff)"
          filter="blur(50px)"
        />
      </Box>

      <Container maxW="6xl" py={12} position="relative">
        <Flex justify="space-between" align="center" mb={12}>
          <Stack spacing={3}>
            <HStack spacing={3}>
              <Flex align="center" justify="center" bg="white" borderRadius="full" p={3} boxShadow="md">
                <Text fontSize="lg" fontWeight="bold" color="#111827">
                  T4L
                </Text>
              </Flex>
              <Text fontWeight="bold" color="#111827" fontSize="lg">
                Transformation 4 Leaders
              </Text>
            </HStack>
            <HStack spacing={3}>
              <Icon as={CheckCircle2} color="#8b5cf6" />
              <Text color="#4b5563" fontWeight="medium">
                CPD-Accredited Training
              </Text>
            </HStack>
          </Stack>
          <Button
            as={RouterLink}
            to="/login"
            variant="outline"
            colorScheme="purple"
            borderColor="#7c3aed"
            color="#7c3aed"
            rightIcon={<ArrowRight size={18} />}
          >
            Sign In
          </Button>
        </Flex>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10} alignItems="center">
          <VStack spacing={8} align="flex-start">
            <HStack spacing={3} bg="white" borderRadius="full" px={4} py={2} boxShadow="md">
              <Flex boxSize={6} align="center" justify="center">
                <Icon as={PlayCircle} color="#f59e0b" />
              </Flex>
              <Text fontSize="sm" fontWeight="semibold" color="#4b5563">
                CPD-Accredited Training
              </Text>
            </HStack>

            <Heading
              as="h1"
              fontSize={{ base: '3xl', md: '4xl', lg: '5xl' }}
              lineHeight="shorter"
              color="#111827"
            >
              Digital Transformation Doesn't Happen Alone.
              <Text as="span" display="block">
                Even Beyoncé Has a Team.
              </Text>
            </Heading>

            <Text fontSize="lg" color="#4b5563">
              Our gamified, CPD-accredited platform gives your team the skills, coaching, and (loving-but-firm)
              accountability to lead real change—without burning out or boring everyone to death.
            </Text>

            <Button
              as={RouterLink}
              to="/signup"
              size="lg"
              colorScheme="purple"
              rightIcon={<ArrowRight />}
              px={8}
            >
              Get Started (+50 XP)
            </Button>

            <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4} w="full">
              <StatCard title="Improved completion" value="+198%" />
              <StatCard title="Boosted confidence" value="+292%" />
              <StatCard title="Reduced regrets" value="-81%" />
            </SimpleGrid>

            <Stack direction={{ base: 'column', sm: 'row' }} spacing={6} pt={4} w="full">
              <FeatureCard
                icon={Sparkles}
                title="100% gamified journeys"
                description="Micro-learning that's built to thrill, not drill"
                color="#8b5cf6"
              />
              <FeatureCard
                icon={Shield}
                title="A.I. + community accountability"
                description="Brutally honest feedback from mentors & peers"
                color="#f59e0b"
              />
              <FeatureCard
                icon={CheckCircle2}
                title="Built-in habit formation"
                description="Daily streaks, XP, and rewards that make behavior stick"
                color="#06b6d4"
              />
            </Stack>
          </VStack>

          <VStack spacing={4} align="stretch">
            <Box bg="white" borderRadius="2xl" boxShadow="xl" overflow="hidden" border="1px solid #ede9fe">
              <Box bg="#fef3c7" px={6} py={4} borderBottom="1px solid #fcd34d">
                <Text fontWeight="bold" color="#92400e">
                  For changemakers who are ready to lead transformation, not just talk about it.
                </Text>
              </Box>
              <VStack align="stretch" spacing={6} p={6}>
                <HStack spacing={4} align="flex-start">
                  <Flex boxSize={10} borderRadius="md" bg="#e0e7ff" align="center" justify="center" color="#4338ca">
                    <Icon as={Sparkles} />
                  </Flex>
                  <Box>
                    <Text fontWeight="bold" color="#111827">
                      Upskill on digital leadership
                    </Text>
                    <Text color="#4b5563">Structured pathways that make complex change stick</Text>
                  </Box>
                </HStack>

                <HStack spacing={4} align="flex-start">
                  <Flex boxSize={10} borderRadius="md" bg="#ccfbf1" align="center" justify="center" color="#0f766e">
                    <Icon as={CheckCircle2} />
                  </Flex>
                  <Box>
                    <Text fontWeight="bold" color="#111827">
                      Build the habits that prevent failure
                    </Text>
                    <Text color="#4b5563">Daily nudges, streaks, and XP keep teams on track</Text>
                  </Box>
                </HStack>

                <HStack spacing={4} align="flex-start">
                  <Flex boxSize={10} borderRadius="md" bg="#fef3c7" align="center" justify="center" color="#b45309">
                    <Icon as={Shield} />
                  </Flex>
                  <Box>
                    <Text fontWeight="bold" color="#111827">
                      Coach every level of the org at scale
                    </Text>
                    <Text color="#4b5563">Mentors, peer reviews, and AI guidance, all in one place</Text>
                  </Box>
                </HStack>
              </VStack>
            </Box>
          </VStack>
        </SimpleGrid>
      </Container>
    </Box>
  )
}

export default HomePage
