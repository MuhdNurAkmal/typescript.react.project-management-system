import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MultiCombobox } from '@/components/ui/multi-combobox'
import { AssigneeStack } from '@/components/tasks/AssigneeStack'
import { useConfirm } from '@/hooks/useConfirm'
import { useProjectMembers } from '@/hooks/useProjectData'
import { useTeams, type TeamWithMembers } from '@/hooks/useTeams'
import { supabase } from '@/lib/supabase'

/** Teams of this project: named groups of members, used to assign several people to a task at once. */
export function TeamsSection({ projectId, canManage }: { projectId: number; canManage: boolean }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const { data: teams, isLoading, error } = useTeams(projectId)
  const { data: members } = useProjectMembers(projectId)
  // undefined = closed, null = new team
  const [editing, setEditing] = useState<TeamWithMembers | null | undefined>(undefined)

  const nameOf = (id: string) => {
    const p = members?.find((m) => m.member.user_id === id)?.profile
    return p?.full_name || p?.email || 'Former member'
  }
  const refresh = () => qc.invalidateQueries({ queryKey: ['teams', projectId] })

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('project_teams').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Teams</h2>
        {canManage && (
          <Button size="sm" variant="success" onClick={() => setEditing(null)}>
            <Plus /> New team
          </Button>
        )}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {teams?.length === 0 && (
        <p className="text-sm text-muted-foreground">No teams yet.{canManage ? ' Create one to assign several people to a task at once.' : ''}</p>
      )}
      {teams && teams.length > 0 && (
        <Card>
          <CardContent>
            <ul className="divide-y">
              {teams.map((t) => (
                <li key={t.team.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.team.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.userIds.length} {t.userIds.length === 1 ? 'person' : 'people'}
                    </div>
                  </div>
                  <AssigneeStack names={t.userIds.map(nameOf)} max={4} />
                  {canManage && (
                    <div className="flex items-center gap-1.5">
                      <Button size="icon-sm" variant="outline" aria-label={`Edit ${t.team.name}`} title="Edit team" onClick={() => setEditing(t)}>
                        <Pencil />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="destructive"
                        aria-label={`Delete ${t.team.name}`}
                        title="Delete team"
                        onClick={async () =>
                          (await confirm({ title: `Delete team "${t.team.name}"?`, description: 'The people stay in the project and keep their tasks.', confirmLabel: 'Delete' })) &&
                          remove.mutate(t.team.id)
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        <DialogContent>
          {editing !== undefined && (
            <TeamForm
              key={editing?.team.id ?? 'new'}
              projectId={projectId}
              team={editing}
              onDone={async () => {
                setEditing(undefined)
                await refresh()
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

function TeamForm({ projectId, team, onDone }: { projectId: number; team: TeamWithMembers | null; onDone: () => Promise<void> }) {
  const { data: members } = useProjectMembers(projectId)
  const [name, setName] = useState(team?.team.name ?? '')
  const [ids, setIds] = useState<string[]>(team?.userIds ?? [])
  const active = members?.filter((m) => m.member.is_active) ?? []

  const save = useMutation({
    mutationFn: async () => {
      let teamId = team?.team.id
      if (team) {
        const { error } = await supabase.from('project_teams').update({ name: name.trim() }).eq('id', team.team.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('project_teams').insert({ project_id: projectId, name: name.trim() }).select('id').single()
        if (error) throw error
        teamId = data.id
      }
      const before = team?.userIds ?? []
      const removed = before.filter((id) => !ids.includes(id))
      const added = ids.filter((id) => !before.includes(id))
      if (removed.length) {
        const { error } = await supabase.from('project_team_members').delete().eq('team_id', teamId!).in('user_id', removed)
        if (error) throw error
      }
      if (added.length) {
        const { error } = await supabase.from('project_team_members').insert(added.map((user_id) => ({ team_id: teamId!, user_id })))
        if (error) throw error
      }
    },
    onSuccess: onDone,
    onError: (e: Error) => toast.error(e.message.includes('project_teams_name_key') ? 'A team with this name already exists' : e.message),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (name.trim()) save.mutate()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{team ? 'Edit team' : 'New team'}</DialogTitle>
        <DialogDescription>A team is a group of project members. When you add a team to a task, its members are assigned to it one by one.</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="team-name">Name</Label>
        <Input id="team-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Frontend" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="team-members">Members</Label>
        <MultiCombobox
          id="team-members"
          items={active.map(({ member, profile }) => ({ value: member.user_id, label: profile?.full_name || profile?.email || 'Unknown' }))}
          value={ids}
          onChange={setIds}
          placeholder="Choose the people in this team"
          emptyText="No member matches."
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={save.isPending || !name.trim()}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  )
}
