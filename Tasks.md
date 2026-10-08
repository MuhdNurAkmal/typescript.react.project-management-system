# Project Management System: Build Tasks

A project management system for lecturers running grant or industrial projects. A Project Manager (PM) creates projects, adds team members (developers, interns, others), assigns job scope, views a Gantt timeline, and tracks attendance via clock in/out.

**Stack:** React + Vite + TypeScript, Tailwind + shadcn/ui, Supabase (Postgres, Auth, RLS), Netlify.

## How Claude Code should use this file

- Work through phases **in order**. Do not skip ahead.
- Tasks marked **[HUMAN]** must be done by the user. Stop, tell the user what to do, and wait for confirmation.
- Tasks marked **[CLAUDE]** are for Claude Code to do.
- After finishing a task, change `[ ]` to `[x]` in this file.
- Commit to git after each phase with a clear message.
- Never put the Supabase `service_role` key in frontend code or commit it. Only the `anon` key goes in the frontend.
- Store all timestamps in UTC (`timestamptz`). Display in the user's local time (Malaysia is UTC+8).

---

## Phase 0: Accounts and setup

- [x] **[HUMAN]** Create a free account at supabase.com and create a new project (name e.g. `pms`, choose the region closest to Malaysia such as Singapore, and save the database password somewhere safe).
- [ ] **[HUMAN]** In Supabase: Project Settings > API. Copy the **Project URL** and the **anon (public) key**.
- [ ] **[HUMAN]** Create a free account at netlify.com and a GitHub repo for this project (empty is fine).
- [x] **[HUMAN]** Confirm Node.js 20+ and git are installed locally.
- [x] **[CLAUDE]** Scaffold the app: `npm create vite@latest` with React + TypeScript. Install `@supabase/supabase-js`, `react-router-dom`, `tailwindcss`, `@tanstack/react-query`, and `date-fns`. Set up shadcn/ui.
- [x] **[CLAUDE]** Create `.env.example` containing `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=`. Make sure `.env` and `.env.local` are in `.gitignore`.
- [ ] **[HUMAN]** Copy `.env.example` to `.env.local` and fill in the real URL and anon key.
- [x] **[CLAUDE]** Create `src/lib/supabase.ts` exporting a configured Supabase client.
- [x] **[CLAUDE]** Set up folder structure: `src/pages`, `src/components`, `src/hooks`, `src/lib`, `supabase/migrations`.

## Phase 1: Database schema and security

Create SQL files in `supabase/migrations/`. The user can run them via the Supabase SQL Editor (paste and run, in order) or the Supabase CLI.

- [x] **[CLAUDE]** `001_schema.sql`: create tables
  - `profiles` (id references auth.users, full_name, email, avatar_url, created_at)
  - `projects` (id, name, description, type ['grant','industrial'], sponsor, start_date, end_date, budget, status ['planning','active','on_hold','completed'], created_by, created_at)
  - `project_members` (id, project_id, user_id, role ['pm','developer','intern','tester','designer','viewer'], is_active, joined_at, unique(project_id, user_id))
  - `tasks` (id, project_id, title, description, assignee_id, start_date, due_date, status ['todo','in_progress','review','done'], priority ['low','medium','high'], progress 0-100, parent_task_id, created_by, created_at)
  - `task_dependencies` (task_id, depends_on_task_id)
  - `attendance` (id, project_id, user_id, clock_in default now(), clock_out, note, status ['pending','approved','rejected'])
  - `milestones` (id, project_id, title, due_date, completed)
  - Add useful indexes on foreign keys and on `attendance(user_id, clock_out)`.
- [x] **[CLAUDE]** `002_triggers.sql`:
  - Trigger to auto-create a `profiles` row when a new `auth.users` row is created.
  - Trigger so the creator of a project is automatically added to `project_members` as `pm`.
  - Unique partial index so a user can have only one open attendance row (`clock_out is null`) at a time.
- [x] **[CLAUDE]** `003_rls.sql`: enable Row Level Security on every table and add policies using helper functions `is_project_member(project_id)` and `is_project_pm(project_id)` (both `security definer`, with a fixed `search_path`):
  - `profiles`: users can read profiles of people who share a project with them; update only their own.
  - `projects`: members can select; any authenticated user can insert; only PMs can update/delete.
  - `project_members`: members can select; only PMs can insert/update/delete.
  - `tasks`: members can select; PMs can insert/update/delete; assignees can update only the `status` and `progress` of their own tasks.
  - `attendance`: users can insert and update (clock out) only their own rows within projects they belong to; members can select their own rows; PMs can select all rows in their projects and update `status`.
  - `milestones`: members select; PMs write.
