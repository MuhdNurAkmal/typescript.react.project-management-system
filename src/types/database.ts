// Hand-written types mirroring supabase/migrations. Regenerate with
// `supabase gen types typescript` once the CLI is set up.

export type ProjectType = 'grant' | 'industrial'
export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed'
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'
export type AttendanceStatus = 'pending' | 'approved' | 'rejected'

export type Profile = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  created_at: string
}

export type Project = {
  id: number
  name: string
  description: string | null
  type: ProjectType
  sponsor: string | null
  start_date: string | null
  end_date: string | null
  budget: number | null
  status: ProjectStatus
  created_by: string
  created_at: string
}

export type Role = {
  id: number
  name: string
  description: string | null
  is_pm: boolean
  is_system: boolean
  created_by: string | null
  created_at: string
}

export type ProjectMember = {
  id: number
  project_id: number
  user_id: string
  role_id: number
  is_active: boolean
  joined_at: string
}

export type Task = {
  id: number
  project_id: number
  title: string
  description: string | null
  assignee_id: string | null
  start_date: string | null
  due_date: string | null
  status: TaskStatus
  priority: TaskPriority
  progress: number
  parent_task_id: number | null
  created_by: string
  created_at: string
}

export type TaskDependency = {
  task_id: number
  depends_on_task_id: number
}

export type Attendance = {
  id: number
  user_id: string
  clock_in: string
  clock_out: string | null
  note: string | null
  status: AttendanceStatus
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export type LeaveType = {
  id: number
  name: string
  description: string | null
  is_system: boolean
  created_by: string | null
  created_at: string
}

export type LeaveRequest = {
  id: number
  user_id: string
  leave_type_id: number
  start_date: string
  end_date: string
  reason: string | null
  status: LeaveStatus
  review_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export type Milestone = {
  id: number
  project_id: number
  title: string
  due_date: string
  completed: boolean
}

type Table<Row, Insert> = {
  Row: Row
  Insert: Insert
  Update: Partial<Insert>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, Pick<Profile, 'id'> & Partial<Profile>>
      projects: Table<
        Project,
        Pick<Project, 'name' | 'type'> & Partial<Omit<Project, 'name' | 'type'>>
      >
      roles: Table<Role, Pick<Role, 'name'> & Partial<Omit<Role, 'name'>>>
      project_members: Table<
        ProjectMember,
        Pick<ProjectMember, 'project_id' | 'user_id' | 'role_id'> &
          Partial<Omit<ProjectMember, 'project_id' | 'user_id' | 'role_id'>>
      >
      tasks: Table<
        Task,
        Pick<Task, 'project_id' | 'title'> & Partial<Omit<Task, 'project_id' | 'title'>>
      >
      task_dependencies: Table<TaskDependency, TaskDependency>
      attendance: Table<Attendance, Partial<Attendance>>
      leave_types: Table<LeaveType, Pick<LeaveType, 'name'> & Partial<Omit<LeaveType, 'name'>>>
      leave_requests: Table<
        LeaveRequest,
        Pick<LeaveRequest, 'leave_type_id' | 'start_date' | 'end_date'> &
          Partial<Omit<LeaveRequest, 'leave_type_id' | 'start_date' | 'end_date'>>
      >
      milestones: Table<
        Milestone,
        Pick<Milestone, 'project_id' | 'title' | 'due_date'> &
          Partial<Omit<Milestone, 'project_id' | 'title' | 'due_date'>>
      >
    }
    Views: Record<string, never>
    Functions: {
      search_users: {
        Args: { p_project_id: number; p_query: string }
        Returns: { id: string; full_name: string | null; email: string | null }[]
      }
      add_project_member: {
        Args: { p_project_id: number; p_email: string; p_role_id: number }
        Returns: ProjectMember
      }
      pm_set_clock_out: { Args: { p_attendance_id: number; p_clock_out: string }; Returns: Attendance }
      clock_in: { Args: never; Returns: Attendance }
      clock_out: { Args: never; Returns: Attendance }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
