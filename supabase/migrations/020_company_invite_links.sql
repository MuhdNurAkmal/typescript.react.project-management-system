-- 020_company_invite_links.sql: every company has its own invitation link. Anyone who opens it can register
-- (or sign in) and is added to that company as a member. Admins can turn the link off or replace it.
-- Run after 019. Not destructive.

create table public.organization_invites (
  organization_id bigint primary key references public.organizations (id) on delete cascade,
  code text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.organization_invites enable row level security;

-- only company admins can see the code; the code itself can only be replaced through reset_invite_code
create policy invites_select on public.organization_invites for select to authenticated
  using (public.is_org_admin(organization_id));
create policy invites_update on public.organization_invites for update to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
revoke update on public.organization_invites from authenticated;
grant update (enabled) on public.organization_invites to authenticated;

-- existing companies get a link, and so does every new company
insert into public.organization_invites (organization_id) select id from public.organizations;

create or replace function public.create_org_invite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.organization_invites (organization_id) values (new.id);
  return new;
end;
$$;
create trigger on_organization_invite
  after insert on public.organizations
  for each row execute function public.create_org_invite();

-- the join page shows the company name before the visitor has an account
create or replace function public.get_invite_info(p_code text)
returns table (organization_name text)
language sql stable security definer set search_path = public as $$
  select o.name
  from public.organization_invites i
  join public.organizations o on o.id = i.organization_id
  where i.code = p_code and i.enabled and o.suspended_at is null;
$$;
revoke all on function public.get_invite_info(text) from public;
grant execute on function public.get_invite_info(text) to anon, authenticated;

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
  insert into public.organization_members (organization_id, user_id, org_role)
  values (v_org, auth.uid(), 'member')
  on conflict (organization_id, user_id) do nothing;
  return v_org;
end;
$$;
revoke all on function public.join_company(text) from public, anon;
grant execute on function public.join_company(text) to authenticated;

create or replace function public.reset_invite_code(p_org_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_org_admin(p_org_id) then raise exception 'Only a company admin can do this'; end if;
  update public.organization_invites
    set code = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), enabled = true
    where organization_id = p_org_id;
end;
$$;
revoke all on function public.reset_invite_code(bigint) from public, anon;
grant execute on function public.reset_invite_code(bigint) to authenticated;
