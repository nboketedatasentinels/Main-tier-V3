import React, { useEffect, useMemo, useState } from "react"
import { Link as RouterLink, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Eye, EyeOff, ArrowRight, User, Mail, Lock, Building2, CheckCircle, XCircle, MailCheck } from "lucide-react"
import { Spinner, useToast } from "@chakra-ui/react"
import { sendEmailVerification } from "firebase/auth"
import { useAuth } from "@/hooks/useAuth"
import { getFriendlyErrorMessage } from "@/utils/authErrors"
import { validateCompanyCode } from "@/services/organizationService"
import { auth } from "@/services/firebase"
import { GenderOption, Organization, UserRole } from "@/types"
import { getLandingPathForRole } from "@/utils/roleRouting"
import { TermsOfUseModal } from "@/components/modals/TermsOfUseModal"
import { PrivacyPolicyModal } from "@/components/modals/PrivacyPolicyModal"
import { GoogleIcon } from "@/components/icons/GoogleIcon"
import { CompanyCodeModal } from "@/components/modals/CompanyCodeModal"

interface FormData {
  fullName: string
  gender: GenderOption
  email: string
  password: string
  confirmPassword: string
  companyCode: string
  acceptTerms: boolean
}

export const SignUpPage: React.FC = () => {
  const navigate = useNavigate()
  const { signUp, signInWithGoogle, profile } = useAuth()
  const toast = useToast()

  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    gender: "prefer_not_to_say",
    email: "",
    password: "",
    confirmPassword: "",
    companyCode: "",
    acceptTerms: false,
  })

  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [companyCodeValid, setCompanyCodeValid] = useState<boolean | null>(null)
  const [companyCodeError, setCompanyCodeError] = useState<string | null>(null)
  const [isCheckingCode, setIsCheckingCode] = useState(false)
  const [validatedOrganization, setValidatedOrganization] = useState<Organization | null>(null)
  const [pendingEmailVerification, setPendingEmailVerification] = useState(false)
  const [lastVerificationSent, setLastVerificationSent] = useState<number | null>(null)
  const [resendLoading, setResendLoading] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [showCompanyCodeModal, setShowCompanyCodeModal] = useState(false)
  const [pendingGoogleNavigation, setPendingGoogleNavigation] = useState(false)

  const nameParts = useMemo(() => {
    const parts = formData.fullName.trim().split(/\s+/).filter(Boolean)
    return {
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" ") || "",
    }
  }, [formData.fullName])

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    const code = formData.companyCode.trim()

    if (!code) {
      setCompanyCodeValid(null)
      setCompanyCodeError(null)
      setValidatedOrganization(null)
      setIsCheckingCode(false)
      return
    }

    if (code.length !== 6) {
      setCompanyCodeValid(null)
      setCompanyCodeError(null)
      setValidatedOrganization(null)
      setIsCheckingCode(false)
      return
    }

    let cancelled = false
    setIsCheckingCode(true)

    validateCompanyCode(code).then(result => {
      if (cancelled) return

      setCompanyCodeValid(result.valid)
      setCompanyCodeError(result.error ?? null)
      setValidatedOrganization(result.valid && result.organization ? result.organization : null)
      setIsCheckingCode(false)
    })

    return () => {
      cancelled = true
    }
  }, [formData.companyCode])

  const validate = () => {
    if (!formData.fullName.trim()) return "Full name is required."

    const email = formData.email.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!email) return "Email is required."
    if (!emailRegex.test(email)) return "Please enter a valid email address."
    if (formData.password.length < 8) return "Password must be at least 8 characters."
    if (formData.password !== formData.confirmPassword) return "Passwords do not match."

    if (formData.companyCode.trim()) {
      if (formData.companyCode.trim().length !== 6) return "Company code must be 6 characters."
      if (companyCodeValid === false) return "Company code is invalid or inactive."
      if (companyCodeValid === null || isCheckingCode) return "Please wait while we verify the company code."
    }

    if (!formData.acceptTerms) return "You must accept the Terms of Use and Privacy Policy."

    return null
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const { firstName, lastName } = nameParts
      const email = formData.email.trim().toLowerCase()

      const { error: signUpError, userId } = await signUp(email, formData.password, {
        firstName: firstName || "User",
        lastName,
        fullName: formData.fullName.trim(),
        gender: formData.gender !== "prefer_not_to_say" ? formData.gender : undefined,
        companyCode:
          formData.companyCode.trim() && companyCodeValid ? formData.companyCode.trim() : undefined,
        companyId: validatedOrganization?.id,
        companyName: validatedOrganization?.name,
      })

      if (signUpError) {
        setError(getFriendlyErrorMessage(signUpError))
        return
      }

      toast({
        title: "Account created!",
        description:
          "Please check your email to verify your account. You can still access the dashboard while we verify your email.",
        status: "success",
        duration: 7000,
      })
      if (userId) {
        localStorage.setItem(`t4l.newUserWelcome.${userId}`, "pending")
      }

      const currentUser = auth.currentUser
      if (currentUser && !currentUser.emailVerified) {
        setPendingEmailVerification(true)
        setSuccessMessage("We sent a verification link to your email.")
        setLastVerificationSent(Date.now())
        return
      }

      navigate(getLandingPathForRole(profile ?? UserRole.FREE_USER), { replace: true })
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!pendingGoogleNavigation || profileLoading) return
    if (!user || !profile) return
    if (showCompanyCodeModal) return
    setPendingGoogleNavigation(false)
    navigate(getLandingPathForRole(profile ?? UserRole.FREE_USER), { replace: true })
  }, [pendingGoogleNavigation, profileLoading, profile, showCompanyCodeModal, navigate, user])

  const handleGoogleSignUp = async () => {
    setError(null)
    setGoogleError(null)
    setGoogleLoading(true)
    const { error: googleAuthError, isNewUser, linked } = await signInWithGoogle()
    if (googleAuthError) {
      const friendlyMessage = getFriendlyErrorMessage(googleAuthError)
      setGoogleError(friendlyMessage)
      toast({
        title: "Google sign-in failed",
        description: friendlyMessage,
        status: "error",
        duration: 5000,
      })
      setGoogleLoading(false)
      return
    }

    toast({
      title: linked ? "Accounts linked" : "Welcome!",
      description: linked
        ? "Your Google account has been linked to your existing profile."
        : "Signed in with Google successfully.",
      status: "success",
      duration: 4000,
    })

    if (isNewUser) {
      setShowCompanyCodeModal(true)
    }
    setPendingGoogleNavigation(true)
    setGoogleLoading(false)
  }

  const handleResendEmail = async () => {
    setError(null)
    setSuccessMessage(null)

    if (lastVerificationSent && Date.now() - lastVerificationSent < 30000) {
      setError("Please wait 30 seconds before requesting another email.")
      return
    }

    try {
      setResendLoading(true)
      const currentUser = auth.currentUser
      if (!currentUser) {
        setError("No user found for verification. Please sign in again.")
        return
      }

      await sendEmailVerification(currentUser)
      setSuccessMessage("Confirmation email sent! Check your inbox.")
      setLastVerificationSent(Date.now())
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
    } finally {
      setResendLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setError(null)
    setSuccessMessage(null)

    if (!formData.acceptTerms) {
      setError("You must accept the Terms of Use and Privacy Policy.")
      return
    }

    setGoogleLoading(true)
    try {
      const { error: googleError, isNewUser, redirect } = await signInWithGoogle()
      if (googleError) {
        setError(getFriendlyErrorMessage(googleError))
        return
      }

      if (redirect) {
        return
      }

      const currentUser = auth.currentUser
      if (currentUser?.uid && isNewUser) {
        localStorage.setItem(`t4l.newUserWelcome.${currentUser.uid}`, "pending")
      }

      toast({
        title: "Signed in with Google!",
        description: "Welcome to Man-Tier.",
        status: "success",
        duration: 5000,
      })
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
    } finally {
      setGoogleLoading(false)
    }
  }

  if (pendingEmailVerification) {
    return (
      <div className="w-full">
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-50">
            <MailCheck className="h-6 w-6 text-[#350e6f]" />
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Check Your Email</h1>
          <p className="mt-2 text-sm text-gray-600">
            We sent a verification link to <span className="font-semibold text-gray-900">{formData.email}</span>
          </p>

          <div className="mt-6 space-y-3">
            <div className="rounded-lg border bg-gray-50 px-4 py-3 text-sm text-gray-600">
              If you don't see it in a few minutes, check your spam folder.
            </div>

            <button
              type="button"
              onClick={handleResendEmail}
              disabled={resendLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-60"
            >
              {resendLoading ? "Sending..." : "Resend Confirmation Email"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#350e6f] to-[#27062e] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
            >
              Back to Sign In
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSignUp} className="space-y-5">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Create account</h1>
          <p className="mt-1 text-sm text-gray-600">Start your transformation journey.</p>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={googleLoading}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-60"
        >
          <GoogleIcon />
          {googleLoading ? "Connecting Google..." : "Continue with Google"}
        </button>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="h-px flex-1 bg-gray-200" />
          <span>or sign up with email</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={formData.fullName}
              onChange={e => handleChange("fullName", e.target.value)}
              placeholder="John Doe"
              autoComplete="name"
              className="h-10 w-full rounded-md border bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#350e6f]"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Gender (optional)</label>
          <select
            value={formData.gender}
            onChange={e => handleChange("gender", e.target.value as GenderOption)}
            className="h-10 w-full rounded-md border bg-gray-50 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#350e6f]"
          >
            <option value="prefer_not_to_say">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non_binary">Non-binary</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="email"
              value={formData.email}
              onChange={e => handleChange("email", e.target.value.toLowerCase())}
              placeholder="your@email.com"
              autoComplete="email"
              className="h-10 w-full rounded-md border bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#350e6f]"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Company Code (optional)</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={formData.companyCode}
              onChange={e => handleChange("companyCode", e.target.value.slice(0, 6))}
              placeholder="6-digit code"
              maxLength={6}
              className="h-10 w-full rounded-md border bg-gray-50 pl-9 pr-3 text-sm uppercase tracking-widest text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#350e6f]"
            />
          </div>
          {isCheckingCode && (
            <div className="mt-2 inline-flex items-center gap-2 text-sm text-gray-600 transition-all">
              <Spinner size="xs" />
              <span>Verifying code...</span>
            </div>
          )}
          {companyCodeValid && validatedOrganization && !isCheckingCode && (
            <div className="mt-2 inline-flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />
              <span>Valid company code ({validatedOrganization.name})</span>
            </div>
          )}
          {companyCodeValid === false && !isCheckingCode && (
            <div className="mt-2 inline-flex items-center gap-2 text-sm text-red-700">
              <XCircle className="h-4 w-4" />
              <span>{companyCodeError || "Invalid or inactive company code"}</span>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={e => handleChange("password", e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              minLength={8}
              className="h-10 w-full rounded-md border bg-gray-50 pl-9 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#350e6f]"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">Minimum 8 characters.</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Confirm password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={formData.confirmPassword}
              onChange={e => handleChange("confirmPassword", e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="h-10 w-full rounded-md border bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#350e6f]"
              required
            />
          </div>
        </div>

        <div className="flex items-start gap-2">
          <input
            id="acceptTerms"
            type="checkbox"
            checked={formData.acceptTerms}
            onChange={e => handleChange("acceptTerms", e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-[#350e6f] focus:ring-[#350e6f]"
            required
          />
          <label htmlFor="acceptTerms" className="text-sm text-gray-700">
            I accept the{" "}
            <button
              type="button"
              onClick={() => setShowTermsModal(true)}
              className="font-semibold text-[#350e6f] hover:underline"
            >
              Terms of Use
            </button>{" "}
            and{" "}
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="font-semibold text-[#350e6f] hover:underline"
            >
              Privacy Policy
            </button>
          </label>
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          disabled={loading}
          type="submit"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#350e6f] to-[#27062e] text-white text-sm font-medium shadow-sm hover:opacity-95 disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Sign Up"}
          <ArrowRight className="h-4 w-4" />
        </motion.button>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <RouterLink to="/login" className="font-semibold text-[#350e6f] hover:underline">
            Sign In
          </RouterLink>
        </p>
      </form>

      <TermsOfUseModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => {
          setShowTermsModal(false)
          setFormData(prev => ({ ...prev, acceptTerms: true }))
        }}
      />

      <PrivacyPolicyModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />

      <CompanyCodeModal
        isOpen={showCompanyCodeModal}
        onClose={() => setShowCompanyCodeModal(false)}
        onSkip={() => setShowCompanyCodeModal(false)}
        onSuccess={() => setShowCompanyCodeModal(false)}
      />
    </div>
  )
}
