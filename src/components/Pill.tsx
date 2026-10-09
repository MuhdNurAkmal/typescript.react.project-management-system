import type { ReactNode } from 'react'

export type Tone = 'slate' | 'blue' | 'teal' | 'amber' | 'red' | 'violet' | 'green'

// A status tag is a small coloured dot followed by the label: quieter than a filled badge,
// and the colour is still readable by people who cannot tell the dots apart because the label says it too.
const dots: Record<Tone, string> = {
  slate: 'bg-slate-400',
  blue: 'bg-sky-500',
  teal: 'bg-teal-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  violet: 'bg-violet-500',
  green: 'bg-emerald-500',
}

export function Pill({ tone = 'slate', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-foreground/80 ${className}`}>
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${dots[tone]}`} />
      {children}
    </span>
  )
}
