import { selectClass } from '@/components/projects/ProjectForm'
import { useTeams } from '@/hooks/useTeams'

/**
 * "Add a team" next to the people picker: picking a team adds all its members to the task's assignees.
 * Only people still active in the project are added, and nobody is added twice. Nobody is removed.
 */
export function TeamPicker({
  projectId,
  value,
  activeIds,
  onChange,
  disabled,
}: {
  projectId: number
  value: string[]
  activeIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const { data: teams } = useTeams(projectId)
  const usable = (teams ?? []).filter((t) => t.userIds.some((id) => activeIds.includes(id)))
  if (usable.length === 0) return null

  return (
    <select
      aria-label="Add a team"
      className={selectClass}
      disabled={disabled}
      value=""
      onChange={(e) => {
        const team = usable.find((t) => String(t.team.id) === e.target.value)
        if (!team) return
        const add = team.userIds.filter((id) => activeIds.includes(id) && !value.includes(id))
        if (add.length > 0) onChange([...value, ...add])
      }}
    >
      <option value="">Add a whole team…</option>
      {usable.map((t) => (
        <option key={t.team.id} value={t.team.id}>
          {t.team.name} ({t.userIds.filter((id) => activeIds.includes(id)).length})
        </option>
      ))}
    </select>
  )
}
