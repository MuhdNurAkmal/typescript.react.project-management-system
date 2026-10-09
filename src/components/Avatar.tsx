// Muted, slightly desaturated tones that sit comfortably on the paper background.
const palette = [
  'bg-slate-200 text-slate-800',
  'bg-stone-200 text-stone-800',
  'bg-sky-100 text-sky-900',
  'bg-amber-100 text-amber-900',
  'bg-teal-100 text-teal-900',
  'bg-rose-100 text-rose-900',
]

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] ?? '')
  return (first + last).toUpperCase()
}

/** Rounded-square avatar with initials; the colour is stable for a given name. */
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const dims = size === 'sm' ? 'size-7 text-[11px]' : 'size-9 text-xs'
  return (
    <span aria-hidden className={`inline-grid shrink-0 place-items-center rounded-md font-semibold tracking-wide ${dims} ${palette[hash % palette.length]}`}>
      {initials(name)}
    </span>
  )
}
