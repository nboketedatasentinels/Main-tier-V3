import { Card, CardBody, Text, VStack } from '@chakra-ui/react'
import { ReactNode } from 'react'

interface EmptyStateCardProps {
  title: string
  description?: string
  action?: ReactNode
}

export const EmptyStateCard = ({ title, description, action }: EmptyStateCardProps) => {
  return (
    <Card variant="outline" borderColor="brand.border" h="100%">
      <CardBody>
        <VStack spacing={3} align="start">
          <Text fontWeight="bold" color="brand.text">
            {title}
          </Text>
          {description && (
            <Text color="brand.subtleText" fontSize="sm">
              {description}
            </Text>
          )}
          {action}
        </VStack>
      </CardBody>
    </Card>
  )
}
