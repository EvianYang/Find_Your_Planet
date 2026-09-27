create table public.submissions (
  round_id uuid not null references public.rounds (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now(),
  primary key (round_id, profile_id),
  constraint submissions_body_length check (
    char_length(body) between 1 and 300
  ),
  constraint submissions_body_trimmed check (body = btrim(body))
);

alter table public.submissions enable row level security;
alter table public.submissions force row level security;
revoke all on table public.submissions from public, anon, authenticated;

create or replace function public.reject_submission_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'SUBMISSION_IMMUTABLE';
end;
$$;

create trigger submissions_are_immutable
before update on public.submissions
for each row execute function public.reject_submission_update();

revoke all on function public.reject_submission_update() from public;

create or replace function public.submit_answer(
  p_profile_id uuid,
  p_room_id uuid,
  p_round_index integer,
  p_answer text
)
returns table (status text, submitted_room_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_round public.rounds%rowtype;
  v_existing_body text;
  v_submission_count integer;
begin
  select * into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, null::uuid;
    return;
  end if;

  if not exists (
    select 1 from public.participants
    where room_id = p_room_id and profile_id = p_profile_id
  ) then
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

  select body into v_existing_body
  from public.submissions
  where round_id = v_round.id and profile_id = p_profile_id;

  if found then
    if v_existing_body = p_answer then
      return query select 'SUBMITTED'::text, p_room_id;
    else
      return query select 'CONFLICT'::text, p_room_id;
    end if;
    return;
  end if;

  if v_room.phase <> 'answering' or v_room.current_round <> p_round_index then
    return query select 'INVALID_PHASE'::text, p_room_id;
    return;
  end if;

  insert into public.submissions (round_id, profile_id, body)
  values (v_round.id, p_profile_id, p_answer);

  select count(*) into v_submission_count
  from public.submissions
  where round_id = v_round.id;

  update public.rooms
  set phase = case when v_submission_count = 2 then 'evaluating' else phase end,
      revision = revision + 1
  where id = p_room_id;

  if v_submission_count = 2 then
    update public.rounds
    set evaluation_state = 'pending'
    where id = v_round.id;
  end if;

  return query select 'SUBMITTED'::text, p_room_id;
end;
$$;

revoke all on function public.submit_answer(uuid, uuid, integer, text) from public;
revoke all on function public.submit_answer(uuid, uuid, integer, text) from anon, authenticated;
grant execute on function public.submit_answer(uuid, uuid, integer, text) to service_role;

create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participants
    join public.profiles on profiles.id = participants.profile_id
    where participants.room_id = p_room_id
      and profiles.active_auth_user_id = auth.uid()
  );
$$;

revoke all on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_member(uuid) to authenticated;

create policy rooms_member_read
on public.rooms
for select
to authenticated
using (public.is_room_member(id));

grant select (id, phase, current_round, revision, expires_at)
on public.rooms to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end;
$$;

comment on table public.submissions is
  'Immutable answers. Browser roles have no direct read or write access.';
