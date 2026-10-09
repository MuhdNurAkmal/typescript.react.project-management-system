import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Plus } from 'lucide-react'
import { Pill } from '@/components/Pill'
import { selectClass } from '@/components/projects/ProjectForm'
import { TypeToConfirmDialog } from '@/components/TypeToConfirmDialog'
import { useAdminAction, useAdminOrgs } from '@/components/admin/useAdmin'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useOrg } from '@/hooks/useOrg'
import { supabase } from '@/lib/supabase'
import type { AdminOrg, OrgRole } from '@/types/database'

type Mode = 'create' | 'members' | 'transfer' | 'suspend' | 'delete' | null

export function CompaniesPanel() {
  const { data, isLoading, error } = useAdminOrgs()
  const { setCurrentId } = useOrg()
  const navigate = useNavigate()
  const [target, setTarget] = useState<AdminOrg | null>(null)
  const [mode, setMode] = useState<Mode>(null)

  const setSuspended = useAdminAction(
    (v: { id: number; on: boolean; reason?: string }) =>
      supabase.rpc('admin_set_org_suspended', { p_org_id: v.id, p_suspended: v.on, p_reason: v.reason }),
    'Company updated',
  )
  const remove = useAdminAction((id: number) => supabase.rpc('admin_delete_org', { p_org_id: id }), 'Company deleted')

  function open(o: AdminOrg | null, m: Mode) {
    setTarget(o)
    setMode(m)
  }
  function close() {
    setMode(null)
    setTarget(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => open(null, 'create')}>
          <Plus /> New company
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading companies…</p>}
      {error && (
        <p className="flex items-center gap-2 text-danger-foreground" role="alert">
          <AlertCircle className="size-4" /> Could not load companies: {error.message}
        </p>
      )}
      {data && data.length === 0 && <p className="text-muted-foreground">No companies yet.</p>}
      {data && data.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Company</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="pl-5 font-medium">{o.name}</TableCell>
                    <TableCell className="text-muted-foreground">{o.owners || 'None'}</TableCell>
                    <TableCell>{o.member_count}</TableCell>
                    <TableCell>{o.project_count}</TableCell>
                    <TableCell>{o.suspended_at ? <Pill tone="red">Suspended</Pill> : <Pill tone="green">Active</Pill>}</TableCell>
                    <TableCell className="pr-5">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setCurrentId(o.id)
                            navigate('/projects')
                          }}
                        >
                          Open
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => open(o, 'members')}>
                          Members
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => open(o, 'transfer')}>
                          Transfer
                        </Button>
                        {o.suspended_at ? (
                          <Button size="sm" variant="ghost" onClick={() => setSuspended.mutate({ id: o.id, on: false })}>
                            Reactivate
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => open(o, 'suspend')}>
                            Suspend
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => open(o, 'delete')}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CreateDialog open={mode === 'create'} onClose={close} />
      {target && <MembersDialog open={mode === 'members'} org={target} onClose={close} />}
      {target && <TransferDialog open={mode === 'transfer'} org={target} onClose={close} />}
      <SuspendDialog
        open={mode === 'suspend'}
        org={target}
        pending={setSuspended.isPending}
        onClose={close}
        onSubmit={async (reason) => {
          if (target) await setSuspended.mutateAsync({ id: target.id, on: true, reason })
          close()
        }}
      />
      <TypeToConfirmDialog
        open={mode === 'delete'}
        onOpenChange={(o) => !o && close()}
        title="Delete this company?"
        description="Its projects, tasks, attendance and leave are deleted for good. Members keep their accounts."
        expected={target?.name ?? ''}
        confirmLabel="Delete company"
        pending={remove.isPending}
        onConfirm={async () => {
          if (target) await remove.mutateAsync(target.id).catch(() => undefined)
          close()
        }}
      />
    </div>
  )
}

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const create = useAdminAction(
    (v: { name: string; email: string }) => supabase.rpc('admin_create_org', { p_name: v.name, p_owner_email: v.email }),
    'Company created',
  )
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New company</DialogTitle>
          <DialogDescription>The owner must already have an account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Company name</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-owner">Owner email</Label>
            <Input id="c-owner" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || !email.trim() || create.isPending}
            onClick={async () => {
              await create.mutateAsync({ name, email }).then(() => {
                setName('')
                setEmail('')
                onClose()
              }, () => undefined)
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type MemberRow = { id: number; user_id: string; org_role: OrgRole; name: string; email: string | null }

function useOrgMembers(orgId: number) {
  return useQuery({
    queryKey: ['admin', 'members', orgId],
    queryFn: async (): Promise<MemberRow[]> => {
      const { data: members, error } = await supabase.from('organization_members').select('*').eq('organization_id', orgId)
      if (error) throw error
      const ids = members.map((m) => m.user_id)
      const { data: profiles, error: pe } = await supabase.from('profiles').select('id, full_name, email').in('id', ids)
      if (pe) throw pe
      const byId = new Map(profiles.map((p) => [p.id, p]))
      return members.map((m) => {
        const p = byId.get(m.user_id)
        return { id: m.id, user_id: m.user_id, org_role: m.org_role, name: p?.full_name || p?.email || 'Unknown', email: p?.email ?? null }
      })
    },
  })
}

function MembersDialog({ open, org, onClose }: { open: boolean; org: AdminOrg; onClose: () => void }) {
  const { data, isLoading, error } = useOrgMembers(org.id)
  const [email, setEmail] = useState('')
  const setRole = useAdminAction(
    (v: { id: number; role: OrgRole }) => supabase.from('organization_members').update({ org_role: v.role }).eq('id', v.id),
    'Role updated',
  )
  const removeMember = useAdminAction((id: number) => supabase.from('organization_members').delete().eq('id', id), 'Member removed')
  const add = useAdminAction(async (e: string) => {
    const { data: p, error } = await supabase.from('profiles').select('id').ilike('email', e.trim()).maybeSingle()
    if (error) return { error }
    if (!p) return { error: new Error('No registered user with that email') }
    return supabase.from('organization_members').insert({ organization_id: org.id, user_id: p.id, org_role: 'member' })
  }, 'Member added')

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{org.name}: members</DialogTitle>
          <DialogDescription>Changes here are recorded in the audit log.</DialogDescription>
        </DialogHeader>
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {error && <p className="text-danger-foreground">Could not load members: {error.message}</p>}
        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {data?.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-lg border p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <select
                className={`${selectClass} w-28`}
                value={m.org_role}
                aria-label={`Role of ${m.name}`}
                onChange={(e) => setRole.mutate({ id: m.id, role: e.target.value as OrgRole })}
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
              <Button size="sm" variant="ghost" onClick={() => removeMember.mutate(m.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input type="email" placeholder="Add member by email" aria-label="Email of the user to add" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button
            disabled={!email.trim() || add.isPending}
            onClick={async () => {
              await add.mutateAsync(email).then(() => setEmail(''), () => undefined)
            }}
          >
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TransferDialog({ open, org, onClose }: { open: boolean; org: AdminOrg; onClose: () => void }) {
  const { data } = useOrgMembers(org.id)
  const [pick, setPick] = useState('')
  const transfer = useAdminAction(
    (id: string) => supabase.rpc('admin_transfer_ownership', { p_org_id: org.id, p_new_owner: id }),
    'Ownership transferred',
  )
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer {org.name}</DialogTitle>
          <DialogDescription>The chosen member becomes the owner. Current owners become admins.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="t-owner">New owner</Label>
          <select id="t-owner" className={selectClass} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Choose a member…</option>
            {data?.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name} ({m.org_role})
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!pick || transfer.isPending}
            onClick={async () => {
              await transfer.mutateAsync(pick).then(onClose, () => undefined)
            }}
          >
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SuspendDialog({
  open,
  org,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean
  org: AdminOrg | null
  pending: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend {org?.name}</DialogTitle>
          <DialogDescription>The company becomes read-only: nobody can add projects, tasks or leave. Members can still clock out.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="s-reason">Reason (shown to members)</Label>
          <Input id="s-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => onSubmit(reason)}>
            Suspend
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
