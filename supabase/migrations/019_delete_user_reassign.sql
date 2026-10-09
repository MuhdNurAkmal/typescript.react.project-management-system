-- 019_delete_user_reassign.sql: deleting a user no longer fails because they created projects or companies.
-- What they created is handed to the superadmin who deletes them; a company they solely own gets a new owner first.
-- Run after 018. Not destructive.

create or replace function public.admin_delete_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_label text;
  r record;
  v_next uuid;
begin
  perform public.require_superadmin();
  if p_user_id = auth.uid() then raise exception 'You cannot delete yourself'; end if;
  v_label := public.display_name(p_user_id);

  -- companies where this person is the only owner: promote someone else (admins first, then the longest-standing member)
  for r in
    select m.organization_id, o.name
    from public.organization_members m join public.organizations o on o.id = m.organization_id
    where m.user_id = p_user_id and m.org_role = 'owner'
      and not exists (
        select 1 from public.organization_members x
        where x.organization_id = m.organization_id and x.org_role = 'owner' and x.user_id <> p_user_id)
  loop
    select x.user_id into v_next
    from public.organization_members x
    where x.organization_id = r.organization_id and x.user_id <> p_user_id
    order by (x.org_role = 'admin') desc, x.joined_at
    limit 1;
    if v_next is null then
      raise exception 'Company "%" has no other members. Delete or transfer the company first.', r.name;
    end if;
    update public.organization_members set org_role = 'owner'
      where organization_id = r.organization_id and user_id = v_next;
  end loop;

  -- everything else that points at this person without cascading (projects, tasks, companies created by them):
  -- required columns go to the superadmin, optional ones are cleared
  for r in
    select c.conrelid::regclass::text as tbl, a.attname::text as col, a.attnotnull as required
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass and c.confdeltype = 'a'
  loop
    execute format('update %s set %I = %s where %I = $1', r.tbl, r.col,
      case when r.required then quote_literal(auth.uid()::text) || '::uuid' else 'null' end, r.col)
      using p_user_id;
  end loop;

  perform public.admin_log('delete', 'user', p_user_id::text, 'Deleted user ' || v_label || ' (their projects and companies were kept)');
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
