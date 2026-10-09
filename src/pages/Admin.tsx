import { AuditPanel } from '@/components/admin/AuditPanel'
import { CompaniesPanel } from '@/components/admin/CompaniesPanel'
import { DeletedPanel } from '@/components/admin/DeletedPanel'
import { OverviewPanel } from '@/components/admin/OverviewPanel'
import { UsersPanel } from '@/components/admin/UsersPanel'
import { PageHeader } from '@/components/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function Admin() {
  return (
    <div>
      <PageHeader eyebrow="Superadmin" title="System administration" description="Everything below applies to the whole system, and every change is recorded in the audit log." />
      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="deleted">Deleted projects</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-4">
          <OverviewPanel />
        </TabsContent>
        <TabsContent value="users" className="pt-4">
          <UsersPanel />
        </TabsContent>
        <TabsContent value="companies" className="pt-4">
          <CompaniesPanel />
        </TabsContent>
        <TabsContent value="deleted" className="pt-4">
          <DeletedPanel />
        </TabsContent>
        <TabsContent value="audit" className="pt-4">
          <AuditPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
