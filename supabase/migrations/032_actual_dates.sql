-- 032_actual_dates.sql: planned versus actual dates on tasks.
-- tasks.start_date / due_date stay the PLAN. New: actual_start / actual_end, filled in automatically
-- (today in Malaysia, the same clock as the milestone alerts) and correctable by hand:
--   * a task leaves To do        -> actual_start = today (if empty)
--   * a task is marked Done      -> actual_end = today (if empty), actual_start too if it was never set
--   * a Done task is reopened    -> actual_end is cleared
-- A date you set by hand in the same change is never overwritten. Existing tasks keep empty actual dates:
-- when they really started and finished is not known. Run after 031.

alter table public.tasks
  add column actual_start date,
  add column actual_end date,
  add constraint tasks_actual_dates_order check (actual_end is null or actual_start is null or actual_end >= actual_start);

create or replace function public.set_actual_dates()
returns trigger language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'todo' and new.actual_start is null then new.actual_start := today; end if;
    if new.status = 'done' and new.actual_end is null then new.actual_end := greatest(today, new.actual_start); end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    -- started
    if old.status = 'todo' and new.status <> 'todo' and new.actual_start is null then
      new.actual_start := today;
    end if;
    -- finished
    if new.status = 'done' and old.status <> 'done' then
      if new.actual_start is null then new.actual_start := today; end if;
      if new.actual_end is not distinct from old.actual_end and new.actual_end is null then
        new.actual_end := greatest(today, new.actual_start);
      end if;
    end if;
    -- reopened
    if old.status = 'done' and new.status <> 'done' and new.actual_end is not distinct from old.actual_end then
      new.actual_end := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_actual_dates
  before insert or update on public.tasks
  for each row execute function public.set_actual_dates();
