-- 028_subtasks_rollup.sql: Phase (milestone) > task > subtask, with progress rolling up.
--   * a subtask belongs to a task (one level only); a subtask cannot have subtasks
--   * a subtask is always in its task's phase
--   * a task WITH subtasks gets its percentage, status and dates from them (average, summary, earliest start / latest due);
--     a task WITHOUT subtasks keeps its own values
--   * a phase's percentage is the average of its tasks' percentages (calculated in the app); the phase is done when
--     all of its tasks are done
-- Deleting a task now deletes its subtasks with it. Run after 027. Not destructive for data
-- (subtasks nested deeper than one level are moved up to one level).

-- ================================================================ clean existing data
-- flatten anything nested deeper than one level (a subtask of a subtask becomes a subtask of the top task)
with recursive up(id, cur, parent, depth) as (
  select id, id, parent_task_id, 0 from public.tasks
  union all
  select up.id, t.id, t.parent_task_id, up.depth + 1
  from up join public.tasks t on t.id = up.parent
  where up.parent is not null and up.depth < 50
)
update public.tasks t set parent_task_id = u.cur
from (select id, cur from up where parent is null) u
where t.id = u.id and t.parent_task_id is not null and t.parent_task_id <> u.cur and t.id <> u.cur;

-- subtasks share their task's phase
update public.tasks c set milestone_id = p.milestone_id
from public.tasks p
where c.parent_task_id = p.id and c.milestone_id is distinct from p.milestone_id;

-- deleting a task deletes its subtasks
alter table public.tasks drop constraint tasks_parent_task_id_fkey;
alter table public.tasks add constraint tasks_parent_task_id_fkey
  foreign key (parent_task_id) references public.tasks (id) on delete cascade;

-- ================================================================ rules about the hierarchy
create or replace function public.check_task_hierarchy()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.tasks;
begin
  if new.parent_task_id is null then return new; end if;
  if new.parent_task_id = new.id then raise exception 'A task cannot be its own subtask'; end if;
  select * into p from public.tasks where id = new.parent_task_id;
  if not found or p.project_id <> new.project_id then
    raise exception 'The task above must be in the same project';
  end if;
  if p.parent_task_id is not null then
    raise exception 'A subtask cannot have its own subtasks';
  end if;
  if tg_op = 'UPDATE' and exists (select 1 from public.tasks where parent_task_id = new.id) then
    raise exception 'A task that has subtasks cannot become a subtask';
  end if;
  new.milestone_id := p.milestone_id;   -- a subtask is always in its task's phase
  return new;
end;
$$;
create trigger tasks_hierarchy
  before insert or update of parent_task_id, project_id on public.tasks
  for each row execute function public.check_task_hierarchy();

-- when a task moves to another phase, its subtasks go with it
create or replace function public.cascade_task_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.tasks set milestone_id = new.milestone_id
    where parent_task_id = new.id and milestone_id is distinct from new.milestone_id;
  return null;
end;
$$;
create trigger tasks_cascade_milestone
  after update of milestone_id on public.tasks
  for each row when (new.parent_task_id is null and old.milestone_id is distinct from new.milestone_id)
  execute function public.cascade_task_milestone();

-- ================================================================ roll-up from subtasks
-- status: all done -> done; all to do -> to do; all in review/done -> review; otherwise in progress
create or replace function public.subtask_rollup(p_parent bigint)
returns table (r_status text, r_progress integer, r_start date, r_due date)
language sql stable security definer set search_path = public as $$
  select
    case when bool_and(status = 'done') then 'done'
         when bool_and(status = 'todo') then 'todo'
         when bool_and(status in ('review', 'done')) then 'review'
         else 'in_progress' end,
    round(avg(progress))::integer,
    min(coalesce(start_date, due_date)),
    max(coalesce(due_date, start_date))
  from public.tasks where parent_task_id = p_parent
  having count(*) > 0;
$$;

-- a task with subtasks cannot be set by hand: whatever is written is replaced by the roll-up
create or replace function public.derive_from_subtasks()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.subtask_rollup(new.id);
  if found then
    new.status := r.r_status;
    new.progress := r.r_progress;
    new.start_date := coalesce(r.r_start, new.start_date);
    new.due_date := coalesce(r.r_due, new.due_date);
  elsif new.status = 'done' then
    new.progress := 100;
  end if;
  return new;
end;
$$;
create trigger tasks_derive_from_subtasks
  before update on public.tasks
  for each row execute function public.derive_from_subtasks();

create or replace function public.refresh_parent_task(p_parent bigint)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if p_parent is null then return; end if;
  select * into r from public.subtask_rollup(p_parent);
  if found then
    update public.tasks set
      status = r.r_status,
      progress = r.r_progress,
      start_date = coalesce(r.r_start, start_date),
      due_date = coalesce(r.r_due, due_date)
    where id = p_parent
      and (status, progress, start_date, due_date)
          is distinct from (r.r_status, r.r_progress, coalesce(r.r_start, start_date), coalesce(r.r_due, due_date));
  end if;
end;
$$;
revoke all on function public.refresh_parent_task(bigint), public.subtask_rollup(bigint) from public, anon, authenticated;

create or replace function public.tasks_refresh_parent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_parent_task(new.parent_task_id);
  elsif tg_op = 'DELETE' then
    perform public.refresh_parent_task(old.parent_task_id);
  else
    perform public.refresh_parent_task(old.parent_task_id);
    if new.parent_task_id is distinct from old.parent_task_id then
      perform public.refresh_parent_task(new.parent_task_id);
    end if;
  end if;
  return null;
end;
$$;
create trigger tasks_refresh_parent
  after insert or update of status, progress, start_date, due_date, parent_task_id or delete on public.tasks
  for each row execute function public.tasks_refresh_parent();

-- a phase counts its tasks (not their subtasks); a task with subtasks is done when its subtasks are
create or replace function public.refresh_milestone(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_total int; v_open int;
begin
  if p_id is null then return; end if;
  select count(*), count(*) filter (where status <> 'done') into v_total, v_open
    from public.tasks where milestone_id = p_id and parent_task_id is null;
  if v_total > 0 then   -- a milestone with no tasks is still ticked by hand
    update public.milestones set completed = (v_open = 0) where id = p_id and completed is distinct from (v_open = 0);
  end if;
end;
$$;

-- bring everything in line once
select public.refresh_parent_task(t.id) from public.tasks t where exists (select 1 from public.tasks c where c.parent_task_id = t.id);
select public.refresh_milestone(id) from public.milestones;
