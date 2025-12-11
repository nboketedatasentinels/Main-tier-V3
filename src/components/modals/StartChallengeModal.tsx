import React, { useState } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  VStack,
  FormControl,
  FormLabel,
  Select,
  Input,
  Textarea,
  HStack,
  Badge,
} from '@chakra-ui/react'
import { Sword } from 'lucide-react'

export interface ChallengeConfig {
  opponent: string
  duration: string
  wager: string
  focus: string
  kickoff: string
}

interface StartChallengeModalProps {
  isOpen: boolean
  opponents: string[]
  onClose: () => void
  onCreate: (config: ChallengeConfig) => void
}

export const StartChallengeModal: React.FC<StartChallengeModalProps> = ({ isOpen, opponents, onClose, onCreate }) => {
  const [config, setConfig] = useState<ChallengeConfig>({
    opponent: opponents[0] || '',
    duration: '7 days',
    wager: '',
    focus: 'Consistency',
    kickoff: new Date().toISOString().slice(0, 10),
  })

  const handleCreate = () => {
    onCreate(config)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader display="flex" alignItems="center" gap={2}>
          <Sword size={18} />
          Start a challenge
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <Text color="brand.subtleText">Select an opponent and set the stakes for your next battle.</Text>

            <FormControl>
              <FormLabel>Opponent</FormLabel>
              <Select
                value={config.opponent}
                onChange={e => setConfig(prev => ({ ...prev, opponent: e.target.value }))}
                placeholder="Choose a peer"
              >
                {opponents.map(name => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>Focus</FormLabel>
              <Select value={config.focus} onChange={e => setConfig(prev => ({ ...prev, focus: e.target.value }))}>
                <option value="Consistency">Consistency</option>
                <option value="Learning">Learning</option>
                <option value="Impact">Impact</option>
                <option value="Wellness">Wellness</option>
              </Select>
            </FormControl>

            <HStack spacing={4} align="flex-start">
              <FormControl>
                <FormLabel>Duration</FormLabel>
                <Select value={config.duration} onChange={e => setConfig(prev => ({ ...prev, duration: e.target.value }))}>
                  <option value="7 days">7 days</option>
                  <option value="14 days">14 days</option>
                  <option value="30 days">30 days</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Kickoff</FormLabel>
                <Input
                  type="date"
                  value={config.kickoff}
                  onChange={e => setConfig(prev => ({ ...prev, kickoff: e.target.value }))}
                />
              </FormControl>
            </HStack>

            <FormControl>
              <FormLabel>What are the stakes?</FormLabel>
              <Textarea
                placeholder="Loser buys coffee or shares a learning session..."
                value={config.wager}
                onChange={e => setConfig(prev => ({ ...prev, wager: e.target.value }))}
              />
            </FormControl>

            <HStack spacing={3} color="brand.subtleText" fontSize="sm">
              <Badge colorScheme="purple">New Battle</Badge>
              <Text>We'll refresh your challenge list once you create this battle.</Text>
            </HStack>
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="purple" onClick={handleCreate} isDisabled={!config.opponent}>
            Create battle
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
