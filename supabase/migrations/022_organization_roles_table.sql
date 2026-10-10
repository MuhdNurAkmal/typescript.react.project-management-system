-- 022_organization_roles_table.sql: company roles (owner / admin / member) move into their own table,
-- like project roles. organization_members now points at it with a foreign key (org_role_id) and the
-- old text column org_role is dropped. What a role may do comes from two flags, never from its name:
--   is_owner = full control of the company (delete it, change owners), always also an admin
--   is_admin = manage people, review attendance and leave
-- The superadmin manages the roles from Admin > Roles. Run after 021.

create table public.organization_roles (
  id bigint generated always as identity primary key,
  name text not null unique check (char_length(trim(name)) between 1 and 60),
  description text,
  is_owner boolean not null default false,
  is_admin boolean not null default false,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  check (not is_owner or is_admin)
);

insert into public.organization_roles (name, description, is_owner, is_admin, is_system) values
  ('Owner', 'Full control, including deleting the company', true, true, true),
  ('Admin', 'Manages people, reviews attendance and leave', false, true, true),
  ('Member', 'Takes part in projects and clocks in', false, false, true);

alter table public.organization_roles enable row level security;
create policy org_roles_select on public.organization_roles for select to authenticated using (true);
create policy org_roles_superadmin on public.organization_roles for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- the superadmin may also manage the project roles table
create policy roles_superadmin on public.roles for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- the built-in roles keep their powers; everything else about them (name, description) can be edited
create or replace function public.guard_org_roles()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then raise exception 'Built-in roles cannot be deleted'; end if;
    return old;
  end if;
  if old.is_system and (new.is_owner is distinct from old.is_owner or new.is_admin is distinct from old.is_admin) then
    raise exception 'The powers of a built-in role cannot be changed';
  end if;
  return new;
end;
$$;
create trigger org_roles_guard before update or delete on public.organization_roles
  for each row execute function public.guard_org_roles();

-- ================================================================ move the members over
alter table public.organization_members add column org_role_id bigint references public.organization_roles (id) on delete restrict;
update public.organization_members m set org_role_id = r.id
  from public.organization_roles r where lower(r.name) = m.org_role;
alter table public.organization_members alter column org_role_id set not null;
create index on public.organization_members (org_role_id);

-- ================================================================ helpers (by flag, never by name)
create or replace function public.org_role_is_owner(p_role_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner from public.organization_roles where id = p_role_id), false);
$$;
create or replace function public.owner_org_role_id()
returns bigint language sql stable security definer set search_path = public as $$
  select id from public.organization_roles where is_owner order by is_system desc, id limit 1;
$$;
create or replace function public.admin_org_role_id()
returns bigint language sql stable security definer set search_path = public as $$
  select id from public.organization_roles where is_admin and not is_owner order by is_system desc, id limit 1;
$$;
create or replace function public.default_org_role_id()
returns bigint language sql stable security definer set search_path = public as $$
  select id from public.organization_roles where not is_admin order by is_system desc, id limit 1;
$$;
revoke all on function public.org_role_is_owner(bigint), public.owner_org_role_id(),
  public.admin_org_role_id(), public.default_org_role_id() from public, anon;
grant execute on function public.org_role_is_owner(bigint), public.owner_org_role_id(),
  public.admin_org_role_id(), public.default_org_role_id() to authenticated;

alter table public.organization_members alter column org_role_id set default public.default_org_role_id();

