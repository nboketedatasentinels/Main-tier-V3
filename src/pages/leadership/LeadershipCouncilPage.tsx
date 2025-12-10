import React from 'react'
import { Box, Heading, Text, Stack, List, ListItem, ListIcon } from '@chakra-ui/react'
import { Calendar, UserCheck } from 'lucide-react'

export const LeadershipCouncilPage: React.FC = () => {
  return (
    <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="brand.border" boxShadow="sm">
      <Stack spacing={4}>
        <Heading size="md" color="brand.text">
          Leadership Council
        </Heading>
        <Text color="brand.subtleText">
          Upcoming council initiatives and member resources will be organized here.
        </Text>
        <List spacing={3} color="brand.subtleText">
          <ListItem>
            <ListIcon as={Calendar} color="#5d6bff" /> Next council meeting schedule
          </ListItem>
          <ListItem>
            <ListIcon as={UserCheck} color="#5d6bff" /> Member directory with profiles
          </ListItem>
        </List>
      </Stack>
    </Box>
  )
}
