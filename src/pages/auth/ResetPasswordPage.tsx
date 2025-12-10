import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@chakra-ui/react'
import T4LAuthScreen from '@/components/ui/T4LAuthCard'
import { useAuth } from '@/hooks/useAuth'
import { mapFirebaseAuthError } from '@/utils/auth'

export const ResetPasswordPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const { resetPassword } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const handleReset = async (values: { email: string }) => {
    setServerError(null)
    setSuccessMessage(null)
    setLoading(true)
    const { error } = await resetPassword(values.email)
    setLoading(false)

    if (error) {
      const friendlyMessage = mapFirebaseAuthError((error as { code?: string }).code)
      setServerError(friendlyMessage)
      toast({
        title: 'Unable to send reset link',
        description: friendlyMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return { error: friendlyMessage }
    }

    const success = 'Check your email for a link to reset your password.'
    setSuccessMessage(success)
    toast({
      title: 'Reset email sent',
      description: success,
      status: 'success',
      duration: 5000,
    })

    return { error: undefined }
  }

  return (
    <T4LAuthScreen
      mode="reset"
      loading={loading}
      serverError={serverError}
      successMessage={successMessage}
      onSubmit={handleReset}
      onNavigateToSignIn={() => navigate('/login')}
    />
  )
}
