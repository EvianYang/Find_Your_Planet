-- Tasks 3.2 / 3.3: one bounded AI question-generation attempt per room while it waits in the lobby.
-- Candidates live in their own private table, not on rooms: rooms is in the Realtime publication,
-- and the candidate pool must never reach a browser. (The unused rooms.prompt_candidates_json and
-- rooms.prompt_generation_state columns from 202609260002 are left in place.)

create table public.room_prompt_pools (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  state text not null,
  lease_until timestamptz,
  candidates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_prompt_pools_state check (
    state in ('processing', 'ready', 'empty', 'failed', 'discarded')
  ),
  constraint room_prompt_pools_lease check ((state = 'processing') = (lease_until is not null)),
  constraint room_prompt_pools_candidates check (
    jsonb_typeof(candidates) = 'array'
    and jsonb_array_length(candidates) <= 2
    and ((state = 'ready') = (jsonb_array_length(candidates) > 0))
  )
);

alter table public.room_prompt_pools enable row level security;
alter table public.room_prompt_pools force row level security;
revoke all on table public.room_prompt_pools from public, anon, authenticated;

-- Claims the room's single generation attempt. Only rooms in the lobby qualify (otherwise
-- INVALID_PHASE). Returns CLAIMED only to the first caller; later calls read the existing state
-- (PROCESSING, READY, EMPTY, FAILED) and never call the model again. An attempt whose lease ran out
-- (the instance died) is ended as FAILED, not re-claimed.
create or replace function public.claim_prompt_generation(
  p_profile_id uuid,
  p_room_id uuid
)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_pool public.room_prompt_pools%rowtype;
begin
  -- Same lock as start_room and finish_prompt_generation.
  select *
  into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found or not exists (
    select 1
    from public.participants
    where room_id = p_room_id
      and profile_id = p_profile_id
  ) then
    return query select 'NOT_FOUND'::text;
    return;
  end if;

  if v_room.expires_at <= now() then
    return query select 'EXPIRED'::text;
    return;
  end if;

  if v_room.phase <> 'lobby' then
    return query select 'INVALID_PHASE'::text;
    return;
  end if;

  select *
  into v_pool
  from public.room_prompt_pools
  where room_id = p_room_id;

  if found then
    if v_pool.state = 'processing' and v_pool.lease_until <= now() then
      update public.room_prompt_pools
      set state = 'failed',
          lease_until = null,
          updated_at = now()
      where room_id = p_room_id;
      return query select 'FAILED'::text;
      return;
    end if;
    return query select upper(v_pool.state);
    return;
  end if;

  -- The model call has an 8-second limit; the lease leaves room for the request around it.
  insert into public.room_prompt_pools (room_id, state, lease_until)
  values (p_room_id, 'processing', now() + interval '30 seconds');

  return query select 'CLAIMED'::text;
end;
$$;

-- Writes back the attempt's outcome under the room lock. A result that arrives after the game
-- started, after the room expired, or after the lease ran out is discarded; it never changes the
-- started game's prompt snapshot. Returns READY, EMPTY, FAILED, DISCARDED or STALE.
create or replace function public.finish_prompt_generation(
  p_room_id uuid,
  p_state text,
  p_candidates jsonb
)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_pool public.room_prompt_pools%rowtype;
begin
  if p_state not in ('ready', 'empty', 'failed')
    or jsonb_typeof(p_candidates) <> 'array'
    or jsonb_array_length(p_candidates) > 2
    or ((p_state = 'ready') <> (jsonb_array_length(p_candidates) > 0)) then
    raise exception 'Invalid prompt generation result';
  end if;

  select *
  into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    return query select 'DISCARDED'::text;
    return;
  end if;

  select *
  into v_pool
  from public.room_prompt_pools
  where room_id = p_room_id
  for update;

  if not found or v_pool.state <> 'processing' then
    return query select 'STALE'::text;
    return;
  end if;

  if v_pool.lease_until <= now() then
    update public.room_prompt_pools
    set state = 'failed',
        lease_until = null,
        updated_at = now()
    where room_id = p_room_id;
    return query select 'STALE'::text;
    return;
  end if;

  if v_room.phase <> 'lobby' or v_room.expires_at <= now() then
    update public.room_prompt_pools
    set state = 'discarded',
        lease_until = null,
        updated_at = now()
    where room_id = p_room_id;
    return query select 'DISCARDED'::text;
    return;
  end if;

  update public.room_prompt_pools
  set state = p_state,
      candidates = p_candidates,
      lease_until = null,
      updated_at = now()
  where room_id = p_room_id;

  return query select upper(p_state);
