-- 009_general_attendance_and_leave.sql
-- 1. Attendance is no longer tied to a project: it belongs to the user.
-- 2. Leave / absence (annual leave, MC, ...) can be declared in advance and reviewed by a PM.
--
-- Who is a "manager" of whom: a PM of any project can see and review the attendance and leave
-- of every active member of the projects they manage (is_pm_of_user). Nobody can review themselves.
-- "Today" for the leave check uses Malaysia time (Asia/Kuala_Lumpur); timestamps stay in UTC.

-- Helper: is the caller an active PM on a project that `p_user_id` is an active member of?
create or replace function public.is_pm_of_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members me
    join public.roles r on r.id = me.role_id
    join public.project_members other on other.project_id = me.project_id
    where me.user_id = auth.uid() and me.is_active and r.is_pm
      and other.user_id = p_user_id and other.is_active
  );
$$;

revoke all on function public.is_pm_of_user(uuid) from public, anon;
grant execute on function public.is_pm_of_user(uuid) to authenticated;

-- ---------------------------------------------------------------- attendance
drop policy attendance_select on public.attendance;
drop policy attendance_insert on public.attendance;
drop policy attendance_update_own on public.attendance;
drop policy attendance_update_pm on public.attendance;

alter table public.attendance drop column project_id;

create policy attendance_select on public.attendance for select to authenticated
  using (user_id = auth.uid() or public.is_pm_of_user(user_id));
create policy attendance_insert on public.attendance for insert to authenticated
  with check (user_id = auth.uid());
create policy attendance_update_own on public.attendance for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy attendance_update_pm on public.attendance for update to authenticated
  using (user_id <> auth.uid() and public.is_pm_of_user(user_id))
  with check (user_id <> auth.uid() and public.is_pm_of_user(user_id));

-- Own rows: only clock_out and note may change. Managers: status and note, plus clock_out
-- only through pm_set_clock_out (which raises a transaction-local flag).
create or replace function public.enforce_attendance_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id <> old.id or new.user_id <> old.user_id then
    raise exception 'Cannot change attendance ownership';
  end if;
  if old.user_id = auth.uid() then
    if new.clock_in <> old.clock_in or new.status <> old.status then
      raise exception 'You may only update clock_out and note on your own attendance';
    end if;
  else
    if new.clock_in <> old.clock_in then
      raise exception 'Managers cannot change the clock-in time';
    end if;
    if new.clock_out is distinct from old.clock_out
       and coalesce(current_setting('app.attendance_correction', true), '') <> 'on' then
      raise exception 'Use the correction function to change clock-out';
    end if;
  end if;
  return new;
end;
$$;

drop function public.clock_in(bigint);
drop function public.clock_out(bigint);

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
  if not public.is_pm_of_user(row_.user_id) then
    raise exception 'Only a project manager of this person can correct attendance';
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

-- ---------------------------------------------------------------- leave
create table public.leave_types (
  id bigint generated always as identity primary key,
  name text not null unique,
  description text,
  is_system boolean not null default false,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

insert into public.leave_types (name, description, is_system) values
  ('Annual leave', 'Planned time off', true),
  ('Medical leave (MC)', 'Sick leave with medical certificate', true),
  ('Emergency leave', 'Unplanned urgent leave', true),
  ('Unpaid leave', 'Leave without pay', true),
  ('Other', 'Any other absence', true);

create table public.leave_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  leave_type_id bigint not null references public.leave_types (id) on delete restrict,
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index on public.leave_requests (user_id, start_date, end_date);
create index on public.leave_requests (leave_type_id);

alter table public.leave_types enable row level security;
alter table public.leave_requests enable row level security;

create policy leave_types_select on public.leave_types for select to authenticated using (true);
create policy leave_types_insert on public.leave_types for insert to authenticated
  with check (
    created_by = auth.uid() and not is_system
    and exists (
      select 1 from public.project_members m
      join public.roles r on r.id = m.role_id
      where m.user_id = auth.uid() and m.is_active and r.is_pm
    )
  );
create policy leave_types_update on public.leave_types for update to authenticated
  using (created_by = auth.uid() and not is_system)
  with check (created_by = auth.uid() and not is_system);
create policy leave_types_delete on public.leave_types for delete to authenticated
  using (created_by = auth.uid() and not is_system);

create policy leave_select on public.leave_requests for select to authenticated
  using (user_id = auth.uid() or public.is_pm_of_user(user_id));
create policy leave_insert on public.leave_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
create policy leave_update_own on public.leave_requests for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'pending');
create policy leave_update_manager on public.leave_requests for update to authenticated
  using (user_id <> auth.uid() and public.is_pm_of_user(user_id))
  with check (user_id <> auth.uid() and public.is_pm_of_user(user_id));
create policy leave_delete_own on public.leave_requests for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');

-- Managers may only decide (status + note); the decision is stamped server-side.
create or replace function public.enforce_leave_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id <> old.id or new.user_id <> old.user_id or new.created_at <> old.created_at then
    raise exception 'Cannot change leave ownership';
  end if;
  if old.user_id = auth.uid() then
    new.review_note := old.review_note;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
  else
    if (new.leave_type_id, new.start_date, new.end_date, new.reason)
       is distinct from (old.leave_type_id, old.start_date, old.end_date, old.reason) then
      raise exception 'Managers can only approve or reject a leave request';
    end if;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger leave_columns
  before update on public.leave_requests
  for each row execute function public.enforce_leave_columns();

-- ---------------------------------------------------------------- clock in / out
create or replace function public.clock_in()
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
  if exists (select 1 from public.attendance where user_id = auth.uid() and clock_out is null) then
    raise exception 'You are already clocked in. Clock out first.';
  end if;
  select t.name into leave_name
  from public.leave_requests l
  join public.leave_types t on t.id = l.leave_type_id
  where l.user_id = auth.uid() and l.status = 'approved' and today between l.start_date and l.end_date
  limit 1;
  if leave_name is not null then
    raise exception 'You are on approved leave today (%). Ask your manager if this is wrong.', leave_name;
  end if;
  insert into public.attendance (user_id, clock_in) values (auth.uid(), now())
  returning * into result;
  return result;
end;
$$;

create or replace function public.clock_out()
returns public.attendance
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.attendance;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update public.attendance set clock_out = now()
  where user_id = auth.uid() and clock_out is null
  returning * into result;
  if not found then
    raise exception 'You are not clocked in';
  end if;
  return result;
end;
$$;

revoke all on function public.clock_in(), public.clock_out() from public, anon;
grant execute on function public.clock_in(), public.clock_out() to authenticated;
