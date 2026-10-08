import { Pill, type Tone } from '@/components/Pill'
import type { AttendanceStatus } from '@/types/database'

const tone: Record<AttendanceStatus, Tone> = { pending: 'amber', approved: 'green', rejected: 'red' }

/** Used for attendance and leave requests, which share the same three states. */
export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <Pill tone={tone[status]} className="capitalize">
      {status}
    </Pill>
  )
}
