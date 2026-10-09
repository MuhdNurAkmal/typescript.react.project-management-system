import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { OrgContext, type OrgContextValue, type OrgEntry } from '@/lib/org-context'
import { supabase } from '@/lib/supabase'

const storageKey = (userId: string) => `pms.org.${userId}`

function readStored(userId: string | undefined): number | null {
  if (!userId) return null
  try {
    const v = window.localStorage.getItem(storageKey(userId))
    return v ? Number(v) : null
  } catch {
    return null
  }
}

/** Loads the user's companies and remembers which one is selected. */
export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [picked, setPicked] = useState<number | null>(() => readStored(user?.id))
  const [pickedFor, setPickedFor] = useState(user?.id)

  // another account signed in on this browser: reload its remembered choice
  if (pickedFor !== user?.id) {
    setPickedFor(user?.id)
    setPicked(readStored(user?.id))
  }

  const query = useQuery({
    queryKey: ['orgs', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<OrgEntry[]> => {
      const { data: memberships, error } = await supabase.from('organization_members').select('*').eq('user_id', user!.id)
      if (error) throw error
      if (memberships.length === 0) return []
      const { data: orgs, error: oErr } = await supabase.from('organizations').select('*').in('id', memberships.map((m) => m.organization_id))
      if (oErr) throw oErr
      return memberships
        .map((m) => ({ org: orgs.find((o) => o.id === m.organization_id)!, role: m.org_role }))
        .filter((e) => e.org)
        .sort((a, b) => a.org.name.localeCompare(b.org.name))
    },
  })

  const setCurrentId = useCallback(
    (id: number) => {
      setPicked(id)
      if (!user) return
      try {
        window.localStorage.setItem(storageKey(user.id), String(id))
      } catch {
        // storage can be blocked; the choice then just lasts for this visit
      }
    },
    [user],
  )

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['orgs'] }), [qc])

  const value = useMemo<OrgContextValue>(() => {
    const orgs = query.data ?? []
    const current = orgs.find((e) => e.org.id === picked) ?? orgs[0] ?? null
    return {
      orgs,
      current,
      setCurrentId,
      isAdmin: current?.role === 'owner' || current?.role === 'admin',
      isOwner: current?.role === 'owner',
      loading: !!user && query.isLoading,
      refresh,
    }
  }, [query.data, query.isLoading, picked, setCurrentId, refresh, user])

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}
