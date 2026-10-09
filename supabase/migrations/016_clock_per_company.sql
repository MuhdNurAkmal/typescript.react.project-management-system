-- 016_clock_per_company.sql
-- A person can be clocked in to several companies at the same time:
-- at most ONE open session per person PER COMPANY (before it was one in total).
-- clock_out now takes the company, because there may be more than one open session.

drop index if exists public.attendance_one_open_session;
create unique index attendance_one_open_session
  on public.attendance (user_id, organization_id)
  where clock_out is null;

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

drop function if exists public.clock_out();

create or replace function public.clock_out(p_organization_id bigint)
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
  where user_id = auth.uid() and organization_id = p_organization_id and clock_out is null
  returning * into result;
  if not found then
    raise exception 'You are not clocked in to this company';
  end if;
  return result;
end;
$$;

revoke all on function public.clock_in(bigint), public.clock_out(bigint) from public, anon;
grant execute on function public.clock_in(bigint), public.clock_out(bigint) to authenticated;
