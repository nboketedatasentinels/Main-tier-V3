
import { HStack, Text, Heading } from '@chakra-ui/react'
import { SurfaceCard } from '@/components/primitives/SurfacePrimitives'

interface StatCardProps {
  label: string
  value: string
  icon: React.ReactNode
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon }) => (
  <SurfaceCard borderColor="gray.700" borderRadius="lg" bg="white">
    <HStack justify="space-between" mb={1}>
      <Text color="#273240" fontSize="sm">
        {label}
      </Text>
      {icon}
    </HStack>
    <Heading size="md" color="#273240">
      {value}
    </Heading>
  </SurfaceCard>
)
