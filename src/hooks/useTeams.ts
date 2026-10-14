import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ProjectTeam } from '@/types/database'

export interface TeamWithMembers {
  team: ProjectTeam
  userIds: string[]
}

/** The teams of a project with the ids of their members, by name. */
export function useTeams(projectId: number) {
  return useQuery({
    queryKey: ['teams', projectId],
    queryFn: async (): Promise<TeamWithMembers[]> => {
      const { data: teams, error } = await supabase.from('project_teams').select('*').eq('project_id', projectId).order('name')
      if (error) throw error
      if (teams.length === 0) return []
      const { data: links, error: lErr } = await supabase.from('project_team_members').select('*').in('team_id', teams.map((t) => t.id))
      if (lErr) throw lErr
      return teams.map((team) => ({ team, userIds: links.filter((l) => l.team_id === team.id).map((l) => l.user_id) }))
    },
  })
}
