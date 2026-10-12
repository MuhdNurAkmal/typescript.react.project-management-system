-- 027_milestone_phases.sql: a milestone is a phase with a start and an end date, and tasks live under it.
-- All of a milestone's tasks should be done by its end date. A task belongs to at most one milestone.
--   * milestones: due_date becomes end_date, plus a start_date (existing milestones get start = end)
--   * tasks.milestone_id links a task to its milestone (no milestone = "unplanned")
--   * a milestone with tasks completes by itself when its last task is done, and reopens when one is reopened
--   * the project's managers are notified once when a milestone's end date passes with tasks still open
-- Run after 026. Not destructive.

alter table public.milestones rename column due_date to end_date;
alter table public.milestones add column start_date date;
update public.milestones set start_date = end_date;
alter table public.milestones alter column start_date set not null;
alter table public.milestones add constraint milestones_dates_ordered check (end_date >= start_date);

alter table public.tasks add column milestone_id bigint references public.milestones (id) on delete set null;
create index on public.tasks (milestone_id);

-- ================================================================ a task's milestone must be in the same project
create or replace function public.check_task_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.milestone_id is not null
     and not exists (select 1 from public.milestones m where m.id = new.milestone_id and m.project_id = new.project_id) then
    raise exception 'The milestone belongs to a different project';
  end if;
  return new;
end;
$$;
create trigger tasks_check_milestone
  before insert or update of milestone_id, project_id on public.tasks
  for each row execute function public.check_task_milestone();

-- ================================================================ finish and reopen milestones by themselves
create or replace function public.refresh_milestone(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_total int; v_open int;
begin
  if p_id is null then return; end if;
  select count(*), count(*) filter (where status <> 'done') into v_total, v_open from public.tasks where milestone_id = p_id;
  if v_total > 0 then   -- a milestone with no tasks is still ticked by hand
    update public.milestones set completed = (v_open = 0) where id = p_id and completed is distinct from (v_open = 0);
  end if;
end;
$$;
revoke all on function public.refresh_milestone(bigint) from public, anon, authenticated;

create or replace function public.tasks_refresh_milestones()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_milestone(new.milestone_id);
  elsif tg_op = 'DELETE' then
    perform public.refresh_milestone(old.milestone_id);
  else
    perform public.refresh_milestone(old.milestone_id);
    if new.milestone_id is distinct from old.milestone_id then
      perform public.refresh_milestone(new.milestone_id);
    end if;
  end if;
  return null;
end;
$$;
create trigger tasks_refresh_milestones
  after insert or update of status, milestone_id or delete on public.tasks
  for each row execute function public.tasks_refresh_milestones();

-- bring existing milestones in line with their tasks (none are linked yet, so this is a no-op today)
select public.refresh_milestone(id) from public.milestones;

-- the activity log used the old column
create or replace function public.audit_milestones()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(new.project_id, 'create', 'milestone', new.id,
      'Added milestone "' || new.title || '" (' || new.start_date::text || ' to ' || new.end_date::text || ')');
  elsif tg_op = 'UPDATE' then
    if new.completed is distinct from old.completed then
      perform public.log_audit(new.project_id, 'update', 'milestone', new.id,
        'Milestone "' || new.title || '" marked ' || case when new.completed then 'complete' else 'incomplete' end);
    end if;
    if new.title is distinct from old.title or new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date then
      perform public.log_audit(new.project_id, 'update', 'milestone', new.id,
        'Milestone "' || new.title || '": ' || new.start_date::text || ' to ' || new.end_date::text);
    end if;
  elsif exists (select 1 from public.projects where id = old.project_id) then
    perform public.log_audit(old.project_id, 'delete', 'milestone', old.id, 'Deleted milestone "' || old.title || '"');
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- ================================================================ tell the managers once when a milestone is overdue
create table public.milestone_alerts (
  milestone_id bigint primary key references public.milestones (id) on delete cascade,
  notified_at timestamptz not null default now()
);
alter table public.milestone_alerts enable row level security;   -- no policies: only the function below touches it

-- Called when someone opens a project. For each milestone whose end date has passed (Malaysia time) with open tasks
-- and no alert sent yet, every project manager gets one notification. A new end date earns a new alert.
create or replace function public.check_milestone_deadlines(p_project_id bigint)
returns integer language plpgsql security definer set search_path = public as $$
declare
  m record; pm uuid; v_sent int := 0; v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  if not public.is_project_member(p_project_id) then return 0; end if;

  -- a milestone that was given a new, later end date can be alerted again
  delete from public.milestone_alerts a using public.milestones x
    where x.id = a.milestone_id and x.project_id = p_project_id and x.end_date >= v_today;

  for m in
    select ms.id, ms.title, ms.end_date,
           (select count(*) from public.tasks t where t.milestone_id = ms.id and t.status <> 'done') as open_tasks
    from public.milestones ms
    where ms.project_id = p_project_id and ms.end_date < v_today
      and not exists (select 1 from public.milestone_alerts a where a.milestone_id = ms.id)
  loop
    if m.open_tasks > 0 then
      for pm in
        select pmm.user_id from public.project_members pmm
        join public.roles r on r.id = pmm.role_id
        where pmm.project_id = p_project_id and pmm.is_active and r.is_pm
      loop
        insert into public.notifications (user_id, type, title, body, link)
        values (pm, 'milestone_overdue', 'Milestone "' || m.title || '" is overdue',
                m.open_tasks || ' task(s) still open. It ended on ' || m.end_date::text, '/projects/' || p_project_id::text);
      end loop;
      insert into public.milestone_alerts (milestone_id) values (m.id);
      v_sent := v_sent + 1;
    end if;
  end loop;
  return v_sent;
end;
$$;
revoke all on function public.check_milestone_deadlines(bigint) from public, anon;
grant execute on function public.check_milestone_deadlines(bigint) to authenticated;
