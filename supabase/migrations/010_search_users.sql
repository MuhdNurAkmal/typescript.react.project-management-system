-- 010_search_users.sql
-- Suggestions when a PM invites someone: search registered users by name or email.
-- Profiles are only readable between people who share a project, so this runs as security
-- definer, but only for PMs of the project, and it returns just id, name and email.
-- Users who are already active members of the project are left out.

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
begin
  if not public.is_project_pm(p_project_id) then
    raise exception 'Only project managers can search for users';
  end if;
  if length(q) < 2 then
    return;
  end if;

  -- escape LIKE wildcards so user input is matched literally
  pattern := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select p.id, p.full_name, p.email
  from public.profiles p
  where (p.full_name ilike pattern or p.email ilike pattern)
    and not exists (
      select 1 from public.project_members m
      where m.project_id = p_project_id and m.user_id = p.id and m.is_active
    )
  order by (lower(p.email) = lower(q)) desc, p.full_name nulls last, p.email
  limit 8;
end;
$$;

revoke all on function public.search_users(bigint, text) from public, anon;
grant execute on function public.search_users(bigint, text) to authenticated;
