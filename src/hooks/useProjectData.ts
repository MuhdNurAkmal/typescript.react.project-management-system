import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useOrg } from '@/hooks/useOrg'

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('roles').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

/** Projects the current user actively belongs to, with their role in each. */
export function useMyProjects() {
  const { user, profile } = useAuth()
  const { current } = useOrg()
  const isSuper = Boolean(profile?.is_superadmin)
  const orgId = current?.org.id
  return useQuery({
    queryKey: ['projects', user?.id, orgId, isSuper],
    enabled: !!user && !!orgId,
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from('project_members')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
      if (error) throw error
      if (memberships.length === 0 && !isSuper) return []

      const [{ data: projects, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        isSuper
          ? supabase.from('projects').select('*').eq('organization_id', orgId!)
          : supabase.from('projects').select('*').eq('organization_id', orgId!).in('id', memberships.map((m) => m.project_id)),
        supabase.from('roles').select('*'),
      ])
      if (pErr) throw pErr
      if (rErr) throw rErr

      return projects
        .map((project) => {
          const m = memberships.find((x) => x.project_id === project.id)
          return { project, role: roles.find((r) => r.id === m?.role_id) ?? null }
        })
        .sort((a, b) => b.project.created_at.localeCompare(a.project.created_at))
    },
  })
}

export function useProject(projectId: number | undefined) {
  return useQuery({
    queryKey: ['project', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', projectId!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useProjectMembers(projectId: number | undefined) {
  return useQuery({
    queryKey: ['members', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId!)
        .order('joined_at')
      if (error) throw error
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .in('id', members.map((m) => m.user_id))
      if (pErr) throw pErr
      return members.map((member) => ({
        member,
        profile: profiles.find((p) => p.id === member.user_id) ?? null,
      }))
    },
  })
}
