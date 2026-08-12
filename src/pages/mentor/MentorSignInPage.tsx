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
import { Eye, EyeOff, GraduationCap } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { getFriendlyErrorMessage } from '@/utils/authErrors'
import { normalizeRole } from '@/utils/role'

/**
 * Dedicated mentor portal sign-in.
 * Live URL: https://app.t4leader.com/mentor-signin
 *
 * Mentors must already have role=mentor on their profile (admin/partner assigned).
 */
export const MentorSignInPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const seeded = (location.state as { info?: string; email?: string } | null) ?? null
  const [email, setEmail] = useState(seeded?.email ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info] = useState<string | null>(seeded?.info ?? null)

  const assertMentorRole = async (): Promise<boolean> => {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user
    if (!user) {
      setError('Could not verify your session. Please try again.')
      return false
    }

    await supabase
      .from('profiles')
      .upsert(
        { id: user.id, email: user.email },
        { onConflict: 'id', ignoreDuplicates: true },
      )

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      await supabase.auth.signOut()
      setError('Could not verify mentor access. Please try again.')
      return false
    }

    const role = normalizeRole(profile?.role)
    if (role !== 'mentor' && role !== 'super_admin') {
      await supabase.auth.signOut()
      setError(
        'This account is not set up as a mentor. Ask your admin or partner to assign you the mentor role, then sign in here.',
      )
      return false
    }
    return true
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
      const ok = await assertMentorRole()
      if (ok) {
        window.location.assign('/mentor/dashboard')
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

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
          <Box
            as="button"
            onClick={() => navigate('/')}
            display="flex"
            alignItems="center"
            gap={2.5}
          >
            <img
              src="/t4.png"
              alt=""
              style={{ height: 36, width: 36, borderRadius: '9999px', objectFit: 'cover' }}
            />
            <Box as="span" fontWeight="extrabold" letterSpacing="wide" color="#eab130" fontSize="sm">
              TRANSFORMATION <Box as="span" color="#f9db59">LEADER</Box>
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
                <GraduationCap size={28} color="#350e6f" />
              </Box>
              <Text fontSize="2xl" fontWeight="bold" color="#27062e" letterSpacing="-0.02em">
                Mentor sign in
              </Text>
              <Text fontSize="sm" color="gray.600" textAlign="center" lineHeight="1.6">
                Access your mentees, session schedule, coaching brief, and end-of-course assessments.
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
                  Sign in to mentor dashboard
                </Button>
                <Text fontSize="xs" color="gray.500" textAlign="center">
                  Mentors only. Partners use{' '}
                  <Box
                    as="button"
                    type="button"
                    color="#350e6f"
                    fontWeight="semibold"
                    onClick={() => navigate('/partner-signin')}
                  >
                    partner sign in
                  </Box>
                  .
                </Text>
              </VStack>
            </form>
          </VStack>
        </Box>
      </Container>
    </Box>
  )
}

export default MentorSignInPage
