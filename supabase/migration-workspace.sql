-- Migration: Team workspaces (shared data sync + named members + assignments)
-- Run after migration-plans.sql / migration-team.sql in Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- 1. Teams and membership
-- ---------------------------------------------------------------------------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  leader_id uuid not null references auth.users (id),
  license_key text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('leader', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- One team per user in v1.
create unique index if not exists team_members_user_uniq
  on public.team_members (user_id);
create index if not exists team_members_team_idx
  on public.team_members (team_id);

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users (id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create index if not exists team_invites_email_idx
  on public.team_invites (lower(email));

-- ---------------------------------------------------------------------------
-- 2. Shared workspace rows (generic document store, tombstones included)
-- ---------------------------------------------------------------------------
create table if not exists public.team_rows (
  team_id uuid not null references public.teams (id) on delete cascade,
  entity text not null check (entity in (
    'clients', 'projects', 'tasks', 'invoices', 'invoice_items', 'payments'
  )),
  row_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  deleted boolean not null default false,
  primary key (team_id, entity, row_id)
);

create index if not exists team_rows_pull_idx
  on public.team_rows (team_id, updated_at);

-- ---------------------------------------------------------------------------
-- 3. RLS — members read their team; all writes go through SECURITY DEFINER
--    RPCs (site Account page and desktop app, both signed in).
-- ---------------------------------------------------------------------------
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.team_rows enable row level security;

create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;

drop policy if exists teams_select_member on public.teams;
create policy teams_select_member on public.teams
  for select using (
    public.is_team_member(id)
    or exists (
      select 1 from public.team_invites i
      where i.team_id = id
        and i.status = 'pending'
        and lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members
  for select using (user_id = auth.uid() or public.is_team_member(team_id));

drop policy if exists team_invites_select on public.team_invites;
create policy team_invites_select on public.team_invites
  for select using (
    public.is_team_member(team_id)
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists team_rows_select on public.team_rows;
create policy team_rows_select on public.team_rows
  for select using (public.is_team_member(team_id));

-- ---------------------------------------------------------------------------
-- 4. Helpers
-- ---------------------------------------------------------------------------
create or replace function public.team_seat_limit(p_team_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text;
  v_seats integer;
begin
  select license_key into v_key from public.teams where id = p_team_id;
  if v_key is null then return 0; end if;
  select coalesce(seats, 1) into v_seats
  from public.licenses
  where license_key = v_key and status = 'active'
    and (expires_at is null or expires_at > now())
  limit 1;
  return coalesce(v_seats, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Team management RPCs
-- ---------------------------------------------------------------------------

-- Create a team under the caller's active multi-seat license.
create or replace function public.create_team(p_name text, p_license_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_license public.licenses%rowtype;
  v_team_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_name');
  end if;
  if exists (select 1 from public.team_members where user_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'code', 'already_in_team');
  end if;

  select * into v_license
  from public.licenses
  where license_key = upper(trim(p_license_key)) and user_id = auth.uid()
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'license_not_found');
  end if;
  if v_license.status <> 'active'
     or (v_license.expires_at is not null and v_license.expires_at < now()) then
    return jsonb_build_object('ok', false, 'code', 'license_inactive');
  end if;
  if coalesce(v_license.seats, 1) <= 1 then
    return jsonb_build_object('ok', false, 'code', 'not_team_license');
  end if;

  insert into public.teams (name, leader_id, license_key)
  values (trim(p_name), auth.uid(), v_license.license_key)
  returning id into v_team_id;

  insert into public.team_members (team_id, user_id, role)
  values (v_team_id, auth.uid(), 'leader');

  return jsonb_build_object('ok', true, 'team_id', v_team_id);
end;
$$;

-- Everything about the caller's team: team, members, pending invites, seats.
create or replace function public.team_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_team public.teams%rowtype;
  v_members jsonb;
  v_invites jsonb;
  v_seats integer;
  v_role text;
begin
  select * into v_team from public.teams
  where id = (select team_id from public.team_members where user_id = auth.uid());
  if not found then
    return jsonb_build_object('ok', true, 'team', null);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id', m.user_id,
      'email', p.email,
      'role', m.role,
      'joined_at', m.joined_at
    ) order by m.joined_at
  ), '[]'::jsonb)
  into v_members
  from public.team_members m
  left join public.profiles p on p.id = m.user_id
  where m.team_id = v_team.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', i.id, 'email', i.email, 'status', i.status,
      'created_at', i.created_at, 'expires_at', i.expires_at
    ) order by i.created_at desc
  ), '[]'::jsonb)
  into v_invites
  from public.team_invites i
  where i.team_id = v_team.id and i.status = 'pending';

  v_seats := public.team_seat_limit(v_team.id);
  select role into v_role from public.team_members
  where team_id = v_team.id and user_id = auth.uid();

  return jsonb_build_object(
    'ok', true,
    'team', jsonb_build_object(
      'id', v_team.id, 'name', v_team.name,
      'leader_id', v_team.leader_id, 'created_at', v_team.created_at
    ),
    'role', v_role,
    'members', v_members,
    'invites', v_invites,
    'seats', v_seats
  );
end;
$$;

create or replace function public.invite_member(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.teams%rowtype;
  v_count integer;
  v_seats integer;
  v_lower text;
begin
  v_lower := lower(trim(coalesce(p_email, '')));
  if v_lower = '' or position('@' in v_lower) = 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_email');
  end if;

  select * into v_team from public.teams
  where id = (select team_id from public.team_members
              where user_id = auth.uid() and role = 'leader');
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_leader');
  end if;

  select count(*) into v_count from public.team_members where team_id = v_team.id;
  v_seats := public.team_seat_limit(v_team.id);
  if v_count >= v_seats then
    return jsonb_build_object('ok', false, 'code', 'seats_full',
      'seats', v_seats, 'members', v_count);
  end if;

  if exists (select 1 from public.team_members m
             join public.profiles p on p.id = m.user_id
             where m.team_id = v_team.id and lower(p.email) = v_lower) then
    return jsonb_build_object('ok', false, 'code', 'already_member');
  end if;

  update public.team_invites set status = 'revoked'
    where team_id = v_team.id and lower(email) = v_lower and status = 'pending';

  insert into public.team_invites (team_id, email, invited_by)
  values (v_team.id, v_lower, auth.uid());

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.revoke_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean := false;
begin
  update public.team_invites i
  set status = 'revoked'
  from public.team_members m
  where i.id = p_invite_id
    and m.team_id = i.team_id
    and m.user_id = auth.uid()
    and m.role = 'leader'
    and i.status = 'pending';
  get diagnostics v_ok = row_count;
  return jsonb_build_object('ok', v_ok);
end;
$$;

-- The invited person accepts while signed in (site or app session).
create or replace function public.accept_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.team_invites%rowtype;
  v_count integer;
  v_seats integer;
  v_email text;
begin
  select * into v_invite from public.team_invites where id = p_invite_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_invite.status <> 'pending' or v_invite.expires_at < now() then
    return jsonb_build_object('ok', false, 'code', 'invite_invalid');
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' or v_email <> lower(v_invite.email) then
    return jsonb_build_object('ok', false, 'code', 'email_mismatch');
  end if;
  if exists (select 1 from public.team_members where user_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'code', 'already_in_team');
  end if;

  select count(*) into v_count from public.team_members where team_id = v_invite.team_id;
  v_seats := public.team_seat_limit(v_invite.team_id);
  if v_count >= v_seats then
    return jsonb_build_object('ok', false, 'code', 'seats_full',
      'seats', v_seats, 'members', v_count);
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (v_invite.team_id, auth.uid(), 'member');
  update public.team_invites set status = 'accepted' where id = p_invite_id;

  return jsonb_build_object('ok', true, 'team_id', v_invite.team_id);
end;
$$;

create or replace function public.remove_member(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_leader uuid;
begin
  select t.id, t.leader_id into v_team_id, v_leader
  from public.teams t
  where t.id = (select team_id from public.team_members
                where user_id = auth.uid() and role = 'leader');
  if v_team_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_leader');
  end if;
  if p_user_id = v_leader then
    return jsonb_build_object('ok', false, 'code', 'cannot_remove_leader');
  end if;

  delete from public.team_members where team_id = v_team_id and user_id = p_user_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Members may leave; the leader may not (team would be orphaned).
create or replace function public.leave_team()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_team_id uuid;
begin
  select role, team_id into v_role, v_team_id
  from public.team_members where user_id = auth.uid();
  if v_team_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_in_team');
  end if;
  if v_role = 'leader' then
    return jsonb_build_object('ok', false, 'code', 'leader_cannot_leave');
  end if;

  delete from public.team_members where team_id = v_team_id and user_id = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Sync RPCs (desktop app)
-- ---------------------------------------------------------------------------

-- Push changed rows. Server keeps the newer updated_at (last-write-wins).
create or replace function public.sync_push(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_item jsonb;
begin
  select team_id into v_team_id from public.team_members where user_id = auth.uid();
  if v_team_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_in_team');
  end if;

  for v_item in select * from jsonb_array_elements(p_rows) loop
    continue when v_item ->> 'entity' not in (
      'clients', 'projects', 'tasks', 'invoices', 'invoice_items', 'payments'
    );

    insert into public.team_rows (team_id, entity, row_id, data, updated_at, updated_by, deleted)
    values (
      v_team_id,
      v_item ->> 'entity',
      v_item ->> 'row_id',
      coalesce(v_item -> 'data', '{}'::jsonb),
      coalesce((v_item ->> 'updated_at')::timestamptz, now()),
      auth.uid(),
      coalesce((v_item ->> 'deleted')::boolean, false)
    )
    on conflict (team_id, entity, row_id) do update
      set data = excluded.data,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by,
          deleted = excluded.deleted
      where public.team_rows.updated_at <= excluded.updated_at;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

-- Pull rows changed since a cursor. Returns server_now so clients use the
-- server clock instead of their own for the next pull.
create or replace function public.sync_pull(p_since timestamptz, p_limit integer default 1000)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_rows jsonb;
begin
  select team_id into v_team_id from public.team_members where user_id = auth.uid();
  if v_team_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_in_team');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'entity', r.entity,
      'row_id', r.row_id,
      'data', r.data,
      'updated_at', r.updated_at,
      'deleted', r.deleted
    ) order by r.updated_at
  ), '[]'::jsonb)
  into v_rows
  from public.team_rows r
  where r.team_id = v_team_id
    and r.updated_at > coalesce(p_since, timestamptz '1970-01-01 UTC')
  limit least(coalesce(p_limit, 1000), 5000);

  return jsonb_build_object('ok', true, 'rows', v_rows, 'server_now', now());
end;
$$;

-- Roster for the desktop app (member names/emails for assignment).
create or replace function public.team_roster()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_members jsonb;
begin
  if not exists (select 1 from public.team_members where user_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'code', 'not_in_team');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id', m.user_id,
      'email', p.email,
      'role', m.role
    ) order by m.joined_at
  ), '[]'::jsonb)
  into v_members
  from public.team_members m
  left join public.profiles p on p.id = m.user_id
  where m.team_id = (select team_id from public.team_members where user_id = auth.uid());

  return jsonb_build_object('ok', true, 'members', v_members);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Grants (Supabase roles)
-- ---------------------------------------------------------------------------
grant execute on function public.is_team_member(uuid) to authenticated, anon;
grant execute on function public.create_team(text, text) to authenticated;
grant execute on function public.team_state() to authenticated;
grant execute on function public.invite_member(text) to authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
grant execute on function public.accept_invite(uuid) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.leave_team() to authenticated;
grant execute on function public.sync_push(jsonb) to authenticated;
grant execute on function public.sync_pull(timestamptz, integer) to authenticated;
grant execute on function public.team_roster() to authenticated;
