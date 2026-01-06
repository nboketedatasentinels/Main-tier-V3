import React, { useEffect, useMemo, useState } from "react"
import { Link as RouterLink, useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { Mail, ArrowRight } from "lucide-react"
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth"
import { useAuth } from "@/hooks/useAuth"
import { CheckEmailScreen } from "@/components/auth/CheckEmailScreen"
import { auth } from "@/services/firebase"
import { getFriendlyErrorMessage } from "@/utils/authErrors"

export const ResetPasswordPage: React.FC = () => {
  const { resetPassword } = useAuth()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [resetEmail, setResetEmail] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetComplete, setResetComplete] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetForm, setResetForm] = useState({ password: "", confirmPassword: "" })

  const actionMode = searchParams.get("mode")
  const actionCode = searchParams.get("oobCode")
  const isResetFlow = useMemo(
    () => actionMode === "resetPassword" && Boolean(actionCode),
    [actionMode, actionCode]
  )

  useEffect(() => {
    if (!isResetFlow || !actionCode) return
    setResetLoading(true)
    setResetError(null)
    verifyPasswordResetCode(auth, actionCode)
      .then((resolvedEmail) => {
        setResetEmail(resolvedEmail)
      })
      .catch((err) => {
        setResetError(getFriendlyErrorMessage(err))
      })
      .finally(() => {
        setResetLoading(false)
      })
  }, [actionCode, isResetFlow])

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

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError(null)

    if (!actionCode) {
      setResetError("This reset link is missing required information.")
      return
    }

    if (!resetForm.password) {
      setResetError("Please enter a new password.")
      return
    }

    if (resetForm.password !== resetForm.confirmPassword) {
      setResetError("Passwords do not match.")
      return
    }

    setResetLoading(true)
    try {
      await confirmPasswordReset(auth, actionCode, resetForm.password)
      setResetComplete(true)
    } catch (err) {
      setResetError(getFriendlyErrorMessage(err))
    } finally {
      setResetLoading(false)
    }
  }

  if (isResetFlow) {
    if (resetLoading && !resetComplete && !resetError && !resetEmail) {
      return (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-700">
          Verifying your reset link...
        </div>
      )
    }

    if (resetComplete) {
      return (
        <div className="space-y-4 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Password updated</h2>
          <p className="text-sm text-gray-600">
            Your password has been updated. You can now sign in with your new credentials.
          </p>
          <RouterLink to="/login" className="text-sm text-[#4540c0] hover:underline">
            Back to Sign In
          </RouterLink>
        </div>
      )
    }

    if (resetError) {
      return (
        <div className="space-y-4 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Reset link issue</h2>
          <p className="text-sm text-red-600">{resetError}</p>
          <RouterLink to="/reset-password" className="text-sm text-[#4540c0] hover:underline">
            Request a new reset link
          </RouterLink>
        </div>
      )
    }

    return (
      <div>
        <p className="text-sm text-gray-600 mb-5">
          {resetEmail
            ? `Enter a new password for ${resetEmail}.`
            : "Enter a new password to finish resetting your account."}
        </p>

        <form onSubmit={handleResetSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              className="h-10 w-full rounded-md border bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#350e6f]"
              type="password"
              value={resetForm.password}
              onChange={(e) => setResetForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Enter a new password"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input
              className="h-10 w-full rounded-md border bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#350e6f]"
              type="password"
              value={resetForm.confirmPassword}
              onChange={(e) =>
                setResetForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
              }
              placeholder="Re-enter your new password"
              required
            />
          </div>

          {resetError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {resetError}
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            disabled={resetLoading}
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#350e6f] to-[#27062e] text-white text-sm font-medium shadow-sm hover:opacity-95 disabled:opacity-60"
          >
            {resetLoading ? "Updating..." : "Update password"}
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
