-- 017_superadmin.sql: one system-wide superadmin who can see everything and manage users and companies.
-- Safe to run once on top of 016. Not destructive.
--
-- AFTER RUNNING, make yourself the superadmin (SQL Editor runs as postgres, which is allowed to do this):
--   update public.profiles set is_superadmin = true where email = 'YOUR-LOGIN-EMAIL';
-- Only one superadmin can exist (unique index). The app can never grant or revoke it.

-- ================================================================ columns
alter table public.profiles
  add column is_superadmin boolean not null default false,
  add column suspended_at timestamptz,
  add column suspended_reason text;
create unique index profiles_one_superadmin on public.profiles ((true)) where is_superadmin;

alter table public.organizations
  add column suspended_at timestamptz,
  add column suspended_reason text;

-- ================================================================ helpers
create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_superadmin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_suspended()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select suspended_at is not null from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.org_is_suspended(p_org_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select suspended_at is not null from public.organizations where id = p_org_id), false);
$$;

create or replace function public.project_org_suspended(p_project_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select o.suspended_at is not null
    from public.projects p join public.organizations o on o.id = p.organization_id
    where p.id = p_project_id
  ), false);
$$;

revoke all on function public.is_superadmin(), public.is_suspended(), public.org_is_suspended(bigint), public.project_org_suspended(bigint) from public, anon;
grant execute on function public.is_superadmin(), public.is_suspended(), public.org_is_suspended(bigint), public.project_org_suspended(bigint) to authenticated;

-- ================================================================ nobody can promote or suspend through the API
create or replace function public.guard_profile_admin_columns()
returns trigger language plpgsql as $$
begin
  if (new.is_superadmin is distinct from old.is_superadmin
      or new.suspended_at is distinct from old.suspended_at
      or new.suspended_reason is distinct from old.suspended_reason)
     and current_user in ('authenticated', 'anon') then
    raise exception 'These fields can only be changed by the system';
  end if;
  return new;
end;
$$;
create trigger profiles_guard_admin_columns
  before update on public.profiles
  for each row execute function public.guard_profile_admin_columns();

-- ================================================================ audit log of superadmin actions
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid default auth.uid(),
  action text not null,
  target_type text not null,
  target_id text,
  summary text not null,
  created_at timestamptz not null default now()
);
create index on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;
create policy admin_audit_select on public.admin_audit_log for select to authenticated using (public.is_superadmin());
-- no write policies: rows are written only by the functions below

create or replace function public.admin_log(p_action text, p_type text, p_target text, p_summary text)
returns void language sql security definer set search_path = public as $$
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, summary)
  values (auth.uid(), p_action, p_type, p_target, p_summary);
$$;
revoke all on function public.admin_log(text, text, text, text) from public, anon, authenticated;

create or replace function public.require_superadmin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin only';
  end if;
end;
$$;
revoke all on function public.require_superadmin() from public, anon, authenticated;

-- ================================================================ read access to everything
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'organizations', 'organization_members', 'projects', 'project_members', 'roles',
    'tasks', 'task_dependencies', 'milestones', 'task_comments', 'attendance', 'leave_requests',
    'leave_types', 'audit_log'
  ] loop
    execute format('create policy superadmin_select on public.%I for select to authenticated using (public.is_superadmin())', t);
  end loop;
end $$;

-- the superadmin can manage companies and their memberships directly
create policy superadmin_all on public.organizations for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
create policy superadmin_all on public.organization_members for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- the superadmin may change owners (the "last owner" rule still applies)
create or replace function public.guard_org_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.organizations where id = old.organization_id) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id or new.user_id <> old.user_id then
      raise exception 'Cannot move a membership';
    end if;
    if new.org_role = old.org_role then
      return new;
    end if;
  end if;

  if (old.org_role = 'owner' or (tg_op = 'UPDATE' and new.org_role = 'owner'))
     and not public.is_org_owner(old.organization_id)
     and not public.is_superadmin() then
    raise exception 'Only a company owner can change an owner';
  end if;

  if old.org_role = 'owner'
     and (tg_op = 'DELETE' or new.org_role <> 'owner')
     and not exists (
       select 1 from public.organization_members m
       where m.organization_id = old.organization_id and m.org_role = 'owner' and m.id <> old.id
     ) then
    raise exception 'A company needs at least one owner';
  end if;

  if tg_op = 'DELETE' then
    delete from public.project_members pm
    using public.projects p
    where p.id = pm.project_id and p.organization_id = old.organization_id and pm.user_id = old.user_id;
    return old;
  end if;
  return new;
end;
$$;

-- membership changes made directly by the superadmin are logged
create or replace function public.audit_superadmin_membership()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.organization_members;
begin
  if current_user = 'authenticated' and public.is_superadmin() then
    r := case when tg_op = 'DELETE' then old else new end;
    perform public.admin_log(lower(tg_op), 'company_member', r.organization_id::text,
      tg_op || ' member ' || public.display_name(r.user_id) || ' (' || r.org_role || ') in company #' || r.organization_id);
  end if;
  return null;
