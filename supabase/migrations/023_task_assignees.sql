-- 023_task_assignees.sql: a task can be assigned to several people.
-- A link table (task_assignees) replaces the single tasks.assignee_id column; existing assignments are copied over.
-- Rules: the project manager decides who is assigned; any assignee can update the task's status and progress.
-- Run after 022. Back up first: the old column is dropped at the end.

create table public.task_assignees (
  task_id bigint not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index on public.task_assignees (user_id);

insert into public.task_assignees (task_id, user_id)
select id, assignee_id from public.tasks where assignee_id is not null;

-- ================================================================ helpers
create or replace function public.is_task_assignee(p_task_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.task_assignees where task_id = p_task_id and user_id = auth.uid());
$$;
revoke all on function public.is_task_assignee(bigint) from public, anon;
grant execute on function public.is_task_assignee(bigint) to authenticated;

-- ================================================================ security
alter table public.task_assignees enable row level security;

create policy task_assignees_select on public.task_assignees for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id)));

create policy task_assignees_insert on public.task_assignees for insert to authenticated
  with check (exists (
    select 1 from public.tasks t
    join public.project_members m on m.project_id = t.project_id and m.user_id = task_assignees.user_id and m.is_active
    where t.id = task_id and public.is_project_pm(t.project_id)
  ));

create policy task_assignees_delete on public.task_assignees for delete to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_project_pm(t.project_id)));

create policy superadmin_select on public.task_assignees for select to authenticated using (public.is_superadmin());
create policy not_suspended on public.task_assignees as restrictive for all to authenticated using (not public.is_suspended());
create policy company_active_ins on public.task_assignees as restrictive for insert to authenticated
  with check (public.is_superadmin() or not exists (
    select 1 from public.tasks t where t.id = task_id and public.project_org_suspended(t.project_id)));
create policy company_active_del on public.task_assignees as restrictive for delete to authenticated
  using (public.is_superadmin() or not exists (
    select 1 from public.tasks t where t.id = task_id and public.project_org_suspended(t.project_id)));

-- any assignee may update their task (the trigger below limits them to status and progress)
drop policy tasks_update_assignee on public.tasks;
create policy tasks_update_assignee on public.tasks for update to authenticated
  using (public.is_task_assignee(id) and public.is_project_member(project_id))
  with check (public.is_task_assignee(id) and public.is_project_member(project_id));

create or replace function public.enforce_task_assignee_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_project_pm(old.project_id) then
    return new;
  end if;
  if (new.id, new.project_id, new.title, new.description, new.start_date,
      new.due_date, new.priority, new.parent_task_id, new.created_by, new.created_at)
     is distinct from
     (old.id, old.project_id, old.title, old.description, old.start_date,
      old.due_date, old.priority, old.parent_task_id, old.created_by, old.created_at) then
    raise exception 'Assignees may only update task status and progress';
  end if;
  return new;
end;
$$;

