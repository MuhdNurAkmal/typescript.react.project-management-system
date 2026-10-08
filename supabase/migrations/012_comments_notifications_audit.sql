-- 012_comments_notifications_audit.sql
-- Task comments, in-app notifications and a per-project activity (audit) log.

-- ================================================================ comments
create table public.task_comments (
  id bigint generated always as identity primary key,
  task_id bigint not null references public.tasks (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.task_comments (task_id, created_at);
create index on public.task_comments (user_id);

alter table public.task_comments enable row level security;

create policy comments_select on public.task_comments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id)));
create policy comments_insert on public.task_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id))
  );
create policy comments_delete on public.task_comments for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.tasks t where t.id = task_id and public.is_project_pm(t.project_id))
  );

-- ================================================================ notifications
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, read, created_at desc);

alter table public.notifications enable row level security;

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());
-- no insert policy: rows are created only by the security definer triggers below

create or replace function public.enforce_notification_columns()
returns trigger
language plpgsql
as $$
begin
  if (new.id, new.user_id, new.type, new.title, new.body, new.link, new.created_at)
     is distinct from (old.id, old.user_id, old.type, old.title, old.body, old.link, old.created_at) then
    raise exception 'Only the read flag of a notification can be changed';
  end if;
  return new;
end;
$$;

create trigger notifications_columns
  before update on public.notifications
  for each row execute function public.enforce_notification_columns();

create or replace function public.display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(full_name, ''), email, 'Someone') from public.profiles where id = p_user_id;
$$;
revoke all on function public.display_name(uuid) from public, anon, authenticated;

-- task assigned
create or replace function public.notify_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assignee_id is not null and new.assignee_id is distinct from auth.uid() then
    if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
      return new;
    end if;
    insert into public.notifications (user_id, type, title, body, link)
    values (new.assignee_id, 'task_assigned', 'New task assigned to you', new.title, '/projects/' || new.project_id::text);
  end if;
  return new;
end;
$$;

create trigger tasks_notify_assigned
  after insert or update of assignee_id on public.tasks
  for each row execute function public.notify_task_assigned();

-- new comment: tell the assignee and the creator (not the commenter)
create or replace function public.notify_task_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
  who uuid;
begin
  select * into t from public.tasks where id = new.task_id;
  for who in
    select distinct x from unnest(array[t.assignee_id, t.created_by]) as x
    where x is not null and x <> new.user_id
  loop
    insert into public.notifications (user_id, type, title, body, link)
    values (who, 'task_comment', public.display_name(new.user_id) || ' commented on "' || t.title || '"',
            left(new.body, 140), '/projects/' || t.project_id::text);
  end loop;
  return new;
end;
$$;

create trigger comments_notify
  after insert on public.task_comments
  for each row execute function public.notify_task_comment();

-- leave requested (tell the managers) and decided (tell the requester)
create or replace function public.notify_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  manager uuid;
begin
  if tg_op = 'INSERT' then
    for manager in
      select distinct me.user_id
      from public.project_members me
      join public.roles r on r.id = me.role_id
      join public.project_members other on other.project_id = me.project_id
      where me.is_active and r.is_pm and other.is_active
        and other.user_id = new.user_id and me.user_id <> new.user_id
    loop
      insert into public.notifications (user_id, type, title, body, link)
      values (manager, 'leave_requested', public.display_name(new.user_id) || ' requested leave',
              new.start_date::text || ' to ' || new.end_date::text, '/attendance');
    end loop;
  elsif new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, type, title, body, link)
    values (new.user_id, 'leave_decided', 'Your leave request was ' || new.status,
            new.start_date::text || ' to ' || new.end_date::text, '/attendance');
  end if;
  return new;
end;
$$;

create trigger leave_notify
  after insert or update of status on public.leave_requests
  for each row execute function public.notify_leave();

-- attendance reviewed
create or replace function public.notify_attendance_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected')
     and new.user_id is distinct from auth.uid() then
    insert into public.notifications (user_id, type, title, body, link)
    values (new.user_id, 'attendance_reviewed', 'Your attendance was ' || new.status,
            to_char(new.clock_in at time zone 'Asia/Kuala_Lumpur', 'DD Mon YYYY HH24:MI'), '/attendance');
  end if;
  return new;
end;
$$;

create trigger attendance_notify
  after update of status on public.attendance
  for each row execute function public.notify_attendance_reviewed();

