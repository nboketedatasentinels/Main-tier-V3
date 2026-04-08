
import { HStack, Text, Heading } from '@chakra-ui/react'
import { SurfaceCard } from '@/components/primitives/SurfacePrimitives'

interface StatCardProps {
  label: string
  value: string
  icon: React.ReactNode
  borderColor?: string
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, borderColor = 'gray.200' }) => (
  <SurfaceCard borderWidth="1px" borderStyle="solid" borderColor={borderColor} borderRadius="lg" bg="white" boxShadow="sm">
    <HStack justify="space-between" mb={1}>
      <Text color="text.primary" fontSize="sm">
        {label}
      </Text>
      {icon}
    </HStack>
    <Heading size="md" color="text.primary">
      {value}
    </Heading>
  </SurfaceCard>
)
