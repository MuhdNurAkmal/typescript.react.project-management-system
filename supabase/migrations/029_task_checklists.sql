-- 029_task_checklists.sql: subtasks become a Trello-style checklist inside the task (replaces 028's subtasks).
--   * a checklist item has only a title and its progress: either a tick box (0 or 100) or a percentage (0-100)
--   * items have no people, dates or status of their own; the people are on the task
--   * a task with checklist items gets its percentage from them (average); a Done task counts as 100
--   * status and dates of a task are set by hand again
-- Existing subtasks (028) are turned into checklist items of their task, then removed. Run after 028.
-- Back up first: the old subtask rows are deleted (their title and progress are kept as items;
-- their comments, people and dates are not).

-- ================================================================ undo 028's hierarchy rules
drop trigger if exists tasks_hierarchy on public.tasks;
drop trigger if exists tasks_cascade_milestone on public.tasks;
drop trigger if exists tasks_derive_from_subtasks on public.tasks;
drop trigger if exists tasks_refresh_parent on public.tasks;
drop function if exists public.check_task_hierarchy();
drop function if exists public.cascade_task_milestone();
drop function if exists public.derive_from_subtasks();
drop function if exists public.tasks_refresh_parent();
drop function if exists public.refresh_parent_task(bigint);
drop function if exists public.subtask_rollup(bigint);

-- ================================================================ the checklist
create table public.task_checklist_items (
  id bigint generated always as identity primary key,
  task_id bigint not null references public.tasks (id) on delete cascade,
  project_id bigint not null references public.projects (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  kind text not null default 'check' check (kind in ('check', 'percent')),
  progress integer not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  -- a tick box is either empty or full
  check (kind = 'percent' or progress in (0, 100))
);
create index on public.task_checklist_items (task_id);
create index on public.task_checklist_items (project_id);

-- the project always comes from the task, never from the caller
create or replace function public.checklist_set_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select project_id into new.project_id from public.tasks where id = new.task_id;
  if new.project_id is null then raise exception 'Task not found'; end if;
  if tg_op = 'UPDATE' and new.task_id <> old.task_id then
    raise exception 'A checklist item cannot move to another task';
  end if;
  return new;
end;
$$;
create trigger checklist_project
  before insert or update on public.task_checklist_items
  for each row execute function public.checklist_set_project();

-- ================================================================ percentage of a task from its checklist
-- Done counts as 100; with no checklist the task keeps its own value.
create or replace function public.checklist_progress(p_task bigint)
returns integer language sql stable security definer set search_path = public as $$
  select round(avg(progress))::integer from public.task_checklist_items where task_id = p_task;
$$;
revoke all on function public.checklist_progress(bigint) from public, anon, authenticated;

create or replace function public.refresh_task_progress(p_task bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  v := public.checklist_progress(p_task);
  if v is not null then
    update public.tasks set progress = case when status = 'done' then 100 else v end
    where id = p_task and progress is distinct from (case when status = 'done' then 100 else v end);
  end if;
end;
$$;
revoke all on function public.refresh_task_progress(bigint) from public, anon, authenticated;

create or replace function public.checklist_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' then perform public.refresh_task_progress(old.task_id); end if;
  if tg_op <> 'DELETE' then perform public.refresh_task_progress(new.task_id); end if;
  return null;
end;
$$;
create trigger checklist_refresh
  after insert or update or delete on public.task_checklist_items
  for each row execute function public.checklist_changed();

-- a hand-typed percentage on a task with a checklist is replaced by the checklist's
create or replace function public.tasks_keep_checklist_progress()
returns trigger language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  v := public.checklist_progress(new.id);
  if v is not null then
    new.progress := case when new.status = 'done' then 100 else v end;
  elsif new.status = 'done' then
    new.progress := 100;
  end if;
  return new;
end;
$$;
create trigger tasks_checklist_progress
  before update on public.tasks
  for each row execute function public.tasks_keep_checklist_progress();

-- ================================================================ security
alter table public.task_checklist_items enable row level security;

create policy checklist_select on public.task_checklist_items for select to authenticated
  using (public.is_project_member(project_id));
create policy checklist_insert on public.task_checklist_items for insert to authenticated
  with check (public.can_edit_project(project_id));
create policy checklist_update on public.task_checklist_items for update to authenticated
  using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));
create policy checklist_delete on public.task_checklist_items for delete to authenticated
  using (public.can_edit_project(project_id));

create policy superadmin_select on public.task_checklist_items for select to authenticated using (public.is_superadmin());
create policy not_suspended on public.task_checklist_items as restrictive for all to authenticated using (not public.is_suspended());
create policy company_active_ins on public.task_checklist_items as restrictive for insert to authenticated
  with check (public.is_superadmin() or not public.project_org_suspended(project_id));
create policy company_active_upd on public.task_checklist_items as restrictive for update to authenticated
  using (public.is_superadmin() or not public.project_org_suspended(project_id));
create policy company_active_del on public.task_checklist_items as restrictive for delete to authenticated
  using (public.is_superadmin() or not public.project_org_suspended(project_id));

-- ================================================================ convert 028's subtasks
insert into public.task_checklist_items (task_id, project_id, title, kind, progress, created_at)
select parent_task_id, project_id, left(btrim(title), 200),
       case when progress in (0, 100) then 'check' else 'percent' end,
       case when status = 'done' then 100 else progress end,
       created_at
from public.tasks
where parent_task_id is not null and length(btrim(title)) > 0
order by coalesce(start_date, due_date), id;

-- remove the old subtask rows without firing activity / notification triggers for them
alter table public.tasks disable trigger user;
delete from public.tasks where parent_task_id is not null;
alter table public.tasks enable trigger user;

-- tasks are flat again: nothing may be a subtask
alter table public.tasks add constraint tasks_not_a_subtask check (parent_task_id is null);

-- bring the percentages in line once
select public.refresh_task_progress(id) from public.tasks;

-- a milestone counts its tasks (all of them are top level now)
create or replace function public.refresh_milestone(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_total int; v_open int;
begin
  if p_id is null then return; end if;
  select count(*), count(*) filter (where status <> 'done') into v_total, v_open
    from public.tasks where milestone_id = p_id;
  if v_total > 0 then   -- a milestone with no tasks is still ticked by hand
    update public.milestones set completed = (v_open = 0) where id = p_id and completed is distinct from (v_open = 0);
  end if;
end;
$$;
select public.refresh_milestone(id) from public.milestones;
