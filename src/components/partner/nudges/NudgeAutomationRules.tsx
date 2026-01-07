import React from 'react'
import {
  Badge,
  Box,
  Button,
  HStack,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  VStack,
} from '@chakra-ui/react'

export const NudgeAutomationRules: React.FC = () => {
  return (
    <Stack spacing={4}>
      <HStack justify="space-between" align="center">
        <VStack align="flex-start" spacing={1}>
          <Text fontWeight="bold" color="brand.text">Automated nudge rules</Text>
          <Text fontSize="sm" color="brand.subtleText">Configure triggers and quiet hours for automation.</Text>
        </VStack>
        <Button size="sm" colorScheme="purple">Add rule</Button>
      </HStack>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
        {[
          { id: 'rule-1', label: '7 days inactive', template: 'Initial Outreach', active: true },
          { id: 'rule-2', label: 'Critical risk reached', template: 'Critical Alert', active: false },
        ].map((rule) => (
          <Box key={rule.id} border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
            <Stack spacing={3}>
              <HStack justify="space-between" align="center">
                <Text fontWeight="semibold">{rule.label}</Text>
                <Switch isChecked={rule.active} colorScheme="purple" />
              </HStack>
              <Text fontSize="sm" color="brand.subtleText">Template: {rule.template}</Text>
              <HStack spacing={3}>
                <Select size="sm" defaultValue="daily">
                  <option value="daily">Daily checks</option>
                  <option value="weekly">Weekly checks</option>
                </Select>
                <Select size="sm" defaultValue="24">
                  <option value="24">Cooldown 24h</option>
                  <option value="48">Cooldown 48h</option>
                </Select>
              </HStack>
              <Badge colorScheme={rule.active ? 'green' : 'gray'}>{rule.active ? 'Active' : 'Paused'}</Badge>
            </Stack>
          </Box>
        ))}
      </SimpleGrid>
    </Stack>
  )
}

export default NudgeAutomationRules
