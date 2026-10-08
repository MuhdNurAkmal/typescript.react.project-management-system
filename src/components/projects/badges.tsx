import { Pill, type Tone } from '@/components/Pill'
import type { ProjectStatus } from '@/types/database'

const status: Record<ProjectStatus, { label: string; tone: Tone }> = {
  planning: { label: 'Planning', tone: 'slate' },
  active: { label: 'Active', tone: 'teal' },
  on_hold: { label: 'On hold', tone: 'amber' },
  completed: { label: 'Completed', tone: 'blue' },
}

export function StatusBadge({ status: s }: { status: ProjectStatus }) {
  return <Pill tone={status[s].tone}>{status[s].label}</Pill>
}

export function RoleBadge({ name }: { name: string | null }) {
  return (
    <Pill tone="violet" className="capitalize">
      {name ?? 'unknown'}
    </Pill>
  )
}
