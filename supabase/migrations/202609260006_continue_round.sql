create or replace function public.continue_round(
  p_profile_id uuid,
  p_room_id uuid,
  p_round_index integer
)
returns table (status text, continued_room_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_round public.rounds%rowtype;
  v_slot text;
  v_continued_a boolean;
  v_continued_b boolean;
begin
  select * into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, null::uuid;
    return;
  end if;

  select slot into v_slot
  from public.participants
  where room_id = p_room_id and profile_id = p_profile_id;

  if not found then
    return query select 'NOT_FOUND'::text, null::uuid;
    return;
  end if;

  if v_room.expires_at <= now() then
    return query select 'EXPIRED'::text, p_room_id;
    return;
  end if;

  select * into v_round
  from public.rounds
  where room_id = p_room_id and round_index = p_round_index
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, p_room_id;
    return;
  end if;

  if v_room.current_round > p_round_index
    or (v_room.phase = 'finished' and p_round_index = 3) then
    return query select 'CONTINUED'::text, p_room_id;
    return;
  end if;

  if v_room.phase <> 'reveal'
    or v_room.current_round <> p_round_index
    or v_round.evaluation_state <> 'ready'
    or v_round.result_json is null then
    return query select 'INVALID_PHASE'::text, p_room_id;
    return;
  end if;

  if (v_slot = 'A' and v_round.continued_a)
    or (v_slot = 'B' and v_round.continued_b) then
    return query select 'CONTINUED'::text, p_room_id;
    return;
  end if;

  update public.rounds
  set continued_a = case when v_slot = 'A' then true else continued_a end,
      continued_b = case when v_slot = 'B' then true else continued_b end
  where id = v_round.id
  returning continued_a, continued_b into v_continued_a, v_continued_b;

  if v_continued_a and v_continued_b then
    update public.rooms
    set phase = case when p_round_index = 3 then 'finished' else 'answering' end,
        current_round = case when p_round_index = 3 then 3 else p_round_index + 1 end,
        revision = revision + 1
    where id = p_room_id;
  else
    update public.rooms
    set revision = revision + 1
    where id = p_room_id;
  end if;

  return query select 'CONTINUED'::text, p_room_id;
end;
$$;

revoke all on function public.continue_round(uuid, uuid, integer) from public;
revoke all on function public.continue_round(uuid, uuid, integer) from anon, authenticated;
grant execute on function public.continue_round(uuid, uuid, integer) to service_role;

comment on function public.continue_round(uuid, uuid, integer) is
  'Records one member continuation idempotently and advances only after both members continue.';
