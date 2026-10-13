import React from 'react'
import { Badge } from '@chakra-ui/react'
import type { CourseAccessInfo } from '@/utils/courseAccess'

/** "Free" or "Paid · $49.00", with "included" when the learner already has access. */
export const CourseAccessBadge: React.FC<{ access: CourseAccessInfo; included?: boolean }> = ({
  access,
  included = false,
}) => {
  const isFree = access.type === 'free'
  const label = isFree
    ? 'Free'
    : `Paid${access.priceLabel ? ` · ${access.priceLabel}` : ''}${included ? ' · included' : ''}`
  return (
    <Badge
      bg={isFree ? 'green.50' : 'orange.50'}
      color={isFree ? 'green.700' : 'orange.800'}
      border="1px solid"
      borderColor={isFree ? 'green.200' : 'orange.200'}
      textTransform="none"
      fontSize="2xs"
      fontWeight="semibold"
      px={2}
      py={0.5}
      borderRadius="full"
      w="fit-content"
    >
      {label}
    </Badge>
  )
}
