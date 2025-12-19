import { Card, CardBody, Text, VStack } from '@chakra-ui/react'
import { ReactNode } from 'react'

interface EmptyStateCardProps {
  title: string
  description?: string
  action?: ReactNode
}

export const EmptyStateCard = ({ title, description, action }: EmptyStateCardProps) => {
  return (
    <Card variant="outline" borderColor="border.subtle" h="100%">
      <CardBody>
        <VStack spacing={3} align="start">
          <Text fontWeight="bold" color="text.primary">
            {title}
          </Text>
          {description && (
            <Text color="text.secondary" fontSize="sm">
              {description}
            </Text>
          )}
          {action}
        </VStack>
      </CardBody>
    </Card>
  )
}
