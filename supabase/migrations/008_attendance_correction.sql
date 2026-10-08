-- 008_attendance_correction.sql
-- Lets a PM fix a member's clock-out time (e.g. they forgot to clock out).
-- The column-guard trigger normally forbids PMs from touching clock times, so the RPC
-- raises a transaction-local flag that the trigger honours. Only this function sets it.

create or replace function public.enforce_attendance_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id <> old.id or new.project_id <> old.project_id or new.user_id <> old.user_id then
    raise exception 'Cannot change attendance ownership';
  end if;
  if public.is_project_pm(old.project_id) and old.user_id <> auth.uid() then
    if new.clock_in <> old.clock_in then
      raise exception 'PMs cannot change the clock-in time';
    end if;
    if new.clock_out is distinct from old.clock_out
       and coalesce(current_setting('app.attendance_correction', true), '') <> 'on' then
      raise exception 'Use the correction function to change clock-out';
    end if;
  else
    if new.clock_in <> old.clock_in or new.status <> old.status then
      raise exception 'You may only update clock_out and note on your own attendance';
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
  if not public.is_project_pm(row_.project_id) then
    raise exception 'Only project managers can correct attendance';
  end if;
  if row_.user_id = auth.uid() then
    raise exception 'You cannot correct your own attendance';
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

revoke all on function public.pm_set_clock_out(bigint, timestamptz) from public, anon;
grant execute on function public.pm_set_clock_out(bigint, timestamptz) to authenticated;
