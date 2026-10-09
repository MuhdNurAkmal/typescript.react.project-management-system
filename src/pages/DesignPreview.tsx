import { useState, type ReactNode } from 'react'
import { AlertCircle, CalendarClock, FolderKanban, Inbox, LayoutDashboard, ListChecks, LogIn, LogOut, Menu, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/* Preview of the proposed design system. Not linked from the app; open /design-preview. */

type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'primary'
const toneClass: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-info-soft text-info-foreground',
  warning: 'bg-warning-soft text-warning-foreground',
  success: 'bg-success-soft text-success-foreground',
  danger: 'bg-danger-soft text-danger-foreground',
  primary: 'bg-primary-soft text-accent-foreground',
}

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${toneClass[tone]}`}>{children}</span>
}

const status: { label: string; tone: Tone }[] = [
  { label: 'To do', tone: 'neutral' },
  { label: 'In progress', tone: 'info' },
  { label: 'Review', tone: 'warning' },
  { label: 'Done', tone: 'success' },
  { label: 'Blocked', tone: 'danger' },
]
const roles: { label: string; tone: Tone }[] = [
  { label: 'PM', tone: 'primary' },
  { label: 'Developer', tone: 'info' },
  { label: 'Intern', tone: 'warning' },
  { label: 'Tester', tone: 'success' },
  { label: 'Viewer', tone: 'neutral' },
]

const swatches = [
  { name: 'primary', cls: 'bg-primary', note: 'Indigo, actions and links' },
  { name: 'primary-soft', cls: 'bg-primary-soft border', note: 'Selected, hover' },
  { name: 'foreground', cls: 'bg-foreground', note: 'Text' },
  { name: 'muted-foreground', cls: 'bg-muted-foreground', note: 'Secondary text' },
  { name: 'border', cls: 'bg-border', note: 'Dividers' },
  { name: 'background', cls: 'bg-background border', note: 'Page' },
  { name: 'success', cls: 'bg-success', note: 'Done, clocked in' },
  { name: 'warning', cls: 'bg-warning', note: 'Review, pending' },
  { name: 'danger', cls: 'bg-danger', note: 'Errors, delete' },
  { name: 'info', cls: 'bg-info', note: 'In progress' },
]

const typeScale = [
  { cls: 'text-3xl font-semibold', label: 'Page title', spec: '30 / 600' },
  { cls: 'text-xl font-semibold', label: 'Section title', spec: '20 / 600' },
  { cls: 'text-base font-semibold', label: 'Card title', spec: '16 / 600' },
  { cls: 'text-[15px]', label: 'Body text for reading', spec: '15 / 400' },
  { cls: 'text-sm font-medium', label: 'Button and label', spec: '14 / 500' },
  { cls: 'text-xs text-muted-foreground', label: 'Caption and helper text', spec: '12 / 400' },
]

const spacing = [4, 8, 12, 16, 24, 32, 48]

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Projects', icon: FolderKanban },
  { label: 'My tasks', icon: ListChecks },
  { label: 'Attendance', icon: CalendarClock },
]

/** Circular floating clock button: fixed bottom-right, 80px (well above the 44px tap minimum). */
function ClockButton() {
  const [on, setOn] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      aria-label={on ? 'Clock out' : 'Clock in'}
      className={`fixed right-4 bottom-4 z-50 flex size-20 flex-col items-center justify-center gap-0.5 rounded-full text-xs font-medium text-white shadow-lift transition-transform hover:scale-105 active:scale-95 sm:right-8 sm:bottom-8 ${
        on ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary/90'
      }`}
    >
      {on ? <LogOut className="size-6" /> : <LogIn className="size-6" />}
      {on ? 'Clock out' : 'Clock in'}
    </button>
  )
}

export default function DesignPreview() {
  return (
    <div className="ds min-h-screen">
      <ClockButton />
      <div className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6">
        <header>
          <Badge tone="primary">Proposal</Badge>
          <h1 className="mt-3 text-3xl">Design preview</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Poppins, a calm indigo, cool grays, 12px corners and soft shadows. Light mode only. All values are tokens in <span className="font-medium">src/styles/design-system.css</span>.
          </p>
        </header>

        <Section title="Colour" hint="One primary, neutral grays, and four semantic colours. Text on every soft background meets 4.5:1.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {swatches.map((s) => (
              <div key={s.name} className="space-y-2">
                <div className={`h-14 rounded-lg ${s.cls}`} />
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.note}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Type scale" hint="Poppins 400 body, 500 buttons and labels, 600 headings.">
          <Card>
            <CardContent className="divide-y">
              {typeScale.map((t) => (
                <div key={t.label} className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <span className={t.cls}>{t.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{t.spec}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </Section>

        <Section title="Spacing, radius and shadow" hint="4px base unit. Cards use 24px padding, page sections 48px apart.">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardContent className="space-y-2">
                {spacing.map((s) => (
                  <div key={s} className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="w-10">{s}px</span>
                    <span className="h-3 rounded-sm bg-primary/70" style={{ width: s * 2 }} />
                  </div>
                ))}
              </CardContent>
            </Card>
            <div className="grid grid-cols-3 gap-3">
              {[
                { l: 'Radius 8', c: 'rounded-lg shadow-none border' },
                { l: 'Shadow soft', c: 'rounded-xl shadow-soft' },
                { l: 'Shadow lift', c: 'rounded-xl shadow-lift' },
              ].map((b) => (
                <div key={b.l} className={`grid h-24 place-items-center bg-card text-center text-xs text-muted-foreground ${b.c}`}>
                  {b.l}
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>
              <Plus /> New project
            </Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete</Button>
            <Button disabled>Disabled</Button>
          </div>
          <p className="text-sm text-muted-foreground">
            The clock button floats at the bottom-right of every page (try it now): indigo "Clock in", red "Clock out".
          </p>
        </Section>

        <Section title="Inputs">
          <Card className="shadow-soft">
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Project name</Label>
                <Input id="p-name" placeholder="Grant 2026: Smart Campus" />
                <p className="text-xs text-muted-foreground">Helper text sits below.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-search">Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="p-search" className="pl-9" placeholder="Search tasks" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-err">Email</Label>
                <Input id="p-err" aria-invalid defaultValue="not-an-email" />
                <p className="text-xs text-danger-foreground">Enter a valid email address.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-dis">Company</Label>
                <Input id="p-dis" disabled defaultValue="UiTM Research Group" />
              </div>
            </CardContent>
          </Card>
        </Section>

        <Section title="Badges" hint="Same colour always means the same thing. Each has a text label, so colour is never the only signal.">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 text-xs text-muted-foreground">Status</span>
              {status.map((s) => (
                <Badge key={s.label} tone={s.tone}>
                  {s.label}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 text-xs text-muted-foreground">Role</span>
              {roles.map((s) => (
                <Badge key={s.label} tone={s.tone}>
                  {s.label}
                </Badge>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Cards and table">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { l: 'Open tasks', v: '18', t: 'info' as Tone },
              { l: 'Due this week', v: '5', t: 'warning' as Tone },
              { l: 'Hours this month', v: '96h', t: 'success' as Tone },
            ].map((k) => (
              <Card key={k.l} className="shadow-soft">
                <CardHeader>
                  <CardDescription>{k.l}</CardDescription>
                  <CardTitle className="text-3xl">{k.v}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
          <Card className="shadow-soft">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Task</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6">Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ['Draft ethics application', 'Aina', 'Review', 'warning', '14 Oct'],
                    ['Build clock-in screen', 'Hafiz', 'In progress', 'info', '18 Oct'],
                    ['Literature review', 'Mei Ling', 'Done', 'success', '2 Oct'],
                    ['Procure sensors', 'Unassigned', 'Blocked', 'danger', '20 Oct'],
                  ].map(([t, a, s, tone, d]) => (
                    <TableRow key={t}>
                      <TableCell className="pl-6 font-medium">{t}</TableCell>
                      <TableCell className="text-muted-foreground">{a}</TableCell>
                      <TableCell>
                        <Badge tone={tone as Tone}>{s}</Badge>
                      </TableCell>
                      <TableCell className="pr-6 text-muted-foreground">{d}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Section>

        <Section title="Loading, empty and error states" hint="Every list and page gets all three.">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="shadow-soft">
              <CardContent className="space-y-3" aria-busy="true" aria-label="Loading">
                <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
            <Card className="shadow-soft">
              <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
                <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary">
                  <Inbox className="size-5" />
                </span>
                <p className="font-medium">No projects yet</p>
                <p className="text-sm text-muted-foreground">Create your first project to start planning.</p>
                <Button size="sm" className="mt-1">
                  <Plus /> New project
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-soft">
              <CardContent className="flex flex-col items-center gap-2 py-6 text-center" role="alert">
                <span className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
                  <AlertCircle className="size-5" />
                </span>
                <p className="font-medium">Could not load projects</p>
                <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
                <Button size="sm" variant="outline" className="mt-1">
                  Try again
                </Button>
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section title="App shell" hint="Light sidebar on desktop; on phones it becomes a menu button and the clock button stays one tap away.">
          <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
            <div className="grid min-h-80 md:grid-cols-[14rem_1fr]">
              <aside className="hidden flex-col gap-1 border-r bg-sidebar p-3 md:flex">
                <div className="mb-4 flex items-center gap-2 px-2 pt-1">
                  <span className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">U</span>
                  <span className="font-semibold">UrusProgres</span>
                </div>
                {navItems.map(({ label, icon: Icon }, i) => (
                  <a
                    key={label}
                    href="#shell"
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${i === 1 ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-muted'}`}
                  >
                    <Icon className="size-4" /> {label}
                  </a>
                ))}
              </aside>
              <div className="flex min-w-0 flex-col">
                <div className="flex h-14 items-center justify-between border-b px-4">
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                    <Menu />
                  </Button>
                  <span className="hidden text-sm text-muted-foreground md:block">UiTM Research Group</span>
                  <span className="grid size-8 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-accent-foreground">AR</span>
                </div>
                <div className="flex-1 space-y-3 p-4 sm:p-6">
                  <h3 className="text-xl">Projects</h3>
                  <p className="text-sm text-muted-foreground">Page content goes here with 24px padding and 24px gaps.</p>
                </div>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
