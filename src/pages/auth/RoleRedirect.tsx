// src/pages/auth/RoleRedirect.tsx
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types";

export default function RoleRedirect() {
  const { loading, profileLoading, user, profile: userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || profileLoading) return;

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    // if profile missing
    if (!userData) {
      navigate("/auth/profile-missing", { replace: true });
      return;
    }

    // account status gate (optional but recommended)
    if (userData.accountStatus && userData.accountStatus !== "active") {
      navigate("/login", { replace: true });
      return;
    }

    // ✅ Super Admin first
    if (userData.role === UserRole.SUPER_ADMIN) {
      navigate("/super-admin/dashboard", { replace: true });
      return;
    }

    // ✅ Partner/Company Admin
    if (userData.role === UserRole.COMPANY_ADMIN) {
      navigate("/admin/dashboard", { replace: true });
      return;
    }

    // Mentor
    if (userData.role === UserRole.MENTOR) {
      navigate("/mentor/dashboard", { replace: true });
      return;
    }

    // Ambassador
    if (userData.role === UserRole.AMBASSADOR) {
      navigate("/app/dashboard/ambassador", { replace: true });
      return;
    }

    // default user
    navigate("/app/dashboard/free", { replace: true });
  }, [loading, profileLoading, user, userData, navigate, location.key]);

  return null;
}