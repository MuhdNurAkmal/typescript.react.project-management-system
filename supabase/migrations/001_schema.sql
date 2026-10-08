-- 001_schema.sql: core tables. All timestamps are timestamptz (UTC).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type text not null check (type in ('grant', 'industrial')),
  sponsor text,
  start_date date,
  end_date date,
  budget numeric(14, 2),
  status text not null default 'planning'
    check (status in ('planning', 'active', 'on_hold', 'completed')),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'developer'
    check (role in ('pm', 'developer', 'intern', 'tester', 'designer', 'viewer')),
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid references public.profiles (id) on delete set null,
  start_date date,
  due_date date,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'review', 'done')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  progress integer not null default 0 check (progress between 0 and 100),
  parent_task_id uuid references public.tasks (id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  check (due_date is null or start_date is null or due_date >= start_date)
);

create table public.task_dependencies (
  task_id uuid not null references public.tasks (id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks (id) on delete cascade,
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  check (clock_out is null or clock_out >= clock_in)
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  due_date date not null,
  completed boolean not null default false
);

-- Indexes on foreign keys and common lookups
create index on public.projects (created_by);
create index on public.project_members (user_id);
create index on public.project_members (project_id);
create index on public.tasks (project_id);
create index on public.tasks (assignee_id);
create index on public.tasks (parent_task_id);
create index on public.task_dependencies (depends_on_task_id);
create index on public.attendance (project_id);
create index on public.attendance (user_id, clock_out);
create index on public.milestones (project_id);
