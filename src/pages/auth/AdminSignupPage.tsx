import React, { useEffect, useRef, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
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
  Link,
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
  const { user } = useAuth()
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

  // The ONLY admin-claim path. Every entry point (signup, in-page signin,
  // code-only activation, email-link return) funnels through here: claim the
  // code to set the role in the DB, then sign out and send the user to
  // /admin-login. We deliberately never navigate to /admin/dashboard from a
  // freshly-minted session - that session still reflects the pre-admin role, so
  // the requireSuperAdmin guard would bounce the user to /unauthorized. A clean
  // sign-in re-reads the elevated role and passes the guard.
  const claimThenRequireLogin = async (code: string): Promise<void> => {
    // Ensure the profile row exists BEFORE claiming. The claim function only
    // runs `UPDATE profiles SET role='super_admin' WHERE id = auth.uid()`; a
    // fresh signup can reach here before the provisioning trigger has created
    // the row, so the UPDATE would hit zero rows and the role would silently
    // stay 'free_user' (the bug that landed "admins" on the learner dashboard).
    // We cannot set the role from the client (revoked by design), but we CAN
    // create the row - then the claim's UPDATE lands on it.
    const { data: sessionData } = await supabase.auth.getUser()
    const authUser = sessionData.user
    if (authUser) {
      const { error: ensureRowError } = await supabase
        .from('profiles')
        .upsert(
          { id: authUser.id, email: authUser.email },
          { onConflict: 'id', ignoreDuplicates: true },
        )
      if (ensureRowError) {
        setError('Could not prepare your profile. Please try again.')
        return
      }
    }

    const result = await claimAdminAccess(code.trim())
    if (result !== 'ok') {
      setError(
        result === 'invalid_code'
          ? 'That access code is not valid. Check the exact code (it is case-sensitive).'
          : 'Could not grant admin access. Please try again.',
      )
      return
    }
    sessionStorage.removeItem(PENDING_CODE_KEY)
    await supabase.auth.signOut()
    toast({
      title: 'Admin access granted',
      description: 'Please sign in to open your dashboard.',
      status: 'success',
      duration: 5000,
    })
    navigate('/admin-login', { replace: true })
  }

  // If they return already signed in (e.g. after clicking the email link) and a
  // code is pending, activate admin automatically. Form actions set
  // autoClaimedRef first, so this only fires for the genuine email-link return -
  // never as a side effect of submitting the signup/signin forms (which would
  // otherwise race the handler and navigate to /admin/dashboard -> /unauthorized).
  useEffect(() => {
    if (!alreadySignedIn || autoClaimedRef.current) return
    const pending = sessionStorage.getItem(PENDING_CODE_KEY)
    if (!pending) return
    autoClaimedRef.current = true
    void (async () => {
      setLoading(true)
      try {
        await claimThenRequireLogin(pending)
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
    // Claim is driven explicitly below; stop the auto-claim effect from also
    // firing when signUp flips us to signed-in and racing this handler.
    autoClaimedRef.current = true
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

      // Confirmation OFF -> we have a session -> elevate the role, then send the
      // user to sign in (the dashboard is only ever reached after a clean login).
      if (data.session) {
        await claimThenRequireLogin(accessCode)
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
    autoClaimedRef.current = true
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
      await claimThenRequireLogin(code)
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
    autoClaimedRef.current = true
    try {
      await claimThenRequireLogin(accessCode)
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
            <Text fontSize="sm" color="text.secondary" textAlign="center">
              Already an admin?{' '}
              <Link as={RouterLink} to="/admin-login" color="brand.500" fontWeight="medium">
                Sign in here
              </Link>
            </Text>
          </VStack>
        </form>
      )}
    </VStack>
  )
}

export default AdminSignupPage
