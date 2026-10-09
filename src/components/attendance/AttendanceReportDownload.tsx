import { useState } from 'react'
import { format } from 'date-fns'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { selectClass } from '@/components/projects/ProjectForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOrg } from '@/hooks/useOrg'
import { detailCsv, monthlySummaryCsv, yearlySummaryCsv } from '@/lib/attendanceReport'
import { errorMessage } from '@/lib/errors'
import { downloadCsv } from '@/lib/reportUtils'
import { supabase } from '@/lib/supabase'
import type { Attendance } from '@/types/database'

const PAGE = 1000

/** Loads every attendance row of the company in [from, to), a page at a time (the API returns at most 1000 rows per request). */
async function loadRange(orgId: number, from: Date, to: Date): Promise<Attendance[]> {
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

/** Company admins download a monthly or yearly attendance report as a CSV file (opens in Excel). */
export function AttendanceReportDownload() {
  const { current } = useOrg()
  const thisYear = new Date().getFullYear()
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [year, setYear] = useState(thisYear)
  const [content, setContent] = useState<'summary' | 'detailed'>('summary')
  const [busy, setBusy] = useState(false)

  const years = Array.from({ length: 6 }, (_, i) => thisYear - i)

  async function download() {
    if (!current) return
    setBusy(true)
    try {
      const from = period === 'monthly' ? new Date(`${month}-01T00:00:00`) : new Date(year, 0, 1)
      const to = period === 'monthly' ? new Date(from.getFullYear(), from.getMonth() + 1, 1) : new Date(year + 1, 0, 1)
      const rows = await loadRange(current.org.id, from, to)
      if (rows.length === 0) {
        toast.info('There is no attendance in that period.')
        return
      }
      const ids = [...new Set(rows.map((r) => r.user_id))]
      const { data: profiles, error } = await supabase.from('profiles').select('*').in('id', ids)
      if (error) throw error
      const nameOf = (id: string) => {
        const p = profiles.find((x) => x.id === id)
        return p?.full_name || p?.email || 'Unknown'
      }
      const now = new Date()
      const csv =
        content === 'detailed' ? detailCsv(rows, nameOf, now) : period === 'monthly' ? monthlySummaryCsv(rows, nameOf, now) : yearlySummaryCsv(rows, nameOf, now)
      const label = period === 'monthly' ? month : String(year)
      const company = current.org.name.replace(/\W+/g, '-').toLowerCase()
      downloadCsv(`attendance-${content}-${company}-${label}.csv`, csv)
      toast.success('Report downloaded')
    } catch (e) {
      toast.error(errorMessage(e, 'Could not build the report'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="rp-period">Report</Label>
            <select id="rp-period" className={`${selectClass} w-32`} value={period} onChange={(e) => setPeriod(e.target.value as 'monthly' | 'yearly')}>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-value">{period === 'monthly' ? 'Month' : 'Year'}</Label>
            {period === 'monthly' ? (
              <Input id="rp-value" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
            ) : (
              <select id="rp-value" className={`${selectClass} w-28`} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-content">Contents</Label>
            <select id="rp-content" className={`${selectClass} w-48`} value={content} onChange={(e) => setContent(e.target.value as 'summary' | 'detailed')}>
              <option value="summary">{period === 'monthly' ? 'Summary (hours per person)' : 'Summary (hours per month)'}</option>
              <option value="detailed">Detailed (every session)</option>
            </select>
          </div>
          <Button onClick={download} disabled={busy}>
            <Download /> {busy ? 'Preparing…' : 'Download report'}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Covers everyone in {current?.org.name}, including you. Summaries leave out rejected records; the detailed report lists them with their status.
        </p>
      </CardContent>
    </Card>
  )
}
