-- 000_reset.sql: DESTRUCTIVE. Drops every table and function this project created in the
-- public schema so 001-006 can be re-run with bigint ids. Auth users are NOT touched.
-- Run this ONLY while the project holds test data. Then run 001 -> 006, then 007.

drop table if exists public.task_dependencies, public.attendance, public.milestones,
  public.tasks, public.project_members, public.roles, public.projects, public.profiles cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.handle_user_email_change() cascade;
drop function if exists public.handle_new_project() cascade;
drop function if exists public.enforce_task_assignee_columns() cascade;
drop function if exists public.enforce_attendance_columns() cascade;
drop function if exists public.is_project_member(uuid) cascade;
drop function if exists public.is_project_member(bigint) cascade;
drop function if exists public.is_project_pm(uuid) cascade;
drop function if exists public.is_project_pm(bigint) cascade;
drop function if exists public.shares_project_with(uuid) cascade;
drop function if exists public.clock_in(uuid) cascade;
drop function if exists public.clock_in(bigint) cascade;
drop function if exists public.clock_out(uuid) cascade;
drop function if exists public.clock_out(bigint) cascade;
drop function if exists public.add_project_member(uuid, text, uuid) cascade;
drop function if exists public.add_project_member(bigint, text, bigint) cascade;

-- the auth.users triggers are removed by the function drops above (cascade)
