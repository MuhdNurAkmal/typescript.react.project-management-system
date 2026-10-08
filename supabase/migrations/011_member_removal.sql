-- 011_member_removal.sql
-- When a member is removed from a project:
--   * every task in that project assigned to them becomes unassigned (assignee_id = null)
--   * the last project manager cannot be removed (the project would have nobody in charge)
-- Deleting a whole project cascades to its members; the guard is skipped then, because
-- the project row is already gone by the time the member rows are deleted.

create or replace function public.handle_member_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.projects where id = old.project_id) then
    if old.is_active
       and exists (select 1 from public.roles r where r.id = old.role_id and r.is_pm)
       and not exists (
         select 1
         from public.project_members m
         join public.roles r on r.id = m.role_id
         where m.project_id = old.project_id and m.id <> old.id and m.is_active and r.is_pm
       ) then
      raise exception 'You cannot remove the last project manager';
    end if;

    update public.tasks
       set assignee_id = null
     where project_id = old.project_id and assignee_id = old.user_id;
  end if;
  return old;
end;
$$;

create trigger on_member_removed
  before delete on public.project_members
  for each row execute function public.handle_member_removed();
