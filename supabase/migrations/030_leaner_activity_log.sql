-- 030_leaner_activity_log.sql: the project activity log keeps only events a manager would look up later.
-- Logged from now on:
--   * project: name, status, dates or budget changed
--   * members: added, removed, role changed, deactivated / reactivated
--   * milestones: added, deleted, dates changed, marked complete / incomplete
--   * tasks: deleted, marked done, due date moved after it had one
-- No longer logged: task created, status moves other than to Done, title / priority / assignee / progress edits,
-- project description / sponsor / type edits, milestone title-only edits.
-- Also deletes the old activity rows that are no longer wanted. Run after 029. Safe to run twice.

-- ================================================================ tasks
create or replace function public.audit_tasks()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.status = 'done' and old.status <> 'done' then
      perform public.log_audit(new.project_id, 'update', 'task', new.id, 'Task "' || new.title || '" marked done');
    end if;
    if old.due_date is not null and new.due_date is distinct from old.due_date then
      perform public.log_audit(new.project_id, 'update', 'task', new.id,
        'Task "' || new.title || '": due date ' || old.due_date::text || ' to ' || coalesce(new.due_date::text, 'none'));
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if exists (select 1 from public.projects where id = old.project_id) then
      perform public.log_audit(old.project_id, 'delete', 'task', old.id, 'Deleted task "' || old.title || '"');
    end if;
    return old;
  end if;
  return new;   -- creating a task is not logged
end;
$$;

-- assigning people is not logged any more
drop trigger if exists task_assignees_audit on public.task_assignees;
drop function if exists public.audit_task_assignees();

-- ================================================================ project: leave out description / sponsor / type edits
create or replace function public.audit_projects()
returns trigger language plpgsql security definer set search_path = public as $$
declare changes text[] := '{}';
begin
  if new.name is distinct from old.name then changes := changes || ('name "' || old.name || '" to "' || new.name || '"'); end if;
  if new.status is distinct from old.status then changes := changes || ('status ' || old.status || ' to ' || new.status); end if;
  if new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date then changes := changes || array['dates']; end if;
  if new.budget is distinct from old.budget then changes := changes || array['budget']; end if;
  if array_length(changes, 1) is not null then
    perform public.log_audit(new.id, 'update', 'project', new.id, 'Updated project: ' || array_to_string(changes, ', '));
  end if;
  return new;
end;
$$;

-- ================================================================ milestones: a title-only edit is not logged
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
    if new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date then
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

-- ================================================================ clean up the old log
-- tasks: keep deletions and "status ... to done"; everything else (created, moved, renamed, assigned, dates) goes
delete from public.audit_log
where entity = 'task'
  and action <> 'delete'
  and summary !~ 'status [a-z_]+ to done';

-- projects: an edit that only touched description / sponsor / type
delete from public.audit_log
where entity = 'project' and summary = 'Updated project: details';

-- milestones: old title-only edits cannot be told apart from date edits, so they stay
