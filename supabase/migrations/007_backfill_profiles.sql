-- 007_backfill_profiles.sql: recreate profile rows for auth users that already exist
-- (needed after 000_reset.sql, since the profiles table was dropped and rebuilt).

insert into public.profiles (id, email, full_name)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do nothing;
