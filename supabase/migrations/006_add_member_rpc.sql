-- 006_add_member_rpc.sql
-- PMs add registered users by email. Profiles are only readable between people who already
-- share a project, so the lookup runs in a security definer function that checks PM rights itself.

create or replace function public.add_project_member(
  p_project_id uuid,
  p_email text,
  p_role_id uuid
)
returns public.project_members
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  result public.project_members;
begin
  if not public.is_project_pm(p_project_id) then
    raise exception 'Only project managers can add members';
  end if;

  select id into target_id from public.profiles where lower(email) = lower(trim(p_email));
  if target_id is null then
    raise exception 'No registered user with email %', p_email;
  end if;

  -- Re-activate a previously deactivated member instead of failing on the unique constraint
  insert into public.project_members (project_id, user_id, role_id)
  values (p_project_id, target_id, p_role_id)
  on conflict (project_id, user_id)
  do update set is_active = true, role_id = excluded.role_id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.add_project_member(uuid, text, uuid) from public, anon;
grant execute on function public.add_project_member(uuid, text, uuid) to authenticated;
