-- 013_organizations.sql
-- Adds a company (organization) layer:
--     company -> many projects -> many project members
-- Attendance and leave belong to the company. Company owners/admins review them.
-- Everyone in a project must first be a member of the project's company.
--
-- DESTRUCTIVE: existing projects (with their members, tasks, milestones, comments),
-- attendance, leave requests, notifications and the activity log are deleted, because
-- they have no company to belong to. Accounts (profiles), roles and leave types are kept.

truncate table public.projects, public.attendance, public.leave_requests,
  public.notifications, public.audit_log restart identity cascade;

-- ================================================================ tables
create table public.organizations (
  id bigint generated always as identity primary key,
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  org_role text not null default 'member' check (org_role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index on public.organization_members (user_id);
create index on public.organization_members (organization_id);
create index on public.organizations (created_by);

alter table public.projects
  add column organization_id bigint not null references public.organizations (id) on delete cascade;
create index on public.projects (organization_id);

alter table public.attendance
  add column organization_id bigint not null references public.organizations (id) on delete cascade;
create index on public.attendance (organization_id, clock_in);

alter table public.leave_requests
  add column organization_id bigint not null references public.organizations (id) on delete cascade;
create index on public.leave_requests (organization_id);

-- ================================================================ helpers
create or replace function public.is_org_member(p_org_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(p_org_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = auth.uid() and org_role in ('owner', 'admin')
  );
$$;

create or replace function public.is_org_owner(p_org_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = auth.uid() and org_role = 'owner'
  );
$$;

revoke all on function public.is_org_member(bigint), public.is_org_admin(bigint), public.is_org_owner(bigint) from public, anon;
grant execute on function public.is_org_member(bigint), public.is_org_admin(bigint), public.is_org_owner(bigint) to authenticated;

-- People who share a project OR a company can read each other's profile
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
  ) or exists (
    select 1
    from public.organization_members me
    join public.organization_members other on other.organization_id = me.organization_id
    where me.user_id = auth.uid() and other.user_id = p_user_id
  );
$$;

-- ================================================================ organizations: RLS and triggers
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy orgs_select on public.organizations for select to authenticated
  using (public.is_org_member(id) or created_by = auth.uid());
create policy orgs_insert on public.organizations for insert to authenticated
  with check (created_by = auth.uid());
create policy orgs_update on public.organizations for update to authenticated
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));
create policy orgs_delete on public.organizations for delete to authenticated
  using (public.is_org_owner(id));

create policy org_members_select on public.organization_members for select to authenticated
  using (public.is_org_member(organization_id));
create policy org_members_insert on public.organization_members for insert to authenticated
  with check (public.is_org_admin(organization_id) and org_role in ('admin', 'member'));
create policy org_members_update on public.organization_members for update to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy org_members_delete on public.organization_members for delete to authenticated
  using (public.is_org_admin(organization_id));

-- The creator of a company becomes its owner
create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_members (organization_id, user_id, org_role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

-- Only owners may change or remove owners; the last owner cannot go; leaving a company
-- removes the person from that company's projects (their tasks become unassigned).
create or replace function public.guard_org_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.organizations where id = old.organization_id) then
    -- the whole company is being deleted
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
     and not public.is_org_owner(old.organization_id) then
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

create trigger org_members_guard
  before update or delete on public.organization_members
  for each row execute function public.guard_org_member_change();

-- Project members must belong to the project's company
create or replace function public.require_company_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = new.project_id and om.user_id = new.user_id
  ) then
    raise exception 'That person must be a member of the company first';
  end if;
  return new;
end;
$$;

create trigger project_members_require_company
  before insert on public.project_members
  for each row execute function public.require_company_member();

-- Projects: only company members can create one inside their company
drop policy projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated
  with check (created_by = auth.uid() and public.is_org_member(organization_id));

