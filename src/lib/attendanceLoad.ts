import { supabase } from '@/lib/supabase'
import type { Attendance } from '@/types/database'

const PAGE = 1000

/** Loads every attendance row of the company in [from, to), a page at a time (the API returns at most 1000 rows per request). */
export async function loadAttendanceRange(orgId: number, from: Date, to: Date): Promise<Attendance[]> {
  const all: Attendance[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('organization_id', orgId)
      .gte('clock_in', from.toISOString())
      .lt('clock_in', to.toISOString())
      .order('clock_in')
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    all.push(...data)
    if (data.length < PAGE) return all
  }
}

/** Everyone in the company plus anyone who has a record in `extraIds`, with the name to show for each. */
export async function loadPeople(orgId: number, extraIds: string[]): Promise<{ id: string; name: string }[]> {
  const { data: members, error } = await supabase.from('organization_members').select('user_id').eq('organization_id', orgId)
  if (error) throw error
  const ids = [...new Set([...members.map((m) => m.user_id), ...extraIds])]
  if (ids.length === 0) return []
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').in('id', ids)
  if (pErr) throw pErr
  return ids.map((id) => {
    const p = profiles.find((x) => x.id === id)
    return { id, name: p?.full_name || p?.email || 'Unknown' }
  })
}
