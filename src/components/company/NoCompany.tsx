import { useState } from 'react'
import { Building2, Mail } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { CreateCompanyForm } from '@/components/company/CreateCompanyForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useOrg } from '@/hooks/useOrg'

/** Shown where a company is needed but the user is not in one yet. They can wait to be added, or start their own. */
export function NoCompany() {
  const { user } = useAuth()
  const { refresh } = useOrg()
  const [creating, setCreating] = useState(false)
  const [checking, setChecking] = useState(false)

  async function checkAgain() {
    setChecking(true)
    await refresh()
    setChecking(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader eyebrow="Getting started" title="Welcome" description="You are not part of a company yet. Projects, attendance and leave all live inside a company." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <span className="mb-1 grid size-10 place-items-center rounded-md bg-muted text-foreground">
              <Mail className="size-5" />
            </span>
            <CardTitle>Join an existing company</CardTitle>
            <CardDescription>
              Ask the company owner or an admin to add you. Give them the email you registered with:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted px-3 py-2 font-mono text-sm break-all">{user?.email}</div>
            <Button variant="outline" onClick={checkAgain} disabled={checking}>
              {checking ? 'Checking…' : 'I have been added, check again'}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <span className="mb-1 grid size-10 place-items-center rounded-md bg-muted text-foreground">
              <Building2 className="size-5" />
            </span>
            <CardTitle>Start your own company</CardTitle>
            <CardDescription>You become its owner and can add people and create projects.</CardDescription>
          </CardHeader>
          <CardContent>
            {creating ? <CreateCompanyForm /> : <Button onClick={() => setCreating(true)}>Create a company</Button>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