-- ================================================================ user search / add
create or replace function public.search_users(p_project_id bigint, p_query text)
returns table (id uuid, full_name text, email text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := trim(p_query);
  pattern text;
  org_id bigint;
begin
  if not public.is_project_pm(p_project_id) then
    raise exception 'Only project managers can search for users';
  end if;
  if length(q) < 2 then
    return;
  end if;
  select organization_id into org_id from public.projects where projects.id = p_project_id;
  pattern := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  -- only people already in the project's company, and not already in the project
  return query
  select p.id, p.full_name, p.email
  from public.profiles p
  join public.organization_members om on om.user_id = p.id and om.organization_id = org_id
  where (p.full_name ilike pattern or p.email ilike pattern)
    and not exists (
      select 1 from public.project_members m
      where m.project_id = p_project_id and m.user_id = p.id and m.is_active
    )
  order by (lower(p.email) = lower(q)) desc, p.full_name nulls last, p.email
  limit 8;
end;
$$;

-- Company admins look for registered people to bring into the company
create or replace function public.search_org_users(p_organization_id bigint, p_query text)
returns table (id uuid, full_name text, email text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := trim(p_query);
  pattern text;
begin
  if not public.is_org_admin(p_organization_id) then
    raise exception 'Only company admins can search for users';
  end if;
  if length(q) < 2 then
    return;
  end if;
  pattern := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select p.id, p.full_name, p.email
  from public.profiles p
  where (p.full_name ilike pattern or p.email ilike pattern)
    and not exists (
      select 1 from public.organization_members om
      where om.organization_id = p_organization_id and om.user_id = p.id
    )
  order by (lower(p.email) = lower(q)) desc, p.full_name nulls last, p.email
  limit 8;
end;
$$;

create or replace function public.add_org_member(p_organization_id bigint, p_email text, p_org_role text default 'member')
returns public.organization_members
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  result public.organization_members;
begin
  if not public.is_org_admin(p_organization_id) then
    raise exception 'Only company admins can add members';
  end if;
  if p_org_role not in ('admin', 'member') then
    raise exception 'Role must be admin or member';
  end if;
  select id into target_id from public.profiles where lower(email) = lower(trim(p_email));
  if target_id is null then
    raise exception 'No registered user with email %', p_email;
  end if;
  insert into public.organization_members (organization_id, user_id, org_role)
  values (p_organization_id, target_id, p_org_role)
  on conflict (organization_id, user_id) do nothing
  returning * into result;
  if result.id is null then
    raise exception 'That person is already in the company';
  end if;
  return result;
end;
$$;

revoke all on function public.search_users(bigint, text), public.search_org_users(bigint, text),
  public.add_org_member(bigint, text, text) from public, anon;
grant execute on function public.search_users(bigint, text), public.search_org_users(bigint, text),
  public.add_org_member(bigint, text, text) to authenticated;

-- ================================================================ attendance
drop policy attendance_select on public.attendance;
drop policy attendance_insert on public.attendance;
drop policy attendance_update_pm on public.attendance;

create policy attendance_select on public.attendance for select to authenticated
  using (user_id = auth.uid() or public.is_org_admin(organization_id));
create policy attendance_insert on public.attendance for insert to authenticated
  with check (user_id = auth.uid() and public.is_org_member(organization_id));
create policy attendance_update_admin on public.attendance for update to authenticated
  using (user_id <> auth.uid() and public.is_org_admin(organization_id))
  with check (user_id <> auth.uid() and public.is_org_admin(organization_id));

create or replace function public.enforce_attendance_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id <> old.id or new.user_id <> old.user_id or new.organization_id <> old.organization_id then
    raise exception 'Cannot change attendance ownership';
  end if;
  if old.user_id = auth.uid() then
    if new.clock_in <> old.clock_in or new.status <> old.status then
      raise exception 'You may only update clock_out and note on your own attendance';
    end if;
  else
    if new.clock_in <> old.clock_in then
      raise exception 'Admins cannot change the clock-in time';
    end if;
    if new.clock_out is distinct from old.clock_out
       and coalesce(current_setting('app.attendance_correction', true), '') <> 'on' then
      raise exception 'Use the correction function to change clock-out';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.pm_set_clock_out(p_attendance_id bigint, p_clock_out timestamptz)
returns public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  row_ public.attendance;
begin
  select * into row_ from public.attendance where id = p_attendance_id;
  if not found then
    raise exception 'Attendance record not found';
  end if;
  if row_.user_id = auth.uid() then
    raise exception 'You cannot correct your own attendance';
  end if;
  if not public.is_org_admin(row_.organization_id) then
    raise exception 'Only a company admin can correct attendance';
  end if;
  if p_clock_out < row_.clock_in then
    raise exception 'Clock-out cannot be before clock-in';
  end if;
  if p_clock_out > now() then
    raise exception 'Clock-out cannot be in the future';
  end if;

  perform set_config('app.attendance_correction', 'on', true);
  update public.attendance set clock_out = p_clock_out where id = p_attendance_id
  returning * into row_;
  perform set_config('app.attendance_correction', 'off', true);
  return row_;
end;
$$;

drop function public.clock_in();

create or replace function public.clock_in(p_organization_id bigint)
returns public.attendance
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.attendance;
  today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  leave_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_org_member(p_organization_id) then
    raise exception 'You are not a member of this company';
  end if;
  if exists (select 1 from public.attendance where user_id = auth.uid() and clock_out is null) then
    raise exception 'You are already clocked in. Clock out first.';
  end if;
  select t.name into leave_name
  from public.leave_requests l
  join public.leave_types t on t.id = l.leave_type_id
  where l.user_id = auth.uid() and l.organization_id = p_organization_id
    and l.status = 'approved' and today between l.start_date and l.end_date
  limit 1;
  if leave_name is not null then
    raise exception 'You are on approved leave today (%). Ask your company admin if this is wrong.', leave_name;
  end if;
  insert into public.attendance (user_id, organization_id, clock_in)
  values (auth.uid(), p_organization_id, now())
  returning * into result;
  return result;
end;
$$;

revoke all on function public.clock_in(bigint) from public, anon;
grant execute on function public.clock_in(bigint) to authenticated;

-- ================================================================ leave
drop policy leave_select on public.leave_requests;
drop policy leave_insert on public.leave_requests;
drop policy leave_update_manager on public.leave_requests;
drop policy leave_types_insert on public.leave_types;

create policy leave_select on public.leave_requests for select to authenticated
  using (user_id = auth.uid() or public.is_org_admin(organization_id));
create policy leave_insert on public.leave_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and public.is_org_member(organization_id));
create policy leave_update_manager on public.leave_requests for update to authenticated
  using (user_id <> auth.uid() and public.is_org_admin(organization_id))
  with check (user_id <> auth.uid() and public.is_org_admin(organization_id));

-- any company admin may add a custom leave type
create policy leave_types_insert on public.leave_types for insert to authenticated
  with check (
    created_by = auth.uid() and not is_system
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid() and om.org_role in ('owner', 'admin')
    )
  );

create or replace function public.enforce_leave_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id <> old.id or new.user_id <> old.user_id or new.created_at <> old.created_at
     or new.organization_id <> old.organization_id then
    raise exception 'Cannot change leave ownership';
  end if;
  if old.user_id = auth.uid() then
    new.review_note := old.review_note;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
  else
    if (new.leave_type_id, new.start_date, new.end_date, new.reason)
       is distinct from (old.leave_type_id, old.start_date, old.end_date, old.reason) then
      raise exception 'Admins can only approve or reject a leave request';
    end if;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.notify_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid;
begin
  if tg_op = 'INSERT' then
    for admin_id in
      select om.user_id from public.organization_members om
      where om.organization_id = new.organization_id and om.org_role in ('owner', 'admin') and om.user_id <> new.user_id
    loop
      insert into public.notifications (user_id, type, title, body, link)
      values (admin_id, 'leave_requested', public.display_name(new.user_id) || ' requested leave',
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

drop function public.is_pm_of_user(uuid);
