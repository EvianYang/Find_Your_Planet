create or replace function public.claim_round_evaluation(
  p_profile_id uuid,
  p_room_id uuid,
  p_round_index integer,
  p_claim_token uuid
)
returns table (
  status text,
  claimed_round_id uuid,
  prompt_json jsonb,
  answer_a text,
  answer_b text,
  result_json jsonb,
  automatic_attempts integer,
  manual_retries integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_round public.rounds%rowtype;
  v_answer_a text;
  v_answer_b text;
begin
  select * into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found or not exists (
    select 1 from public.participants
    where room_id = p_room_id and profile_id = p_profile_id
  ) then
    return query select 'NOT_FOUND'::text, null::uuid, null::jsonb,
      null::text, null::text, null::jsonb, 0, 0;
    return;
  end if;

  if v_room.expires_at <= now() then
    return query select 'EXPIRED'::text, null::uuid, null::jsonb,
      null::text, null::text, null::jsonb, 0, 0;
    return;
  end if;

  select * into v_round
  from public.rounds
  where room_id = p_room_id and round_index = p_round_index
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, null::uuid, null::jsonb,
      null::text, null::text, null::jsonb, 0, 0;
    return;
  end if;

  if v_round.evaluation_state = 'ready' and v_round.result_json is not null then
    return query select 'READY'::text, v_round.id, v_round.prompt_json,
      null::text, null::text, v_round.result_json,
      v_round.automatic_attempts, v_round.manual_retries;
    return;
  end if;

  if v_room.phase <> 'evaluating' or v_room.current_round <> p_round_index then
    return query select 'INVALID_PHASE'::text, v_round.id, v_round.prompt_json,
      null::text, null::text, null::jsonb,
      v_round.automatic_attempts, v_round.manual_retries;
    return;
  end if;

  if v_round.evaluation_state = 'processing'
    and v_round.lease_until is not null
    and v_round.lease_until > now() then
    return query select 'PROCESSING'::text, v_round.id, v_round.prompt_json,
      null::text, null::text, null::jsonb,
      v_round.automatic_attempts, v_round.manual_retries;
    return;
  end if;

  select
    max(s.body) filter (where p.slot = 'A'),
    max(s.body) filter (where p.slot = 'B')
  into v_answer_a, v_answer_b
  from public.participants p
  left join public.submissions s
    on s.profile_id = p.profile_id and s.round_id = v_round.id
  where p.room_id = p_room_id;

  if v_answer_a is null or v_answer_b is null then
    return query select 'NOT_READY'::text, v_round.id, v_round.prompt_json,
      null::text, null::text, null::jsonb,
      v_round.automatic_attempts, v_round.manual_retries;
    return;
  end if;

  if v_round.evaluation_state = 'pending' then
    update public.rounds as target
    set evaluation_state = 'processing',
        claim_token = p_claim_token,
        lease_until = now() + interval '60 seconds',
        automatic_attempts = target.automatic_attempts + 1
    where target.id = v_round.id
    returning * into v_round;
  elsif v_round.evaluation_state = 'processing'
    and (v_round.lease_until is null or v_round.lease_until <= now())
    and v_round.automatic_attempts < 2 then
    update public.rounds as target
    set claim_token = p_claim_token,
        lease_until = now() + interval '60 seconds',
        automatic_attempts = target.automatic_attempts + 1
    where target.id = v_round.id
    returning * into v_round;
  elsif v_round.evaluation_state in ('failed', 'processing')
    and v_round.manual_retries < 2 then
    update public.rounds as target
    set evaluation_state = 'processing',
        claim_token = p_claim_token,
        lease_until = now() + interval '60 seconds',
        manual_retries = target.manual_retries + 1
    where target.id = v_round.id
    returning * into v_round;
  elsif v_round.evaluation_state in ('failed', 'processing') then
    return query select 'RETRY_EXHAUSTED'::text, v_round.id, v_round.prompt_json,
      null::text, null::text, null::jsonb,
      v_round.automatic_attempts, v_round.manual_retries;
    return;
  else
    return query select 'INVALID_PHASE'::text, v_round.id, v_round.prompt_json,
      null::text, null::text, null::jsonb,
      v_round.automatic_attempts, v_round.manual_retries;
    return;
  end if;

  update public.rooms
  set revision = revision + 1
  where id = p_room_id and phase = 'evaluating';

  return query select 'CLAIMED'::text, v_round.id, v_round.prompt_json,
    v_answer_a, v_answer_b, null::jsonb,
    v_round.automatic_attempts, v_round.manual_retries;
end;
$$;

revoke all on function public.claim_round_evaluation(uuid, uuid, integer, uuid) from public;
revoke all on function public.claim_round_evaluation(uuid, uuid, integer, uuid) from anon, authenticated;
grant execute on function public.claim_round_evaluation(uuid, uuid, integer, uuid) to service_role;

comment on function public.claim_round_evaluation(uuid, uuid, integer, uuid) is
  'Claims a 60-second evaluation lease and increments the room revision so members refresh processing state.';
