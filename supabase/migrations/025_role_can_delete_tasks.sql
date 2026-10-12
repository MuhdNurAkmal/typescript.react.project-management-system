-- 025_role_can_delete_tasks.sql: deleting a card becomes a power of the role, like editing, so each project team
-- decides which roles may delete. Project managers can always delete.
-- Roles: can_edit = create/edit/move/assign cards, can_delete = delete cards. Both are switched in Admin > Roles.
-- Run after 024.

alter table public.roles add column can_delete boolean not null default false;
update public.roles set can_delete = true where is_pm;
alter table public.roles add constraint roles_pm_can_delete check (not is_pm or can_delete);
-- deleting needs the power to edit as well
alter table public.roles add constraint roles_delete_needs_edit check (not can_delete or can_edit);

create or replace function public.can_delete_tasks(p_project_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or exists (
    select 1
    from public.project_members m
    join public.roles r on r.id = m.role_id
    where m.project_id = p_project_id and m.user_id = auth.uid() and m.is_active and (r.can_delete or r.is_pm)
  );
$$;
revoke all on function public.can_delete_tasks(bigint) from public, anon;
grant execute on function public.can_delete_tasks(bigint) to authenticated;

drop policy tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.can_delete_tasks(project_id));
