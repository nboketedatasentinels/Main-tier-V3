import React, { useEffect, useMemo, useState } from "react"
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { Eye, EyeOff, ArrowRight, User, Mail, Lock, Building2, CheckCircle, XCircle } from "lucide-react"
import { useToast } from "@chakra-ui/react"
import { useAuth } from "@/hooks/useAuth"
import { getFriendlyErrorMessage } from "@/utils/authErrors"
import { validateCompanyCode } from "@/services/organizationService"
import { auth } from "@/services/firebase"
import { validateReferralCode } from "@/services/referralService"
import { GenderOption, Organization, UserRole } from "@/types"
import { getLandingPathForRole } from "@/utils/roleRouting"
import { TermsOfUseModal } from "@/components/modals/TermsOfUseModal"
import { PrivacyPolicyModal } from "@/components/modals/PrivacyPolicyModal"
import { GoogleIcon } from "@/components/icons/GoogleIcon"
import { CompanyCodeModal } from "@/components/modals/CompanyCodeModal"
import { PageTransitionLoader } from "@/components/PageTransitionLoader"

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
  const [searchParams] = useSearchParams()
  const { signUp, signInWithGoogle, profile, profileLoading, user } = useAuth()
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
  const [showPassword, setShowPassword] = useState(false)
  const [companyCodeValid, setCompanyCodeValid] = useState<boolean | null>(null)
  const [companyCodeError, setCompanyCodeError] = useState<string | null>(null)
  const [isCheckingCode, setIsCheckingCode] = useState(false)
  const [validatedOrganization, setValidatedOrganization] = useState<Organization | null>(null)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [showCompanyCodeModal, setShowCompanyCodeModal] = useState(false)
  const [pendingGoogleNavigation, setPendingGoogleNavigation] = useState(false)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [referralStatus, setReferralStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle")
  const showAuthLoader = loading || googleLoading || profileLoading

  useEffect(() => {
    const queryRef = searchParams.get("ref")?.trim()
    if (queryRef) {
      localStorage.setItem("pending_ref", queryRef)
      setReferralCode(queryRef)
      return
    }

    const storedRef = localStorage.getItem("pending_ref")?.trim()
    if (storedRef) {
      setReferralCode(storedRef)
    }
  }, [searchParams])

  useEffect(() => {
    if (!referralCode) {
      setReferralStatus("idle")
      return
    }

    let active = true
    setReferralStatus("checking")

    validateReferralCode(referralCode).then(referrerUid => {
      if (!active) return
      if (referrerUid) {
        setReferralStatus("valid")
      } else {
        setReferralStatus("invalid")
        localStorage.removeItem("pending_ref")
      }
    })

    return () => {
      active = false
    }
  }, [referralCode])

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

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const { firstName, lastName } = nameParts
      const email = formData.email.trim().toLowerCase()

      const referralCodeToUse = referralStatus === "valid" ? referralCode ?? undefined : undefined
      const { error: signUpError, userId } = await signUp(
        email,
        formData.password,
        {
          firstName: firstName || "User",
          lastName,
          fullName: formData.fullName.trim(),
          gender: formData.gender !== "prefer_not_to_say" ? formData.gender : undefined,
          companyCode:
            formData.companyCode.trim() && companyCodeValid ? formData.companyCode.trim() : undefined,
          companyId: validatedOrganization?.id,
          companyName: validatedOrganization?.name,
        },
        referralCodeToUse
      )

      if (signUpError) {
        setError(getFriendlyErrorMessage(signUpError))
        return
      }

      if (referralCodeToUse) {
        localStorage.removeItem("pending_ref")
      }

      toast({
        title: "Account created!",
        description: "Welcome to Man-Tier. Redirecting you to your dashboard now.",
        status: "success",
        duration: 5000,
      })
      if (userId) {
        localStorage.setItem(`t4l.newUserWelcome.${userId}`, "pending")
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

    if (!formData.acceptTerms) {
      setError("You must accept the Terms of Use and Privacy Policy.")
      return
    }

    const pendingCode = formData.companyCode.trim().toUpperCase()
    if (pendingCode && companyCodeValid) {
      localStorage.setItem('t4l.pendingCompanyCode', pendingCode)
    } else {
      localStorage.removeItem('t4l.pendingCompanyCode')
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

      if (isNewUser) {
        setShowCompanyCodeModal(true)
        setPendingGoogleNavigation(true)
      } else {
        setShowCompanyCodeModal(false)
        setPendingGoogleNavigation(true)
      }

      toast({
        title: "Signed in with Google!",
        description: "Welcome to Transformational Leader.",
        status: "success",
        duration: 5000,
      })
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className="w-full">
      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}


      <form onSubmit={handleSignUp} className="space-y-5">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Create account</h1>
          <p className="mt-1 text-sm text-gray-600">Start your transformation journey.</p>
        </div>

        {showAuthLoader && (
          <div className="flex justify-center">
            <PageTransitionLoader fullScreen={false} size="medium" />
          </div>
        )}

        {referralCode && (
          <div className="rounded-lg border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-700">
            {referralStatus === "checking" && (
              <div className="inline-flex items-center gap-2">
                <PageTransitionLoader fullScreen={false} size="small" inline />
                <span>Checking referral code...</span>
              </div>
            )}
            {referralStatus === "valid" && (
              <div className="inline-flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Referral code applied!</span>
              </div>
            )}
            {referralStatus === "invalid" && (
              <div className="inline-flex items-center gap-2 text-red-700">
                <XCircle className="h-4 w-4" />
                <span>Referral code is invalid or inactive.</span>
              </div>
            )}
          </div>
        )}

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
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              value={formData.fullName}
              onChange={e => handleChange("fullName", e.target.value)}
              placeholder="John Doe"
              autoComplete="name"
              className="h-10 w-full rounded-md border bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#350e6f]"
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
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="email"
              value={formData.email}
              onChange={e => handleChange("email", e.target.value.toLowerCase())}
              placeholder="your@email.com"
              autoComplete="email"
              className="h-10 w-full rounded-md border bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#350e6f]"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Company Code (optional)</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              value={formData.companyCode}
              onChange={e => handleChange("companyCode", e.target.value.slice(0, 6))}
              placeholder="6-digit code"
              maxLength={6}
              className="h-10 w-full rounded-md border bg-gray-50 pl-9 pr-3 text-sm uppercase tracking-widest text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#350e6f]"
            />
          </div>
          {isCheckingCode && (
            <div className="mt-2 inline-flex items-center gap-2 text-sm text-gray-600 transition-all">
              <PageTransitionLoader fullScreen={false} size="small" inline />
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
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={e => handleChange("password", e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              minLength={8}
              className="h-10 w-full rounded-md border bg-gray-50 pl-9 pr-10 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#350e6f]"
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
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type={showPassword ? "text" : "password"}
              value={formData.confirmPassword}
              onChange={e => handleChange("confirmPassword", e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="h-10 w-full rounded-md border bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#350e6f]"
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
        onSkip={() => {
          setShowCompanyCodeModal(false)
          setPendingGoogleNavigation(false)
          navigate(getLandingPathForRole(profile ?? UserRole.FREE_USER), { replace: true })
        }}
        onSuccess={() => {
          setShowCompanyCodeModal(false)
          setPendingGoogleNavigation(false)
          navigate(getLandingPathForRole(profile ?? UserRole.FREE_USER), { replace: true })
        }}
      />
    </div>
  )
}
