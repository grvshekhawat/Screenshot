import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { isSupabaseConfigured, appOrigin } from "../config"
import { getSupabase } from "../lib/supabase"
import {
  localGetProfile,
  localSignIn,
  localSignOut,
  localUpdateProfile,
} from "../api/local-backend"
import { fetchProfile } from "../api/projects"
import type { Profile } from "../types/cloud"
import { canExport } from "../types/cloud"

type AuthContextValue = {
  ready: boolean
  userId: string | null
  email: string | null
  profile: Profile | null
  isAdmin: boolean
  canExport: boolean
  usingLocalBackend: boolean
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUpWithPassword: (
    email: string,
    password: string,
  ) => Promise<"signed-in" | "confirm-email">
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  /** Local/demo only: toggle subscription for testing paywall */
  setDemoSubscription: (active: boolean) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const usingLocalBackend = !isSupabaseConfigured()

  const refreshProfile = useCallback(async () => {
    if (usingLocalBackend) {
      const local = await localGetProfile()
      setProfile(local)
      setUserId(local?.id ?? null)
      setEmail(local?.email ?? null)
      return
    }
    const supabase = getSupabase()!
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setUserId(null)
      setEmail(null)
      setProfile(null)
      return
    }
    setUserId(user.id)
    setEmail(user.email ?? null)
    const next = await fetchProfile(user.id)
    setProfile(next)
  }, [usingLocalBackend])

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      try {
        if (usingLocalBackend) {
          await refreshProfile()
        } else {
          const supabase = getSupabase()!
          const {
            data: { session },
          } = await supabase.auth.getSession()
          if (session?.user && !cancelled) {
            setUserId(session.user.id)
            setEmail(session.user.email ?? null)
            const next = await fetchProfile(session.user.id)
            if (!cancelled) setProfile(next)
          }
          supabase.auth.onAuthStateChange((_event, nextSession) => {
            void (async () => {
              if (!nextSession?.user) {
                setUserId(null)
                setEmail(null)
                setProfile(null)
                return
              }
              setUserId(nextSession.user.id)
              setEmail(nextSession.user.email ?? null)
              const next = await fetchProfile(nextSession.user.id)
              setProfile(next)
            })()
          })
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [refreshProfile, usingLocalBackend])

  const signInWithPassword = useCallback(
    async (nextEmail: string, password: string) => {
      if (usingLocalBackend) {
        const next = await localSignIn(nextEmail.trim())
        setProfile(next)
        setUserId(next.id)
        setEmail(next.email)
        return
      }
      const supabase = getSupabase()!
      const { error } = await supabase.auth.signInWithPassword({
        email: nextEmail.trim(),
        password,
      })
      if (error) throw error
      await refreshProfile()
    },
    [refreshProfile, usingLocalBackend],
  )

  const signUpWithPassword = useCallback(
    async (nextEmail: string, password: string) => {
      if (usingLocalBackend) {
        await signInWithPassword(nextEmail, password)
        return "signed-in" as const
      }
      const supabase = getSupabase()!
      const { data, error } = await supabase.auth.signUp({
        email: nextEmail.trim(),
        password,
        options: {
          emailRedirectTo: `${appOrigin().replace(/\/$/, "")}/app`,
        },
      })
      if (error) throw error
      if (data.session) {
        await refreshProfile()
        return "signed-in" as const
      }
      return "confirm-email" as const
    },
    [refreshProfile, signInWithPassword, usingLocalBackend],
  )

  const signOut = useCallback(async () => {
    if (usingLocalBackend) {
      await localSignOut()
      setProfile(null)
      setUserId(null)
      setEmail(null)
      return
    }
    const supabase = getSupabase()!
    await supabase.auth.signOut()
    setProfile(null)
    setUserId(null)
    setEmail(null)
  }, [usingLocalBackend])

  const setDemoSubscription = useCallback(
    async (active: boolean) => {
      if (!usingLocalBackend) return
      const next = await localUpdateProfile({
        subscription_status: active ? "active" : "none",
        billing_provider: active ? "stripe" : null,
        subscription_period_end: active
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : null,
      })
      setProfile(next)
    },
    [usingLocalBackend],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      userId,
      email,
      profile,
      isAdmin: profile?.role === "admin",
      canExport: canExport(profile),
      usingLocalBackend,
      signInWithPassword,
      signUpWithPassword,
      signOut,
      refreshProfile,
      setDemoSubscription,
    }),
    [
      ready,
      userId,
      email,
      profile,
      usingLocalBackend,
      signInWithPassword,
      signUpWithPassword,
      signOut,
      refreshProfile,
      setDemoSubscription,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
