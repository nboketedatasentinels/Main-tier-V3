import React, { useState } from 'react'
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  VStack,
} from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Users } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { claimPartnerAccess } from '@/services/supabaseOrgService'
import { getFriendlyErrorMessage } from '@/utils/authErrors'

/**
 * Partner signup/signin. No company code (a partner can manage several orgs).
 * A partner can only get in if an admin has assigned their email to an
 * organization - claimPartnerAccess promotes + links them, or rejects them.
 */
export const PartnerSignupPage: React.FC = () => {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signup' | 'signin'>('signup')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const finishClaim = async () => {
    // Ensure the profile row exists BEFORE claiming. A fresh signup can reach
    // here before the provisioning trigger has created the row, and
    // claim_partner_access UPDATEs profiles.role - with no row the role is never
    // set, so the partner lands on /unauthorized. Create the row first (same as
    // the admin signup fix); claim_partner_access then promotes the real row.
    const { data: sessionData } = await supabase.auth.getUser()
    if (sessionData.user) {
      await supabase
        .from('profiles')
        .upsert(
          { id: sessionData.user.id, email: sessionData.user.email },
          { onConflict: 'id', ignoreDuplicates: true },
        )
    }
    const result = await claimPartnerAccess()
    if (result === 'ok') {
      // Full reload so the session re-reads the freshly-granted partner role.
      // (A client-side navigate hits the role guard before the new role has
      // propagated, causing "Access denied" on the first try.)
      window.location.assign('/partner/dashboard')
      return
    }
    // Not assigned (or error): block - sign them out and explain.
    await supabase.auth.signOut()
    setError(
      result === 'not_assigned'
        ? 'This email has not been assigned to any organization. Ask your admin to assign you as a partner, then sign up again.'
        : 'Could not verify your partner access. Please try again.',
    )
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    setLoading(true)
    try {
      const normalizedEmail = email.trim().toLowerCase()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/partner-signup`,
          data: { full_name: fullName.trim() || normalizedEmail.split('@')[0] },
        },
      })
      if (signUpError) {
        if (/already|registered|exists/i.test(signUpError.message)) {
          setMode('signin')
          setInfo('You already have an account. Sign in below to activate partner access.')
          return
        }
        setError(getFriendlyErrorMessage(signUpError))
        return
      }
      if (data.session) {
        await finishClaim()
        return
      }
      setMode('signin')
      setInfo('Account created. If a confirmation email was sent, confirm it first, then sign in below.')
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
        setError(getFriendlyErrorMessage(signInError))
        return
      }
      await finishClaim()
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
    <Box minH="100vh" bg="white">
      <Box as="header" w="full" bg="#27062e">
        <Box mx="auto" maxW="6xl" px={{ base: 4, sm: 6 }} py={4}>
          <Box as="button" onClick={() => navigate('/partners')} display="flex" alignItems="center" gap={2.5}>
            <img src="/t4.png" alt="" style={{ height: 36, width: 36, borderRadius: '9999px', objectFit: 'cover' }} />
            <Box as="span" fontWeight="extrabold" letterSpacing="wide" color="#eab130" fontSize="sm">
              TRANSFORMATION <Box as="span" color="#f9db59">LEADER</Box>
            </Box>
          </Box>
        </Box>
      </Box>

      <Container maxW="md" py={{ base: 8, md: 12 }}>
        <VStack spacing={6} align="stretch">
          <VStack spacing={1}>
            <Users size={28} color="#350e6f" />
            <Text fontSize="2xl" fontWeight="bold" color="text.primary">
              Partner access
            </Text>
            <Text fontSize="sm" color="text.secondary" textAlign="center">
              {mode === 'signin'
                ? 'Sign in to activate your partner access.'
                : 'Create your partner account. Your email must be assigned to an organization by an admin.'}
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

          {mode === 'signup' ? (
            <form onSubmit={handleSignup}>
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel color="text.primary">Full name</FormLabel>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel color="text.primary">Email</FormLabel>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@org.com" />
                </FormControl>
                {passwordField}
                <Button type="submit" variant="primary" size="lg" isLoading={loading} loadingText="Creating...">
                  Create partner account
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setMode('signin'); setError(null); setInfo(null) }}>
                  Already have an account? Sign in
                </Button>
              </VStack>
            </form>
          ) : (
            <form onSubmit={handleSignin}>
              <VStack spacing={4} align="stretch">
                <FormControl isRequired>
                  <FormLabel color="text.primary">Email</FormLabel>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@org.com" />
                </FormControl>
                {passwordField}
                <Button type="submit" variant="primary" size="lg" isLoading={loading} loadingText="Signing in...">
                  Sign in
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setMode('signup'); setError(null); setInfo(null) }}>
                  Back to sign up
                </Button>
              </VStack>
            </form>
          )}
        </VStack>
      </Container>
    </Box>
  )
}

export default PartnerSignupPage
