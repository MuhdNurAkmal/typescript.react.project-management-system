import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthContext, type AuthContextValue } from '@/lib/auth-context'
import type { Profile } from '@/types/database'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const userId = session?.user.id

  const loadProfile = useCallback(async (id: string | undefined) => {
    if (!id) {
      setProfile(null)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
    setProfile(data)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    void loadProfile(userId)
  }, [userId, loadProfile])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      signUp: async (email, password, fullName) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        if (error) throw error
        // With email confirmation off, signUp returns a session. End it so the user must sign in.
        if (data.session) await supabase.auth.signOut()
        return { needsConfirmation: !data.session }
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      },
      resetPassword: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
      },
      refreshProfile: () => loadProfile(userId),
    }),
    [session, profile, loading, loadProfile, userId],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
