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

/** Approved leave and work-from-home requests that touch [from, to] (yyyy-MM-dd, both included), with the request types. */
export async function loadApprovedLeave(orgId: number, from: string, to: string) {
  const { data: leaves, error } = await supabase
    .from('leave_requests')
    .select('user_id, leave_type_id, start_date, end_date')
    .eq('organization_id', orgId)
    .eq('status', 'approved')
    .lte('start_date', to)
    .gte('end_date', from)
  if (error) throw error
  const { data: types, error: tErr } = await supabase.from('leave_types').select('id, name, blocks_clock_in')
  if (tErr) throw tErr
  return { leaves, types }
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
