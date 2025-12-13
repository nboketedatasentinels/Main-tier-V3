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

export const FreeDashboard: React.FC = () => {
  const { profile } = useAuth()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [villageName, setVillageName] = useState('')
  const [villagePurpose, setVillagePurpose] = useState('')

  return (
    <Box>
      {!profile?.villageId && (
        <Card mb={8} bg="brand.primaryMuted" border="1px" borderColor="brand.border">
          <CardBody>
            <VStack align="flex-start" spacing={3}>
              <Heading size="md" color="brand.text">
                Build Your Village
              </Heading>
              <Text color="brand.text">
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
              <StatLabel color="brand.textOnDark">Total Points</StatLabel>
              <StatNumber color="white">{profile?.totalPoints || 0}</StatNumber>
              <StatHelpText color="brand.textOnDark">Keep logging impact!</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.textOnDark">Level</StatLabel>
              <StatNumber color="white">{profile?.level || 1}</StatNumber>
              <StatHelpText color="brand.textOnDark">Earn points to level up</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg="brand.royalPurple" aria-label="Upgrade call to action">
          <CardBody>
            <Stat>
              <StatLabel color="brand.textOnDark">Journey</StatLabel>
              <StatNumber color="white">Free Tier</StatNumber>
              <StatHelpText color="brand.flameOrange">Upgrade to start a journey!</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader color="brand.text">Build Your Village</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <Text color="brand.text">
                Start a village to bring together peers working on similar goals. Share updates, host events, and celebrate wins.
              </Text>
              <FormControl>
                <FormLabel color="brand.text">Village name</FormLabel>
                <Input
                  value={villageName}
                  onChange={(e) => setVillageName(e.target.value)}
                  placeholder="e.g. Impact Innovators"
                  bg="white"
                  borderColor="brand.border"
                />
              </FormControl>
              <FormControl>
                <FormLabel color="brand.text">Purpose</FormLabel>
                <Textarea
                  value={villagePurpose}
                  onChange={(e) => setVillagePurpose(e.target.value)}
                  placeholder="Describe what your village will focus on"
                  bg="white"
                  borderColor="brand.border"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose} color="brand.text">
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
