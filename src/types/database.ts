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
  id: string
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
  id: string
  name: string
  description: string | null
  is_pm: boolean
  is_system: boolean
  created_by: string | null
  created_at: string
}

export type ProjectMember = {
  id: string
  project_id: string
  user_id: string
  role_id: string
  is_active: boolean
  joined_at: string
}

export type Task = {
  id: string
  project_id: string
  title: string
  description: string | null
  assignee_id: string | null
  start_date: string | null
  due_date: string | null
  status: TaskStatus
  priority: TaskPriority
  progress: number
  parent_task_id: string | null
  created_by: string
  created_at: string
}

export type TaskDependency = {
  task_id: string
  depends_on_task_id: string
}

export type Attendance = {
  id: string
  project_id: string
  user_id: string
  clock_in: string
  clock_out: string | null
  note: string | null
  status: AttendanceStatus
}

export type Milestone = {
  id: string
  project_id: string
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
      attendance: Table<
        Attendance,
        Pick<Attendance, 'project_id'> & Partial<Omit<Attendance, 'project_id'>>
      >
      milestones: Table<
        Milestone,
        Pick<Milestone, 'project_id' | 'title' | 'due_date'> &
          Partial<Omit<Milestone, 'project_id' | 'title' | 'due_date'>>
      >
    }
    Views: Record<string, never>
    Functions: {
      add_project_member: {
        Args: { p_project_id: string; p_email: string; p_role_id: string }
        Returns: ProjectMember
      }
      clock_in: { Args: { p_project_id: string }; Returns: Attendance }
      clock_out: { Args: { p_project_id: string }; Returns: Attendance }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
