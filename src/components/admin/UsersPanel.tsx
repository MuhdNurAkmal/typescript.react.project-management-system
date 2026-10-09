import { useState } from 'react'
import { AlertCircle, Search } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { Pill } from '@/components/Pill'
import { TypeToConfirmDialog } from '@/components/TypeToConfirmDialog'
import { useAdminAction, useAdminUsers } from '@/components/admin/useAdmin'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/hooks/useAuth'
import { useDebounced } from '@/hooks/useDebounced'
import { supabase } from '@/lib/supabase'
import type { AdminUser } from '@/types/database'

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'Never')

export function UsersPanel() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 250)
  const { data, isLoading, error } = useAdminUsers(debounced)
  const [target, setTarget] = useState<AdminUser | null>(null)
  const [mode, setMode] = useState<'suspend' | 'rename' | 'delete' | null>(null)
  const [text, setText] = useState('')

  const suspend = useAdminAction(
    (v: { id: string; on: boolean; reason?: string }) =>
      supabase.rpc('admin_set_user_suspended', { p_user_id: v.id, p_suspended: v.on, p_reason: v.reason }),
    'User updated',
  )
  const rename = useAdminAction(
    (v: { id: string; name: string }) => supabase.rpc('admin_update_user_name', { p_user_id: v.id, p_full_name: v.name }),
    'Name updated',
  )
  const remove = useAdminAction((id: string) => supabase.rpc('admin_delete_user', { p_user_id: id }), 'User deleted')
  const reset = useAdminAction(
    (email: string) => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }),
    'Password reset email sent',
  )

  function open(u: AdminUser, m: 'suspend' | 'rename' | 'delete') {
    setTarget(u)
    setMode(m)
    setText(m === 'rename' ? (u.full_name ?? '') : '')
  }
  function close() {
    setMode(null)
    setTarget(null)
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search users" />
      </div>

      {isLoading && <p className="text-muted-foreground">Loading users…</p>}
      {error && (
        <p className="flex items-center gap-2 text-danger-foreground" role="alert">
          <AlertCircle className="size-4" /> Could not load users: {error.message}
        </p>
      )}
      {data && data.length === 0 && <p className="text-muted-foreground">No users match.</p>}
      {data && data.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">User</TableHead>
                  <TableHead>Companies</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((u) => {
                  const me = u.id === user?.id
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.full_name || u.email || '?'} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{u.full_name || '(no name)'}</p>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{u.company_count}</TableCell>
                      <TableCell className="text-muted-foreground">{fmt(u.last_sign_in_at)}</TableCell>
                      <TableCell>
                        {u.is_superadmin ? <Pill tone="violet">Superadmin</Pill> : u.suspended_at ? <Pill tone="red">Suspended</Pill> : <Pill tone="green">Active</Pill>}
                      </TableCell>
                      <TableCell className="pr-5">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => open(u, 'rename')}>
                            Rename
                          </Button>
                          <Button size="sm" variant="ghost" disabled={!u.email || reset.isPending} onClick={() => u.email && reset.mutate(u.email)}>
                            Reset password
                          </Button>
                          {!me &&
                            (u.suspended_at ? (
                              <Button size="sm" variant="ghost" onClick={() => suspend.mutate({ id: u.id, on: false })}>
                                Reactivate
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => open(u, 'suspend')}>
                                Suspend
                              </Button>
                            ))}
                          {!me && (
                            <Button size="sm" variant="destructive" onClick={() => open(u, 'delete')}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={mode === 'suspend' || mode === 'rename'} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === 'rename' ? 'Rename user' : 'Suspend user'}</DialogTitle>
            <DialogDescription>
              {mode === 'rename'
                ? target?.email
                : `${target?.full_name || target?.email} will be signed out of everything and cannot use the system until you reactivate them.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="admin-text">{mode === 'rename' ? 'Full name' : 'Reason (shown to the user)'}</Label>
            <Input id="admin-text" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              disabled={suspend.isPending || rename.isPending}
              onClick={async () => {
                if (!target) return
                if (mode === 'rename') await rename.mutateAsync({ id: target.id, name: text })
                else await suspend.mutateAsync({ id: target.id, on: true, reason: text })
                close()
              }}
            >
              {mode === 'rename' ? 'Save' : 'Suspend'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TypeToConfirmDialog
        open={mode === 'delete'}
        onOpenChange={(o) => !o && close()}
        title="Delete this user?"
        description="Their account is removed for good and their tasks become unassigned. Projects and companies they created are kept and handed to you; a company they solely own gets a new owner from its members."
        expected={target?.email ?? ''}
        confirmLabel="Delete user"
        pending={remove.isPending}
        onConfirm={async () => {
          if (!target) return
          await remove.mutateAsync(target.id).catch(() => undefined)
          close()
        }}
      />
    </div>
  )
}
