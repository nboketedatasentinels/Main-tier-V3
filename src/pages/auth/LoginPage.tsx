import React, { useState } from "react"
import { Link as RouterLink, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Eye, EyeOff, ArrowRight, Mail, Lock, CheckCircle2, ArrowLeft, Link2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { signIn, signInWithMagicLink } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError("Please enter your email address.")
      return
    }
    if (!password) {
      setError("Please enter your password.")
      return
    }

    setLoading(true)
    try {
      const { error } = await signIn(email.trim(), password)
      if (error) {
        setError(error.message)
        return
      }

      navigate("/app", { replace: true })
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLink = async () => {
    setError(null)

    if (!email.trim()) {
      setError("Please enter your email address to receive a magic link.")
      return
    }

    setLoading(true)
    try {
      const { error } = await signInWithMagicLink(email.trim())
      if (error) {
        setError(error.message)
        return
      }

      setMagicLinkSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (magicLinkSent) {
    return (
      <div className="w-full">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Check your email</h1>
          <p className="mt-2 text-sm text-gray-600">
            We sent a magic sign-in link to {" "}
            <span className="font-semibold text-gray-900">{email}</span>.
          </p>

          <div className="mt-6 space-y-3">
            <div className="rounded-lg border bg-gray-50 px-4 py-3 text-sm text-gray-600">
              If you don’t see it in a few minutes, check your spam/junk folder.
            </div>

            <button
              type="button"
              onClick={() => setMagicLinkSent(false)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
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

      <form onSubmit={handleLogin} className="space-y-5">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-600">Sign in to your account.</p>
        </div>

        <button
          type="button"
          onClick={handleMagicLink}
          disabled={loading}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-60"
        >
          <Link2 className="h-4 w-4" />
          Send magic link
        </button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-gray-500">or sign in with password</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
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
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
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
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          disabled={loading}
          type="submit"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#350e6f] to-[#27062e] text-white text-sm font-medium shadow-sm hover:opacity-95 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign In"}
          <ArrowRight className="h-4 w-4" />
        </motion.button>

        <div className="flex items-center justify-between text-sm">
          <RouterLink to="/reset-password" className="font-medium text-[#350e6f] hover:underline">
            Forgot password?
          </RouterLink>

          <span className="text-gray-600">
            No account?{" "}
            <RouterLink to="/signup" className="font-semibold text-[#350e6f] hover:underline">
              Sign Up
            </RouterLink>
          </span>
        </div>
      </form>
    </div>
  )
}