create or replace function public.is_org_admin(p_org_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or exists (
    select 1 from public.organization_members m
    join public.organization_roles r on r.id = m.org_role_id
    where m.organization_id = p_org_id and m.user_id = auth.uid() and r.is_admin
  );
$$;

create or replace function public.is_org_owner(p_org_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    join public.organization_roles r on r.id = m.org_role_id
    where m.organization_id = p_org_id and m.user_id = auth.uid() and r.is_owner
  );
$$;

-- ================================================================ policies and triggers that used the text column
drop policy org_members_insert on public.organization_members;
create policy org_members_insert on public.organization_members for insert to authenticated
  with check (public.is_org_admin(organization_id) and not public.org_role_is_owner(org_role_id));

drop policy leave_types_insert on public.leave_types;
create policy leave_types_insert on public.leave_types for insert to authenticated
  with check (
    created_by = auth.uid() and not is_system
    and exists (
      select 1 from public.organization_members om
      join public.organization_roles r on r.id = om.org_role_id
      where om.user_id = auth.uid() and r.is_admin
    )
  );

create or replace function public.handle_new_organization()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.organization_members (organization_id, user_id, org_role_id)
  values (new.id, new.created_by, public.owner_org_role_id());
  return new;
end;
$$;

create or replace function public.guard_org_member_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare old_owner boolean; new_owner boolean;
begin
  if not exists (select 1 from public.organizations where id = old.organization_id) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id or new.user_id <> old.user_id then
      raise exception 'Cannot move a membership';
    end if;
    if new.org_role_id = old.org_role_id then
      return new;
    end if;
  end if;

  old_owner := public.org_role_is_owner(old.org_role_id);
  new_owner := tg_op = 'UPDATE' and public.org_role_is_owner(new.org_role_id);

  if (old_owner or new_owner) and not public.is_org_owner(old.organization_id) and not public.is_superadmin() then
    raise exception 'Only a company owner can change an owner';
  end if;

  if old_owner and (tg_op = 'DELETE' or not new_owner)
     and not exists (
       select 1 from public.organization_members x
       join public.organization_roles r on r.id = x.org_role_id
       where x.organization_id = old.organization_id and r.is_owner and x.id <> old.id
     ) then
    raise exception 'A company needs at least one owner';
  end if;

  if tg_op = 'DELETE' then
    delete from public.project_members pm
    using public.projects p
    where p.id = pm.project_id and p.organization_id = old.organization_id and pm.user_id = old.user_id;
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.audit_superadmin_membership()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.organization_members;
begin
  if current_user = 'authenticated' and public.is_superadmin() then
    r := case when tg_op = 'DELETE' then old else new end;
    perform public.admin_log(lower(tg_op), 'company_member', r.organization_id::text,
      tg_op || ' member ' || public.display_name(r.user_id) || ' ('
      || coalesce((select name from public.organization_roles where id = r.org_role_id), '?')
      || ') in company #' || r.organization_id);
  end if;
  return null;
end;
$$;

create or replace function public.notify_leave()
returns trigger language plpgsql security definer set search_path = public as $$
declare admin_id uuid;
begin
  if tg_op = 'INSERT' then
    for admin_id in
      select om.user_id from public.organization_members om
      join public.organization_roles r on r.id = om.org_role_id
      where om.organization_id = new.organization_id and r.is_admin and om.user_id <> new.user_id
    loop
      insert into public.notifications (user_id, type, title, body, link)
      values (admin_id, 'leave_requested', public.display_name(new.user_id) || ' requested leave',
              new.start_date::text || ' to ' || new.end_date::text, '/attendance');
    end loop;
  elsif new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, type, title, body, link)
    values (new.user_id, 'leave_decided', 'Your leave request was ' || new.status,
            new.start_date::text || ' to ' || new.end_date::text, '/attendance');
  end if;
  return new;
end;
$$;

-- add a person to a company with a chosen role (null = the default member role); owners are not assignable here
drop function public.add_org_member(bigint, text, text);
create or replace function public.add_org_member(p_organization_id bigint, p_email text, p_org_role_id bigint default null)
returns public.organization_members
language plpgsql security definer set search_path = public as $$
declare
  target_id uuid;
  v_role bigint := coalesce(p_org_role_id, public.default_org_role_id());
  result public.organization_members;
begin
  if not public.is_org_admin(p_organization_id) then
    raise exception 'Only company admins can add members';
  end if;
  if not exists (select 1 from public.organization_roles where id = v_role) then
    raise exception 'Unknown role';
  end if;
  if public.org_role_is_owner(v_role) then
    raise exception 'Owners are set by transferring ownership, not when adding a person';
  end if;
  select id into target_id from public.profiles where lower(email) = lower(trim(p_email));
  if target_id is null then
    raise exception 'No registered user with email %', p_email;
  end if;
  insert into public.organization_members (organization_id, user_id, org_role_id)
  values (p_organization_id, target_id, v_role)
  on conflict (organization_id, user_id) do nothing
  returning * into result;
  if result.id is null then
    raise exception 'That person is already in the company';
  end if;
  return result;
