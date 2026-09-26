create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  round_index integer not null,
  prompt_json jsonb not null,
  result_json jsonb,
  evaluation_state text not null default 'idle',
  claim_token uuid,
  lease_until timestamptz,
  automatic_attempts integer not null default 0,
  manual_retries integer not null default 0,
  continued_a boolean not null default false,
  continued_b boolean not null default false,
  created_at timestamptz not null default now(),
  unique (room_id, round_index),
  constraint rounds_index check (round_index between 1 and 3),
  constraint rounds_prompt_object check (jsonb_typeof(prompt_json) = 'object'),
  constraint rounds_result_object check (
    result_json is null or jsonb_typeof(result_json) = 'object'
  ),
  constraint rounds_evaluation_state check (
    evaluation_state in ('idle', 'pending', 'processing', 'ready', 'failed')
  ),
  constraint rounds_attempts_nonnegative check (
    automatic_attempts >= 0 and manual_retries >= 0
  )
);

alter table public.rounds enable row level security;
alter table public.rounds force row level security;
revoke all on table public.rounds from public, anon, authenticated;

create or replace function public.start_room(
  p_profile_id uuid,
  p_room_id uuid,
  p_prompts jsonb
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

revoke all on function public.start_room(uuid, uuid, jsonb) from public;
revoke all on function public.start_room(uuid, uuid, jsonb) from anon, authenticated;
grant execute on function public.start_room(uuid, uuid, jsonb) to service_role;

comment on table public.rounds is
  'Three immutable prompt snapshots and per-round game state for a started room.';
