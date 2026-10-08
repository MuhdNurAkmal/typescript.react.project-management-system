# Project Management System

A project management system for lecturers running grant or industrial projects. A Project Manager (PM) creates projects, adds team members, assigns tasks, views a Gantt timeline, and tracks attendance and leave.

**Stack:** React 19 + Vite + TypeScript, Tailwind CSS v4 + shadcn/ui, Supabase (Postgres, Auth, Row Level Security), Netlify.

## Features

- Email/password sign up, sign in, password reset
- Projects with members and custom roles (roles are rows in a `roles` table)
- Tasks with assignees, priorities, parent tasks and dependencies (cycles are rejected)
- Gantt chart (Day / Week / Month) with drag-to-reschedule for PMs and project milestones
- General attendance: floating Clock in / Clock out button on every page, server-side timestamps
- Leave and absence requests (annual leave, MC, emergency, unpaid, other); approved leave blocks clock in
- Manager views: team attendance, leave approval, clock-out correction
- Kanban board, task comments, in-app notifications and a PM-only activity log
- Dashboard, attendance report per month, task report, CSV export

## Prerequisites

- Node.js 20 or newer
- A Supabase project (free tier is fine)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your project values from Supabase > Project Settings > API:

   ```
   VITE_SUPABASE_URL=https://<your-project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon public key>
   ```

   Only the **anon** key belongs in the frontend. Never put the `service_role` key in this app or commit it.

3. Create the database. In the Supabase SQL Editor, paste and run the files in `supabase/migrations/` **in order**:

   | File | Purpose |
   | --- | --- |
   | `001_schema.sql` | Tables and indexes (bigint identity ids; `profiles.id` is a uuid that mirrors `auth.users`) |
   | `002_triggers.sql` | Auto-create profiles, auto-add project creator as PM, one open attendance session per user |
   | `003_rls.sql` | Row Level Security policies and helper functions |
   | `004_functions.sql` | First version of clock in / out (replaced by 009) |
   | `005_roles_table.sql` | Roles as a table; `project_members.role_id` foreign key |
   | `006_add_member_rpc.sql` | Add a registered user to a project by email |
   | `007_backfill_profiles.sql` | Create profile rows for auth users that already exist |
   | `008_attendance_correction.sql` | PM can correct a member's clock-out time |
   | `009_general_attendance_and_leave.sql` | Attendance without projects; leave types and requests |
| `010_search_users.sql` | User search (by name or email) for the invite suggestions |
| `011_member_removal.sql` | Removing a member unassigns their tasks; the last PM cannot be removed |
| `012_comments_notifications_audit.sql` | Task comments, in-app notifications, per-project activity log |

   `000_reset.sql` is **destructive**: it drops every table this app created in the `public` schema so you can start over. Only use it on a project with test data.

4. In Supabase > Authentication > Providers, make sure Email is enabled. While developing you can turn off "Confirm email"; turn it back on before going live.

## Run

```bash
npm run dev      # start the dev server
npm run build    # type-check and build to dist/
npm run preview  # serve the production build locally
npm run lint     # oxlint
npm test         # unit tests (vitest)
```

## Project structure

```
src/
  components/    UI components (ui/ is shadcn), feature folders: projects, tasks, gantt, attendance, leave
  hooks/         data hooks (TanStack Query) and auth/permission hooks
  lib/           supabase client, validation and report helpers (unit tested)
  pages/         route pages
  types/         hand-written database types (see below)
supabase/
  migrations/    SQL, run in order
  tests/         rls_checklist.md: manual security test cases
```

## How access control works

The database is the real enforcement. Row Level Security policies decide who can read and write each table; the UI only hides controls (`usePermissions`) for convenience.

- A **PM** is anyone whose role in a project has `is_pm = true`. The project creator is made a PM automatically.
- Members can read their projects; only PMs can change projects, members, tasks and milestones.
- Assignees can change only the status and progress of their own tasks (enforced by a trigger).
- Attendance is per person. A PM can see and review the attendance and leave of everyone who shares a project with them, but never their own.
- Clock in/out use database functions with server time (`now()`), not the browser clock. Timestamps are stored in UTC (`timestamptz`) and shown in the user's local time. The leave check for "today" uses Malaysia time (`Asia/Kuala_Lumpur`); change it in `clock_in()` if you deploy elsewhere.

Work through `supabase/tests/rls_checklist.md` with three accounts (PM, developer, intern) after any change to policies.

## Database types

`src/types/database.ts` is written by hand. When you add or change columns, update it too, or generate it with the Supabase CLI:

```bash
npx supabase gen types typescript --project-id <your-project-ref> > src/types/database.ts
```

## Deploy to Netlify

1. Push the repo to GitHub, then in Netlify choose Add new site > Import from Git.
2. `netlify.toml` already sets the build command (`npm run build`), publish directory (`dist`) and the single-page-app redirect.
3. In Site settings > Environment variables add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy.
4. In Supabase > Authentication > URL Configuration set the Site URL to your Netlify URL and add it to the redirect URLs (needed for password reset emails).
5. Re-enable "Confirm email" and consider a custom SMTP provider for reliable email delivery.

Free Supabase projects pause after a period of inactivity; open the app now and then or upgrade the plan.

## Keeping the free tier alive and backing up

- `.github/workflows/keepalive.yml` pings the Supabase API daily so a free project is not paused for inactivity. Add two repository secrets in GitHub (Settings > Secrets and variables > Actions): `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- `scripts/backup.sh` dumps the `public` schema with `pg_dump`. Set `DATABASE_URL` to the connection string from Supabase > Project Settings > Database and run it (needs the PostgreSQL client tools). Backups go to `backups/`, which is git-ignored. Keep them somewhere safe, as they contain all your data.
