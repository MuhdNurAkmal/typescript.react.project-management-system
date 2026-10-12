-- 026_everyone_edits_and_deletes.sql: everyone in a project can add, edit and delete any card.
-- The two role switches from 024/025 stay, so a team can still make one role read-only later (Admin > Roles),
-- but they are now ON for every role, including Viewer, and ON by default for new roles.
-- Run after 025.

update public.roles set can_edit = true, can_delete = true;
alter table public.roles alter column can_edit set default true;
alter table public.roles alter column can_delete set default true;
