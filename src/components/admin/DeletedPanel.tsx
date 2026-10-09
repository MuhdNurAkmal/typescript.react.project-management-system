import { useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { useAdminAction } from '@/components/admin/useAdmin'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import type { AdminDeletedProject } from '@/types/database'

/** Deleted projects are kept for 30 days and can be restored with their members, tasks, dependencies, milestones and comments. */
export function DeletedPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'deleted'],
    queryFn: async (): Promise<AdminDeletedProject[]> => {
      const { data, error } = await supabase.rpc('admin_list_deleted_projects')
      if (error) throw error
      return data
    },
  })
  const restore = useAdminAction((id: number) => supabase.rpc('admin_restore_project', { p_deleted_id: id }), 'Project restored')

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (error)
    return (
      <p className="flex items-center gap-2 text-danger-foreground" role="alert">
        <AlertCircle className="size-4" /> Could not load deleted projects: {error.message}
      </p>
    )
  if (!data?.length) return <p className="text-muted-foreground">No deleted projects in the last 30 days.</p>

  return (
    <Card>
      <CardContent className="overflow-x-auto px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Project</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Tasks</TableHead>
              <TableHead>Deleted</TableHead>
              <TableHead className="pr-5 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="pl-5 font-medium">{d.name}</TableCell>
                <TableCell className="text-muted-foreground">{d.organization_name ?? 'Company deleted'}</TableCell>
                <TableCell>{d.task_count}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(d.deleted_at).toLocaleString()}
                  {d.deleted_by_name ? ` by ${d.deleted_by_name}` : ''}
                </TableCell>
                <TableCell className="pr-5 text-right">
                  <Button size="sm" variant="outline" disabled={!d.company_exists || restore.isPending} onClick={() => restore.mutate(d.id)}>
                    Restore
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
