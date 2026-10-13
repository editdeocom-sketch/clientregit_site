-- Migration: Meetings (video calls) + in-call chat + 1:1 messaging
-- Run after migration-workspace.sql in Supabase SQL Editor. Idempotent.

-- ---------------------------------------------------------------------------
-- 1) meetings
-- ---------------------------------------------------------------------------
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_user_id uuid not null references auth.users (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  title text not null default 'Meeting',
  description text,
  scheduled_at timestamptz,
  duration_min integer,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'ended', 'cancelled')),
  lobby_enabled boolean not null default false,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (title <> '' and char_length(title) <= 200),
  check (duration_min is null or duration_min > 0)
);

create index if not exists meetings_team_idx
  on public.meetings (team_id, scheduled_at desc nulls last);
create index if not exists meetings_host_idx
  on public.meetings (host_user_id, scheduled_at desc nulls last);

-- ---------------------------------------------------------------------------
-- 2) meeting_members (team invitees), meeting_guests (link recipients)
-- ---------------------------------------------------------------------------
create table if not exists public.meeting_members (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  invite_status text not null default 'invited'
    check (invite_status in ('invited', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

create index if not exists meeting_members_user_idx
  on public.meeting_members (user_id);

create table if not exists public.meeting_guests (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  name text not null,
  email text,
  created_at timestamptz not null default now(),
  check (name <> '' and char_length(name) <= 120)
);

create index if not exists meeting_guests_meeting_idx
  on public.meeting_guests (meeting_id);

-- ---------------------------------------------------------------------------
-- 3) in-call chat (persistent transcript; guests allowed while live)
-- ---------------------------------------------------------------------------
create table if not exists public.meeting_messages (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  sender_kind text not null check (sender_kind in ('user', 'guest')),
  sender_id text not null,
  sender_name text not null,
  body text not null,
  created_at timestamptz not null default now(),
  check (char_length(body) between 1 and 4000)
);

create index if not exists meeting_messages_meeting_idx
  on public.meeting_messages (meeting_id, created_at);

-- ---------------------------------------------------------------------------
-- 4) call history
-- ---------------------------------------------------------------------------
create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists call_sessions_meeting_idx
  on public.call_sessions (meeting_id, started_at desc);

create table if not exists public.call_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.call_sessions (id) on delete cascade,
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  participant_kind text not null check (participant_kind in ('user', 'guest')),
  participant_id text not null,
  name text not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

create index if not exists call_participants_session_idx
  on public.call_participants (session_id);
create index if not exists call_participants_meeting_idx
  on public.call_participants (meeting_id, joined_at);

-- ---------------------------------------------------------------------------
-- 5) 1:1 messaging (team members only; canonical pair user_a < user_b)
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create index if not exists conversations_user_a_idx on public.conversations (user_a);
create index if not exists conversations_user_b_idx on public.conversations (user_b);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id),
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (char_length(body) between 1 and 8000)
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);
create index if not exists messages_unread_idx
  on public.messages (conversation_id, read_at) where read_at is null;

-- ---------------------------------------------------------------------------
-- 6) helpers (security definer: used from policies + anon RPCs)
-- ---------------------------------------------------------------------------
create or replace function public.is_meeting_host(p_meeting_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.meetings
    where id = p_meeting_id and host_user_id = auth.uid()
  );
$$;

create or replace function public.is_meeting_visible(p_meeting_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.meetings m
    where m.id = p_meeting_id
      and (
        m.host_user_id = auth.uid()
        or (m.team_id is not null and public.is_team_member(m.team_id))
      )
  );
$$;

create or replace function public.meeting_is_live(p_meeting_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.meetings
    where id = p_meeting_id and status = 'live'
  );
$$;

-- Caller is host of the meeting AND the invited user shares the caller's team.
create or replace function public.can_invite_to_meeting(p_meeting_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.meetings m
    where m.id = p_meeting_id
      and m.host_user_id = auth.uid()
      and m.team_id is not null
      and exists (
        select 1 from public.team_members a
        join public.team_members b on b.team_id = a.team_id
        where a.user_id = auth.uid() and b.user_id = p_user_id
      )
  );
$$;

create or replace function public.share_team(p_other uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members a
    join public.team_members b on b.team_id = a.team_id
    where a.user_id = auth.uid() and b.user_id = p_other
  );
$$;

