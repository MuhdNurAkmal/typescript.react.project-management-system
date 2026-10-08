const palette = [
  'bg-sky-100 text-sky-800',
  'bg-indigo-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
  'bg-violet-100 text-violet-800',
  'bg-cyan-100 text-cyan-800',
  'bg-slate-200 text-slate-800',
]

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] ?? '')
  return (first + last).toUpperCase()
}

/** Round avatar with initials; the colour is stable for a given name. */
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const dims = size === 'sm' ? 'size-7 text-[11px]' : 'size-8 text-xs'
  return (
    <span aria-hidden className={`inline-grid shrink-0 place-items-center rounded-full font-semibold ${dims} ${palette[hash % palette.length]}`}>
      {initials(name)}
    </span>
  )
}
