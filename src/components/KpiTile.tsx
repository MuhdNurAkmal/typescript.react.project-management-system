import type { LucideIcon } from 'lucide-react'

const toneClass = {
  blue: 'bg-sky-100 text-sky-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-emerald-100 text-emerald-700',
} as const

/** Small stat card: an icon chip, a big number and a label. */
export function KpiTile({ icon: Icon, label, value, tone = 'blue' }: { icon: LucideIcon; label: string; value: string | number; tone?: keyof typeof toneClass }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${toneClass[tone]}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <div className="text-2xl leading-tight font-semibold tabular-nums">{value}</div>
        <div className="truncate text-sm text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}
