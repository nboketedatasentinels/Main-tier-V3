import React, { useState } from 'react'
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
} from '@chakra-ui/react'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { resolveRole } from '@/utils/role'
import { getLandingPathForRole } from '@/utils/roleRouting'
import { getFriendlyErrorMessage } from '@/utils/authErrors'

/**
 * Dedicated admin sign-in. Authenticates, then confirms the account actually
 * has an admin role (super_admin or partner) before routing to the admin
 * dashboard. Non-admin accounts are signed back out so an admin session is
 * never left open for a non-admin user.
 */
export const AdminLoginPage: React.FC = () => {
  const { signIn, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }

    setLoading(true)
    try {
      const { error: signInError } = await signIn(email.trim().toLowerCase(), password)
      if (signInError) {
        setError(
          /confirm/i.test(signInError.message)
            ? 'Please confirm your email first (check your inbox), then sign in again.'
            : getFriendlyErrorMessage(signInError),
        )
        return
      }

      // Pull the fresh profile so we can check the role before redirecting.
      const { profile } = await refreshProfile({ reason: 'admin-login', isManual: true })
      const role = resolveRole(profile?.role)

      if (role !== 'super_admin' && role !== 'partner') {
        await signOut()
        setError(
          'This account does not have admin access. Use the regular sign-in page, or sign up with the admin access code.',
        )
        return
      }

      navigate(getLandingPathForRole(profile), { replace: true })
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
          Admin Sign In
        </Text>
        <Text fontSize="sm" color="text.secondary" textAlign="center">
          Sign in to your administrator account.
        </Text>
      </VStack>

      {error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <VStack spacing={4} align="stretch">
          <FormControl isRequired>
            <FormLabel color="text.primary">Email</FormLabel>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@t4leader.com"
            />
          </FormControl>

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

          <Button type="submit" variant="primary" size="lg" isLoading={loading} loadingText="Signing in...">
            Sign in to admin dashboard
          </Button>

          <Text fontSize="sm" color="text.secondary" textAlign="center">
            Need admin access?{' '}
            <Link as={RouterLink} to="/admin-signup" color="brand.500" fontWeight="medium">
              Sign up with the access code
            </Link>
          </Text>
        </VStack>
      </form>
    </VStack>
  )
}

export default AdminLoginPage
