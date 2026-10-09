-- 018_superadmin_manage.sql: the superadmin can act as PM / company admin anywhere, every deleted project is kept for 30 days and can be restored.
-- Run after 017. Not destructive.

-- ================================================================ act as PM / admin everywhere
-- The three checks that gate project and company management now also pass for the superadmin.
-- (is_org_member stays strict, so the superadmin does not appear as a member or clock in to other companies.)
create or replace function public.is_project_member(p_project_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid() and is_active
  );
$$;

create or replace function public.is_project_pm(p_project_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or exists (
    select 1
    from public.project_members m
    join public.roles r on r.id = m.role_id
    where m.project_id = p_project_id and m.user_id = auth.uid() and m.is_active and r.is_pm
  );
$$;

create or replace function public.is_org_admin(p_org_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = auth.uid() and org_role in ('owner', 'admin')
  );
$$;

-- ================================================================ audit what the superadmin changes on other people's behalf
create or replace function public.audit_superadmin_attendance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_superadmin() and new.user_id <> auth.uid() and new.clock_out is distinct from old.clock_out then
    perform public.admin_log('update', 'attendance', new.id::text,
      'Set clock-out of ' || public.display_name(new.user_id) || ' (session #' || new.id || ')');
  end if;
  return null;
end;
$$;
create trigger attendance_superadmin_audit
  after update on public.attendance
  for each row execute function public.audit_superadmin_attendance();

create or replace function public.audit_superadmin_leave()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_superadmin() and new.user_id <> auth.uid() and new.status is distinct from old.status then
    perform public.admin_log('update', 'leave', new.id::text,
      'Marked leave of ' || public.display_name(new.user_id) || ' as ' || new.status);
  end if;
  return null;
end;
$$;
create trigger leave_superadmin_audit
  after update on public.leave_requests
  for each row execute function public.audit_superadmin_leave();

-- ================================================================ deleted projects are kept for 30 days
create table public.deleted_projects (
  id bigint generated always as identity primary key,
  project_id bigint not null,
  organization_id bigint not null,
  name text not null,
  deleted_by uuid default auth.uid(),
  deleted_at timestamptz not null default now(),
  snapshot jsonb not null
);
create index on public.deleted_projects (deleted_at);
alter table public.deleted_projects enable row level security;
create policy deleted_projects_select on public.deleted_projects for select to authenticated using (public.is_superadmin());
-- no write policies: written by the trigger below, restored through admin_restore_project

create or replace function public.snapshot_deleted_project()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tasks jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_tasks from public.tasks t where t.project_id = old.id;
  insert into public.deleted_projects (project_id, organization_id, name, snapshot)
  values (old.id, old.organization_id, old.name, jsonb_build_object(
    'project', to_jsonb(old),
    'members', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from public.project_members m where m.project_id = old.id),
    'tasks', v_tasks,
    'dependencies', (select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from public.task_dependencies d
                     where d.task_id in (select t.id from public.tasks t where t.project_id = old.id)),
    'milestones', (select coalesce(jsonb_agg(to_jsonb(ms)), '[]'::jsonb) from public.milestones ms where ms.project_id = old.id),
    'comments', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.task_comments c
                 where c.task_id in (select t.id from public.tasks t where t.project_id = old.id))
  ));
  if public.is_superadmin() then
    perform public.admin_log('delete', 'project', old.id::text, 'Deleted project "' || old.name || '" (kept for 30 days)');
  end if;
  return old;
end;
$$;
create trigger projects_snapshot_before_delete
  before delete on public.projects
  for each row execute function public.snapshot_deleted_project();

create or replace function public.admin_list_deleted_projects()
returns table (
  id bigint, project_id bigint, name text, organization_id bigint, organization_name text,
  deleted_by_name text, deleted_at timestamptz, task_count bigint, company_exists boolean
)
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_superadmin();
  delete from public.deleted_projects d where d.deleted_at < now() - interval '30 days';
  return query
    select d.id, d.project_id, d.name, d.organization_id, o.name,
           case when d.deleted_by is null then null else public.display_name(d.deleted_by) end,
           d.deleted_at, jsonb_array_length(d.snapshot -> 'tasks')::bigint, o.id is not null
    from public.deleted_projects d
    left join public.organizations o on o.id = d.organization_id
    order by d.deleted_at desc;
end;
$$;

create or replace function public.admin_restore_project(p_deleted_id bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare s jsonb; d public.deleted_projects;
begin
  perform public.require_superadmin();
  select * into d from public.deleted_projects where id = p_deleted_id;
  if not found then raise exception 'Nothing to restore'; end if;
  if not exists (select 1 from public.organizations where id = d.organization_id) then
    raise exception 'The company of this project no longer exists';
  end if;
  if exists (select 1 from public.projects where id = d.project_id) then
    raise exception 'This project already exists';
  end if;
  s := d.snapshot;

  insert into public.projects overriding system value
    select * from jsonb_populate_recordset(null::public.projects, jsonb_build_array(s -> 'project'));
  -- the new-project trigger made the creator a PM; replace that with the original members
  delete from public.project_members where project_id = d.project_id;
  insert into public.project_members overriding system value
    select * from jsonb_populate_recordset(null::public.project_members, s -> 'members');
  insert into public.tasks overriding system value
    select * from jsonb_populate_recordset(null::public.tasks, s -> 'tasks');
  insert into public.task_dependencies
    select * from jsonb_populate_recordset(null::public.task_dependencies, s -> 'dependencies');
  insert into public.milestones overriding system value
    select * from jsonb_populate_recordset(null::public.milestones, s -> 'milestones');
  insert into public.task_comments overriding system value
    select * from jsonb_populate_recordset(null::public.task_comments, s -> 'comments');

  delete from public.deleted_projects where id = p_deleted_id;
  perform public.admin_log('restore', 'project', d.project_id::text, 'Restored project "' || d.name || '"');
  return d.project_id;
end;
$$;

revoke all on function public.admin_list_deleted_projects(), public.admin_restore_project(bigint) from public, anon;
grant execute on function public.admin_list_deleted_projects(), public.admin_restore_project(bigint) to authenticated;
