-- 024_trello_style_tasks.sql: tasks work like Trello cards.
-- Any project member whose role is allowed to edit can create cards, edit them, move them and assign anyone.
-- Roles get a can_edit flag (everything except the read-only Viewer by default). Deleting a card stays with
-- project managers and the person who created it. Milestones stay with project managers.
-- Run after 023.

alter table public.roles add column can_edit boolean not null default true;
update public.roles set can_edit = false where lower(name) like '%viewer%' and not is_pm;
alter table public.roles add constraint roles_pm_can_edit check (not is_pm or can_edit);

-- Roles the user may edit with: the superadmin, or an active member whose role can edit
create or replace function public.can_edit_project(p_project_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or exists (
    select 1
    from public.project_members m
    join public.roles r on r.id = m.role_id
    where m.project_id = p_project_id and m.user_id = auth.uid() and m.is_active and (r.can_edit or r.is_pm)
  );
$$;
revoke all on function public.can_edit_project(bigint) from public, anon;
grant execute on function public.can_edit_project(bigint) to authenticated;

-- ================================================================ tasks
drop policy tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.can_edit_project(project_id));

drop policy tasks_update_pm on public.tasks;
drop policy tasks_update_assignee on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));

drop policy tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_project_pm(project_id) or (created_by = auth.uid() and public.can_edit_project(project_id)));

-- editors may change everything about a card except where it lives and who made it
create or replace function public.enforce_task_assignee_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.id, new.project_id, new.created_by, new.created_at)
     is distinct from (old.id, old.project_id, old.created_by, old.created_at) then
    raise exception 'A task cannot be moved to another project or change its creator';
  end if;
  return new;
end;
$$;

-- ================================================================ dependencies and assignees
drop policy deps_insert on public.task_dependencies;
drop policy deps_delete on public.task_dependencies;
create policy deps_insert on public.task_dependencies for insert to authenticated
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.can_edit_project(t.project_id)));
create policy deps_delete on public.task_dependencies for delete to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and public.can_edit_project(t.project_id)));

drop policy task_assignees_insert on public.task_assignees;
drop policy task_assignees_delete on public.task_assignees;
create policy task_assignees_insert on public.task_assignees for insert to authenticated
  with check (exists (
    select 1 from public.tasks t
    join public.project_members m on m.project_id = t.project_id and m.user_id = task_assignees.user_id and m.is_active
    where t.id = task_id and public.can_edit_project(t.project_id)
  ));
create policy task_assignees_delete on public.task_assignees for delete to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and public.can_edit_project(t.project_id)));

create or replace function public.set_task_assignees(p_task_id bigint, p_user_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_project bigint; u uuid;
begin
  select project_id into v_project from public.tasks where id = p_task_id;
  if v_project is null then raise exception 'Task not found'; end if;
  if not public.can_edit_project(v_project) then raise exception 'You can only look at this project'; end if;

  foreach u in array coalesce(p_user_ids, '{}') loop
    if not exists (select 1 from public.project_members where project_id = v_project and user_id = u and is_active) then
      raise exception 'Everyone assigned must be an active member of the project';
    end if;
  end loop;

  delete from public.task_assignees where task_id = p_task_id and not (user_id = any (coalesce(p_user_ids, '{}')));
  insert into public.task_assignees (task_id, user_id)
    select p_task_id, x from (select distinct unnest(coalesce(p_user_ids, '{}')) as x) people
    on conflict do nothing;
end;
$$;
