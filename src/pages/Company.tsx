import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/Avatar'
import { NoCompany } from '@/components/company/NoCompany'
import { CreateCompanyForm } from '@/components/company/CreateCompanyForm'
import { Pill, type Tone } from '@/components/Pill'
import { selectClass } from '@/components/projects/ProjectForm'
import { UserSearch } from '@/components/projects/UserSearch'
import { TypeToConfirmDialog } from '@/components/TypeToConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/hooks/useAuth'
import { useConfirm } from '@/hooks/useConfirm'
import { useOrg } from '@/hooks/useOrg'
import { supabase } from '@/lib/supabase'
import type { OrgRole } from '@/types/database'

const roleTone: Record<OrgRole, Tone> = { owner: 'violet', admin: 'blue', member: 'slate' }
const roleHelp: Record<OrgRole, string> = {
  owner: 'Full control, including deleting the company',
  admin: 'Manages members, reviews attendance and leave',
  member: 'Takes part in projects and clocks in',
}

export default function Company() {
  const { current, isAdmin, isOwner } = useOrg()
  const { user } = useAuth()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [newOpen, setNewOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const orgId = current?.org.id ?? 0

  const members = useQuery({
    queryKey: ['org-members', orgId],
    enabled: !!current,
    queryFn: async () => {
      const { data: rows, error } = await supabase.from('organization_members').select('*').eq('organization_id', orgId).order('joined_at')
      if (error) throw error
      const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').in('id', rows.map((r) => r.user_id))
      if (pErr) throw pErr
      return rows.map((member) => ({ member, profile: profiles.find((p) => p.id === member.user_id) ?? null }))
    },
  })

  const refreshMembers = () => qc.invalidateQueries({ queryKey: ['org-members', orgId] })

  if (!current) return <NoCompany />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{current.org.name}</h1>
          <Pill tone={roleTone[current.role]} className="capitalize">
            {current.role}
          </Pill>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger render={<Button variant="outline" />}>
            <Plus /> New company
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create another company</DialogTitle>
              <DialogDescription>You become its owner. You can switch between companies from the sidebar.</DialogDescription>
            </DialogHeader>
            <CreateCompanyForm onDone={() => setNewOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isAdmin && <RenameCard orgId={orgId} name={current.org.name} />}
      {isAdmin && <AddMemberCard orgId={orgId} onAdded={refreshMembers} />}

      <Card>
        <CardHeader>
          <CardTitle>People in this company</CardTitle>
          <CardDescription>Only people listed here can be added to projects, clock in and request leave.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {members.isLoading && <p className="text-muted-foreground">Loading…</p>}
          {members.error && <p className="text-destructive">{members.error.message}</p>}
          {members.data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.data.map(({ member, profile }) => {
                  const name = profile?.full_name || profile?.email || 'Unknown'
                  const self = member.user_id === user?.id
                  // admins cannot touch owners; only owners can
                  const editable = isAdmin && !self && (member.org_role !== 'owner' || isOwner)
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <Avatar name={name} size="sm" />
                          {name}
                          {self && <span className="text-muted-foreground">(you)</span>}
                        </span>
                      </TableCell>
                      <TableCell>{profile?.email}</TableCell>
                      <TableCell>
                        {editable ? (
                          <RoleSelect orgId={orgId} memberId={member.id} value={member.org_role} isOwner={isOwner} onChanged={refreshMembers} />
                        ) : (
                          <Pill tone={roleTone[member.org_role]} className="capitalize">
                            {member.org_role}
                          </Pill>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          {editable && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: `Remove ${name} from ${current.org.name}?`,
                                  description: 'They are removed from all projects in this company and their tasks there become unassigned.',
                                  confirmLabel: 'Remove',
                                })
                                if (!ok) return
                                const { error } = await supabase.from('organization_members').delete().eq('id', member.id)
                                if (error) return toast.error(error.message)
                                toast.success(`${name} removed`)
                                await refreshMembers()
                                await qc.invalidateQueries({ queryKey: ['projects'] })
                                await qc.invalidateQueries({ queryKey: ['tasks'] })
                              }}
                            >
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
          )}
        </CardContent>
      </Card>

      {isOwner && (
        <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="font-medium text-destructive">Danger zone</div>
          <p className="text-sm text-muted-foreground">
            Deleting the company permanently removes all its projects, tasks, attendance and leave records. This cannot be undone.
          </p>
          <Button variant="destructive" onClick={() => setDeleting(true)}>
            Delete this company
          </Button>
          <DeleteCompany open={deleting} onOpenChange={setDeleting} orgId={orgId} name={current.org.name} />
        </div>
      )}
    </div>
  )
}

