-- 031_project_teams.sql: teams inside a project ("Design", "Field work") to assign several people to a task at once.
-- A team is only a named list of the project's members. Assigning a team just adds its members to the task
-- one by one (done in the app), so tasks keep ordinary assignees.
-- Project managers create and edit teams; every project member can see them. Run after 030.

create table public.project_teams (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index project_teams_name_key on public.project_teams (project_id, lower(btrim(name)));

create table public.project_team_members (
  team_id bigint not null references public.project_teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (team_id, user_id)
);
create index on public.project_team_members (user_id);

-- only people who are active members of the team's project can be put in the team
create or replace function public.check_team_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.project_teams t
    join public.project_members m on m.project_id = t.project_id and m.user_id = new.user_id and m.is_active
    where t.id = new.team_id
  ) then
    raise exception 'Only active members of the project can join its teams';
  end if;
  return new;
end;
$$;
create trigger project_team_members_check
  before insert on public.project_team_members
  for each row execute function public.check_team_member();

-- someone removed from the project leaves its teams too
create or replace function public.leave_teams_on_removal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.project_team_members
  where user_id = old.user_id and team_id in (select id from public.project_teams where project_id = old.project_id);
  return null;
end;
$$;
create trigger project_members_leave_teams
  after delete on public.project_members
  for each row execute function public.leave_teams_on_removal();

-- ================================================================ security
alter table public.project_teams enable row level security;
alter table public.project_team_members enable row level security;

create policy teams_select on public.project_teams for select to authenticated
  using (public.is_project_member(project_id));
create policy teams_insert on public.project_teams for insert to authenticated
  with check (public.is_project_pm(project_id));
create policy teams_update on public.project_teams for update to authenticated
  using (public.is_project_pm(project_id)) with check (public.is_project_pm(project_id));
create policy teams_delete on public.project_teams for delete to authenticated
  using (public.is_project_pm(project_id));

create policy team_members_select on public.project_team_members for select to authenticated
  using (exists (select 1 from public.project_teams t where t.id = team_id and public.is_project_member(t.project_id)));
create policy team_members_insert on public.project_team_members for insert to authenticated
  with check (exists (select 1 from public.project_teams t where t.id = team_id and public.is_project_pm(t.project_id)));
create policy team_members_delete on public.project_team_members for delete to authenticated
  using (exists (select 1 from public.project_teams t where t.id = team_id and public.is_project_pm(t.project_id)));

create policy superadmin_select on public.project_teams for select to authenticated using (public.is_superadmin());
create policy superadmin_select on public.project_team_members for select to authenticated using (public.is_superadmin());

create policy not_suspended on public.project_teams as restrictive for all to authenticated using (not public.is_suspended());
create policy not_suspended on public.project_team_members as restrictive for all to authenticated using (not public.is_suspended());

create policy company_active_ins on public.project_teams as restrictive for insert to authenticated
  with check (public.is_superadmin() or not public.project_org_suspended(project_id));
create policy company_active_upd on public.project_teams as restrictive for update to authenticated
  using (public.is_superadmin() or not public.project_org_suspended(project_id));
create policy company_active_del on public.project_teams as restrictive for delete to authenticated
  using (public.is_superadmin() or not public.project_org_suspended(project_id));
create policy company_active_ins on public.project_team_members as restrictive for insert to authenticated
  with check (public.is_superadmin() or not exists (
    select 1 from public.project_teams t where t.id = team_id and public.project_org_suspended(t.project_id)));
create policy company_active_del on public.project_team_members as restrictive for delete to authenticated
  using (public.is_superadmin() or not exists (
    select 1 from public.project_teams t where t.id = team_id and public.project_org_suspended(t.project_id)));