end;
$$;
revoke all on function public.add_org_member(bigint, text, bigint) from public, anon;
grant execute on function public.add_org_member(bigint, text, bigint) to authenticated;

-- superadmin functions
create or replace function public.admin_list_orgs()
returns table (
  id bigint, name text, created_at timestamptz, suspended_at timestamptz, suspended_reason text,
  owners text, member_count bigint, project_count bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_superadmin();
  return query
    select o.id, o.name, o.created_at, o.suspended_at, o.suspended_reason,
           coalesce((select string_agg(coalesce(p.full_name, p.email), ', ')
                     from public.organization_members m
                     join public.organization_roles r on r.id = m.org_role_id
                     join public.profiles p on p.id = m.user_id
                     where m.organization_id = o.id and r.is_owner), ''),
           (select count(*) from public.organization_members m where m.organization_id = o.id),
           (select count(*) from public.projects pr where pr.organization_id = o.id)
    from public.organizations o
    order by o.created_at desc;
end;
$$;

create or replace function public.admin_transfer_ownership(p_org_id bigint, p_new_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_owner bigint := public.owner_org_role_id(); v_admin bigint := public.admin_org_role_id();
begin
  perform public.require_superadmin();
  select name into v_name from public.organizations where id = p_org_id;
  if v_name is null then raise exception 'Company not found'; end if;
  if not exists (select 1 from public.profiles where id = p_new_owner) then raise exception 'User not found'; end if;
  insert into public.organization_members (organization_id, user_id, org_role_id)
  values (p_org_id, p_new_owner, v_owner)
  on conflict (organization_id, user_id) do update set org_role_id = v_owner;
  update public.organization_members set org_role_id = v_admin
    where organization_id = p_org_id and org_role_id in (select id from public.organization_roles where is_owner) and user_id <> p_new_owner;
  perform public.admin_log('transfer', 'company', p_org_id::text, 'Transferred "' || v_name || '" to ' || public.display_name(p_new_owner));
end;
$$;

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

  for r in
    select m.organization_id, o.name
    from public.organization_members m
    join public.organization_roles ro on ro.id = m.org_role_id
    join public.organizations o on o.id = m.organization_id
    where m.user_id = p_user_id and ro.is_owner
      and not exists (
        select 1 from public.organization_members x
        join public.organization_roles xr on xr.id = x.org_role_id
        where x.organization_id = m.organization_id and xr.is_owner and x.user_id <> p_user_id)
  loop
    select x.user_id into v_next
    from public.organization_members x
    join public.organization_roles xr on xr.id = x.org_role_id
    where x.organization_id = r.organization_id and x.user_id <> p_user_id
    order by xr.is_admin desc, x.joined_at
    limit 1;
    if v_next is null then
      raise exception 'Company "%" has no other members. Delete or transfer the company first.', r.name;
    end if;
    update public.organization_members set org_role_id = public.owner_org_role_id()
      where organization_id = r.organization_id and user_id = v_next;
  end loop;

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

-- joining through an invitation link uses the default member role
create or replace function public.join_company(p_code text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if public.is_suspended() then raise exception 'Your account is suspended'; end if;
  select i.organization_id into v_org
  from public.organization_invites i
  join public.organizations o on o.id = i.organization_id
  where i.code = p_code and i.enabled and o.suspended_at is null;
  if v_org is null then raise exception 'This invitation link is not valid any more'; end if;
  insert into public.organization_members (organization_id, user_id, org_role_id)
  values (v_org, auth.uid(), public.default_org_role_id())
  on conflict (organization_id, user_id) do nothing;
  return v_org;
end;
$$;

-- the old text column is no longer used
alter table public.organization_members drop column org_role;
