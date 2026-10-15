-- 034_work_from_home.sql: "Work from home" as a request type next to the leave types.
-- Working from home is not time off: on an approved WFH day the person still clocks in as usual.
-- So each type now says whether it blocks clocking in (leave types do, WFH does not).
-- Run after 033.

alter table public.leave_types add column blocks_clock_in boolean not null default true;

insert into public.leave_types (name, description, is_system, blocks_clock_in)
values ('Work from home', 'Working remotely; you still clock in as usual', true, false)
on conflict (name) do nothing;

-- clock in: only leave that blocks clocking in stops you (WFH does not)
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
    and t.blocks_clock_in
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

-- notifications name the type: "Aina requested Work from home", "Your Annual leave request was approved"
create or replace function public.notify_leave()
returns trigger language plpgsql security definer set search_path = public as $$
declare admin_id uuid; type_name text;
begin
  select name into type_name from public.leave_types where id = new.leave_type_id;
  if tg_op = 'INSERT' then
    for admin_id in
      select om.user_id from public.organization_members om
      join public.organization_roles r on r.id = om.org_role_id
      where om.organization_id = new.organization_id and r.is_admin and om.user_id <> new.user_id
    loop
      insert into public.notifications (user_id, type, title, body, link)
      values (admin_id, 'leave_requested', public.display_name(new.user_id) || ' requested ' || coalesce(type_name, 'leave'),
              new.start_date::text || ' to ' || new.end_date::text, '/attendance');
    end loop;
  elsif new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, type, title, body, link)
    values (new.user_id, 'leave_decided', 'Your ' || coalesce(type_name, 'leave') || ' request was ' || new.status,
            new.start_date::text || ' to ' || new.end_date::text, '/attendance');
  end if;
  return new;
end;
$$;
