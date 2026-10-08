import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Avatar } from '@/components/Avatar'
import { Input } from '@/components/ui/input'
import { useDebounced } from '@/hooks/useDebounced'
import { supabase } from '@/lib/supabase'

export interface UserSuggestion {
  id: string
  full_name: string | null
  email: string | null
}

interface Props {
  projectId: number
  /** The text in the box; the parent keeps it so typed emails still work without picking a suggestion. */
  value: string
  onChange: (value: string) => void
  onPick: (user: UserSuggestion) => void
}

/** Text box that suggests registered users (by name or email) as you type. */
export function UserSearch({ projectId, value, onChange, onPick }: Props) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const term = useDebounced(value.trim(), 250)

  const { data, isFetching } = useQuery({
    queryKey: ['user-search', projectId, term],
    enabled: term.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_users', { p_project_id: projectId, p_query: term })
      if (error) throw error
      return data as UserSuggestion[]
    },
  })

  const suggestions = term.length >= 2 ? (data ?? []) : []
  const showList = open && value.trim().length >= 2

  function pick(u: UserSuggestion) {
    onPick(u)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!showList || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(suggestions[active] ?? suggestions[0])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <Input
        id="m-search"
        autoComplete="off"
        placeholder="Search by name or email"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        required
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
        >
          {suggestions.map((u, i) => (
            <li
              key={u.id}
              role="option"
              aria-selected={i === active}
              // mousedown (not click) so it fires before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault()
                pick(u)
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm ${i === active ? 'bg-accent' : ''}`}
            >
              <Avatar name={u.full_name || u.email || '?'} size="sm" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{u.full_name || u.email}</span>
                {u.full_name && <span className="block truncate text-xs text-muted-foreground">{u.email}</span>}
              </span>
            </li>
          ))}
          {suggestions.length === 0 && (
            <li className="px-2 py-2 text-sm text-muted-foreground">
              {isFetching || term !== value.trim() ? 'Searching…' : 'No registered user found, or they are already a member.'}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
