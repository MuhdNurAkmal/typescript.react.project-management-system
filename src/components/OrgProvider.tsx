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
  const { user, profile } = useAuth()
  const isSuper = Boolean(profile?.is_superadmin)
  const qc = useQueryClient()
  const [picked, setPicked] = useState<number | null>(() => readStored(user?.id))
  const [pickedFor, setPickedFor] = useState(user?.id)

  // another account signed in on this browser: reload its remembered choice
  if (pickedFor !== user?.id) {
    setPickedFor(user?.id)
    setPicked(readStored(user?.id))
  }

  const query = useQuery({
    queryKey: ['orgs', user?.id, isSuper],
    enabled: !!user,
    queryFn: async (): Promise<OrgEntry[]> => {
      const { data: memberships, error } = await supabase.from('organization_members').select('*').eq('user_id', user!.id)
      if (error) throw error
      const { data: roles, error: rErr } = await supabase.from('organization_roles').select('*')
      if (rErr) throw rErr
      const roleById = new Map(roles.map((r) => [r.id, r]))
      const ownerRole = roles.find((r) => r.is_owner) ?? roles[0]
      const roleOf = new Map(memberships.map((m) => [m.organization_id, roleById.get(m.org_role_id)]))
      // the superadmin sees every company; the ones they do not belong to open with owner-level access
      let q = supabase.from('organizations').select('*')
      if (!isSuper) {
        if (memberships.length === 0) return []
        q = q.in('id', memberships.map((m) => m.organization_id))
      }
      const { data: orgs, error: oErr } = await q
      if (oErr) throw oErr
      return orgs
        .map((org) => ({ org, role: roleOf.get(org.id) ?? ownerRole, member: roleOf.has(org.id) }))
        .filter((e) => e.role)
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
      isAdmin: current?.role.is_admin ?? false,
      isOwner: current?.role.is_owner ?? false,
      loading: !!user && query.isLoading,
      refresh,
    }
  }, [query.data, query.isLoading, picked, setCurrentId, refresh, user])

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}
