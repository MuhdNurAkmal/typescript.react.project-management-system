import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Avatar } from '@/components/Avatar'
import { UserSearch } from '@/components/projects/UserSearch'
import { RoleBadge } from '@/components/projects/badges'
import { selectClass } from '@/components/projects/ProjectForm'
import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/hooks/useAuth'
import { useConfirm } from '@/hooks/useConfirm'
import { useProjectMembers, useRoles } from '@/hooks/useProjectData'
import { supabase } from '@/lib/supabase'

export function MembersTab({ projectId, canManage }: { projectId: number; canManage: boolean }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const { data: members, isLoading, error } = useProjectMembers(projectId)
  const { data: roles } = useRoles()
  const [query, setQuery] = useState('')
  const [pickedEmail, setPickedEmail] = useState<string | null>(null)
  const [roleId, setRoleId] = useState<number | null>(null)

  const defaultRoleId = roleId ?? roles?.find((r) => r.name === 'developer')?.id ?? null
  const refresh = () => qc.invalidateQueries({ queryKey: ['members', projectId] })
  const pmCount = members?.filter((m) => m.member.is_active && roles?.find((r) => r.id === m.member.role_id)?.is_pm).length ?? 0

  const add = useMutation({
    mutationFn: async () => {
      // A suggestion was picked, or the PM typed a full email address
      const email = pickedEmail ?? query.trim()
      if (!email.includes('@')) throw new Error('Pick someone from the suggestions, or type their full email')
      const { error } = await supabase.rpc('add_project_member', {
        p_project_id: projectId,
        p_email: email,
        p_role_id: defaultRoleId!,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setQuery('')
      setPickedEmail(null)
      toast.success('Member added')
      await refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: { role_id?: number; is_active?: boolean } }) => {
      const { error } = await supabase.from('project_members').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('project_members').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: async () => {
      toast.success('Member removed. Their tasks are now unassigned.')
      await refresh()
      await qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      await qc.invalidateQueries({ queryKey: ['my-tasks'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function removeMember(id: number, name: string) {
    const ok = await confirm({
      title: `Remove ${name} from this project?`,
      description: 'Their tasks in this project become unassigned. They can be added again later.',
      confirmLabel: 'Remove',
    })
    if (ok) remove.mutate(id)
  }

  function onAdd(e: FormEvent) {
    e.preventDefault()
    add.mutate()
  }

  async function deactivate(id: number, name: string) {
    const ok = await confirm({
      title: `Deactivate ${name}?`,
      description: 'They will lose access to this project. You can reactivate them later.',
      confirmLabel: 'Deactivate',
    })
    if (ok) {
      update.mutate({ id, patch: { is_active: false } })
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <Card className="overflow-visible">
          <CardHeader>
            <CardTitle>Add member</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onAdd} className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1 space-y-2">
                <Label htmlFor="m-search">Find a company member</Label>
                <UserSearch
                  scope={`project-${projectId}`}
                  fetcher={async (term) => {
                    const { data, error } = await supabase.rpc('search_users', { p_project_id: projectId, p_query: term })
                    if (error) throw error
                    return data
                  }}
                  value={query}
                  onChange={(v) => {
                    setQuery(v)
                    setPickedEmail(null)
                  }}
                  onPick={(u) => {
                    setQuery(u.full_name ? `${u.full_name} (${u.email})` : (u.email ?? ''))
                    setPickedEmail(u.email)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-role">Role</Label>
                <select id="m-role" className={`${selectClass} w-40 capitalize`} value={defaultRoleId ?? ''} onChange={(e) => setRoleId(Number(e.target.value))}>
                  {roles?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={add.isPending || defaultRoleId === null}>
                {add.isPending ? 'Adding…' : 'Add'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-muted-foreground">Loading members…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {members && (
        <Card>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map(({ member, profile }) => {
                  const role = roles?.find((r) => r.id === member.role_id)
                  const name = profile?.full_name || profile?.email || 'Unknown'
                  // Keep at least one active PM so the project is never orphaned
                  const lastPm = !!role?.is_pm && member.is_active && pmCount <= 1
                  return (
                    <TableRow key={member.id} className={member.is_active ? '' : 'opacity-50'}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <Avatar name={name} size="sm" />
                          {name}
                          {member.user_id === user?.id && <span className="text-muted-foreground"> (you)</span>}
                        </span>
                      </TableCell>
                      <TableCell>{profile?.email}</TableCell>
                      <TableCell>
                        {canManage && member.is_active ? (
                          <select
                            className={`${selectClass} w-32 capitalize`}
                            value={member.role_id}
                            disabled={lastPm}
                            onChange={(e) => update.mutate({ id: member.id, patch: { role_id: Number(e.target.value) } })}
                          >
                            {roles?.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <RoleBadge name={role?.name ?? null} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Pill tone={member.is_active ? 'teal' : 'slate'}>{member.is_active ? 'Active' : 'Inactive'}</Pill>
                      </TableCell>
                      {canManage && (
                        <TableCell className="space-x-2 text-right whitespace-nowrap">
                          {member.is_active ? (
                            <Button variant="outline" size="sm" disabled={lastPm} onClick={() => deactivate(member.id, name)}>
                              Deactivate
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => update.mutate({ id: member.id, patch: { is_active: true } })}>
                              Reactivate
                            </Button>
                          )}
                          {member.user_id !== user?.id && (
                            <Button variant="outline" size="sm" disabled={lastPm} onClick={() => removeMember(member.id, name)}>
                              Remove
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
