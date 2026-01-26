import React from "react"
import { motion } from "framer-motion"
import { Mail, ArrowLeft } from "lucide-react"
import { Link as RouterLink } from "react-router-dom"

export function CheckEmailScreen({
  email,
  title = "Check your email",
  message,
  primaryAction,
  secondaryAction,
}: {
  email?: string
  title?: string
  message?: string
  primaryAction?: React.ReactNode
  secondaryAction?: React.ReactNode
}) {
  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl border bg-white p-6 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-brand-indigo-50 flex items-center justify-center">
            <Mail className="h-5 w-5 text-brand-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600">We’ve sent instructions to your inbox.</p>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-700 leading-relaxed">
          <p>
            {message ??
              "Use the link in the email to continue. If you don’t see it, check your spam or promotions folder."}
          </p>
          {email ? (
            <p className="mt-3">
              Email sent to: <span className="font-semibold text-gray-900">{email}</span>
            </p>
          ) : null}
        </div>

        <div className="mt-6 space-y-3">
          {primaryAction}
          {secondaryAction}
        </div>

        <div className="mt-6 flex items-center justify-center">
          <RouterLink
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-brand-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </RouterLink>
        </div>
      </motion.div>
    </div>
  )
}
