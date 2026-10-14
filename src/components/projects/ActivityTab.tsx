import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Avatar } from '@/components/Avatar'
import { Pill, type Tone } from '@/components/Pill'
import { selectClass } from '@/components/projects/ProjectForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const tone: Record<string, Tone> = { create: 'green', update: 'blue', delete: 'red' }
const verb: Record<string, string> = { create: 'Added', update: 'Changed', delete: 'Deleted' }
const ENTITIES: Record<string, string> = { task: 'Task', member: 'Member', milestone: 'Milestone', project: 'Project' }
const PAGE_SIZES = [5, 10, 50, 100]

/** Who changed what in this project (PMs only; enforced by RLS), newest first, a page at a time. */
export function ActivityTab({ projectId }: { projectId: number }) {
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(0)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [action, setAction] = useState('')
  const [entity, setEntity] = useState('')
  const filtered = from !== '' || to !== '' || action !== '' || entity !== ''

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit', projectId, page, pageSize, from, to, action, entity],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase.from('audit_log').select('*', { count: 'exact' }).eq('project_id', projectId)
      // the dates are the viewer's local days
      if (from) q = q.gte('created_at', new Date(`${from}T00:00:00`).toISOString())
      if (to) q = q.lt('created_at', new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000).toISOString())
      if (action) q = q.eq('action', action as 'create' | 'update' | 'delete')
      if (entity) q = q.eq('entity', entity)
      const { data: rows, count, error } = await q.order('created_at', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1)
      if (error) throw error
      const ids = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => !!x))]
      const { data: profiles, error: pErr } = ids.length
        ? await supabase.from('profiles').select('*').in('id', ids)
        : { data: [], error: null }
      if (pErr) throw pErr
      return { rows, profiles, total: count ?? rows.length }
    },
  })

  const nameOf = (id: string | null) => {
    const p = data?.profiles.find((x) => x.id === id)
    return p?.full_name || p?.email || 'System'
  }

  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pages - 1)

  function change<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v)
      setPage(0)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="f-from">From</Label>
          <Input id="f-from" type="date" value={from} max={to || undefined} onChange={(e) => change(setFrom)(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="f-to">To</Label>
          <Input id="f-to" type="date" value={to} min={from || undefined} onChange={(e) => change(setTo)(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="f-action">Action</Label>
          <select id="f-action" className={cn(selectClass, 'w-36')} value={action} onChange={(e) => change(setAction)(e.target.value)}>
            <option value="">All actions</option>
            {Object.entries(verb).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="f-type">Type</Label>
          <select id="f-type" className={cn(selectClass, 'w-36')} value={entity} onChange={(e) => change(setEntity)(e.target.value)}>
            <option value="">All types</option>
            {Object.entries(ENTITIES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setFrom('')
              setTo('')
              setAction('')
              setEntity('')
              setPage(0)
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {data && total === 0 && <p className="text-muted-foreground">{filtered ? 'No activity matches these filters.' : 'No activity recorded yet.'}</p>}
      {data && total > 0 && (
        <>
          <Card>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Who</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{format(new Date(r.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <Avatar name={nameOf(r.actor_id)} size="sm" />
                          {nameOf(r.actor_id)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Pill tone={tone[r.action] ?? 'slate'}>{verb[r.action] ?? r.action}</Pill>
                      </TableCell>
                      <TableCell>{ENTITIES[r.entity] ?? r.entity}</TableCell>
                      <TableCell className="min-w-64">{r.summary}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
            <label className="flex items-center gap-2 text-muted-foreground">
              Rows per page
              <select
                aria-label="Rows per page"
                className={cn(selectClass, 'w-20')}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(0)
                }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground tabular-nums">
                {current * pageSize + 1}-{Math.min(total, (current + 1) * pageSize)} of {total}
              </span>
              <Button size="sm" variant="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>
                Previous
              </Button>
              <Button size="sm" variant="outline" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
