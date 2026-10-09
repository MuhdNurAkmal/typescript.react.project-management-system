import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Check, ChevronsUpDown } from 'lucide-react'
import { Pill, type Tone } from '@/components/Pill'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useOpenSessions } from '@/hooks/useAttendance'
import { useOrg } from '@/hooks/useOrg'
import type { OrgRole } from '@/types/database'

const roleTone: Record<OrgRole, Tone> = { owner: 'violet', admin: 'blue', member: 'slate' }

/** Sidebar button showing the current company; clicking it opens a popup to pick another one. */
export function CompanySwitcher({ onPicked }: { onPicked?: () => void }) {
  const { orgs, current, setCurrentId } = useOrg()
  const { data: sessions } = useOpenSessions()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (!current) return null

  function pick(id: number) {
    setOpen(false)
    onPicked?.()
    if (id !== current?.org.id) {
      setCurrentId(id)
      navigate('/')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-md border border-sidebar-border bg-sidebar-accent/50 p-2.5 text-left transition-colors hover:bg-sidebar-accent"
            aria-label={`Current company: ${current.org.name}. Change company`}
          />
        }
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-sidebar-primary/15 text-sidebar-primary">
          <Building2 className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{current.org.name}</span>
          <span className="block text-xs text-sidebar-foreground/60 capitalize">{current.member ? current.role : "Superadmin"}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/50" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose a company</DialogTitle>
          <DialogDescription>Projects, attendance and leave shown in the app belong to the company you pick.</DialogDescription>
        </DialogHeader>
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {orgs.map(({ org, role, member }) => {
            const selected = org.id === current.org.id
            const clockedIn = sessions?.some((s) => s.organization_id === org.id)
            return (
              <li key={org.id}>
                <button
                  type="button"
                  onClick={() => pick(org.id)}
                  className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors hover:bg-accent ${selected ? 'border-primary bg-primary/5' : ''}`}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <Building2 className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{org.name}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <Pill tone={roleTone[role]} className="capitalize">
                        {role}
                      </Pill>
                      {!member && <Pill tone="violet">Superadmin access</Pill>}
                      {clockedIn && <Pill tone="green">Clocked in</Pill>}
                    </span>
                  </span>
                  {selected && <Check className="size-5 shrink-0 text-primary" />}
                </button>
              </li>
            )
          })}
        </ul>
        <Link
          to="/company"
          onClick={() => {
            setOpen(false)
            onPicked?.()
          }}
          className="text-sm text-primary hover:underline"
        >
          Manage companies or create a new one
        </Link>
      </DialogContent>
    </Dialog>
  )
}