end;
$$;
create trigger org_members_superadmin_audit
  after insert or update or delete on public.organization_members
  for each row execute function public.audit_superadmin_membership();

-- ================================================================ suspension is enforced in the database
-- A suspended user cannot read or write anything except their own profile.
do $$
declare t text;
begin
  foreach t in array array[
    'organizations', 'organization_members', 'projects', 'project_members', 'tasks', 'task_dependencies',
    'milestones', 'task_comments', 'attendance', 'leave_requests', 'notifications'
  ] loop
    execute format('create policy not_suspended on public.%I as restrictive for all to authenticated using (not public.is_suspended())', t);
  end loop;
end $$;

-- A suspended company is read-only (clocking out and viewing still work).
create policy company_active_ins on public.projects as restrictive for insert to authenticated
  with check (public.is_superadmin() or not public.org_is_suspended(organization_id));
create policy company_active_upd on public.projects as restrictive for update to authenticated
  using (public.is_superadmin() or not public.org_is_suspended(organization_id));
create policy company_active_del on public.projects as restrictive for delete to authenticated
  using (public.is_superadmin() or not public.org_is_suspended(organization_id));
create policy company_active_ins on public.leave_requests as restrictive for insert to authenticated
  with check (public.is_superadmin() or not public.org_is_suspended(organization_id));
create policy company_active_upd on public.leave_requests as restrictive for update to authenticated
  using (public.is_superadmin() or not public.org_is_suspended(organization_id));
create policy company_active_ins on public.tasks as restrictive for insert to authenticated
  with check (public.is_superadmin() or not public.project_org_suspended(project_id));
create policy company_active_upd on public.tasks as restrictive for update to authenticated
  using (public.is_superadmin() or not public.project_org_suspended(project_id));
create policy company_active_del on public.tasks as restrictive for delete to authenticated
  using (public.is_superadmin() or not public.project_org_suspended(project_id));

-- clock_in is a SECURITY DEFINER function, so guard attendance inserts with a trigger as well
create or replace function public.block_suspended_clock_in()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_suspended() then
    raise exception 'Your account is suspended';
  end if;
  if public.org_is_suspended(new.organization_id) then
    raise exception 'This company is suspended';
  end if;
  return new;
end;
$$;
create trigger attendance_block_suspended
  before insert on public.attendance
  for each row execute function public.block_suspended_clock_in();

-- ================================================================ superadmin functions
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_superadmin();
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'suspended_users', (select count(*) from public.profiles where suspended_at is not null),
    'new_users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'companies', (select count(*) from public.organizations),
    'suspended_companies', (select count(*) from public.organizations where suspended_at is not null),
    'projects', (select count(*) from public.projects),
    'tasks', (select count(*) from public.tasks),
    'open_tasks', (select count(*) from public.tasks where status <> 'done'),
    'clocked_in_now', (select count(*) from public.attendance where clock_out is null),
    'pending_leave', (select count(*) from public.leave_requests where status = 'pending')
  );
end;
$$;

