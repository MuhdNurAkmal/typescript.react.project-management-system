import type { ReactNode } from 'react'

export type Tone = 'slate' | 'blue' | 'teal' | 'amber' | 'red' | 'violet' | 'green'

// A soft tinted chip with the label inside it. Colours come from the semantic tokens, so a theme change recolours every badge;
// the text always says what the status is, so colour is never the only signal.
const tones: Record<Tone, string> = {
  slate: 'bg-muted text-muted-foreground',
  blue: 'bg-info-soft text-info-foreground',
  teal: 'bg-success-soft text-success-foreground',
  amber: 'bg-warning-soft text-warning-foreground',
  red: 'bg-danger-soft text-danger-foreground',
  violet: 'bg-primary-soft text-accent-foreground',
  green: 'bg-success-soft text-success-foreground',
}

export function Pill({ tone = 'slate', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}
