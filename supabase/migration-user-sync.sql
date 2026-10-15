-- Migration: Personal account sync (individual licenses)
-- Run once in Supabase SQL Editor, after migration-workspace.sql.
--
-- Until now, cloud sync only existed for team workspaces. This adds a
-- per-user row store + RPCs so an individual user's clients/projects/tasks/
-- invoices follow their sign-in to any computer they activate.

-- ---------------------------------------------------------------------------
-- 1. Per-user rows (same document shape as team_rows, keyed by account)
-- ---------------------------------------------------------------------------
create table if not exists public.user_rows (
  user_id uuid not null references auth.users (id) on delete cascade,
  entity text not null check (entity in (
    'clients', 'projects', 'tasks', 'invoices', 'invoice_items', 'payments'
  )),
  row_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  deleted boolean not null default false,
  primary key (user_id, entity, row_id)
);

create index if not exists user_rows_pull_idx
  on public.user_rows (user_id, updated_at);

alter table public.user_rows enable row level security;
-- No direct table policies: all reads/writes go through SECURITY DEFINER RPCs
-- (desktop app, signed-in user), mirroring team_rows.

-- ---------------------------------------------------------------------------
-- 2. Sync RPCs (same contract as sync_push / sync_pull, scoped to auth.uid())
-- ---------------------------------------------------------------------------

-- Push changed rows for the signed-in user. Last-write-wins on updated_at.
create or replace function public.sync_push_user(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;

  for v_item in select * from jsonb_array_elements(p_rows) loop
    continue when v_item ->> 'entity' not in (
      'clients', 'projects', 'tasks', 'invoices', 'invoice_items', 'payments'
    );

    insert into public.user_rows (user_id, entity, row_id, data, updated_at, updated_by, deleted)
    values (
      v_user_id,
      v_item ->> 'entity',
      v_item ->> 'row_id',
      coalesce(v_item -> 'data', '{}'::jsonb),
      coalesce((v_item ->> 'updated_at')::timestamptz, now()),
      v_user_id,
      coalesce((v_item ->> 'deleted')::boolean, false)
    )
    on conflict (user_id, entity, row_id) do update
      set data = excluded.data,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by,
          deleted = excluded.deleted
      where public.user_rows.updated_at <= excluded.updated_at;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

-- Pull rows changed since a cursor. Returns server_now so clients use the
-- server clock instead of their own for the next pull.
create or replace function public.sync_pull_user(p_since timestamptz, p_limit integer default 1000)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_rows jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
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
  from public.user_rows r
  where r.user_id = v_user_id
    and r.updated_at > coalesce(p_since, timestamptz '1970-01-01 UTC')
  limit least(coalesce(p_limit, 1000), 5000);

  return jsonb_build_object('ok', true, 'rows', v_rows, 'server_now', now());
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Grants (Supabase roles)
-- ---------------------------------------------------------------------------
grant execute on function public.sync_push_user(jsonb) to authenticated;
grant execute on function public.sync_pull_user(timestamptz, integer) to authenticated;
