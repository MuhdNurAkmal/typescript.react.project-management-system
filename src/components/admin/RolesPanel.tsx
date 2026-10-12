import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Pill } from '@/components/Pill'
import { TypeToConfirmDialog } from '@/components/TypeToConfirmDialog'
import { useAdminAction } from '@/components/admin/useAdmin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useOrgRoles } from '@/hooks/useOrgRoles'
import { supabase } from '@/lib/supabase'
import type { Role } from '@/types/database'

interface Row {
  id: number
  name: string
  description: string | null
  isSystem: boolean
  tags: string[]
  flagOn: boolean
  flag2On?: boolean
  flag3On?: boolean
}

interface Editing {
  id: number | null
  name: string
  description: string
  flag: boolean
  flag2: boolean
  flag3: boolean
}

/** Shared list + add/edit/delete for a roles table. The flag is the one power the table cares about (admin or project manager). */
function RolesCard({
  title,
  description,
  flagLabel,
  flag2Label,
  flag3Label,
  rows,
  loading,
  error,
  onSave,
  onDelete,
  busy,
}: {
  title: string
  description: string
  flagLabel: string
  /** An optional second switch, shown on create and edit. */
  flag2Label?: string
  flag3Label?: string
  rows: Row[]
  loading: boolean
  error: Error | null
  onSave: (v: Editing) => Promise<unknown>
  onDelete: (id: number) => Promise<unknown>
  busy: boolean
}) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-muted-foreground">Loading…</p>}
        {error && <p className="text-danger-foreground">Could not load roles: {error.message}</p>}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Powers</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.name} {r.isSystem && <span className="text-xs text-muted-foreground">(built in)</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.description}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {r.tags.length === 0 ? <Pill tone="slate">Standard</Pill> : r.tags.map((t) => <Pill key={t} tone="blue">{t}</Pill>)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: r.id, name: r.name, description: r.description ?? '', flag: r.flagOn, flag2: r.flag2On ?? true, flag3: r.flag3On ?? true })}>
                      Edit
                    </Button>
                    {!r.isSystem && (
                      <Button size="sm" variant="destructive" onClick={() => setDeleting(r)}>
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Button variant="outline" onClick={() => setEditing({ id: null, name: '', description: '', flag: false, flag2: true, flag3: true })}>
          <Plus /> New role
        </Button>
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit role' : 'New role'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="role-name">Name</Label>
                <Input id="role-name" maxLength={60} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role-desc">Description</Label>
                <Input id="role-desc" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              {editing.id === null && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.flag} onChange={(e) => setEditing({ ...editing, flag: e.target.checked, flag2: e.target.checked ? true : editing.flag2, flag3: e.target.checked ? true : editing.flag3 })} />
                  {flagLabel}
                </label>
              )}
              {flag2Label && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.flag2 || editing.flag}
                    disabled={editing.flag || (editing.id !== null && rows.find((r) => r.id === editing.id)?.flagOn)}
                    onChange={(e) => setEditing({ ...editing, flag2: e.target.checked, flag3: e.target.checked ? editing.flag3 : false })}
                  />
                  {flag2Label}
                </label>
              )}
              {flag3Label && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.flag3 || editing.flag}
                    disabled={editing.flag || !(editing.flag2 || editing.flag) || (editing.id !== null && rows.find((r) => r.id === editing.id)?.flagOn)}
                    onChange={(e) => setEditing({ ...editing, flag3: e.target.checked })}
                  />
                  {flag3Label}
                </label>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={!editing?.name.trim() || busy}
              onClick={async () => {
                if (!editing) return
                await onSave(editing).then(() => setEditing(null), () => undefined)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TypeToConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this role?"
        description="This fails if anybody still has the role. Move them to another role first."
        expected={deleting?.name ?? ''}
        confirmLabel="Delete role"
        pending={busy}
        onConfirm={async () => {
          if (deleting) await onDelete(deleting.id).catch(() => undefined)
          setDeleting(null)
        }}
      />
    </Card>
  )
}

function CompanyRoles() {
  const { data, isLoading, error } = useOrgRoles()
  const save = useAdminAction(
    async (v: Editing) =>
      v.id === null
        ? supabase.from('organization_roles').insert({ name: v.name.trim(), description: v.description.trim() || null, is_admin: v.flag })
        : supabase.from('organization_roles').update({ name: v.name.trim(), description: v.description.trim() || null }).eq('id', v.id),
    'Role saved',
  )
  const remove = useAdminAction((id: number) => supabase.from('organization_roles').delete().eq('id', id), 'Role deleted')
  return (
    <RolesCard
      title="Company roles"
      description="What people can be inside a company. The powers of the built-in roles are fixed; names and descriptions can change."
      flagLabel="Can manage people and review attendance and leave (admin powers)"
      rows={(data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isSystem: r.is_system,
        tags: [r.is_owner ? 'Owner: full control' : null, r.is_admin ? 'Admin: people, attendance, leave' : null].filter((t): t is string => t !== null),
        flagOn: r.is_admin,
      }))}
      loading={isLoading}
      error={error}
      onSave={(v) => save.mutateAsync(v)}
      onDelete={(id) => remove.mutateAsync(id)}
      busy={save.isPending || remove.isPending}
    />
  )
}

function ProjectRoles() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'project-roles'],
    queryFn: async (): Promise<Role[]> => {
      const { data, error } = await supabase.from('roles').select('*').order('id')
      if (error) throw error
      return data
    },
  })
  const save = useAdminAction(
    async (v: Editing) =>
      v.id === null
        ? supabase.from('roles').insert({ name: v.name.trim(), description: v.description.trim() || null, is_pm: v.flag, can_edit: v.flag || v.flag2, can_delete: v.flag || (v.flag2 && v.flag3) })
        : supabase.from('roles').update({ name: v.name.trim(), description: v.description.trim() || null, can_edit: v.flag || v.flag2, can_delete: v.flag || (v.flag2 && v.flag3) }).eq('id', v.id),
    'Role saved',
  )
  const remove = useAdminAction((id: number) => supabase.from('roles').delete().eq('id', id), 'Role deleted')
  return (
    <RolesCard
      title="Project roles"
      description="What people can be inside a project. Keep at least one role with project-manager powers."
      flagLabel="Can manage the project, its members and tasks (project manager powers)"
      flag2Label="Can create, edit, move and assign cards (untick for a read-only role)"
      flag3Label="Can delete cards"
      rows={(data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isSystem: r.is_system,
        tags: r.is_pm ? ['Project manager'] : r.can_edit ? ['Edits cards', ...(r.can_delete ? ['Deletes cards'] : [])] : ['Read-only'],
        flagOn: r.is_pm,
        flag2On: r.can_edit,
        flag3On: r.can_delete,
      }))}
      loading={isLoading}
      error={error}
      onSave={(v) => save.mutateAsync(v)}
      onDelete={(id) => remove.mutateAsync(id)}
      busy={save.isPending || remove.isPending}
    />
  )
}

export function RolesPanel() {
  return (
    <div className="space-y-6">
      <CompanyRoles />
      <ProjectRoles />
    </div>
  )
}
