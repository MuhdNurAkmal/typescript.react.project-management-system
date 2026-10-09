import type { ReactNode } from 'react'

function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden className={`size-2.5 rounded-[3px] ${light ? 'bg-sidebar-primary' : 'bg-primary'}`} />
      <span className="font-display text-[26px] leading-none tracking-tight">UrusProgres</span>
    </span>
  )
}

/** Sign-in style screens: an ink panel on the left (wide screens only) and the form on paper. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <aside className="relative hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <Wordmark light />
        <div className="max-w-md">
          <p className="font-display text-5xl leading-[1.05] tracking-tight text-balance">Projects, people and hours, kept in one place.</p>
          <ul className="mt-8 space-y-3 text-sm text-sidebar-foreground/70">
            <li className="border-l-2 border-sidebar-primary/60 pl-3">Plan tasks on a timeline and a board</li>
            <li className="border-l-2 border-sidebar-primary/60 pl-3">Clock in per company, with leave and approvals</li>
            <li className="border-l-2 border-sidebar-primary/60 pl-3">Monthly and yearly attendance reports</li>
          </ul>
        </div>
        <p className="text-xs text-sidebar-foreground/50">For lecturers and teams running grant and industrial projects.</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Wordmark />
          </div>
          <h1 className="font-display text-4xl leading-tight tracking-tight">{title}</h1>
          {description && <p className="mt-2 mb-7 text-sm text-muted-foreground">{description}</p>}
          {!description && <div className="mb-7" />}
          {children}
        </div>
      </main>
    </div>
  )
}
