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
- [ ] Notifications. Partly done: in-app bell for task assignments, comments, leave and attendance decisions. Still to do: approaching-deadline reminders (need a scheduled job).
- [ ] Task comments and file attachments. Partly done: comments. Still to do: file attachments (Supabase Storage).
- [x] Kanban board view.
- [x] Leave/absence requests (done early, see Additional requests).
- [x] Audit log of changes.
- [x] Keep-alive ping or upgrade plan so the free Supabase project is not paused from inactivity.
- [x] Periodic database backup/export routine.

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
- [x] Task detail dialog with comments; Board tab (Kanban) with drag and drop; PM-only Activity tab (audit log) (`012_comments_notifications_audit.sql`).

---

## Companies (organizations) layer

Decision: attendance and leave belong to a **company**, not to a project. Company -> many projects -> many project members. Decisions taken: company admins (owner/admin) approve attendance and leave; a person can be clocked in to only one company at a time; existing test data is wiped by the migration.

- [x] **[CLAUDE]** `013_organizations.sql`: `organizations`, `organization_members` (owner/admin/member), `projects.organization_id`, `attendance.organization_id`, `leave_requests.organization_id`; new RLS helpers (`is_org_member`, `is_org_admin`); project members must belong to the company; org-level user search and add-member RPCs; clock_in takes the company; leave/attendance approved by company admins. Wipes existing project/attendance/leave data.
- [ ] **[HUMAN]** Run `013_organizations.sql` in the Supabase SQL Editor.
- [x] **[CLAUDE]** Company context (current company, switcher, create-company onboarding when you have none).
- [x] **[CLAUDE]** Company page: members (add by name/email search, change role, remove), rename, delete company (type name to confirm).
- [x] **[CLAUDE]** Projects are created inside the current company; project invites only offer company members.
- [x] **[CLAUDE]** Attendance, leave, team views, reports, dashboard and floating clock work per company.
- [x] **[CLAUDE]** Update README, RLS checklist, tests.
- [x] A new user is not forced to create a company: they land on a neutral welcome screen (ask an admin to add your email, or create your own). Only Dashboard, Company and Profile are available until they join one.
- [x] Fix: creating a project failed because the built-in `pm` role was missing from the roles table. `014_restore_system_roles.sql` restores the roles and makes the trigger recreate `pm` if it is ever missing.
- [x] Fix: editing a project's dates, budget or details failed (`malformed array literal`) because of a bug in the activity-log trigger. Fixed in `012` and by `015_fix_audit_projects.sql`.
- [x] Clock in/out is per company: a person can be clocked in to several companies at the same time (one open session per company). `016_clock_per_company.sql`; the company switcher marks companies where you are clocked in. This replaces the earlier "one company at a time" decision.
- [x] Project Tasks tab: search and filters sit on one row on large screens.
- [x] Sidebar: Profile link removed (it stays in the user menu at the top right); the company selector moved to the bottom of the sidebar as a button that opens a "Choose a company" popup (shows role and whether you are clocked in); picking one loads that company.
- [x] Team attendance: "Download report" for a month or a whole year (CSV, opens in Excel). Monthly summary = hours per person; yearly summary = hours per person for each month; or a detailed list of every session. Covers the whole company, loads past the 1000-row API limit.
- [x] Profile: change password (asks for the current password, checks length and confirmation, shows a strength hint, signs out other devices), plus the existing name edit. The Profile page is reached from the user menu.
- [x] Visual redesign away from the stock template look: warm paper background with ink-blue text and actions, dark ink sidebar with a serif wordmark and an active-page marker, serif page titles with small-caps eyebrows (`PageHeader`), flat bordered cards, hairline tables with small-caps headers, status shown as a coloured dot plus label, stat blocks with large serif numerals, square avatars, underline tabs, split sign-in screen. Fonts: Instrument Sans and Instrument Serif, bundled with the app (no external font requests).
- [x] Design: switched the whole app to the approved blue design (Poppins, 12px corners, soft shadows, light sidebar, circular floating clock button, tinted status/role badges). Tokens live in `src/styles/design-system.css`; a preview of every component is at `/design-preview`. App shell, Login and Projects list restyled; remaining pages inherit the colours and fonts.
- [x] Superadmin (one per system), `017_superadmin.sql`: sees every company, project, task, attendance and leave record (read access, for fixing problems); Admin section in the sidebar with Overview, Users (search, rename, reset password email, suspend/reactivate, delete), Companies (create, members and roles, transfer ownership, suspend/reactivate, delete) and an Audit log of every superadmin action. Suspended users get a "suspended" screen and are blocked by the database; a suspended company is read-only with a banner.
- [ ] [HUMAN] Run `017_superadmin.sql`, then make yourself superadmin: `update public.profiles set is_superadmin = true where email = 'YOUR-LOGIN-EMAIL';`
- [ ] Superadmin, later: edit/correct data inside projects (add/remove a PM, delete a project, fix attendance, decide leave), restore deleted items, system settings (roles, leave types, announcement banner).
- [x] Superadmin group 4, `018_superadmin_manage.sql`: the superadmin sees every company in the company picker ("Superadmin access", owner-level, no clocking) and can open any project with PM powers (edit tasks, add/remove members and PMs, delete the project, correct attendance, approve/reject leave). Those actions are logged in the audit log. Deleted projects are kept for 30 days (members, tasks, dependencies, milestones, comments) and restored from Admin > Deleted projects.
- [ ] [HUMAN] Run `018_superadmin_manage.sql` (after 017).
- [ ] Superadmin, later: system settings (roles, leave types, announcement banner); restore deleted companies/users (only projects are restorable now).
- [x] Fix: superadmin could not delete a user who had created projects (foreign key error). `019_delete_user_reassign.sql` hands what they created to the superadmin and promotes a new owner where they were the only one.
- [ ] [HUMAN] Run `019_delete_user_reassign.sql`.
- [x] Company invitation links, `020_company_invite_links.sql`: every company has its own link (`/join/<code>`), shown to admins on the Company page with Copy, Turn off/on and Create a new link (the old one stops working). Someone who opens it registers (name, email, password) and lands inside that company as a member; an existing user can sign in or join with the account they are already using. Links of suspended companies do not work.
- [x] Registration signs the user in straight away (no second sign-in) when email confirmation is off.
- [ ] [HUMAN] Run `020_company_invite_links.sql`.
- [x] Fix: duplicate roles (the original roles were renamed in the Supabase table editor, so 014 added a second lowercase set). `021_merge_duplicate_roles.sql` merges them onto the renamed ones; the PM role is now found by its is_pm flag, never by name.
- [ ] [HUMAN] Run `021_merge_duplicate_roles.sql`.
- [x] Company roles are now a table too (`organization_roles`: Owner, Admin, Member), like project roles. `022_organization_roles_table.sql` moves every member to `org_role_id` (foreign key) and drops the old text column. Powers come from two flags (`is_owner`, `is_admin`), never from the name, so roles can be renamed. The superadmin edits both company and project roles in Admin > Roles.
- [ ] [HUMAN] Run `022_organization_roles_table.sql` (after 021).
- [x] Sign-in page redesigned: centred card over a faint blurred project timeline (no slogan panel), Sign in / Create account switch, show-password button, Caps Lock hint, inline error message, short entrance animation (off when the system asks for reduced motion). Register, forgot-password and the invitation page still use the old split layout; to be decided after review.
- [x] Same new look on Register, Forgot password, Reset password and the invitation page: shared `AuthCard` shell (timeline backdrop, logo, one card), `PasswordInput` (show/hide, Caps Lock hint), inline error box, company name chip on the invitation page. Sign in and Register share the Sign in / Create account switch.
- [x] Gantt layout: task list and assignee on the left, calendar timeline with bars and dependency lines on the right, rows lined up (milestones included, marked with a diamond). The hover/click popup now escapes task names and descriptions (the chart library wrote them into the page as raw HTML).
- [x] A task can be assigned to several people (`023_task_assignees.sql`: link table `task_assignees`, old `assignee_id` column copied over then dropped). The PM picks the assignees with checkboxes in the task form; any assignee can update the task's status and progress; everyone assigned gets the "assigned to you" notification and sees it in My tasks; the board, task list and Gantt show avatar stacks; reports count a shared task once per person.
- [ ] [HUMAN] Run `023_task_assignees.sql` (after 022). Back up first.
- [x] Task form: Assignees is now a searchable dropdown (combobox) with removable chips; reusable `MultiCombobox` component.
- [x] Trello-style cards (`024_trello_style_tasks.sql`): any project member whose role can edit (everyone except the read-only Viewer) can add cards (inline "+ Add a card" in each column), edit them, drag them between columns, assign several people and comment. Roles get a `can_edit` switch (Admin > Roles). Deleting a card: project managers, or the person who created it. Milestones stay with project managers. The card opens as an editable panel that saves as you go (title, members, description, status, priority, dates, progress, comments); cards show priority, due date chip, description and comment icons and member avatars. Gantt bars can be rescheduled by anyone who can edit.
- [ ] [HUMAN] Run `024_trello_style_tasks.sql` (after 023).
- [ ] Later, if wanted: manual card order inside a column (needs a position column), labels with colours, checklists, card attachments.
- [x] Deleting a card is now a power of the role too (`025_role_can_delete_tasks.sql`, `roles.can_delete`), so each project team decides which roles can add/edit and which can delete. Project managers always can. Replaces the "creator can delete their own card" rule. Set both switches per role in Admin > Roles.
- [ ] [HUMAN] Run `025_role_can_delete_tasks.sql` (after 024).
- [x] Everyone in a project can add, edit and delete any card (`026_everyone_edits_and_deletes.sql`): the role switches stay but are ON for every role, including Viewer, and ON for new roles. A team can still switch editing or deleting off for one role in Admin > Roles.
- [ ] [HUMAN] Run `026_everyone_edits_and_deletes.sql` (after 025).
- [x] Milestones are phases with a start and end date, and tasks live under them (`027_milestone_phases.sql`): a task has an optional milestone (none = Unplanned), set in the task form and the card panel; a warning (never a block) shows when a task's dates fall outside its milestone; a milestone shows "x of y tasks done" and a state (On track / At risk / Overdue / Done), completes by itself when its last task is done and reopens if one is reopened; the Gantt shows each milestone as a phase bar with its tasks grouped under it; the board and task list can be filtered by milestone and cards show their milestone; the overview lists every milestone with progress; project managers get a notification once when a milestone's end date passes with tasks still open (checked when someone opens the project; a scheduled job would be more precise). Existing single-date milestones became start = end.
- [ ] [HUMAN] Run `027_milestone_phases.sql` (after 026).
- [x] Phase > task > subtask with roll-up (`028_subtasks_rollup.sql`): a task can be split into subtasks (one level only; a subtask cannot have subtasks; deleting a task deletes its subtasks); tasks and subtasks both have assignees; a task with subtasks gets its percentage (average), status (all done / all to do / in review / otherwise in progress) and dates (earliest start, latest due) from its subtasks and cannot be set by hand; a task without subtasks keeps its own values; a phase's percentage is the average of its tasks' percentages (each task once) and the phase is done when all its tasks are done; subtasks are always in their task's phase. Everything is shown in date order (earliest start first) and numbered in that order (1, 2 ... and 1.1, 1.2 ...), so numbers move when dates change. The board shows tasks as cards with a "2/4 subtasks" bar and subtasks are edited inside the card; the Gantt shows phase > task > subtask indented; the task table is grouped by phase. Counts by status and by person use the real units of work (subtasks, or tasks without subtasks).
- [ ] [HUMAN] Run `028_subtasks_rollup.sql` (after 027).
- [x] Checklists instead of subtasks (`029_task_checklists.sql`, replaces 028's subtasks): like Trello, a card has a checklist whose items can be added, renamed, changed and deleted by anyone who can edit the project. Each item is a tick box (0 or 100) or a percentage (0-100) and can be switched between the two. Items have no people, dates or status; the people stay on the task. A task with a checklist gets its percentage from the average of its items (Done counts as 100); status and dates are set by hand again. A phase is still the average of its tasks. Existing subtasks are converted into checklist items. Board cards show "x/y checklist" with a bar.
- [ ] [HUMAN] Run `029_task_checklists.sql` (after 028; back up first, old subtask rows are removed).
- [x] Attendance no longer has an approval status: the Status column, badge, approve/reject choice and the Status column in CSV exports are removed; managers can still correct a clock-out and add a note (Edit). The `attendance.status` column stays in the database, unused, so no migration is needed.
- [x] Activity tab is a paginated table (5/10/50/100 rows) and the log is leaner (`030_leaner_activity_log.sql`): only project name/status/dates/budget changes, member changes, milestone add/delete/dates/complete, and tasks deleted, marked done or with the due date moved are logged. Old noisy rows (task created / moved / renamed / assigned, project detail edits) are deleted.
- [ ] [HUMAN] Run `030_leaner_activity_log.sql` (after 029). It deletes old activity rows for good.
- [x] Project teams (`031_project_teams.sql`): project managers create teams (a named group of the project's members) in a new Teams section on the project Overview; in a card's Members field and in the task form, "Add a whole team" adds all its members to the task as ordinary assignees (nobody is removed, nobody is added twice). Everyone in the project can see teams; removing someone from the project removes them from its teams.
- [ ] [HUMAN] Run `031_project_teams.sql` (after 030).
- [x] Planned versus actual dates (`032_actual_dates.sql`): a task's start/due dates are the plan; new actual start / actual end are filled in automatically (leaving To do sets the start, marking Done sets the end, reopening clears the end) and can be corrected in the card panel. The Gantt chart shows a second bar under each task and milestone (green on time, red late, lighter while running, with "x days late") and an "Actual dates" switch in the toolbar. A milestone's actual bar runs from its first actual task start to its last actual end once all tasks are done. Existing tasks start with empty actual dates.
- [ ] [HUMAN] Run `032_actual_dates.sql` (after 031).
- [ ] Optional later: keep the original plan as a locked baseline so a rescheduled task still shows how far it slipped.
- [ ] Gantt chart: the second "actual" bar under each task and milestone was taken out again (planning a better version). The data (032 actual start/end, editable in the card panel) and `src/lib/actualDates.ts` remain for it.
