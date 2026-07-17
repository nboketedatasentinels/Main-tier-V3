import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Session, User as SupabaseUser } from '@supabase/supabase-js'

import {
  UserProfile,
  UserRole,
} from '@/types'
import type { StandardRole } from '@/types'
import { normalizeRole } from '@/utils/role'
import { supabase, supabaseConfigStatus } from '@/services/supabase'
import { AuthContext, AuthContextType, AuthUser } from './AuthContextType'
import { getFriendlyErrorMessage } from '@/utils/authErrors'
import { canAccessOrganization } from '@/services/organizationAccessService'
import { claimOrganizationCode, acceptOrgInvitations } from '@/services/supabaseOrgService'
import { resolveEffectiveOrganization, resolveEffectiveRole } from '@/utils/authz'

interface AuthProviderProps {
  children: React.ReactNode
}

/* ------------------------------------------------------------------ */
/* 🔹 profiles row  <->  UserProfile mapping                           */
/* ------------------------------------------------------------------ */
/**
 * The `profiles` table keeps hot fields as typed (snake_case) columns and the
 * long tail of the document in a `data jsonb` column (already camelCase, since
 * it mirrors the old Firestore document). Reads merge the two; writes split
 * camelCase updates back into the right place.
 */
const COLUMN_BY_FIELD: Record<string, string> = {
  email: 'email',
  firstName: 'first_name',
  lastName: 'last_name',
  fullName: 'full_name',
  role: 'role',
  membershipStatus: 'membership_status',
  organizationId: 'organization_id',
  companyId: 'company_id',
  companyCode: 'company_code',
  companyName: 'company_name',
  journeyType: 'journey_type',
  journeyStartDate: 'journey_start_date',
  currentWeek: 'current_week',
  totalPoints: 'total_points',
  level: 'level',
  villageId: 'village_id',
  clusterId: 'cluster_id',
  mentorId: 'mentor_id',
  ambassadorId: 'ambassador_id',
  transformationTier: 'transformation_tier',
  personalityType: 'personality_type',
  coreValues: 'core_values',
  hasCompletedPersonalityTest: 'has_completed_personality_test',
  hasCompletedValuesTest: 'has_completed_values_test',
}

type ProfileRow = Record<string, unknown> & { id: string; data?: Record<string, unknown> | null }

const mapRowToProfile = (row: ProfileRow): UserProfile => {
  const data = (row.data as Record<string, unknown>) || {}
  const rawRole = (row.role as string) ?? data.role ?? UserRole.USER

  const profile: Record<string, unknown> = {
    // long tail first (camelCase already); typed columns win below
    ...data,
    id: row.id,
    email: (row.email as string) ?? data.email ?? '',
    firstName: row.first_name ?? data.firstName,
    lastName: row.last_name ?? data.lastName,
    fullName: row.full_name ?? data.fullName,
    role: normalizeRole(rawRole) as StandardRole,
    membershipStatus: row.membership_status ?? data.membershipStatus,
    organizationId: row.organization_id ?? data.organizationId ?? null,
    companyId: row.company_id ?? data.companyId ?? null,
    companyCode: row.company_code ?? data.companyCode ?? null,
    companyName: row.company_name ?? data.companyName ?? null,
    journeyType: row.journey_type ?? data.journeyType ?? '4W',
    journeyStartDate: row.journey_start_date ?? data.journeyStartDate ?? null,
    currentWeek: row.current_week ?? data.currentWeek,
    totalPoints: (row.total_points as number) ?? data.totalPoints ?? 0,
    level: (row.level as number) ?? data.level ?? 1,
    villageId: row.village_id ?? data.villageId ?? null,
    clusterId: row.cluster_id ?? data.clusterId ?? null,
    mentorId: row.mentor_id ?? data.mentorId ?? null,
    ambassadorId: row.ambassador_id ?? data.ambassadorId ?? null,
    transformationTier: row.transformation_tier ?? data.transformationTier,
    personalityType: row.personality_type ?? data.personalityType,
    coreValues: row.core_values ?? data.coreValues,
    hasCompletedPersonalityTest: row.has_completed_personality_test ?? data.hasCompletedPersonalityTest ?? false,
    hasCompletedValuesTest: row.has_completed_values_test ?? data.hasCompletedValuesTest ?? false,
    assignedOrganizations: (data.assignedOrganizations as string[]) ?? [],
    createdAt: row.created_at ?? data.createdAt,
    updatedAt: row.updated_at ?? data.updatedAt,
  }

  return profile as unknown as UserProfile
}

