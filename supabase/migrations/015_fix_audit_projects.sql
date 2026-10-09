-- 015_fix_audit_projects.sql
-- Editing a project failed with: malformed array literal: "dates".
-- In audit_projects(), `changes || 'dates'` makes Postgres read the bare word as a whole array.
-- Wrapping each word as array['dates'] fixes it. Safe to run any number of times.

create or replace function public.audit_projects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changes text[] := '{}';
begin
  if new.name is distinct from old.name then changes := changes || ('name "' || old.name || '" to "' || new.name || '"'); end if;
  if new.status is distinct from old.status then changes := changes || ('status ' || old.status || ' to ' || new.status); end if;
  if new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date then changes := changes || array['dates']; end if;
  if new.budget is distinct from old.budget then changes := changes || array['budget']; end if;
  if new.sponsor is distinct from old.sponsor or new.description is distinct from old.description or new.type is distinct from old.type then changes := changes || array['details']; end if;
  if array_length(changes, 1) is not null then
    perform public.log_audit(new.id, 'update', 'project', new.id, 'Updated project: ' || array_to_string(changes, ', '));
  end if;
  return new;
end;
$$;
