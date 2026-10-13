-- Migration: Meetings v2 — get-or-create the active call session.
-- Run after migration-meetings.sql in Supabase SQL Editor. Idempotent.

create or replace function public.active_call_session(p_meeting_id uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not (public.is_meeting_visible(p_meeting_id) or public.meeting_is_live(p_meeting_id)) then
    return null;
  end if;

  select id into v_id
  from public.call_sessions
  where meeting_id = p_meeting_id and ended_at is null
  order by started_at desc
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.call_sessions (meeting_id)
  values (p_meeting_id)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.active_call_session(uuid) to authenticated, anon;
