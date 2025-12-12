import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { UserRole } from '@/types'

interface FreeTierGuardProps {
  children: React.ReactNode
  fallbackPath: string
  title?: string
  description?: string
  blockedRoles?: UserRole[]
}

export const FreeTierGuard: React.FC<FreeTierGuardProps> = ({
  children,
  fallbackPath,
  title = 'Upgrade required',
  description = 'This area is available on paid plans. Upgrade to continue.',
  blockedRoles = [UserRole.FREE_USER],
}) => {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const hasHandledAccess = useRef(false)

  useEffect(() => {
    if (!profile || hasHandledAccess.current) return

    if (blockedRoles.includes(profile.role)) {
      hasHandledAccess.current = true
      toast({
        title,
        description,
        status: 'info',
        duration: 4000,
        isClosable: true,
      })
      navigate(fallbackPath, { replace: true })
    }
  }, [blockedRoles, description, fallbackPath, navigate, profile, title, toast])

  if (profile && blockedRoles.includes(profile.role)) {
    return null
  }

  return <>{children}</>
}