create or replace function public.admin_list_users(p_query text default null)
returns table (
  id uuid, email text, full_name text, created_at timestamptz, last_sign_in_at timestamptz,
  suspended_at timestamptz, suspended_reason text, is_superadmin boolean, company_count bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_superadmin();
  return query
    select p.id, p.email, p.full_name, p.created_at, u.last_sign_in_at,
           p.suspended_at, p.suspended_reason, p.is_superadmin,
           (select count(*) from public.organization_members m where m.user_id = p.id)
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p_query is null or trim(p_query) = ''
       or p.email ilike '%' || trim(p_query) || '%'
       or p.full_name ilike '%' || trim(p_query) || '%'
    order by p.created_at desc
    limit 200;
end;
$$;

create or replace function public.admin_list_orgs()
returns table (
  id bigint, name text, created_at timestamptz, suspended_at timestamptz, suspended_reason text,
  owners text, member_count bigint, project_count bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_superadmin();
  return query
    select o.id, o.name, o.created_at, o.suspended_at, o.suspended_reason,
           coalesce((select string_agg(coalesce(p.full_name, p.email), ', ')
                     from public.organization_members m join public.profiles p on p.id = m.user_id
                     where m.organization_id = o.id and m.org_role = 'owner'), ''),
           (select count(*) from public.organization_members m where m.organization_id = o.id),
           (select count(*) from public.projects pr where pr.organization_id = o.id)
    from public.organizations o
    order by o.created_at desc;
end;
$$;

create or replace function public.admin_set_user_suspended(p_user_id uuid, p_suspended boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_label text;
begin
  perform public.require_superadmin();
  if p_user_id = auth.uid() then raise exception 'You cannot suspend yourself'; end if;
  v_label := public.display_name(p_user_id);
  update public.profiles
    set suspended_at = case when p_suspended then now() else null end,
        suspended_reason = case when p_suspended then nullif(trim(p_reason), '') else null end
    where id = p_user_id;
  if not found then raise exception 'User not found'; end if;
  perform public.admin_log(case when p_suspended then 'suspend' else 'reactivate' end, 'user', p_user_id::text,
    case when p_suspended then 'Suspended ' else 'Reactivated ' end || v_label ||
    case when p_suspended and nullif(trim(p_reason), '') is not null then ': ' || trim(p_reason) else '' end);
end;
$$;

create or replace function public.admin_update_user_name(p_user_id uuid, p_full_name text)
returns void language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  perform public.require_superadmin();
  v_old := public.display_name(p_user_id);
  update public.profiles set full_name = nullif(trim(p_full_name), '') where id = p_user_id;
  if not found then raise exception 'User not found'; end if;
  perform public.admin_log('update', 'user', p_user_id::text, 'Renamed ' || v_old || ' to ' || coalesce(nullif(trim(p_full_name), ''), '(empty)'));
end;
$$;

create or replace function public.admin_delete_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_label text;
begin
  perform public.require_superadmin();
  if p_user_id = auth.uid() then raise exception 'You cannot delete yourself'; end if;
  v_label := public.display_name(p_user_id);
  perform public.admin_log('delete', 'user', p_user_id::text, 'Deleted user ' || v_label);
  delete from auth.users where id = p_user_id;
end;
$$;

create or replace function public.admin_create_org(p_name text, p_owner_email text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_id bigint;
begin
  perform public.require_superadmin();
  select id into v_owner from public.profiles where lower(email) = lower(trim(p_owner_email));
  if v_owner is null then raise exception 'No registered user with that email'; end if;
  insert into public.organizations (name, created_by) values (trim(p_name), v_owner) returning id into v_id;
  perform public.admin_log('create', 'company', v_id::text, 'Created company "' || trim(p_name) || '" owned by ' || public.display_name(v_owner));
  return v_id;
end;
$$;

create or replace function public.admin_transfer_ownership(p_org_id bigint, p_new_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  perform public.require_superadmin();
  select name into v_name from public.organizations where id = p_org_id;
  if v_name is null then raise exception 'Company not found'; end if;
  if not exists (select 1 from public.profiles where id = p_new_owner) then raise exception 'User not found'; end if;
  insert into public.organization_members (organization_id, user_id, org_role)
  values (p_org_id, p_new_owner, 'owner')
  on conflict (organization_id, user_id) do update set org_role = 'owner';
  update public.organization_members set org_role = 'admin'
    where organization_id = p_org_id and org_role = 'owner' and user_id <> p_new_owner;
  perform public.admin_log('transfer', 'company', p_org_id::text, 'Transferred "' || v_name || '" to ' || public.display_name(p_new_owner));
end;
$$;

create or replace function public.admin_set_org_suspended(p_org_id bigint, p_suspended boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  perform public.require_superadmin();
  select name into v_name from public.organizations where id = p_org_id;
  if v_name is null then raise exception 'Company not found'; end if;
  update public.organizations
    set suspended_at = case when p_suspended then now() else null end,
        suspended_reason = case when p_suspended then nullif(trim(p_reason), '') else null end
    where id = p_org_id;
  perform public.admin_log(case when p_suspended then 'suspend' else 'reactivate' end, 'company', p_org_id::text,
    case when p_suspended then 'Suspended company "' else 'Reactivated company "' end || v_name || '"' ||
    case when p_suspended and nullif(trim(p_reason), '') is not null then ': ' || trim(p_reason) else '' end);
end;
$$;

create or replace function public.admin_delete_org(p_org_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  perform public.require_superadmin();
  select name into v_name from public.organizations where id = p_org_id;
  if v_name is null then raise exception 'Company not found'; end if;
  perform public.admin_log('delete', 'company', p_org_id::text, 'Deleted company "' || v_name || '" and everything in it');
  delete from public.organizations where id = p_org_id;
end;
$$;

revoke all on function
  public.admin_overview(), public.admin_list_users(text), public.admin_list_orgs(),
  public.admin_set_user_suspended(uuid, boolean, text), public.admin_update_user_name(uuid, text),
  public.admin_delete_user(uuid), public.admin_create_org(text, text),
  public.admin_transfer_ownership(bigint, uuid), public.admin_set_org_suspended(bigint, boolean, text),
  public.admin_delete_org(bigint)
from public, anon;
grant execute on function
  public.admin_overview(), public.admin_list_users(text), public.admin_list_orgs(),
  public.admin_set_user_suspended(uuid, boolean, text), public.admin_update_user_name(uuid, text),
  public.admin_delete_user(uuid), public.admin_create_org(text, text),
  public.admin_transfer_ownership(bigint, uuid), public.admin_set_org_suspended(bigint, boolean, text),
  public.admin_delete_org(bigint)
to authenticated;
-- every function above starts with require_superadmin(), so other users get "Superadmin only"
