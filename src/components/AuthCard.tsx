import type { ReactNode } from 'react'
import { Layers } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
    <div className="grid min-h-screen place-items-center bg-linear-to-br from-sky-50 via-background to-indigo-50 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Layers className="size-6" />
          </span>
          <div className="text-xl font-semibold tracking-tight">UrusProgres</div>
          <p className="text-sm text-muted-foreground">Projects, tasks and attendance in one place</p>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  )
}
