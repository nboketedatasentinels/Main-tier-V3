
import { Box } from '@chakra-ui/react'

export const InfoPill: React.FC<{ color: string }> = ({ color }) => (
  <Box w={3} h={3} borderRadius="full" bg={`${color}.300`} />
)
