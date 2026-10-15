-- 033_auto_clock_out.sql: a session still open after midnight is closed automatically at the cut-off.
-- Cut-off: 23:59 Malaysia time (Asia/Kuala_Lumpur) of the day the session started. The record is marked
-- auto_closed so a company admin can see it needs checking, and they can still correct the end time
-- (a correction clears the mark). Run after 031.
--
-- Who closes the sessions:
--   * clock_in() closes any stale session first, so a forgotten clock-out never blocks clocking in again
--   * close_stale_sessions() is also called when someone opens the app
--   * if the pg_cron extension is enabled (Database > Extensions in Supabase), it runs every day at 00:05 Malaysia
--     time as well, so records are closed even when nobody opens the app

alter table public.attendance add column auto_closed boolean not null default false;

create or replace function public.close_stale_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  -- the guard trigger only lets a clock-out change through during a correction
  perform set_config('app.attendance_correction', 'on', true);
  with closed as (
    update public.attendance a
    set clock_out = greatest(
          a.clock_in,
          ((timezone('Asia/Kuala_Lumpur', a.clock_in))::date + time '23:59') at time zone 'Asia/Kuala_Lumpur'),
        auto_closed = true
    where a.clock_out is null
      and (timezone('Asia/Kuala_Lumpur', a.clock_in))::date < (timezone('Asia/Kuala_Lumpur', now()))::date
    returning a.user_id
  )
  select count(*) filter (where user_id = auth.uid()) into n from closed;
  perform set_config('app.attendance_correction', 'off', true);
  return coalesce(n, 0);
end;
$$;
revoke all on function public.close_stale_sessions() from public, anon;
grant execute on function public.close_stale_sessions() to authenticated;

-- clock in: first close any session left open from an earlier day
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
  perform public.close_stale_sessions();
  if exists (
    select 1 from public.attendance
    where user_id = auth.uid() and organization_id = p_organization_id and clock_out is null
  ) then
    raise exception 'You are already clocked in to this company. Clock out first.';
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

-- an admin's correction means the time has been checked: clear the automatic mark
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
  update public.attendance set clock_out = p_clock_out, auto_closed = false where id = p_attendance_id
  returning * into row_;
  perform set_config('app.attendance_correction', 'off', true);
  return row_;
end;
$$;
revoke all on function public.pm_set_clock_out(bigint, timestamptz) from public, anon;
grant execute on function public.pm_set_clock_out(bigint, timestamptz) to authenticated;

-- close what is already stale right now
select public.close_stale_sessions();

-- optional daily run at 00:05 Malaysia time (16:05 UTC) when pg_cron is available
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('close-stale-attendance', '5 16 * * *', 'select public.close_stale_sessions()');
  end if;
exception when others then
  raise notice 'pg_cron could not be scheduled (%). The app still closes stale sessions when anyone opens it or clocks in.', sqlerrm;
end;
$$;
