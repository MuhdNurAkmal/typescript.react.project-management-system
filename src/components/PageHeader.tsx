import type { ReactNode } from 'react'

/** Page title block: small uppercase eyebrow, large serif title, optional description and actions, hairline underneath. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b pb-5">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{eyebrow}</div>}
        <h1 className="font-display text-4xl leading-tight tracking-tight text-balance">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
