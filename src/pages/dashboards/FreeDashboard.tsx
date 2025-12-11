import React, { useState } from 'react'
import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Card,
  CardBody,
  Button,
  VStack,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Textarea,
} from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { DashboardTourStep, useDashboardTour } from '@/hooks/useDashboardTour'

export const FreeDashboard: React.FC = () => {
  const { profile } = useAuth()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [villageName, setVillageName] = useState('')
  const [villagePurpose, setVillagePurpose] = useState('')

  return (
    <Box>
      {announcementNode}
      <HStack
        justify="space-between"
        align={{ base: 'flex-start', md: 'center' }}
        spacing={4}
        mb={4}
        bg="rgba(255, 255, 255, 0.04)"
        border="1px solid"
        borderColor="brand.border"
        borderRadius="lg"
        p={4}
      >
        <VStack align="flex-start" spacing={1}>
          <Text fontWeight="bold" color="brand.softGold">
            Guided tour
          </Text>
          <Text fontSize="sm" color="brand.softGold" opacity={0.85}>
            {isLoading
              ? 'Loading your dashboard tour...'
              : hasCompleted
                ? 'Tour complete — replay to revisit tips.'
                : `Resume from step ${currentStep + 1}.`}
          </Text>
        </VStack>
        <Button
          size="sm"
          variant="outline"
          colorScheme="yellow"
          aria-label="Start dashboard tour"
          onClick={() => startTour(hasCompleted ? 0 : currentStep)}
          isDisabled={isLoading}
        >
          {hasCompleted ? 'Replay tour' : 'Start tour'}
        </Button>
      </HStack>

      {profile?.isOnboarded && !profile?.villageId && (
        <Card mb={8} bg="brand.primaryMuted" border="1px" borderColor="brand.border">
          <CardBody>
            <VStack align="flex-start" spacing={3}>
              <Heading size="md" color="brand.gold">
                Build Your Village
              </Heading>
              <Text color="brand.softGold">
                Rally your peers by creating a village to collaborate and track your collective impact.
              </Text>
              <Button colorScheme="yellow" onClick={onOpen} alignSelf="flex-start">
                Open Build Village
              </Button>
            </VStack>
          </CardBody>
        </Card>
      )}

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.softGold">Total Points</StatLabel>
              <StatNumber color="brand.gold">{profile?.totalPoints || 0}</StatNumber>
              <StatHelpText color="brand.softGold">Keep logging impact!</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.softGold">Level</StatLabel>
              <StatNumber color="brand.gold">{profile?.level || 1}</StatNumber>
              <StatHelpText color="brand.softGold">Earn points to level up</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg="brand.royalPurple" id="free-upgrade-card" aria-label="Upgrade call to action">
          <CardBody>
            <Stat>
              <StatLabel color="brand.softGold">Journey</StatLabel>
              <StatNumber color="brand.gold">Free Tier</StatNumber>
              <StatHelpText color="brand.flameOrange">Upgrade to start a journey!</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader color="brand.gold">Build Your Village</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <Text color="brand.softGold">
                Start a village to bring together peers working on similar goals. Share updates, host events, and celebrate wins.
              </Text>
              <FormControl>
                <FormLabel color="brand.softGold">Village name</FormLabel>
                <Input
                  value={villageName}
                  onChange={(e) => setVillageName(e.target.value)}
                  placeholder="e.g. Impact Innovators"
                  bg="brand.inputBg"
                  borderColor="brand.border"
                />
              </FormControl>
              <FormControl>
                <FormLabel color="brand.softGold">Purpose</FormLabel>
                <Textarea
                  value={villagePurpose}
                  onChange={(e) => setVillagePurpose(e.target.value)}
                  placeholder="Describe what your village will focus on"
                  bg="brand.inputBg"
                  borderColor="brand.border"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose} color="brand.softGold">
              Cancel
            </Button>
            <Button colorScheme="yellow" onClick={onClose} isDisabled={!villageName.trim()}>
              Save Village
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
