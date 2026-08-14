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
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Sparkles } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { acceptOrgInvitations } from '@/services/supabaseOrgService'
import { getFriendlyErrorMessage } from '@/utils/authErrors'
import { normalizeRole } from '@/utils/role'

/**
 * Coach signup / sign-in (route-driven, same pattern as mentor auth).
 *
 * Live URLs:
 * - https://app.t4leader.com/coach-signup
 * - https://app.t4leader.com/coach-signin
 *
 * Authorization: admin/partner must invite or assign the email as coach
 * (ambassador). Signup then accepts pending org invitations and verifies role.
 */
export const COACH_ACCESS_CODE = 't4l.ds.Coach.2025#'

export const CoachSignupPage: React.FC<{ initialMode?: 'signup' | 'signin' }> = ({
  initialMode = 'signup',
}) => {
  const navigate = useNavigate()
  const location = useLocation()
  const seeded = (location.state as { info?: string; email?: string } | null) ?? null
  const mode = initialMode
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState(seeded?.email ?? '')
  const [password, setPassword] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(seeded?.info ?? null)

  const ensureProfileRow = async () => {
    const { data: sessionData } = await supabase.auth.getUser()
    if (!sessionData.user) return null
    await supabase.from('profiles').upsert(
      {
        id: sessionData.user.id,
        email: sessionData.user.email,
        full_name:
          fullName.trim() ||
          (sessionData.user.user_metadata?.full_name as string | undefined) ||
          sessionData.user.email?.split('@')[0] ||
          null,
      },
      { onConflict: 'id', ignoreDuplicates: false },
    )
    return sessionData.user
  }

  /** Accept pending coach invite (if any) and verify role. */
  const activateCoachAccess = async (): Promise<boolean> => {
    const user = await ensureProfileRow()
    if (!user) {
      setError('Could not verify your session. Please try again.')
      return false
    }

    await acceptOrgInvitations()

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      await supabase.auth.signOut()
      setError('Could not verify coach access. Please try again.')
      return false
    }

    const role = normalizeRole(profile?.role)
    if (role !== 'ambassador' && role !== 'super_admin') {
      await supabase.auth.signOut()
      setError(
        'This email has not been assigned as a coach. Ask your admin or partner to invite you as a coach, then sign up again.',
      )
      return false
    }
    return true
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    if (accessCode.trim() !== COACH_ACCESS_CODE) {
      setError('Invalid coach access code. Please use the code from your invitation email.')
      return
    }
    setLoading(true)
    try {
      const normalizedEmail = email.trim().toLowerCase()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/coach-signin`,
          data: { full_name: fullName.trim() || normalizedEmail.split('@')[0] },
        },
      })
      if (signUpError) {
        if (/already|registered|exists/i.test(signUpError.message)) {
          navigate('/coach-signin', {
            state: {
              info: 'You already have an account. Sign in below to activate coach access.',
              email: normalizedEmail,
            },
          })
          return
        }
        setError(getFriendlyErrorMessage(signUpError))
        return
      }
      if (data.session) {
        const ok = await activateCoachAccess()
        if (ok) {
          await supabase.auth.signOut()
          navigate('/coach-signin', {
            state: {
              info: 'Your coach account is ready. Please sign in to continue.',
              email: normalizedEmail,
            },
          })
        }
        return
      }
      navigate('/coach-signin', {
        state: {
          info: 'Account created. If a confirmation email was sent, confirm it first, then sign in below.',
          email: normalizedEmail,
        },
      })
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
      const ok = await activateCoachAccess()
      if (ok) {
        window.location.assign('/coach/dashboard')
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const passwordField = (
    <FormControl isRequired>
      <FormLabel color="gray.800">Password</FormLabel>
      <InputGroup>
        <Input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          pr="3rem"
          bg="gray.50"
          borderColor="gray.200"
          _focus={{ borderColor: '#350e6f', boxShadow: '0 0 0 1px #350e6f' }}
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
    <Box
      minH="100vh"
      bg="linear-gradient(165deg, #27062e 0%, #350e6f 42%, #1a0a24 100%)"
      position="relative"
      overflow="hidden"
    >
      <Box
        position="absolute"
        inset={0}
        opacity={0.35}
        backgroundImage="radial-gradient(circle at 20% 20%, rgba(234,177,48,0.25), transparent 40%), radial-gradient(circle at 80% 0%, rgba(244,84,12,0.18), transparent 35%)"
        pointerEvents="none"
      />

      <Box as="header" w="full" position="relative" zIndex={1}>
        <Box mx="auto" maxW="6xl" px={{ base: 4, sm: 6 }} py={5}>
          <Box as="button" onClick={() => navigate('/')} display="flex" alignItems="center" gap={2.5}>
            <img
              src="/t4.png"
              alt=""
              style={{ height: 36, width: 36, borderRadius: '9999px', objectFit: 'cover' }}
            />
            <Box as="span" fontWeight="extrabold" letterSpacing="wide" color="#eab130" fontSize="sm">
              TRANSFORM <Box as="span" color="#f9db59">LEADER</Box>
            </Box>
          </Box>
        </Box>
      </Box>

      <Container maxW="md" py={{ base: 10, md: 16 }} position="relative" zIndex={1}>
        <Box
          bg="white"
          borderRadius="2xl"
          boxShadow="0 24px 60px rgba(0,0,0,0.35)"
          px={{ base: 6, md: 8 }}
          py={{ base: 8, md: 10 }}
        >
          <VStack spacing={6} align="stretch">
            <VStack spacing={2}>
              <Box
                w={14}
                h={14}
                borderRadius="full"
                bg="#f3eef8"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Sparkles size={28} color="#350e6f" />
              </Box>
              <Text fontSize="2xl" fontWeight="bold" color="#27062e" letterSpacing="-0.02em">
                {mode === 'signin' ? 'Coach sign in' : 'Coach sign up'}
              </Text>
              <Text fontSize="sm" color="gray.600" textAlign="center" lineHeight="1.6">
                {mode === 'signin'
                  ? 'Sign in to activate your coach access.'
                  : 'Create your coach account. Your email must be invited or assigned as a coach by an admin or partner.'}
              </Text>
            </VStack>

            {error && (
              <Alert status="error" borderRadius="lg">
                <AlertIcon />
                {error}
              </Alert>
            )}
            {info && (
              <Alert status="success" borderRadius="lg">
                <AlertIcon />
                {info}
              </Alert>
            )}

            {mode === 'signup' ? (
              <form onSubmit={handleSignup}>
                <VStack spacing={4} align="stretch">
                  <FormControl>
                    <FormLabel color="gray.800">Full name</FormLabel>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your name"
                      bg="gray.50"
                      borderColor="gray.200"
                      _focus={{ borderColor: '#350e6f', boxShadow: '0 0 0 1px #350e6f' }}
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel color="gray.800">Email</FormLabel>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@org.com"
                      bg="gray.50"
                      borderColor="gray.200"
                      _focus={{ borderColor: '#350e6f', boxShadow: '0 0 0 1px #350e6f' }}
                    />
                  </FormControl>
                  {passwordField}
                  <FormControl isRequired>
                    <FormLabel color="gray.800">Coach access code</FormLabel>
                    <Input
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="Enter your coach access code"
                      bg="gray.50"
                      borderColor="gray.200"
                      _focus={{ borderColor: '#350e6f', boxShadow: '0 0 0 1px #350e6f' }}
                    />
                  </FormControl>
                  <Button
                    type="submit"
                    size="lg"
                    isLoading={loading}
                    loadingText="Creating..."
                    bg="#350e6f"
                    color="white"
                    _hover={{ bg: '#27062e' }}
                    borderRadius="xl"
                  >
                    Create coach account
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/coach-signin')}>
                    Already have an account? Sign in
                  </Button>
                </VStack>
              </form>
            ) : (
              <form onSubmit={handleSignin}>
                <VStack spacing={4} align="stretch">
                  <FormControl isRequired>
                    <FormLabel color="gray.800">Email</FormLabel>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@org.com"
                      bg="gray.50"
                      borderColor="gray.200"
                      _focus={{ borderColor: '#350e6f', boxShadow: '0 0 0 1px #350e6f' }}
                    />
                  </FormControl>
                  {passwordField}
                  <Button
                    type="submit"
                    size="lg"
                    isLoading={loading}
                    loadingText="Signing in..."
                    bg="#350e6f"
                    color="white"
                    _hover={{ bg: '#27062e' }}
                    borderRadius="xl"
                  >
                    Sign in to coach dashboard
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/coach-signup')}>
                    Need an account? Sign up
                  </Button>
                </VStack>
              </form>
            )}
          </VStack>
        </Box>
      </Container>
    </Box>
  )
}

/** @deprecated Prefer CoachSignupPage with initialMode="signin" */
export const CoachSignInPage = () => <CoachSignupPage initialMode="signin" />

export default CoachSignupPage
