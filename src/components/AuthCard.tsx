import type { ReactNode } from 'react'

function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden className={`grid size-9 place-items-center rounded-lg text-base font-semibold ${light ? 'bg-white text-primary' : 'bg-primary text-primary-foreground'}`}>U</span>
      <span className="text-xl font-semibold tracking-tight">UrusProgres</span>
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
      <aside className="relative hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <Wordmark light />
        <div className="max-w-md">
          <p className="text-4xl leading-tight font-semibold tracking-tight text-balance">Projects, people and hours, kept in one place.</p>
          <ul className="mt-8 space-y-3 text-sm text-primary-foreground/80">
            <li className="flex items-center gap-2 before:size-1.5 before:rounded-full before:bg-white/70">Plan tasks on a timeline and a board</li>
            <li className="flex items-center gap-2 before:size-1.5 before:rounded-full before:bg-white/70">Clock in per company, with leave and approvals</li>
            <li className="flex items-center gap-2 before:size-1.5 before:rounded-full before:bg-white/70">Monthly and yearly attendance reports</li>
          </ul>
        </div>
        <p className="text-xs text-primary-foreground/70">For lecturers and teams running grant and industrial projects.</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Wordmark />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-2 mb-7 text-sm text-muted-foreground">{description}</p>}
          {!description && <div className="mb-7" />}
          {children}
        </div>
      </main>
    </div>
  )
}
