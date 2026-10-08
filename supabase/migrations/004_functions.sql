-- 004_functions.sql: clock in / clock out RPCs using server time

create or replace function public.clock_in(p_project_id bigint)
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
  if not public.is_project_member(p_project_id) then
    raise exception 'You are not an active member of this project';
  end if;
  if exists (select 1 from public.attendance where user_id = auth.uid() and clock_out is null) then
    raise exception 'You are already clocked in. Clock out first.';
  end if;
  insert into public.attendance (project_id, user_id, clock_in)
  values (p_project_id, auth.uid(), now())
  returning * into result;
  return result;
end;
$$;

create or replace function public.clock_out(p_project_id bigint)
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
  update public.attendance
     set clock_out = now()
   where user_id = auth.uid() and project_id = p_project_id and clock_out is null
  returning * into result;
  if not found then
    raise exception 'You are not clocked in to this project';
  end if;
  return result;
end;
$$;

revoke all on function public.clock_in(bigint), public.clock_out(bigint) from public, anon;
grant execute on function public.clock_in(bigint), public.clock_out(bigint) to authenticated;
