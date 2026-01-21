import React from "react"
import { T4LAuthShell } from "@/components/ui/t4l-auth-shell"
import { RouteTransition } from "@/components/RouteTransition"

interface AuthLayoutProps {
  children: React.ReactNode
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <T4LAuthShell>
      <RouteTransition>{children}</RouteTransition>
    </T4LAuthShell>
  )
}
