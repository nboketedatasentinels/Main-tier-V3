import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  AlertIcon,
  Button,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputRightElement,
  IconButton,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { claimAdminAccess } from '@/services/adminAccessService'
import { useAuth } from '@/hooks/useAuth'
import { getFriendlyErrorMessage } from '@/utils/authErrors'

export const AdminSignupPage: React.FC = () => {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const alreadySignedIn = Boolean(user?.uid)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const grantAndRedirect = async (code: string) => {
    const result = await claimAdminAccess(code.trim())
    if (result === 'ok') {
      await refreshProfile({ reason: 'admin-access-claim', isManual: true })
      toast({ title: 'Admin access granted', status: 'success', duration: 3000 })
      navigate('/admin/dashboard', { replace: true })
      return true
    }
    if (result === 'invalid_code') {
      setError('That access code is not valid.')
    } else if (result === 'unauthenticated') {
      setError('You must be signed in to activate admin access.')
    } else {
      setError('Could not grant admin access. Please try again.')
    }
    return false
  }

  // Already-signed-in users: just enter the code to activate admin.
  const handleClaim = async () => {
    setError(null)
    if (!accessCode.trim()) {
      setError('Please enter the access code.')
      return
    }
    setLoading(true)
    try {
      await grantAndRedirect(accessCode)
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!email.trim() || !password || !accessCode.trim()) {
      setError('Email, password, and access code are all required.')
      return
    }
    setLoading(true)
    try {
      const normalizedEmail = email.trim().toLowerCase()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/admin-signup`,
          data: { full_name: email.trim().split('@')[0] },
        },
      })

      if (signUpError) {
        // Account already exists (e.g. they confirmed their email and came back):
        // sign in with the same credentials, then activate admin.
        if (/already|registered|exists/i.test(signUpError.message)) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          })
          if (signInError) {
            setError(
              /confirm/i.test(signInError.message)
                ? 'Please confirm your email first (check your inbox), then submit again to finish.'
                : getFriendlyErrorMessage(signInError),
            )
            return
          }
          await grantAndRedirect(accessCode)
          return
        }
        setError(getFriendlyErrorMessage(signUpError))
        return
      }

      if (data.session) {
        // Email confirmation OFF: we have a session, activate immediately.
        await grantAndRedirect(accessCode)
        return
      }

      // Email confirmation ON and brand-new account: must confirm first.
      setInfo(
        'Account created. Check your email and click the confirmation link, then submit this form again to finish activating admin access.',
      )
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <VStack spacing={6} align="stretch">
      <VStack spacing={1}>
        <ShieldCheck size={28} color="#350e6f" />
        <Text fontSize="2xl" fontWeight="bold" color="text.primary">
          Admin Access
        </Text>
        <Text fontSize="sm" color="text.secondary" textAlign="center">
          {alreadySignedIn
            ? 'Enter the admin access code to activate admin access on your account.'
            : 'Sign up with the shared admin access code to become an administrator.'}
        </Text>
      </VStack>

      {error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          {error}
        </Alert>
      )}
      {info && (
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          {info}
        </Alert>
      )}

      {alreadySignedIn ? (
        <VStack spacing={4} align="stretch">
          <FormControl isRequired>
            <FormLabel color="text.primary">Access code</FormLabel>
            <Input
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Enter admin access code"
            />
          </FormControl>
          <Button variant="primary" size="lg" onClick={handleClaim} isLoading={loading} loadingText="Activating...">
            Activate admin access
          </Button>
        </VStack>
      ) : (
        <form onSubmit={handleSignup}>
          <VStack spacing={4} align="stretch">
            <FormControl isRequired>
              <FormLabel color="text.primary">Email</FormLabel>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@t4leader.com" />
            </FormControl>
            <FormControl isRequired>
              <FormLabel color="text.primary">Password</FormLabel>
              <InputGroup>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  pr="3rem"
                />
                <InputRightElement width="3rem">
                  <IconButton
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    icon={showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword((p) => !p)}
                  />
                </InputRightElement>
              </InputGroup>
            </FormControl>
            <FormControl isRequired>
              <FormLabel color="text.primary">Admin access code</FormLabel>
              <Input
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Enter the shared admin access code"
              />
            </FormControl>
            <Button type="submit" variant="primary" size="lg" isLoading={loading} loadingText="Creating admin...">
              Create admin account
            </Button>
          </VStack>
        </form>
      )}
    </VStack>
  )
}

export default AdminSignupPage
