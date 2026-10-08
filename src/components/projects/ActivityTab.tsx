import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Avatar } from '@/components/Avatar'
import { Pill, type Tone } from '@/components/Pill'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

const tone: Record<string, Tone> = { create: 'green', update: 'blue', delete: 'red' }

/** Who changed what in this project (PMs only; enforced by RLS). */
export function ActivityTab({ projectId }: { projectId: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['audit', projectId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      const ids = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => !!x))]
      const { data: profiles, error: pErr } = ids.length
        ? await supabase.from('profiles').select('*').in('id', ids)
        : { data: [], error: null }
      if (pErr) throw pErr
      return { rows, profiles }
    },
  })

  const nameOf = (id: string | null) => {
    const p = data?.profiles.find((x) => x.id === id)
    return p?.full_name || p?.email || 'System'
  }

  return (
    <div className="space-y-3">
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {data && data.rows.length === 0 && <p className="text-muted-foreground">No activity recorded yet.</p>}
      {data && data.rows.length > 0 && (
        <Card>
          <CardContent>
            <ul className="divide-y">
              {data.rows.map((r) => (
                <li key={r.id} className="flex items-start gap-3 py-2.5 text-sm">
                  <Avatar name={nameOf(r.actor_id)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div>
                      <span className="font-medium">{nameOf(r.actor_id)}</span> <span className="text-muted-foreground">{r.summary}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{format(new Date(r.created_at), 'dd MMM yyyy HH:mm')}</div>
                  </div>
                  <Pill tone={tone[r.action] ?? 'slate'} className="capitalize">
                    {r.entity}
                  </Pill>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
