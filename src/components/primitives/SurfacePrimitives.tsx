import { Box, Text, type BoxProps, type TextProps } from '@chakra-ui/react'
import React from 'react'

type SurfaceCardProps = React.PropsWithChildren<{
  variant?: 'default' | 'muted' | 'elevated'
  borderAccent?: string
}> &
  BoxProps

export const SurfaceCard: React.FC<SurfaceCardProps> = ({
  children,
  variant = 'default',
  borderAccent,
  ...boxProps
}) => {
  const bg = variant === 'muted' ? 'surface.subtle' : 'surface.default'
  const shadow = variant === 'elevated' ? 'card-elevated' : 'card'

  return (
    <Box
      bg={bg}
      border="1px solid"
      borderColor={borderAccent ?? 'border.subtle'}
      borderRadius="xl"
      boxShadow={shadow}
      p={4}
      {...boxProps}
    >
      {children}
    </Box>
  )
}

export const MutedText: React.FC<TextProps> = (props) => <Text color="text.muted" {...props} />

export const SubtleText: React.FC<TextProps> = (props) => <Text color="text.secondary" {...props} />