function RoleSelect({ orgId, memberId, value, isOwner, onChanged }: { orgId: number; memberId: number; value: OrgRole; isOwner: boolean; onChanged: () => void }) {
  const roles: OrgRole[] = isOwner ? ['owner', 'admin', 'member'] : ['admin', 'member']
  const change = useMutation({
    mutationFn: async (org_role: OrgRole) => {
      const { error } = await supabase.from('organization_members').update({ org_role }).eq('id', memberId).eq('organization_id', orgId)
      if (error) throw error
    },
    onSuccess: onChanged,
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <select className={`${selectClass} w-32 capitalize`} value={value} title={roleHelp[value]} onChange={(e) => change.mutate(e.target.value as OrgRole)}>
      {roles.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  )
}

function RenameCard({ orgId, name }: { orgId: number; name: string }) {
  const { refresh } = useOrg()
  const [value, setValue] = useState(name)
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('organizations').update({ name: value.trim() }).eq('id', orgId)
      if (error) throw error
    },
    onSuccess: async () => {
      await refresh()
      toast.success('Company renamed')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <Card>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (value.trim()) save.mutate()
          }}
        >
          <div className="min-w-56 flex-1 space-y-2">
            <Label htmlFor="org-name">Company name</Label>
            <Input id="org-name" maxLength={120} value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <Button type="submit" variant="secondary" disabled={save.isPending || !value.trim() || value.trim() === name}>
            Rename
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function AddMemberCard({ orgId, onAdded }: { orgId: number; onAdded: () => void }) {
  const [query, setQuery] = useState('')
  const [pickedEmail, setPickedEmail] = useState<string | null>(null)
  const [role, setRole] = useState<'member' | 'admin'>('member')

  const add = useMutation({
    mutationFn: async () => {
      const email = pickedEmail ?? query.trim()
      if (!email.includes('@')) throw new Error('Pick someone from the suggestions, or type their full email')
      const { error } = await supabase.rpc('add_org_member', { p_organization_id: orgId, p_email: email, p_org_role: role })
      if (error) throw error
    },
    onSuccess: () => {
      setQuery('')
      setPickedEmail(null)
      toast.success('Added to the company')
      onAdded()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Card className="overflow-visible">
      <CardHeader>
        <CardTitle>Add a person</CardTitle>
        <CardDescription>They must already have an account. Search by name or email.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            add.mutate()
          }}
        >
          <div className="min-w-56 flex-1 space-y-2">
            <Label htmlFor="m-search">Find a registered user</Label>
            <UserSearch
              scope={`org-${orgId}`}
              fetcher={async (term) => {
                const { data, error } = await supabase.rpc('search_org_users', { p_organization_id: orgId, p_query: term })
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
            <Label htmlFor="org-role">Role</Label>
            <select id="org-role" className={`${selectClass} w-32`} value={role} onChange={(e) => setRole(e.target.value as 'member' | 'admin')}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button type="submit" disabled={add.isPending}>
            {add.isPending ? 'Adding…' : 'Add'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function DeleteCompany({ open, onOpenChange, orgId, name }: { open: boolean; onOpenChange: (o: boolean) => void; orgId: number; name: string }) {
  const { refresh } = useOrg()
  const qc = useQueryClient()
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('organizations').delete().eq('id', orgId)
      if (error) throw error
    },
    onSuccess: async () => {
      onOpenChange(false)
      toast.success(`Company "${name}" deleted`)
      qc.clear()
      await refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <TypeToConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete this company?"
      description={`This permanently deletes "${name}" with all its projects, tasks, attendance and leave records.`}
      expected={name}
      confirmLabel="I understand, delete this company"
      pending={del.isPending}
      onConfirm={() => del.mutate()}
    />
  )
}