-- ================================================================ replace a task's assignees in one step
create or replace function public.set_task_assignees(p_task_id bigint, p_user_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_project bigint; u uuid;
begin
  select project_id into v_project from public.tasks where id = p_task_id;
  if v_project is null then raise exception 'Task not found'; end if;
  if not public.is_project_pm(v_project) then raise exception 'Only the project manager can assign people'; end if;

  foreach u in array coalesce(p_user_ids, '{}') loop
    if not exists (select 1 from public.project_members where project_id = v_project and user_id = u and is_active) then
      raise exception 'Everyone assigned must be an active member of the project';
    end if;
  end loop;

  delete from public.task_assignees where task_id = p_task_id and not (user_id = any (coalesce(p_user_ids, '{}')));
  insert into public.task_assignees (task_id, user_id)
    select p_task_id, x from (select distinct unnest(coalesce(p_user_ids, '{}')) as x) people
    on conflict do nothing;
end;
$$;
revoke all on function public.set_task_assignees(bigint, uuid[]) from public, anon;
grant execute on function public.set_task_assignees(bigint, uuid[]) to authenticated;

-- ================================================================ notifications and activity log
drop trigger tasks_notify_assigned on public.tasks;
drop function public.notify_task_assigned();

create or replace function public.notify_task_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  if new.user_id is distinct from auth.uid() then
    select * into t from public.tasks where id = new.task_id;
    if t.id is not null then
      insert into public.notifications (user_id, type, title, body, link)
      values (new.user_id, 'task_assigned', 'New task assigned to you', t.title, '/projects/' || t.project_id::text);
    end if;
  end if;
  return new;
end;
$$;
create trigger task_assignees_notify
  after insert on public.task_assignees
  for each row execute function public.notify_task_assigned();

-- a comment notifies every assignee and the creator (not the commenter)
create or replace function public.notify_task_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
  who uuid;
begin
  select * into t from public.tasks where id = new.task_id;
  for who in
    select x from (
      select a.user_id as x from public.task_assignees a where a.task_id = t.id
      union
      select t.created_by
    ) people
    where x is not null and x <> new.user_id
  loop
    insert into public.notifications (user_id, type, title, body, link)
    values (who, 'task_comment', public.display_name(new.user_id) || ' commented on "' || t.title || '"',
            left(new.body, 140), '/projects/' || t.project_id::text);
  end loop;
  return new;
end;
$$;

create or replace function public.audit_tasks()
returns trigger language plpgsql security definer set search_path = public as $$
declare changes text[] := '{}';
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(new.project_id, 'create', 'task', new.id, 'Created task "' || new.title || '"');
  elsif tg_op = 'UPDATE' then
    if new.title is distinct from old.title then changes := changes || ('title "' || old.title || '" to "' || new.title || '"'); end if;
    if new.status is distinct from old.status then changes := changes || ('status ' || old.status || ' to ' || new.status); end if;
    if new.priority is distinct from old.priority then changes := changes || ('priority ' || old.priority || ' to ' || new.priority); end if;
    if new.start_date is distinct from old.start_date or new.due_date is distinct from old.due_date then
      changes := changes || ('dates ' || coalesce(new.start_date::text, '?') || ' to ' || coalesce(new.due_date::text, '?'));
    end if;
    -- progress-only edits are too noisy to log
    if array_length(changes, 1) is not null then
      perform public.log_audit(new.project_id, 'update', 'task', new.id, 'Task "' || new.title || '": ' || array_to_string(changes, ', '));
    end if;
  elsif exists (select 1 from public.projects where id = old.project_id) then
    perform public.log_audit(old.project_id, 'delete', 'task', old.id, 'Deleted task "' || old.title || '"');
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.audit_task_assignees()
returns trigger language plpgsql security definer set search_path = public as $$
declare t public.tasks; r public.task_assignees;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  select * into t from public.tasks where id = r.task_id;
  if t.id is not null then   -- the task is already gone when it is being deleted
    perform public.log_audit(t.project_id, 'update', 'task', t.id,
      'Task "' || t.title || '": ' || case when tg_op = 'INSERT' then 'assigned ' else 'unassigned ' end || public.display_name(r.user_id));
  end if;
  return null;
end;
$$;
create trigger task_assignees_audit
  after insert or delete on public.task_assignees
  for each row execute function public.audit_task_assignees();

-- removing someone from a project unassigns them from that project's tasks
create or replace function public.handle_member_removed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.projects where id = old.project_id) then
    if old.is_active
       and exists (select 1 from public.roles r where r.id = old.role_id and r.is_pm)
       and not exists (
         select 1
         from public.project_members m
         join public.roles r on r.id = m.role_id
         where m.project_id = old.project_id and m.id <> old.id and m.is_active and r.is_pm
       ) then
      raise exception 'You cannot remove the last project manager';
    end if;

    delete from public.task_assignees a
    using public.tasks t
    where t.id = a.task_id and t.project_id = old.project_id and a.user_id = old.user_id;
  end if;
  return old;
end;
$$;

-- ================================================================ the old column is no longer used
alter table public.tasks drop column assignee_id;
