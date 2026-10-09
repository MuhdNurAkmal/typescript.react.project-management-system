import type { LucideIcon } from 'lucide-react'

const rule = {
  blue: 'border-t-sky-500',
  red: 'border-t-red-500',
  amber: 'border-t-amber-500',
  green: 'border-t-emerald-500',
} as const

/** Stat block: a coloured rule, a small label, and a big serif numeral. */
export function KpiTile({ icon: Icon, label, value, tone = 'blue' }: { icon: LucideIcon; label: string; value: string | number; tone?: keyof typeof rule }) {
  return (
    <div className={`rounded-lg border border-t-2 bg-card px-4 pt-3 pb-4 ${rule[tone]}`}>
      <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
        <Icon className="size-3.5" aria-hidden />
      </div>
      <div className="font-display mt-2 text-5xl leading-none tabular-nums">{value}</div>
    </div>
  )
}