-- Conversation membership without recursing into conversations RLS.
create or replace function public.in_conversation(p_conversation_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversations
    where id = p_conversation_id
      and (user_a = auth.uid() or user_b = auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- 7) RLS
-- ---------------------------------------------------------------------------
alter table public.meetings enable row level security;
alter table public.meeting_members enable row level security;
alter table public.meeting_guests enable row level security;
alter table public.meeting_messages enable row level security;
alter table public.call_sessions enable row level security;
alter table public.call_participants enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings
  for select using (
    host_user_id = auth.uid()
    or (team_id is not null and public.is_team_member(team_id))
  );

drop policy if exists meetings_insert on public.meetings;
create policy meetings_insert on public.meetings
  for insert with check (
    host_user_id = auth.uid()
    and (team_id is null or public.is_team_member(team_id))
  );

drop policy if exists meetings_update_host on public.meetings;
create policy meetings_update_host on public.meetings
  for update using (host_user_id = auth.uid())
  with check (host_user_id = auth.uid());

drop policy if exists meetings_delete_host on public.meetings;
create policy meetings_delete_host on public.meetings
  for delete using (host_user_id = auth.uid());

drop policy if exists meeting_members_select on public.meeting_members;
create policy meeting_members_select on public.meeting_members
  for select using (
    user_id = auth.uid() or public.is_meeting_visible(meeting_id)
  );

drop policy if exists meeting_members_insert on public.meeting_members;
create policy meeting_members_insert on public.meeting_members
  for insert with check (public.can_invite_to_meeting(meeting_id, user_id));

drop policy if exists meeting_members_update_invitee on public.meeting_members;
create policy meeting_members_update_invitee on public.meeting_members
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists meeting_members_update_host on public.meeting_members;
create policy meeting_members_update_host on public.meeting_members
  for update using (public.is_meeting_host(meeting_id));

drop policy if exists meeting_members_delete_host on public.meeting_members;
create policy meeting_members_delete_host on public.meeting_members
  for delete using (public.is_meeting_host(meeting_id));

drop policy if exists meeting_guests_select on public.meeting_guests;
create policy meeting_guests_select on public.meeting_guests
  for select using (public.is_meeting_visible(meeting_id));

drop policy if exists meeting_guests_insert on public.meeting_guests;
create policy meeting_guests_insert on public.meeting_guests
  for insert with check (public.is_meeting_host(meeting_id));

drop policy if exists meeting_guests_delete on public.meeting_guests;
create policy meeting_guests_delete on public.meeting_guests
  for delete using (public.is_meeting_host(meeting_id));

-- Chat: members always; anyone knowing the meeting id while the meeting is
-- live (link = capability — this is how browser guests chat).
drop policy if exists meeting_messages_select on public.meeting_messages;
create policy meeting_messages_select on public.meeting_messages
  for select using (
    public.is_meeting_visible(meeting_id) or public.meeting_is_live(meeting_id)
  );

drop policy if exists meeting_messages_insert on public.meeting_messages;
create policy meeting_messages_insert on public.meeting_messages
  for insert with check (
    public.is_meeting_visible(meeting_id) or public.meeting_is_live(meeting_id)
  );

drop policy if exists meeting_messages_delete on public.meeting_messages;
create policy meeting_messages_delete on public.meeting_messages
  for delete using (public.is_meeting_host(meeting_id));

-- Call sessions: members read; members OR anyone while live may write
-- (guests start their own session once the meeting is live).
drop policy if exists call_sessions_select on public.call_sessions;
create policy call_sessions_select on public.call_sessions
  for select using (public.is_meeting_visible(meeting_id));

drop policy if exists call_sessions_write on public.call_sessions;
create policy call_sessions_write on public.call_sessions
  for insert with check (
    public.is_meeting_visible(meeting_id) or public.meeting_is_live(meeting_id)
  );

drop policy if exists call_sessions_update on public.call_sessions;
create policy call_sessions_update on public.call_sessions
  for update using (
    public.is_meeting_visible(meeting_id) or public.meeting_is_live(meeting_id)
  );

drop policy if exists call_participants_select on public.call_participants;
create policy call_participants_select on public.call_participants
  for select using (public.is_meeting_visible(meeting_id));

drop policy if exists call_participants_insert on public.call_participants;
create policy call_participants_insert on public.call_participants
  for insert with check (
    public.is_meeting_visible(meeting_id) or public.meeting_is_live(meeting_id)
  );

drop policy if exists call_participants_update on public.call_participants;
create policy call_participants_update on public.call_participants
  for update using (
    public.is_meeting_visible(meeting_id) or public.meeting_is_live(meeting_id)
  );

-- Conversations: both participants (same team required to create).
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert with check (
    (user_a = auth.uid() or user_b = auth.uid())
    and public.share_team(case when user_a = auth.uid() then user_b else user_a end)
  );

drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations
  for update using (user_a = auth.uid() or user_b = auth.uid())
  with check (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists conversations_delete on public.conversations;
create policy conversations_delete on public.conversations
  for delete using (user_a = auth.uid() or user_b = auth.uid());

-- Messages: readable by both sides; sender must be self; recipient may
-- update (sets read_at) — v1 trusts participants not to rewrite history.
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select using (public.in_conversation(conversation_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (
    sender_id = auth.uid() and public.in_conversation(conversation_id)
  );

drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
  for update using (public.in_conversation(conversation_id))
  with check (public.in_conversation(conversation_id));

drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own on public.messages
  for delete using (sender_id = auth.uid() and public.in_conversation(conversation_id));

-- ---------------------------------------------------------------------------
-- 8) RPCs
-- ---------------------------------------------------------------------------

-- Close open call sessions when the meeting ends.
create or replace function public.close_call_sessions()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status in ('ended', 'cancelled') then
    update public.call_sessions
    set ended_at = coalesce(ended_at, now())
    where meeting_id = new.id and ended_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists meetings_close_sessions on public.meetings;
create trigger meetings_close_sessions
  after update of status on public.meetings
  for each row
  when (old.status is distinct from new.status)
  execute function public.close_call_sessions();

-- Human-friendly meeting code: no ambiguous characters, 10 chars (~47 bits).
create or replace function public.gen_meeting_code()
returns text
language plpgsql volatile
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..10 loop
      v_code := v_code || substr(
        v_alphabet,
        1 + floor(random() * length(v_alphabet))::int,
        1
      );
    end loop;
    exit when not exists (select 1 from public.meetings where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.create_meeting(
  p_title text,
  p_scheduled_at timestamptz default null,
  p_duration_min integer default null,
  p_lobby_enabled boolean default false,
  p_description text default null,
  p_member_ids uuid[] default '{}',
  p_guest jsonb default '[]'
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_meeting_id uuid;
  v_code text;
  v_team_id uuid;
  v_uid uuid := auth.uid();
  v_title text := trim(coalesce(p_title, ''));
  v_member uuid;
  v_guest jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if v_title = '' or char_length(v_title) > 200 then
    return jsonb_build_object('ok', false, 'code', 'bad_title');
  end if;
  if p_duration_min is not null and p_duration_min <= 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_duration');
  end if;

  select team_id into v_team_id from public.team_members where user_id = v_uid;

  -- Invitees must share the host's team (solo meetings are guests-only).
  if v_team_id is null and cardinality(coalesce(p_member_ids, '{}')) > 0 then
    return jsonb_build_object('ok', false, 'code', 'no_team');
  end if;
  foreach v_member in array coalesce(p_member_ids, '{}') loop
    if v_member = v_uid then
      continue;
    end if;
    if v_team_id is null
       or not exists (
         select 1 from public.team_members
         where team_id = v_team_id and user_id = v_member
       ) then
      return jsonb_build_object('ok', false, 'code', 'bad_members');
    end if;
  end loop;

  v_code := public.gen_meeting_code();

  insert into public.meetings
    (code, host_user_id, team_id, title, description,
     scheduled_at, duration_min, status, lobby_enabled)
  values
    (v_code, v_uid, v_team_id, v_title, nullif(trim(coalesce(p_description, '')), ''),
     p_scheduled_at, p_duration_min, 'scheduled', coalesce(p_lobby_enabled, false))
  returning id into v_meeting_id;

  foreach v_member in array coalesce(p_member_ids, '{}') loop
    if v_member = v_uid then
      continue;
    end if;
    insert into public.meeting_members (meeting_id, user_id)
    values (v_meeting_id, v_member)
    on conflict do nothing;
  end loop;

  for v_guest in select * from jsonb_array_elements(coalesce(p_guest, '[]'::jsonb)) loop
    continue when coalesce(v_guest ->> 'name', '') = '';
    insert into public.meeting_guests (meeting_id, name, email)
    values (
      v_meeting_id,
      left(trim(v_guest ->> 'name'), 120),
      nullif(left(trim(coalesce(v_guest ->> 'email', '')), 200), '')
    );
  end loop;

  return jsonb_build_object('ok', true, 'id', v_meeting_id, 'code', v_code);
end;
$$;

create or replace function public.update_meeting(
  p_id uuid,
  p_title text default null,
  p_scheduled_at timestamptz default null,
  p_clear_scheduled boolean default false,
  p_duration_min integer default null,
  p_clear_duration boolean default false,
  p_lobby_enabled boolean default null,
  p_description text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_title text := trim(coalesce(p_title, ''));
begin
  if not exists (
    select 1 from public.meetings where id = p_id and host_user_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_host');
  end if;
  if v_title = '' or char_length(v_title) > 200 then
    return jsonb_build_object('ok', false, 'code', 'bad_title');
  end if;

  update public.meetings set
    title = v_title,
    scheduled_at = case when p_clear_scheduled then null
                        else coalesce(p_scheduled_at, scheduled_at) end,
    duration_min = case when p_clear_duration then null
                        else coalesce(p_duration_min, duration_min) end,
    lobby_enabled = coalesce(p_lobby_enabled, lobby_enabled),
    description = nullif(trim(coalesce(p_description, description, '')), '')
  where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.set_meeting_status(p_id uuid, p_status text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
begin
  if p_status not in ('scheduled', 'live', 'ended', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'bad_status');
  end if;
  if not exists (
    select 1 from public.meetings where id = p_id and host_user_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_host');
  end if;

  update public.meetings set
    status = p_status,
    started_at = case when p_status = 'live' and started_at is null
                      then now() else started_at end,
    ended_at = case when p_status in ('ended', 'cancelled')
                    then coalesce(ended_at, now()) else ended_at end
  where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- Join info for a meeting code (code = capability; usable by guests/anon).
create or replace function public.get_meeting_by_code(p_code text)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_meeting public.meetings%rowtype;
  v_host_name text;
begin
  select * into v_meeting from public.meetings
  where code = upper(trim(coalesce(p_code, '')));
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    u.email,
    'Meeting host'
  ) into v_host_name
  from auth.users u where u.id = v_meeting.host_user_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_meeting.id,
    'code', v_meeting.code,
    'title', v_meeting.title,
    'description', v_meeting.description,
    'status', v_meeting.status,
    'lobby_enabled', v_meeting.lobby_enabled,
    'scheduled_at', v_meeting.scheduled_at,
    'duration_min', v_meeting.duration_min,
    'host_name', v_host_name
  );
end;
$$;

create or replace function public.get_or_create_conversation(p_other uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_id uuid;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if p_other is null or p_other = v_me then
    return jsonb_build_object('ok', false, 'code', 'bad_other');
  end if;
  if not exists (
    select 1 from public.team_members a
    join public.team_members b on b.team_id = a.team_id
    where a.user_id = v_me and b.user_id = p_other
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_in_team');
  end if;

  v_a := least(v_me, p_other);
  v_b := greatest(v_me, p_other);

  insert into public.conversations (user_a, user_b)
  values (v_a, v_b)
  on conflict (user_a, user_b) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.conversations
    where user_a = v_a and user_b = v_b;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9) Grants
-- ---------------------------------------------------------------------------
grant execute on function public.is_meeting_host(uuid) to authenticated, anon;
grant execute on function public.is_meeting_visible(uuid) to authenticated, anon;
grant execute on function public.meeting_is_live(uuid) to authenticated, anon;
grant execute on function public.can_invite_to_meeting(uuid, uuid) to authenticated, anon;
grant execute on function public.share_team(uuid) to authenticated, anon;
grant execute on function public.in_conversation(uuid) to authenticated, anon;
grant execute on function public.gen_meeting_code() to authenticated;
grant execute on function public.create_meeting(text, timestamptz, integer, boolean, text, uuid[], jsonb) to authenticated;
grant execute on function public.update_meeting(uuid, text, timestamptz, boolean, integer, boolean, boolean, text) to authenticated;
grant execute on function public.set_meeting_status(uuid, text) to authenticated;
grant execute on function public.get_meeting_by_code(text) to authenticated, anon;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10) Realtime (postgres_changes for invites, DMs, meeting status, chat)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meetings'
    ) then
      alter publication supabase_realtime add table public.meetings;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meeting_members'
    ) then
      alter publication supabase_realtime add table public.meeting_members;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meeting_messages'
    ) then
      alter publication supabase_realtime add table public.meeting_messages;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;
  end if;
end $$;