-- ================================================================ audit log
create table public.audit_log (
  id bigint generated always as identity primary key,
  project_id bigint not null,   -- deliberately no foreign key: logging must never block a project delete
  actor_id uuid default auth.uid(),
  action text not null check (action in ('create', 'update', 'delete')),
  entity text not null,
  entity_id bigint,
  summary text not null,
  created_at timestamptz not null default now()
);
create index on public.audit_log (project_id, created_at desc);

alter table public.audit_log enable row level security;

create policy audit_select on public.audit_log for select to authenticated
  using (public.is_project_pm(project_id));
-- no insert/update/delete policies: written only by triggers, immutable for users

create or replace function public.log_audit(
  p_project_id bigint, p_action text, p_entity text, p_entity_id bigint, p_summary text
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_log (project_id, actor_id, action, entity, entity_id, summary)
  values (p_project_id, auth.uid(), p_action, p_entity, p_entity_id, p_summary);
$$;
revoke all on function public.log_audit(bigint, text, text, bigint, text) from public, anon, authenticated;

create or replace function public.audit_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changes text[] := '{}';
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(new.project_id, 'create', 'task', new.id, 'Created task "' || new.title || '"');
  elsif tg_op = 'UPDATE' then
    if new.title is distinct from old.title then changes := changes || ('title "' || old.title || '" to "' || new.title || '"'); end if;
    if new.status is distinct from old.status then changes := changes || ('status ' || old.status || ' to ' || new.status); end if;
    if new.priority is distinct from old.priority then changes := changes || ('priority ' || old.priority || ' to ' || new.priority); end if;
    if new.assignee_id is distinct from old.assignee_id then
      changes := changes || ('assignee ' || coalesce(public.display_name(old.assignee_id), 'unassigned') || ' to ' || coalesce(public.display_name(new.assignee_id), 'unassigned'));
    end if;
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

create trigger tasks_audit
  after insert or update or delete on public.tasks
  for each row execute function public.audit_tasks();

create or replace function public.audit_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_name text;
begin
  if tg_op = 'INSERT' then
    select name into role_name from public.roles where id = new.role_id;
    perform public.log_audit(new.project_id, 'create', 'member', new.id, 'Added ' || public.display_name(new.user_id) || ' as ' || role_name);
  elsif tg_op = 'UPDATE' then
    if new.role_id is distinct from old.role_id then
      select name into role_name from public.roles where id = new.role_id;
      perform public.log_audit(new.project_id, 'update', 'member', new.id, 'Changed role of ' || public.display_name(new.user_id) || ' to ' || role_name);
    end if;
    if new.is_active is distinct from old.is_active then
      perform public.log_audit(new.project_id, 'update', 'member', new.id,
        case when new.is_active then 'Reactivated ' else 'Deactivated ' end || public.display_name(new.user_id));
    end if;
  elsif exists (select 1 from public.projects where id = old.project_id) then
    perform public.log_audit(old.project_id, 'delete', 'member', old.id, 'Removed ' || public.display_name(old.user_id));
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger members_audit
  after insert or update or delete on public.project_members
  for each row execute function public.audit_members();

create or replace function public.audit_projects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changes text[] := '{}';
begin
  if new.name is distinct from old.name then changes := changes || ('name "' || old.name || '" to "' || new.name || '"'); end if;
  if new.status is distinct from old.status then changes := changes || ('status ' || old.status || ' to ' || new.status); end if;
  if new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date then changes := changes || 'dates'; end if;
  if new.budget is distinct from old.budget then changes := changes || 'budget'; end if;
  if new.sponsor is distinct from old.sponsor or new.description is distinct from old.description or new.type is distinct from old.type then changes := changes || 'details'; end if;
  if array_length(changes, 1) is not null then
    perform public.log_audit(new.id, 'update', 'project', new.id, 'Updated project: ' || array_to_string(changes, ', '));
  end if;
  return new;
end;
$$;

create trigger projects_audit
  after update on public.projects
  for each row execute function public.audit_projects();

create or replace function public.audit_milestones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(new.project_id, 'create', 'milestone', new.id, 'Added milestone "' || new.title || '" (' || new.due_date::text || ')');
  elsif tg_op = 'UPDATE' then
    if new.completed is distinct from old.completed then
      perform public.log_audit(new.project_id, 'update', 'milestone', new.id,
        'Milestone "' || new.title || '" marked ' || case when new.completed then 'complete' else 'incomplete' end);
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

create trigger milestones_audit
  after insert or update or delete on public.milestones
  for each row execute function public.audit_milestones();
