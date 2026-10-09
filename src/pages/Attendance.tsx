import { PageHeader } from '@/components/PageHeader'
import { useOrg } from '@/hooks/useOrg'
import { MyAttendance } from '@/components/attendance/MyAttendance'
import { PmAttendance } from '@/components/attendance/PmAttendance'
import { LeaveReview } from '@/components/leave/LeaveReview'
import { LeaveSection } from '@/components/leave/LeaveSection'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsManager } from '@/hooks/useManager'

export default function Attendance() {
  const isManager = useIsManager()
  const { current } = useOrg()

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={current?.org.name} title="Attendance" description="Clock in, request leave and, for admins, review your team." />
      <Tabs defaultValue="mine">
        <div className="overflow-x-auto overflow-y-hidden pb-1">
          <TabsList variant="line">
          <TabsTrigger value="mine">My attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave &amp; absence</TabsTrigger>
          {isManager && <TabsTrigger value="team">Team attendance</TabsTrigger>}
          {isManager && <TabsTrigger value="team-leave">Team leave</TabsTrigger>}
        </TabsList>
        </div>
        <TabsContent value="mine" className="pt-4">
          <MyAttendance />
        </TabsContent>
        <TabsContent value="leave" className="pt-4">
          <LeaveSection />
        </TabsContent>
        {isManager && (
          <TabsContent value="team" className="pt-4">
            <PmAttendance />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="team-leave" className="pt-4">
            <LeaveReview />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
