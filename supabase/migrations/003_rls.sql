-- 003_rls.sql: Row Level Security

-- Helper functions (security definer so policies don't recurse into project_members RLS)
create or replace function public.is_project_member(p_project_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid() and is_active
  );
$$;

create or replace function public.is_project_pm(p_project_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid() and is_active and role = 'pm'
  );
$$;

create or replace function public.shares_project_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members me
    join public.project_members other on other.project_id = me.project_id
    where me.user_id = auth.uid() and me.is_active and other.user_id = p_user_id
  );
$$;

revoke all on function public.is_project_member(bigint), public.is_project_pm(bigint),
  public.shares_project_with(uuid) from public, anon;
grant execute on function public.is_project_member(bigint), public.is_project_pm(bigint),
  public.shares_project_with(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.attendance enable row level security;
alter table public.milestones enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_project_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- projects (creator can see the row they just inserted, before the PM membership trigger is visible)
create policy projects_select on public.projects for select to authenticated
  using (public.is_project_member(id) or created_by = auth.uid());
create policy projects_insert on public.projects for insert to authenticated
  with check (created_by = auth.uid());
create policy projects_update on public.projects for update to authenticated
  using (public.is_project_pm(id)) with check (public.is_project_pm(id));
create policy projects_delete on public.projects for delete to authenticated
  using (public.is_project_pm(id));

-- project_members
create policy members_select on public.project_members for select to authenticated
  using (public.is_project_member(project_id));
create policy members_insert on public.project_members for insert to authenticated
  with check (public.is_project_pm(project_id));
create policy members_update on public.project_members for update to authenticated
  using (public.is_project_pm(project_id)) with check (public.is_project_pm(project_id));
create policy members_delete on public.project_members for delete to authenticated
  using (public.is_project_pm(project_id));

-- tasks
create policy tasks_select on public.tasks for select to authenticated
  using (public.is_project_member(project_id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_project_pm(project_id));
create policy tasks_update_pm on public.tasks for update to authenticated
  using (public.is_project_pm(project_id)) with check (public.is_project_pm(project_id));
create policy tasks_update_assignee on public.tasks for update to authenticated
  using (assignee_id = auth.uid() and public.is_project_member(project_id))
  with check (assignee_id = auth.uid() and public.is_project_member(project_id));
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_project_pm(project_id));

-- RLS cannot restrict columns, so a trigger limits non-PM assignees to status and progress.
create or replace function public.enforce_task_assignee_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_project_pm(old.project_id) then
    return new;
  end if;
  if (new.id, new.project_id, new.title, new.description, new.assignee_id, new.start_date,
      new.due_date, new.priority, new.parent_task_id, new.created_by, new.created_at)
     is distinct from
     (old.id, old.project_id, old.title, old.description, old.assignee_id, old.start_date,
      old.due_date, old.priority, old.parent_task_id, old.created_by, old.created_at) then
    raise exception 'Assignees may only update task status and progress';
  end if;
  return new;
end;
$$;

create trigger tasks_assignee_columns
  before update on public.tasks
  for each row execute function public.enforce_task_assignee_columns();

-- task_dependencies (follow the task's project)
create policy deps_select on public.task_dependencies for select to authenticated
  using (exists (select 1 from public.tasks t
                 where t.id = task_id and public.is_project_member(t.project_id)));
create policy deps_insert on public.task_dependencies for insert to authenticated
  with check (exists (select 1 from public.tasks t
                      where t.id = task_id and public.is_project_pm(t.project_id)));
create policy deps_delete on public.task_dependencies for delete to authenticated
  using (exists (select 1 from public.tasks t
                 where t.id = task_id and public.is_project_pm(t.project_id)));

-- attendance
create policy attendance_select on public.attendance for select to authenticated
  using (
    public.is_project_pm(project_id)
    or (user_id = auth.uid() and public.is_project_member(project_id))
  );
create policy attendance_insert on public.attendance for insert to authenticated
  with check (user_id = auth.uid() and public.is_project_member(project_id));
create policy attendance_update_own on public.attendance for update to authenticated
  using (user_id = auth.uid() and public.is_project_member(project_id))
  with check (user_id = auth.uid() and public.is_project_member(project_id));
create policy attendance_update_pm on public.attendance for update to authenticated
  using (public.is_project_pm(project_id)) with check (public.is_project_pm(project_id));

-- Own rows: only clock_out and note may change (no self-approval, no rewriting clock_in).
-- PMs: only status and note may change.
create or replace function public.enforce_attendance_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id <> old.id or new.project_id <> old.project_id or new.user_id <> old.user_id then
    raise exception 'Cannot change attendance ownership';
  end if;
  if public.is_project_pm(old.project_id) and old.user_id <> auth.uid() then
    if new.clock_in <> old.clock_in or new.clock_out is distinct from old.clock_out then
      raise exception 'PMs may only update attendance status and note';
    end if;
  else
    if new.clock_in <> old.clock_in or new.status <> old.status then
      raise exception 'You may only update clock_out and note on your own attendance';
    end if;
  end if;
  return new;
end;
$$;

create trigger attendance_columns
  before update on public.attendance
  for each row execute function public.enforce_attendance_columns();

-- milestones
create policy milestones_select on public.milestones for select to authenticated
  using (public.is_project_member(project_id));
create policy milestones_insert on public.milestones for insert to authenticated
  with check (public.is_project_pm(project_id));
create policy milestones_update on public.milestones for update to authenticated
  using (public.is_project_pm(project_id)) with check (public.is_project_pm(project_id));
create policy milestones_delete on public.milestones for delete to authenticated
  using (public.is_project_pm(project_id));