/** Split a camelCase update into typed-column updates and `data` jsonb updates. */
const splitProfileUpdates = (updates: Partial<UserProfile>) => {
  const columns: Record<string, unknown> = {}
  const dataPatch: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === 'undefined' || key === 'id') continue
    const column = COLUMN_BY_FIELD[key]
    if (column) {
      columns[column] = value
    } else {
      dataPatch[key] = value
    }
  }

  return { columns, dataPatch }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileStatus, setProfileStatus] = useState<'loading' | 'ready'>('loading')
  const [profileError, setProfileError] = useState<Error | null>(null)
  const [claimsRole, setClaimsRole] = useState<string | null>(null)

  const profileRef = useRef<UserProfile | null>(null)
  // Raw `data` jsonb of the loaded row, so partial updates to long-tail fields
  // merge instead of clobbering the whole blob.
  const profileDataRef = useRef<Record<string, unknown>>({})
  const initialLastProfileLoadAt = (() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('lastProfileLoadAt')
  })()
  const lastProfileLoadAtRef = useRef<string | null>(initialLastProfileLoadAt)
  const refreshStateRef = useRef({ inFlight: false, lastRequestAt: 0 })

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  const recordProfileLoad = useCallback((loadedProfile: UserProfile | null) => {
    if (typeof window === 'undefined') return
    if (!loadedProfile?.id) return
    const timestamp = new Date().toISOString()
    localStorage.setItem('lastProfileLoadAt', timestamp)
    lastProfileLoadAtRef.current = timestamp
  }, [])

  /* ------------------------------------------------------------------ */
  /* 🔹 Supabase user -> AuthUser shim                                   */
  /* ------------------------------------------------------------------ */
  const toAuthUser = useCallback((supaUser: SupabaseUser): AuthUser => {
    const meta = (supaUser.user_metadata as Record<string, unknown>) || {}
    return {
      uid: supaUser.id,
      email: supaUser.email ?? null,
      displayName:
        (meta.full_name as string) ?? (meta.name as string) ?? null,
      photoURL:
        (meta.avatar_url as string) ?? (meta.picture as string) ?? null,
      emailVerified: Boolean(supaUser.email_confirmed_at),
      getIdToken: async () => {
        const { data } = await supabase.auth.getSession()
        return data.session?.access_token ?? ''
      },
    }
  }, [])

  const extractClaimsRole = useCallback((session: Session | null) => {
    // Supabase keeps role in the profile; a deployment may also stamp it into
    // the JWT app_metadata. Prefer the claim when present.
    const appMeta = (session?.user?.app_metadata as Record<string, unknown>) || {}
    const rawRole =
      (appMeta.role as string | undefined) ??
      (appMeta.claimsRole as string | undefined) ??
      null
    setClaimsRole(rawRole ?? null)
  }, [])

  /* ------------------------------------------------------------------ */
  /* 🔹 Profile load (with a short retry for the post-OAuth trigger race)*/
  /* ------------------------------------------------------------------ */
  const loadProfileRow = useCallback(async (uid: string): Promise<ProfileRow | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return (data as ProfileRow) ?? null
  }, [])

  const fetchProfileWithRetry = useCallback(
    async (authUser: AuthUser, attempts = 4): Promise<UserProfile | null> => {
      let lastError: Error | null = null

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          let row = await loadProfileRow(authUser.uid)

          // The `on_auth_user_created` trigger creates the row, but right after
          // an OAuth redirect we can momentarily race it. Retry a couple times,
          // then self-heal with a conflict-safe upsert (ignoreDuplicates avoids a
          // 409 if the trigger's row already landed) and re-read.
          if (!row && attempt === attempts) {
            const { error: upsertError } = await supabase
              .from('profiles')
              .upsert(
                {
                  id: authUser.uid,
                  email: authUser.email,
                  full_name: authUser.displayName,
                },
                { onConflict: 'id', ignoreDuplicates: true }
              )
            if (upsertError) throw new Error(upsertError.message)
            row = await loadProfileRow(authUser.uid)
          }

          if (row) {
            setProfileError(null)
            profileDataRef.current = (row.data as Record<string, unknown>) || {}
            return mapRowToProfile(row)
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Profile fetch failed.')
        }

        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, Math.min(400 * attempt, 1500)))
        }
      }

      if (lastError) setProfileError(lastError)
      return null
    },
    [loadProfileRow]
  )

  /* ------------------------------------------------------------------ */
  /* 🔹 Auth State Listener                                              */
  /* ------------------------------------------------------------------ */
  const loadedUidRef = useRef<string | null>(null)
  // Last (event, uid) we actually logged - so repeated SIGNED_IN emits (token
  // refresh, tab focus, cross-tab session sync) don't spam the console.
  const lastAuthLogRef = useRef<string>('')

  useEffect(() => {
    let isActive = true

    const applySession = async (session: Session | null, origin: string) => {
      if (!isActive) return
      const supaUser = session?.user ?? null
      extractClaimsRole(session)

      if (!supaUser) {
        loadedUidRef.current = null
        setUser(null)
        setProfile(null)
        setClaimsRole(null)
        setProfileError(null)
        setLoading(false)
        setProfileLoading(false)
        setProfileStatus('ready')
        return
      }

      const authUser = toAuthUser(supaUser)
      // Keep a STABLE `user` reference across background auth events (e.g.
      // TOKEN_REFRESHED) for the same account. Returning a fresh object on every
      // auth event churned `user`'s identity, which re-ran every [user]-object
      // effect/subscription (Supabase notifications listeners, etc.) in a loop.
      setUser((prev) => (prev && prev.uid === authUser.uid ? prev : authUser))

      // Background refresh (e.g. TOKEN_REFRESHED when you switch back to the tab)
      // for a user we've ALREADY loaded: do NOT flip global loading. Flipping it
      // makes ProtectedRoute swap in the full-screen loader, which unmounts the
      // current page and wipes in-progress form state. The token/claims are
      // already updated above; nothing else needs to happen, so keep the app
      // mounted and bail.
      if (loadedUidRef.current === supaUser.id) {
        return
      }

      setLoading(true)
      setProfileLoading(true)
      setProfileStatus('loading')

      const loadedProfile = await fetchProfileWithRetry(authUser)
      if (!isActive) return

      let ensuredProfile = loadedProfile
        ? { ...loadedProfile, assignedOrganizations: loadedProfile.assignedOrganizations ?? [] }
        : null

      // Org-code enrollment. A user who signed up with an organization code
      // belongs to that org and can never be free_user: they inherit the org's
      // journey + paid membership (role -> paid_member). The role write can only
      // happen server-side (client role writes are revoked in 0012), so we call
      // the claim RPC once a session exists, then reload the profile. Guard on
      // "not yet enrolled" so we never re-apply (which would clobber the journey)
      // on subsequent logins.
      if (ensuredProfile && !ensuredProfile.organizationId && !ensuredProfile.companyId) {
        const meta = (supaUser.user_metadata as Record<string, unknown>) || {}
        // The pending org code is stashed at signup in auth metadata, but the
        // email-confirmation path (and older signups) persist it only to
        // profiles.data.pendingCompanyCode - which mapRowToProfile spreads onto
        // the profile. Read all three sources so enrollment fires no matter
        // where the code landed; the claim is idempotent and the RPC clears the
        // code on success, so re-reads never re-apply.
        const profilePendingCode = (ensuredProfile as Record<string, unknown>).pendingCompanyCode
        const pendingCode = (
          (typeof meta.pending_company_code === 'string' ? meta.pending_company_code : '') ||
          (typeof profilePendingCode === 'string' ? profilePendingCode : '') ||
          (typeof window !== 'undefined' ? localStorage.getItem('t4l.pendingCompanyCode') ?? '' : '')
        ).trim()

        let enrolled = false
        if (pendingCode) {
          // Self-enrollment: the user typed an org code at signup.
          const claim = await claimOrganizationCode(pendingCode)
          if (typeof window !== 'undefined') localStorage.removeItem('t4l.pendingCompanyCode')
          if (!isActive) return
          if (claim.ok) enrolled = true
          else console.warn('🟠 [Auth] Org-code enrollment skipped:', claim.error)
        }
        if (!enrolled) {
          // Admin-driven: an admin added this email to an org. Enroll into any
          // pending invitation matching the signed-up email.
          const accepted = await acceptOrgInvitations()
          if (!isActive) return
          if (accepted.ok) enrolled = true
        }
        if (enrolled) {
          const reloaded = await fetchProfileWithRetry(authUser)
          if (!isActive) return
          if (reloaded) {
            ensuredProfile = { ...reloaded, assignedOrganizations: reloaded.assignedOrganizations ?? [] }
          }
        }
      }

      console.log('🟢 [Auth] Profile resolved', { origin, role: ensuredProfile?.role })
      setProfile(ensuredProfile)
      recordProfileLoad(ensuredProfile)
      loadedUidRef.current = supaUser.id
      setProfileLoading(false)
      setLoading(false)
      setProfileStatus('ready')
    }

    // Initial session (covers a normal load and the post-OAuth/magic-link redirect).
    supabase.auth.getSession().then(({ data }) => {
      void applySession(data.session, 'init')
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase re-emits SIGNED_IN on token refresh, tab focus, and cross-tab
      // session sync (multiple open tabs echo each other). applySession already
      // bails on an already-loaded user, so the repeats are cheap - but the raw
      // log used to spam the console. Log only genuine (event, user) transitions.
      const signature = `${event}:${session?.user?.id ?? ''}`
      if (signature !== lastAuthLogRef.current) {
        lastAuthLogRef.current = signature
        console.log('🟠 [Auth] Auth state changed', event, session?.user?.email)
      }
      void applySession(session, event)
    })

    return () => {
      isActive = false
      sub.subscription.unsubscribe()
    }
  }, [extractClaimsRole, fetchProfileWithRetry, recordProfileLoad, toAuthUser])

  /* ------------------------------------------------------------------ */
  /* 🔹 Config guard                                                     */
  /* ------------------------------------------------------------------ */
  const ensureSupabaseConfigured = () => {
    if (supabaseConfigStatus.isValid) return null
    return new Error(
      `Authentication is not available because Supabase environment variables are missing: ${supabaseConfigStatus.missingKeys.join(
        ', '
      )}. Add them to .env and restart the dev server.`
    )
  }

  const normalizeError = (error: unknown): Error => {
    const friendly = getFriendlyErrorMessage(error)
    return error instanceof Error && error.message === friendly ? error : new Error(friendly)
  }

  /* ------------------------------------------------------------------ */
  /* 🔹 Auth Actions                                                     */
  /* ------------------------------------------------------------------ */
  const signIn = async (email: string, password: string) => {
    const configError = ensureSupabaseConfigured()
    if (configError) return { error: configError }

    setLoading(true)
    setProfileLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) {
        setLoading(false)
        setProfileLoading(false)
        return { error: normalizeError(error) }
      }
      // onAuthStateChange loads the profile and drives the redirect.
      return { error: null }
    } catch (error) {
      setLoading(false)
      setProfileLoading(false)
      return { error: normalizeError(error) }
    }
  }

  const signInWithMagicLink = async (email: string) => {
    const configError = ensureSupabaseConfigured()
    if (configError) return { error: configError }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })
      if (error) return { error: normalizeError(error) }
      return { error: null }
    } catch (error) {
      return { error: normalizeError(error) }
    }
  }

  const signInWithGoogle = async () => {
    const configError = ensureSupabaseConfigured()
    if (configError) return { error: configError }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login`,
          queryParams: { prompt: 'select_account' },
        },
      })
      if (error) return { error: normalizeError(error) }
      // OAuth navigates away; the session is picked up on redirect back.
      return { error: null, redirect: true }
    } catch (error) {
      return { error: normalizeError(error) }
    }
  }

  const signUp = async (
    email: string,
    password: string,
    userData: Partial<UserProfile> & {
      gender?: string
      phoneNumber?: string
      companyCode?: string
      companyId?: string
      companyName?: string
    },
    referralCode?: string
  ) => {
    const configError = ensureSupabaseConfigured()
    if (configError) return { error: configError, userId: undefined }

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedFullName = userData.fullName?.trim() || ''
    if (!normalizedFullName) {
      return { error: new Error('Full name is required.'), userId: undefined }
    }

    const parts = normalizedFullName.split(/\s+/).filter(Boolean)
    const firstName = parts[0] || 'User'
    const lastName = parts.slice(1).join(' ')
    const pendingCompanyCode = userData.companyCode?.trim().toUpperCase() || ''

    setLoading(true)
    setProfileLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          // Consumed by the on_auth_user_created trigger to seed the profile.
          // pending_company_code rides in metadata so org-code enrollment can be
          // applied on first sign-in (survives email confirmation + other
          // devices, where localStorage/the post-signup session aren't available).
          data: {
            full_name: normalizedFullName,
            first_name: firstName,
            last_name: lastName,
            ...(pendingCompanyCode ? { pending_company_code: pendingCompanyCode } : {}),
          },
        },
      })

      if (error) {
        setLoading(false)
        setProfileLoading(false)
        return { error: normalizeError(error), userId: undefined }
      }

      const newUserId = data.user?.id

      // If a session exists (email confirmation off), persist the extra signup
      // fields onto the freshly-provisioned profile row. The long tail
      // (phone/gender/company code) lives in `data` jsonb.
      if (newUserId && data.session) {
        const extras: Record<string, unknown> = {}
        if (userData.phoneNumber) extras.phoneNumber = userData.phoneNumber
        if (userData.gender) extras.gender = userData.gender
        if (referralCode?.trim()) extras.referralCode = referralCode.trim()
        if (userData.companyCode) extras.pendingCompanyCode = userData.companyCode.trim().toUpperCase()

        if (Object.keys(extras).length) {
          const { error: extrasError } = await supabase
            .from('profiles')
            .update({ data: extras })
            .eq('id', newUserId)
          if (extrasError) {
            console.warn('🟠 [Auth] Unable to persist signup extras', extrasError.message)
          }
        }
      }

      setLoading(false)
      setProfileLoading(false)
      return { error: null, userId: newUserId }
    } catch (error) {
      setLoading(false)
      setProfileLoading(false)
      return { error: normalizeError(error), userId: undefined }
    }
  }

  const signOut = async () => {
    if (signingOut) {
      return { error: new Error('Sign out already in progress') }
    }
    setSigningOut(true)

    const timeoutId = setTimeout(() => {
      window.location.href = '/login'
    }, 5000)

    try {
      // Preserve a couple of UI prefs across the session boundary.
      if (profile?.companyCode) {
        localStorage.setItem('t4l.lastSelectedOrg', profile.companyCode)
      }
      if (profile?.dashboardPreferences) {
        localStorage.setItem('t4l.dashboardPreferences', JSON.stringify(profile.dashboardPreferences))
      }

      await supabase.auth.signOut()

      setUser(null)
      setProfile(null)
      setClaimsRole(null)

      clearTimeout(timeoutId)
      window.location.href = '/login'
      return { error: null }
    } catch (error) {
      clearTimeout(timeoutId)
      window.location.href = '/login'
      return { error: error instanceof Error ? error : new Error('Sign out failed') }
    } finally {
      setSigningOut(false)
    }
  }

  const resetPassword = async (email: string) => {
    const configError = ensureSupabaseConfigured()
    if (configError) return { error: configError }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) return { error: normalizeError(error) }
      return { error: null }
    } catch (error) {
      return { error: normalizeError(error) }
    }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) {
      return { error: new Error('No authenticated user available to update') }
    }

    try {
      const { columns, dataPatch } = splitProfileUpdates(updates)
      const patch: Record<string, unknown> = { ...columns }

      if (Object.keys(dataPatch).length) {
        const mergedData = { ...profileDataRef.current, ...dataPatch }
        profileDataRef.current = mergedData
        patch.data = mergedData
      }

      if (Object.keys(patch).length) {
        const { error } = await supabase.from('profiles').update(patch).eq('id', user.uid)
        if (error) return { error: new Error(getFriendlyErrorMessage(error)) }
      }

      setProfile((prev) => (prev ? { ...prev, ...updates } : prev))
      return { error: null }
    } catch (error) {
      return { error: new Error(getFriendlyErrorMessage(error)) }
    }
  }

  const refreshProfile = useCallback(
    async (options?: { reason?: string; isManual?: boolean }) => {
      const reason = options?.reason || 'manual'
      const { data: sessionData } = await supabase.auth.getSession()
      const supaUser = sessionData.session?.user
      if (!supaUser) {
        const error = new Error('No authenticated user to refresh')
        setProfileError(error)
        return { error, profile: null as UserProfile | null }
      }

      const now = Date.now()
      const refreshState = refreshStateRef.current
      if (refreshState.inFlight) {
        return { error: null, profile: profileRef.current }
      }
      if (now - refreshState.lastRequestAt < 1500) {
        return { error: null, profile: profileRef.current }
      }
      refreshState.inFlight = true
      refreshState.lastRequestAt = now

      try {
        setProfileError(null)
        setProfileLoading(true)
        const authUser = toAuthUser(supaUser)
        const refreshed = await fetchProfileWithRetry(authUser)
        if (refreshed) {
          const ensured = { ...refreshed, assignedOrganizations: refreshed.assignedOrganizations ?? [] }
          setProfile(ensured)
          recordProfileLoad(ensured)
          setProfileError(null)
        }
        setProfileLoading(false)
        return { error: null, profile: refreshed }
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error('Profile refresh failed.')
        console.error('🔴 [Auth] refreshProfile error', { reason, error })
        setProfileError(normalized)
        setProfileLoading(false)
        return { error: normalized, profile: null as UserProfile | null }
      } finally {
        refreshState.inFlight = false
      }
    },
    [fetchProfileWithRetry, recordProfileLoad, toAuthUser]
  )

  // Memoized so its identity is stable. Previously a new function was created
  // every render; consumers that listed it in effect deps (e.g.
  // useAdminNotifications) re-ran on every render, and since refreshSession()
  // fires TOKEN_REFRESHED -> re-render, that became an infinite refresh loop
  // that hit Supabase's 429 and force-logged-out the user.
  const refreshAdminSession = useCallback(async () => {
    const { data } = await supabase.auth.refreshSession()
    extractClaimsRole(data.session)
  }, [extractClaimsRole])

  /* ------------------------------------------------------------------ */
  /* 🔹 Account linking (handled natively by Supabase; no-op shims)      */
  /* ------------------------------------------------------------------ */
  // Supabase auto-links identities by email when "link identities" is enabled,
  // so the Firebase-era manual linking modal is not needed. Kept as inert
  // fields to preserve the context surface for existing consumers.
  const linkGoogleAccount = useCallback(
    async (_password: string): Promise<{ error: Error | null }> => {
      return { error: new Error('Account linking is handled automatically. Please sign in with Google.') }
    },
    []
  )
  const dismissAccountLinking = useCallback(() => {}, [])

  /* ------------------------------------------------------------------ */
  /* 🔹 Role Flags                                                       */
  /* ------------------------------------------------------------------ */
  const { role: effectiveRole, source: effectiveRoleSource } = resolveEffectiveRole({
    claimsRole,
    profileRole: profile?.role,
    fallback: 'user',
  })
  const { organizationId: effectiveOrganizationId } = resolveEffectiveOrganization(profile)

  const isAdmin = effectiveRole === 'partner' || effectiveRole === 'super_admin'
  const isSuperAdmin = effectiveRole === 'super_admin'
  const isMentor = effectiveRole === 'mentor'
  const isAmbassador = effectiveRole === 'ambassador'
  const isPaid =
    ['partner', 'mentor', 'ambassador', 'super_admin'].includes(effectiveRole ?? '') ||
    effectiveRole === 'paid_member' ||
    (effectiveRole === 'user' && profile?.membershipStatus === 'paid')

  const value: AuthContextType = {
    user,
    profile,
    userData: profile,
    loading,
    profileLoading,
    profileStatus,
    profileError,
    signingOut,
    lastProfileLoadAt: lastProfileLoadAtRef.current,
    signIn,
    signUp,
    signOut,
    signInWithMagicLink,
    signInWithGoogle,
    resetPassword,
    updateProfile,
    hasRole: (r: StandardRole) => effectiveRole === r,
    hasAnyRole: (roles: StandardRole[]) => roles.includes(effectiveRole),
    isAdmin,
    isSuperAdmin,
    isMentor,
    isAmbassador,
    isPaid,
    isCorporateMember:
      profile?.transformationTier?.toLowerCase().includes('corporate') ?? false,
    assignedOrganizations: profile?.assignedOrganizations ?? [],
    hasFullOrganizationAccess: effectiveRole === 'super_admin',
    canAccessOrganization: async (organizationId: string) => {
      if (!organizationId || !user?.uid) return false
      return canAccessOrganization({
        role: effectiveRole,
        userId: user.uid,
        organizationId,
      })
    },
    updateDashboardPreferences: async () => ({ error: null }),
    claimsRole,
    effectiveRole,
    effectiveRoleSource,
    effectiveOrganizationId,
    refreshAdminSession,
    refreshProfile,
    pendingLinkEmail: null,
    showAccountLinkingModal: false,
    linkGoogleAccount,
    dismissAccountLinking,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
