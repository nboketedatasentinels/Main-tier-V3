import React, { useState } from "react"
import { Link as RouterLink } from "react-router-dom"
import { motion } from "framer-motion"
import { Mail, ArrowRight } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { CheckEmailScreen } from "@/components/auth/CheckEmailScreen"

export const ResetPasswordPage: React.FC = () => {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await resetPassword(email.trim())
      if (error) {
        setError(error.message)
        return
      }
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <CheckEmailScreen
        email={email}
        title="Password reset sent"
        message="If an account exists for this email, we sent a password reset link. Open it to set a new password."
        primaryAction={
          <button
            type="button"
            onClick={() => setSent(false)}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-gradient-to-r from-[#350e6f] to-[#27062e] text-white text-sm font-medium shadow-sm hover:opacity-95"
          >
            Send again
          </button>
        }
      />
    )
  }

  return (
    <div>
      <p className="text-sm text-gray-600 mb-5">
        Enter the email address linked to your account and we’ll send a reset link.
      </p>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="h-10 w-full rounded-md border bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#350e6f]"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
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
          {loading ? "Sending..." : "Send reset link"}
          <ArrowRight className="h-4 w-4" />
        </motion.button>

        <div className="text-center">
          <RouterLink to="/login" className="text-sm text-[#4540c0] hover:underline">
            Back to Sign In
          </RouterLink>
        </div>
      </form>
    </div>
  )
}
