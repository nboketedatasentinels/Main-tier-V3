import React, { useEffect, useRef, useState } from 'react'
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

const PENDING_CODE_KEY = 't4l.pendingAdminCode'

export const AdminSignupPage: React.FC = () => {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const alreadySignedIn = Boolean(user?.uid)

  // 'signup' = create account; 'signin' = confirm-then-sign-in to activate
  const [mode, setMode] = useState<'signup' | 'signin'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const autoClaimedRef = useRef(false)

  const grantAndRedirect = async (code: string): Promise<boolean> => {
    const result = await claimAdminAccess(code.trim())
    if (result === 'ok') {
      sessionStorage.removeItem(PENDING_CODE_KEY)
      await refreshProfile({ reason: 'admin-access-claim', isManual: true })
      toast({ title: 'Admin access granted', status: 'success', duration: 3000 })
      navigate('/admin/dashboard', { replace: true })
      return true
    }
    setError(
      result === 'invalid_code'
        ? 'That access code is not valid. Check the exact code (it is case-sensitive).'
        : 'Could not grant admin access. Please try again.',
    )
    return false
  }

  // If they return already signed in (e.g. after clicking the email link) and a
  // code is pending, activate admin automatically.
  useEffect(() => {
    if (!alreadySignedIn || autoClaimedRef.current) return
    const pending = sessionStorage.getItem(PENDING_CODE_KEY)
    if (!pending) return
    autoClaimedRef.current = true
    void (async () => {
      setLoading(true)
      try {
        await grantAndRedirect(pending)
      } catch (err) {
        setError(getFriendlyErrorMessage(err))
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadySignedIn])

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
      sessionStorage.setItem(PENDING_CODE_KEY, accessCode.trim())

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/admin-signup`,
          data: { full_name: email.trim().split('@')[0] },
        },
      })

      if (signUpError) {
        if (/already|registered|exists/i.test(signUpError.message)) {
          setMode('signin')
          setInfo('You already have an account. Sign in below to activate admin access.')
          return
        }
        setError(getFriendlyErrorMessage(signUpError))
        return
      }

      // Confirmation OFF -> we have a session -> activate now (one step).
      if (data.session) {
        await grantAndRedirect(accessCode)
        return
      }

      // Confirmation ON -> must confirm email, then sign in to activate.
      setMode('signin')
      setInfo(
        'Account created successfully. If a confirmation email was sent, click the link in it first - then sign in below with your email and password to finish.',
      )
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (signInError) {
        setError(
          /confirm/i.test(signInError.message)
            ? 'Please confirm your email first (check your inbox), then sign in again.'
            : getFriendlyErrorMessage(signInError),
        )
        return
      }
      const code = accessCode.trim() || sessionStorage.getItem(PENDING_CODE_KEY) || ''
      await grantAndRedirect(code)
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

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

  const passwordField = (
    <FormControl isRequired>
      <FormLabel color="text.primary">Password</FormLabel>
      <InputGroup>
        <Input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
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
  )

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
            : mode === 'signin'
              ? 'Sign in to finish activating your admin access.'
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
        <Alert status="success" borderRadius="md">
          <AlertIcon />
          {info}
        </Alert>
      )}

      {alreadySignedIn ? (
        <VStack spacing={4} align="stretch">
          <FormControl isRequired>
            <FormLabel color="text.primary">Access code</FormLabel>
            <Input value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Enter admin access code" />
          </FormControl>
          <Button variant="primary" size="lg" onClick={handleClaim} isLoading={loading} loadingText="Activating...">
            Activate admin access
          </Button>
        </VStack>
      ) : mode === 'signin' ? (
        <form onSubmit={handleSignin}>
          <VStack spacing={4} align="stretch">
            <FormControl isRequired>
              <FormLabel color="text.primary">Email</FormLabel>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@t4leader.com" />
            </FormControl>
            {passwordField}
            <Button type="submit" variant="primary" size="lg" isLoading={loading} loadingText="Signing in...">
              Sign in and go to dashboard
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setMode('signup'); setError(null); setInfo(null) }}>
              Back to sign up
            </Button>
          </VStack>
        </form>
      ) : (
        <form onSubmit={handleSignup}>
          <VStack spacing={4} align="stretch">
            <FormControl isRequired>
              <FormLabel color="text.primary">Email</FormLabel>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@t4leader.com" />
            </FormControl>
            {passwordField}
            <FormControl isRequired>
              <FormLabel color="text.primary">Admin access code</FormLabel>
              <Input value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Enter the shared admin access code" />
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
