import { Avatar } from '@/components/Avatar'

/** Overlapping avatars for everyone on a task (first three, then +N). Nothing assigned shows "Unassigned". */
export function AssigneeStack({ names, max = 3 }: { names: string[]; max?: number }) {
  if (names.length === 0) return <span className="text-xs text-muted-foreground">Unassigned</span>
  const shown = names.slice(0, max)
  const rest = names.length - shown.length
  return (
    <span className="flex items-center" title={names.join(', ')}>
      <span className="flex -space-x-2">
        {shown.map((n, i) => (
          <span key={`${n}-${i}`} className="rounded-md ring-2 ring-card">
            <Avatar name={n} size="sm" />
          </span>
        ))}
      </span>
      {rest > 0 && <span className="ml-1.5 text-xs text-muted-foreground">+{rest}</span>}
    </span>
  )
}