- [x] **[CLAUDE]** `004_functions.sql`: RPC functions `clock_in(project_id)` and `clock_out(project_id)` that use server time (`now()`) and enforce the single-open-session rule.
- [x] **[HUMAN]** Run the migration files in order in the Supabase SQL Editor and confirm there are no errors.
- [x] **[CLAUDE]** Generate TypeScript types from the schema (`supabase gen types typescript`, or hand-write `src/types/database.ts` if the CLI is not set up).
- [x] **[CLAUDE]** Write `supabase/tests/rls_checklist.md` listing manual RLS test cases (e.g. a developer in project A cannot read project B; an intern cannot edit tasks they don't own; a user cannot clock in for someone else).

## Phase 2: Authentication and app shell

- [ ] **[HUMAN]** In Supabase: Authentication > Providers, make sure Email is enabled. For development, optionally turn off "Confirm email" to speed up testing (turn it back on before going live).
- [x] **[CLAUDE]** Build `AuthProvider` context and `useAuth` hook (session, user, signIn, signUp, signOut).
- [x] **[CLAUDE]** Pages: Login, Register, Forgot Password. Add a `ProtectedRoute` wrapper.
- [x] **[CLAUDE]** App layout: sidebar (Dashboard, Projects, My Tasks, Attendance, Profile) and top bar with the user menu.
- [x] **[CLAUDE]** Profile page to edit the user's full name.

## Phase 3: Projects and members

- [x] **[CLAUDE]** Projects list page showing only projects the user belongs to, with status badges and role badges.
- [x] **[CLAUDE]** "Create Project" form (name, description, type, sponsor, start/end date, budget) with validation.
- [x] **[CLAUDE]** Project detail page with tabs: Overview, Members, Tasks, Gantt, Attendance.
- [x] **[CLAUDE]** Members tab: list members with roles. PM can add a member by email (the user must already be registered), change roles, and deactivate members. Non-PMs see a read-only list.
- [x] **[CLAUDE]** Create a `usePermissions(projectId)` hook returning the current user's project role and booleans such as `canManageProject`. Use it to hide UI the user can't use. The database remains the real enforcement.
- [x] **[CLAUDE]** PM can edit project details and change status.

## Phase 4: Tasks (job scope)

- [x] **[CLAUDE]** Tasks tab: table view with filters (assignee, status, priority) and search.
- [x] **[CLAUDE]** "Create/Edit Task" dialog (PM only): title, description, assignee (project members only), start date, due date, priority, parent task, dependencies.
- [x] **[CLAUDE]** Assignees can update the status and progress of their own tasks.
- [x] **[CLAUDE]** "My Tasks" page: all tasks assigned to the current user across projects, grouped by due date, with overdue highlighted.
- [x] **[CLAUDE]** Validation: due date must not be before start date; a task must not depend on itself or create circular dependencies.

## Phase 5: Gantt chart

- [x] **[CLAUDE]** Install `frappe-gantt` (or `gantt-task-react`, whichever integrates more cleanly with React 18+) and render the project's tasks.
- [x] **[CLAUDE]** Map task fields to Gantt bars: name, start, end, progress, dependencies. Colour by status.
- [x] **[CLAUDE]** View modes: Day, Week, Month.
- [x] **[CLAUDE]** PM only: drag/resize bars to reschedule and save changes to the database. Everyone else gets a read-only chart.
- [x] **[CLAUDE]** Show project milestones as markers and a "today" line.

## Phase 6: Attendance (clock in/out)

- [x] **[CLAUDE]** Attendance page with a large Clock In / Clock Out button, calling the `clock_in` / `clock_out` RPC functions (never use the browser clock). Attendance is general, not tied to a project.
- [x] **[CLAUDE]** Show the current session timer if the user is clocked in, plus today's total hours.
- [x] **[CLAUDE]** Personal history table: date, clock in, clock out, duration, status.
- [x] **[CLAUDE]** Manager view (PMs): attendance of everyone on projects they manage, filter by person and date range, approve/reject records, and add a note.
- [x] **[CLAUDE]** Handle edge cases: user forgot to clock out (show a warning on the next day and let the PM correct it), double clock-in is blocked with a clear message.

## Phase 7: Dashboard and reports

- [x] **[CLAUDE]** Dashboard: for PMs show project cards with task progress, overdue task count, and who is clocked in now. For others show my upcoming tasks and today's attendance.
- [x] **[CLAUDE]** Attendance report per month, with total hours per person, and CSV export.
- [x] **[CLAUDE]** Task report: tasks by status and by assignee, with CSV export.

## Phase 8: Polish and quality

- [x] **[CLAUDE]** Loading states, empty states, error toasts, and confirmation dialogs for destructive actions.
- [x] **[CLAUDE]** Make layouts responsive (interns will likely clock in from their phones).
- [ ] **[CLAUDE]** Run through `supabase/tests/rls_checklist.md` with at least three test accounts (PM, developer, intern) and fix any policy gaps.
- [x] **[CLAUDE]** Add basic tests for key logic (permissions hook, date validation, duration calculation).
- [x] **[CLAUDE]** Write a `README.md` with setup and run instructions.

## Phase 9: Deployment to Netlify

- [x] **[CLAUDE]** Add `netlify.toml` with build command `npm run build`, publish directory `dist`, and an SPA redirect (`/*` to `/index.html`, status 200).
- [ ] **[HUMAN]** Push the code to GitHub. In Netlify: Add new site > Import from Git, then select the repo.
- [ ] **[HUMAN]** In Netlify site settings > Environment variables, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then trigger a deploy.
- [ ] **[HUMAN]** In Supabase: Authentication > URL Configuration, set the Site URL to the Netlify URL and add it to the redirect URLs.
- [ ] **[HUMAN]** Re-enable "Confirm email" in Supabase if it was turned off, and consider setting up a custom SMTP provider (e.g. Resend) for reliable emails.
- [ ] **[HUMAN]** Test the live site end to end with the three test accounts.

## Phase 10: Optional improvements (after the MVP works)

- [ ] Email invite for people who have not registered yet (Supabase Edge Function).
- [ ] Notifications for new task assignments and approaching deadlines.
- [ ] Task comments and file attachments (Supabase Storage).
- [ ] Kanban board view.
- [x] Leave/absence requests (done early, see Additional requests).
- [ ] Audit log of changes.
- [ ] Keep-alive ping or upgrade plan so the free Supabase project is not paused from inactivity.
- [ ] Periodic database backup/export routine.

---

## Additional requests (added during the build)

- [x] Roles live in their own `roles` table (CRUD-able); `project_members.role_id` is a foreign key to it (`005_roles_table.sql`).
- [x] After registering, the user is signed out and must log in again to confirm the account works.
- [x] All table primary keys use `bigint` identity instead of `uuid` (`profiles.id` stays `uuid` because it mirrors the Supabase Auth user id). `000_reset.sql` rebuilds the schema; `007_backfill_profiles.sql` restores profile rows.
- [x] PM can add registered users to a project by email (`006_add_member_rpc.sql`).
- [x] PM can add, complete and delete milestones from the Gantt tab (shown as purple bars on the chart).
- [x] PM can correct a member's clock-out time (`008_attendance_correction.sql`, `pm_set_clock_out`), used for the forgot-to-clock-out case.
- [x] Attendance is general (no project): `009_general_attendance_and_leave.sql` drops `attendance.project_id`; managers (PMs) see and review the people who share a project with them. The project Attendance tab was removed.
- [x] Confirmation dialogs (shared `ConfirmProvider`), error boundary and a 404 page.
- [x] Floating Clock in / Clock out button at the bottom right of every page (shows Clock out while clocked in, otherwise Clock in).
- [x] Leave and absence: users declare Annual leave, MC, Emergency, Unpaid or Other in advance (`leave_types`, `leave_requests`); managers approve or reject; clocking in is blocked on days with approved leave.
- [x] Inviting people to a project suggests registered users as you type, searching by name or email (`010_search_users.sql`, PM only, already-active members are left out).
- [x] UI refresh: calm slate-blue theme (low saturation), brand header and gradient sign-in screen, tinted sidebar with active pill, user avatars, soft coloured status pills, dashboard KPI tiles and task status bars.
- [x] Project Overview tab is now two columns: Gantt timeline and Members on the left, project details on the right (stacked on phones, details first). The Members tab was removed; the Gantt tab is kept (chart plus milestones).
- [x] Fixed the invite suggestion list being clipped inside its card.
- [x] Taller, easier-to-click tabs with no stray scrollbar.
- [x] PM can remove a member from a project; their tasks in that project become unassigned (`011_member_removal.sql`). The last PM cannot be removed.
- [x] PM can delete a project from a Danger zone, after typing the project name to confirm (GitHub style).
