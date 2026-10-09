import { useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { Pill, type Tone } from '@/components/Pill'
import { useAdminAudit } from '@/components/admin/useAdmin'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'

const tone: Record<string, Tone> = { create: 'green', update: 'blue', transfer: 'blue', suspend: 'amber', reactivate: 'green', delete: 'red', insert: 'green' }

export function AuditPanel() {
  const { data, isLoading, error } = useAdminAudit()
  const { data: names } = useQuery({
    queryKey: ['admin', 'audit-actors', data?.map((d) => d.actor_id).join(',')],
    enabled: Boolean(data?.length),
    queryFn: async () => {
      const ids = [...new Set((data ?? []).map((d) => d.actor_id).filter((x): x is string => Boolean(x)))]
      const { data: rows } = await supabase.from('profiles').select('id, full_name, email').in('id', ids)
      return new Map((rows ?? []).map((r) => [r.id, r.full_name || r.email || 'Unknown']))
    },
  })

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (error)
    return (
      <p className="flex items-center gap-2 text-danger-foreground" role="alert">
        <AlertCircle className="size-4" /> Could not load the audit log: {error.message}
      </p>
    )
  if (!data?.length) return <p className="text-muted-foreground">Nothing has been recorded yet. Superadmin actions will appear here.</p>

  return (
    <Card>
      <CardContent className="overflow-x-auto px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>What</TableHead>
              <TableHead className="pr-5">By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="pl-5 whitespace-nowrap text-muted-foreground">{new Date(e.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <Pill tone={tone[e.action] ?? 'slate'} className="capitalize">
                    {e.action}
                  </Pill>
                </TableCell>
                <TableCell>{e.summary}</TableCell>
                <TableCell className="pr-5 text-muted-foreground">{(e.actor_id && names?.get(e.actor_id)) || ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