end;
$$;

-- start_room gains p_pool_seen: the pool state the caller read before choosing prompts. Under the room
-- lock, if candidates became ready after that read, it returns POOL_CHANGED so the caller re-reads and
-- chooses again; a write-back that wins the lock is therefore always seen by the start. The default
-- null skips the check, so a game function deployed before this migration keeps working unchanged.
drop function if exists public.start_room(uuid, uuid, jsonb);

create or replace function public.start_room(
  p_profile_id uuid,
  p_room_id uuid,
  p_prompts jsonb,
  p_pool_seen text default null
)
returns table (status text, started_room_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_participant_count integer;
  v_round_count integer;
  v_unique_prompt_count integer;
  v_pool_state text;
begin
  select *
  into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, null::uuid;
    return;
  end if;

  if not exists (
    select 1
    from public.participants
    where room_id = p_room_id
      and profile_id = p_profile_id
  ) then
    return query select 'NOT_FOUND'::text, null::uuid;
    return;
  end if;

  if v_room.host_profile_id <> p_profile_id then
    return query select 'UNAUTHORIZED'::text, p_room_id;
    return;
  end if;

  select count(*)
  into v_round_count
  from public.rounds
  where room_id = p_room_id;

  if v_room.phase = 'answering'
    and v_room.current_round = 1
    and v_round_count = 3 then
    return query select 'STARTED'::text, p_room_id;
    return;
  end if;

  if v_room.expires_at <= now() then
    return query select 'EXPIRED'::text, p_room_id;
    return;
  end if;

  if v_room.phase <> 'lobby' then
    return query select 'INVALID_PHASE'::text, p_room_id;
    return;
  end if;

  select count(*)
  into v_participant_count
  from public.participants
  where room_id = p_room_id;

  if v_participant_count <> 2 then
    return query select 'NOT_READY'::text, p_room_id;
    return;
  end if;

  if p_pool_seen is not null then
    select state
    into v_pool_state
    from public.room_prompt_pools
    where room_id = p_room_id;

    if v_pool_state = 'ready' and p_pool_seen <> 'ready' then
      return query select 'POOL_CHANGED'::text, p_room_id;
      return;
    end if;
  end if;

  if jsonb_typeof(p_prompts) <> 'array' or jsonb_array_length(p_prompts) <> 3 then
    return query select 'INVALID_PROMPTS'::text, p_room_id;
    return;
  end if;

  select count(distinct prompt.value ->> 'id')
  into v_unique_prompt_count
  from jsonb_array_elements(p_prompts) as prompt(value);

  if v_unique_prompt_count <> 3 then
    return query select 'INVALID_PROMPTS'::text, p_room_id;
    return;
  end if;

  insert into public.rounds (room_id, round_index, prompt_json)
  select p_room_id, prompt.ordinality::integer, prompt.value
  from jsonb_array_elements(p_prompts) with ordinality as prompt(value, ordinality);

  update public.rooms
  set phase = 'answering',
      current_round = 1,
      revision = revision + 1
  where id = p_room_id;

  return query select 'STARTED'::text, p_room_id;
end;
$$;

revoke all on function public.start_room(uuid, uuid, jsonb, text) from public;
revoke all on function public.start_room(uuid, uuid, jsonb, text) from anon, authenticated;
grant execute on function public.start_room(uuid, uuid, jsonb, text) to service_role;

revoke all on function public.claim_prompt_generation(uuid, uuid) from public;
revoke all on function public.claim_prompt_generation(uuid, uuid) from anon, authenticated;
grant execute on function public.claim_prompt_generation(uuid, uuid) to service_role;

revoke all on function public.finish_prompt_generation(uuid, text, jsonb) from public;
revoke all on function public.finish_prompt_generation(uuid, text, jsonb) from anon, authenticated;
grant execute on function public.finish_prompt_generation(uuid, text, jsonb) to service_role;

comment on table public.room_prompt_pools is
  'Private per-room AI question candidates (0-2) and the state of the single generation attempt.';
comment on function public.claim_prompt_generation(uuid, uuid) is
  'Claims the room''s one generation attempt for a member in the lobby, or returns its existing state.';
comment on function public.finish_prompt_generation(uuid, text, jsonb) is
  'Saves generated candidates under the room lock, or discards them once the game has started.';
