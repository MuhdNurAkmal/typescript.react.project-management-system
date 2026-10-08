import { MyAttendance } from '@/components/attendance/MyAttendance'
import { PmAttendance } from '@/components/attendance/PmAttendance'
import { LeaveReview } from '@/components/leave/LeaveReview'
import { LeaveSection } from '@/components/leave/LeaveSection'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsManager } from '@/hooks/useManager'

export default function Attendance() {
  const isManager = useIsManager()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Attendance</h1>
      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave &amp; absence</TabsTrigger>
          {isManager && <TabsTrigger value="team">Team attendance</TabsTrigger>}
          {isManager && <TabsTrigger value="team-leave">Team leave</TabsTrigger>}
        </TabsList>
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
