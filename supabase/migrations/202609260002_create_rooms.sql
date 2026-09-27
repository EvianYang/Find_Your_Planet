create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  join_code text not null unique,
  host_profile_id uuid not null references public.profiles (id),
  phase text not null default 'lobby',
  current_round integer not null default 0,
  revision bigint not null default 0,
  prompt_candidates_json jsonb,
  prompt_generation_state text not null default 'idle',
  create_request_id uuid not null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  constraint rooms_join_code_format check (join_code ~ '^[A-Z2-9]{8}$'),
  constraint rooms_phase check (
    phase in ('lobby', 'answering', 'evaluating', 'reveal', 'finished')
  ),
  constraint rooms_current_round check (current_round between 0 and 3),
  constraint rooms_revision_nonnegative check (revision >= 0),
  constraint rooms_prompt_generation_state check (
    prompt_generation_state in ('idle', 'processing', 'ready', 'failed')
  ),
  constraint rooms_expiry_after_creation check (expires_at > created_at),
  unique (host_profile_id, create_request_id)
);

create table public.participants (
  room_id uuid not null references public.rooms (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  slot text not null,
  nickname_snapshot text not null,
  joined_at timestamptz not null default now(),
  primary key (room_id, profile_id),
  unique (room_id, slot),
  constraint participants_slot check (slot in ('A', 'B')),
  constraint participants_nickname_length check (
    char_length(btrim(nickname_snapshot)) between 1 and 20
  ),
  constraint participants_nickname_trimmed check (
    nickname_snapshot = btrim(nickname_snapshot)
  )
);

alter table public.rooms enable row level security;
alter table public.rooms force row level security;
alter table public.participants enable row level security;
alter table public.participants force row level security;

revoke all on table public.rooms from public, anon, authenticated;
revoke all on table public.participants from public, anon, authenticated;

create or replace function public.create_room(
  p_profile_id uuid,
  p_request_id uuid,
  p_join_code text
)
returns table (room_id uuid, join_code text, slot text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_nickname text;
begin
  select nickname
  into v_nickname
  from public.profiles
  where id = p_profile_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'IDENTITY_NOT_FOUND';
  end if;

  select *
  into v_room
  from public.rooms
  where host_profile_id = p_profile_id
    and create_request_id = p_request_id;

  if found then
    return query select v_room.id, v_room.join_code, 'A'::text;
    return;
  end if;

  begin
    insert into public.rooms (
      join_code,
      host_profile_id,
      create_request_id
    )
    values (p_join_code, p_profile_id, p_request_id)
    returning * into v_room;

    insert into public.participants (
      room_id,
      profile_id,
      slot,
      nickname_snapshot
    )
    values (v_room.id, p_profile_id, 'A', v_nickname);
  exception
    when unique_violation then
      select *
      into v_room
      from public.rooms
      where host_profile_id = p_profile_id
        and create_request_id = p_request_id;

      if not found then
        raise;
      end if;
  end;

  return query select v_room.id, v_room.join_code, 'A'::text;
end;
$$;

create or replace function public.join_room(
  p_profile_id uuid,
  p_join_code text
)
returns table (status text, room_id uuid, slot text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_nickname text;
  v_existing_slot text;
  v_participant_count integer;
begin
  select nickname
  into v_nickname
  from public.profiles
  where id = p_profile_id;

  if not found then
    return query select 'IDENTITY_NOT_FOUND'::text, null::uuid, null::text;
    return;
  end if;

  select *
  into v_room
  from public.rooms
  where join_code = p_join_code
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, null::uuid, null::text;
    return;
  end if;

  select participants.slot
  into v_existing_slot
  from public.participants
  where participants.room_id = v_room.id
    and participants.profile_id = p_profile_id;

  if found then
    return query select 'JOINED'::text, v_room.id, v_existing_slot;
    return;
  end if;

  if v_room.expires_at <= now() then
    return query select 'EXPIRED'::text, v_room.id, null::text;
    return;
  end if;

  if v_room.phase <> 'lobby' then
    return query select 'INVALID_PHASE'::text, v_room.id, null::text;
    return;
  end if;

  select count(*)
  into v_participant_count
  from public.participants
  where participants.room_id = v_room.id;

  if v_participant_count >= 2 then
    return query select 'ROOM_FULL'::text, v_room.id, null::text;
    return;
  end if;

  insert into public.participants (
    room_id,
    profile_id,
    slot,
    nickname_snapshot
  )
  values (v_room.id, p_profile_id, 'B', v_nickname);

  update public.rooms
  set revision = revision + 1
  where id = v_room.id;

  return query select 'JOINED'::text, v_room.id, 'B'::text;
end;
$$;

revoke all on function public.create_room(uuid, uuid, text) from public;
revoke all on function public.create_room(uuid, uuid, text) from anon, authenticated;
grant execute on function public.create_room(uuid, uuid, text) to service_role;

revoke all on function public.join_room(uuid, text) from public;
revoke all on function public.join_room(uuid, text) from anon, authenticated;
grant execute on function public.join_room(uuid, text) to service_role;

comment on table public.rooms is
  'Temporary two-player game rooms. Private fields are accessed through Edge Functions.';
comment on table public.participants is
  'Stable profile membership and fixed A/B slot assignment for each room.';
