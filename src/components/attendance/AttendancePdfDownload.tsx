import { useState } from 'react'
import { differenceInCalendarDays, format, parseISO, startOfMonth } from 'date-fns'
import { FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOrg } from '@/hooks/useOrg'
import { attendancePdf } from '@/lib/attendancePdf'
import { loadApprovedLeave, loadAttendanceRange, loadPeople } from '@/lib/attendanceLoad'
import { buildSheet } from '@/lib/attendanceSheet'
import { errorMessage } from '@/lib/errors'

const MAX_DAYS = 366

/** Download a PDF sheet for a date range: a tick or an X for every weekday and every person, weekends blank and blue. */
export function AttendancePdfDownload() {
  const { current } = useOrg()
  const today = format(new Date(), 'yyyy-MM-dd')
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to, setTo] = useState(today)
  const [busy, setBusy] = useState(false)

  async function download() {
    if (!current) return
    if (!from || !to) return toast.error('Choose a start and an end date')
    if (to < from) return toast.error('The end date cannot be before the start date')
    if (differenceInCalendarDays(parseISO(to), parseISO(from)) + 1 > MAX_DAYS) return toast.error('Choose a range of one year or less')
    setBusy(true)
    try {
      // clock-ins are matched to days in the viewer's own time, so load from midnight of the first day to the end of the last
      const rows = await loadAttendanceRange(current.org.id, new Date(`${from}T00:00:00`), new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000))
      const people = await loadPeople(current.org.id, [...new Set(rows.map((r) => r.user_id))])
      const { leaves, types } = await loadApprovedLeave(current.org.id, from, to)
      const sheet = buildSheet(rows, people, from, to, today, leaves, types)
      if (sheet.rows.length === 0) return toast.info('There is nobody in this company yet.')
      const pdf = await attendancePdf(sheet, { company: current.org.name, from, to })
      const company = current.org.name.replace(/\W+/g, '-').toLowerCase()
      pdf.save(`attendance-${company}-${from}-to-${to}.pdf`)
      toast.success('PDF report downloaded')
    } catch (e) {
      toast.error(errorMessage(e, 'Could not build the PDF'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="pdf-from">From</Label>
            <Input id="pdf-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdf-to">To</Label>
            <Input id="pdf-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={download} disabled={busy}>
            <FileDown /> {busy ? 'Preparing…' : 'Download PDF'}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          One row per person, one column per day: a tick when they clocked in, an X when they did not on a weekday, or a code for approved leave and work from home (AL, MC, EL, UL, WFH). Weekends are blank and blue; days that have not
          happened yet are blank. Covers everyone in {current?.org.name}.
        </p>
      </CardContent>
    </Card>
  )
}
