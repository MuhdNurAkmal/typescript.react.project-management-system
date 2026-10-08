# RLS manual test checklist

Test accounts: **PM-A** (creates Project A), **Dev-A** (developer in A), **Intern-A** (intern in A), **PM-B** (creates Project B, unrelated to A).
Mark each case pass/fail after running it as the stated user (via the app, or the SQL editor with `set role authenticated` and `request.jwt.claims`).

## Projects
- [ ] PM-A creates Project A; a `project_members` row with role `pm` appears automatically.
- [ ] Dev-A can read Project A. Dev-A cannot read Project B.
- [ ] PM-B cannot read, update or delete Project A.
- [ ] Dev-A cannot update or delete Project A.
- [ ] Anonymous (no login) requests return no rows from any table.

## Members
- [ ] Dev-A can list members of Project A but not of Project B.
- [ ] Dev-A cannot insert, update or delete a `project_members` row in Project A.
- [ ] PM-A can add, change the role of, and deactivate members of Project A.
- [ ] A deactivated member can no longer read Project A data.
- [ ] PM-B cannot add themselves to Project A.

## Profiles
- [ ] Dev-A can read PM-A's and Intern-A's profiles (shared project) but not PM-B's.
- [ ] Dev-A can update their own profile but not Intern-A's.

## Tasks
- [ ] PM-A can create, edit and delete tasks in Project A.
- [ ] Dev-A and Intern-A cannot create or delete tasks.
- [ ] Intern-A can update `status` and `progress` of a task assigned to them.
- [ ] Intern-A cannot change title, dates, assignee or priority of their own task (trigger raises an error).
- [ ] Intern-A cannot update a task assigned to Dev-A.
- [ ] Dev-A in Project A cannot read tasks in Project B.
- [ ] A task cannot be inserted with `progress` outside 0-100 or `due_date` before `start_date`.

## Task dependencies
- [ ] Members can read dependencies; only PM-A can add or remove them.
- [ ] PM-A cannot add a task depending on itself (check constraint).

## Attendance (general, not per project)
- [ ] Intern-A can `clock_in`; server time is used (the client cannot supply the timestamp).
- [ ] A second `clock_in` while clocked in fails with a clear message.
- [ ] Direct insert with another user's `user_id` fails.
- [ ] Intern-A can `clock_out`; cannot edit `clock_in` or `status` on their own row.
- [ ] Intern-A cannot read Dev-A's attendance rows (no shared PM relationship via attendance).
- [ ] PM-A can read attendance of everyone who shares a project with PM-A, and change `status` and `note`.
- [ ] PM-B (no shared project) cannot read or update attendance of Project A members.
- [ ] A PM cannot approve their own attendance.

## Milestones
- [ ] Members can read milestones; only PM-A can create, update or delete them.
- [ ] Users outside Project A cannot read its milestones.

## Functions
- [ ] `anon` role cannot execute `clock_in`, `clock_out`, `is_project_member`, `is_project_pm`.

## Roles
- [ ] Any signed-in user can read `roles`; anon cannot.
- [ ] A PM can create a custom role (`is_system` and `is_pm` false); a user who is not a PM anywhere cannot.
- [ ] Nobody can create a role with `is_pm = true` or edit/delete system roles.
- [ ] Only the creator can edit/delete their custom role; deleting a role still assigned to a member fails (restrict).

## Attendance correction
- [ ] PM-A can correct Intern-A's clock-out via the Review dialog; the time cannot be before clock-in or in the future.
- [ ] PM-A cannot correct their own attendance rows.
- [ ] Intern-A calling `pm_set_clock_out` directly fails; PM-B cannot correct rows in Project A.
- [ ] A direct `update attendance set clock_out = ...` as a PM on someone else's row fails (only the RPC may change it).

## Leave
- [ ] A user can create a pending leave request for themselves only; inserting with status `approved` fails.
- [ ] A user can cancel (delete) their own pending request, but not an approved or rejected one.
- [ ] PM-A can approve or reject Intern-A's request; PM-A cannot change its dates or type, and cannot review their own request.
- [ ] PM-B (no shared project) cannot see or review Intern-A's request.
- [ ] After approval covering today, `clock_in` fails with the leave message; it works again on other days.
