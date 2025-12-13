import React, { useMemo, useState } from "react"
import { Link as RouterLink, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Eye, EyeOff, ArrowRight, User, Mail, Lock } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"

export const SignUpPage: React.FC = () => {
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const fullName = useMemo(() => {
    const first = formData.firstName.trim()
    const last = formData.lastName.trim()
    return `${first} ${last}`.trim()
  }, [formData.firstName, formData.lastName])

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const validate = () => {
    if (!formData.firstName.trim()) return "First name is required."
    if (!formData.lastName.trim()) return "Last name is required."
    if (!formData.email.trim()) return "Email is required."
    if (formData.password.length < 6) return "Password must be at least 6 characters."
    if (formData.password !== formData.confirmPassword) return "Passwords do not match."
    return null
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const v = validate()
    if (v) {
      setError(v)
      return
    }

    setLoading(true)
    try {
      const { error, userId } = await signUp(formData.email.trim(), formData.password, {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        fullName,
      })

      if (error) {
        setError(error.message)
        return
      }

      if (userId) {
        localStorage.setItem(`t4l.newUserWelcome.${userId}`, "pending")
      }

      navigate("/app", { replace: true })
    } finally {
      setLoading(false)
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={formData.firstName}
                onChange={e => handleChange("firstName", e.target.value)}
                placeholder="John"
                autoComplete="given-name"
                className="h-10 w-full rounded-md border bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#350e6f]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={formData.lastName}
                onChange={e => handleChange("lastName", e.target.value)}
                placeholder="Doe"
                autoComplete="family-name"
                className="h-10 w-full rounded-md border bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#350e6f]"
                required
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="email"
              value={formData.email}
              onChange={e => handleChange("email", e.target.value)}
              placeholder="your@email.com"
              autoComplete="email"
              className="h-10 w-full rounded-md border bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#350e6f]"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={e => handleChange("password", e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              minLength={6}
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
          <p className="mt-1 text-xs text-gray-500">Minimum 6 characters.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
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
    </div>
  )
}
