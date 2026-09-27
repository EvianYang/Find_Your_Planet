create table public.identity_request_results (
  auth_user_id uuid not null,
  request_id uuid not null,
  action text not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (auth_user_id, request_id, action),
  constraint identity_request_action check (action in ('recover', 'rotate_recovery'))
);

create table public.identity_recovery_failures (
  id bigint generated always as identity primary key,
  auth_user_id uuid not null,
  source_hash text not null,
  failed_at timestamptz not null default now(),
  constraint identity_recovery_source_hash check (source_hash ~ '^[0-9a-f]{64}$')
);

create index identity_recovery_failures_auth_recent
  on public.identity_recovery_failures (auth_user_id, failed_at desc);
create index identity_recovery_failures_source_recent
  on public.identity_recovery_failures (source_hash, failed_at desc);

alter table public.identity_request_results enable row level security;
alter table public.identity_request_results force row level security;
alter table public.identity_recovery_failures enable row level security;
alter table public.identity_recovery_failures force row level security;
revoke all on table public.identity_request_results from public, anon, authenticated;
revoke all on table public.identity_recovery_failures from public, anon, authenticated;

create or replace function public.recover_profile(
  p_auth_user_id uuid,
  p_recovery_hash text,
  p_new_recovery_hash text,
  p_request_id uuid,
  p_source_hash text
)
returns table (
  status text,
  profile_id uuid,
  nickname text,
  credential_version integer,
  created_at timestamptz,
  recovery_changed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles%rowtype;
  v_existing public.profiles%rowtype;
  v_completed_profile_id uuid;
  v_auth_failures integer;
  v_source_failures integer;
  v_auth_lock text := 'auth:' || p_auth_user_id::text;
  v_source_lock text := 'source:' || p_source_hash;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(least(v_auth_lock, v_source_lock), 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(greatest(v_auth_lock, v_source_lock), 0)
  );

  delete from public.identity_recovery_failures
  where failed_at < now() - interval '15 minutes';

  select request.profile_id into v_completed_profile_id
  from public.identity_request_results request
  where request.auth_user_id = p_auth_user_id
    and request.request_id = p_request_id
    and request.action = 'recover';

  if found then
    select * into v_target
    from public.profiles
    where id = v_completed_profile_id
      and active_auth_user_id = p_auth_user_id;
    if found then
      return query select 'RECOVERED_REPLAY'::text, v_target.id,
        v_target.nickname, v_target.credential_version, v_target.created_at, false;
    else
      return query select 'RECOVERY_FAILED'::text, null::uuid,
        null::text, null::integer, null::timestamptz, false;
    end if;
    return;
  end if;

  select count(*) into v_auth_failures
  from public.identity_recovery_failures
  where auth_user_id = p_auth_user_id
    and failed_at >= now() - interval '15 minutes';
  select count(*) into v_source_failures
  from public.identity_recovery_failures
  where source_hash = p_source_hash
    and failed_at >= now() - interval '15 minutes';

  if v_auth_failures >= 5 or v_source_failures >= 5 then
    return query select 'RATE_LIMITED'::text, null::uuid,
      null::text, null::integer, null::timestamptz, false;
    return;
  end if;

  select * into v_target
  from public.profiles
  where recovery_hash = p_recovery_hash
  for update;

  if not found then
    insert into public.identity_recovery_failures (auth_user_id, source_hash)
    values (p_auth_user_id, p_source_hash);
    return query select 'RECOVERY_FAILED'::text, null::uuid,
      null::text, null::integer, null::timestamptz, false;
    return;
  end if;

  if v_target.active_auth_user_id = p_auth_user_id then
    insert into public.identity_request_results (
      auth_user_id, request_id, action, profile_id
    ) values (p_auth_user_id, p_request_id, 'recover', v_target.id);
    return query select 'RECOVERED_REPLAY'::text, v_target.id,
      v_target.nickname, v_target.credential_version, v_target.created_at, false;
    return;
  end if;

  select * into v_existing
  from public.profiles
  where active_auth_user_id = p_auth_user_id
  for update;

  if found then
    if exists (
      select 1
      from public.participants participant
      where participant.profile_id = v_existing.id
    ) then
      return query select 'RECOVERY_TARGET_NOT_EMPTY'::text, null::uuid,
        null::text, null::integer, null::timestamptz, false;
      return;
    end if;
    delete from public.profiles where id = v_existing.id;
  end if;

  update public.profiles as target
  set active_auth_user_id = p_auth_user_id,
      recovery_hash = p_new_recovery_hash,
      credential_version = target.credential_version + 1
  where target.id = v_target.id
  returning target.* into v_target;

  insert into public.identity_request_results (
    auth_user_id, request_id, action, profile_id
  ) values (p_auth_user_id, p_request_id, 'recover', v_target.id);

  return query select 'RECOVERED'::text, v_target.id,
    v_target.nickname, v_target.credential_version, v_target.created_at, true;
end;
$$;

create or replace function public.rotate_profile_recovery(
  p_profile_id uuid,
  p_auth_user_id uuid,
  p_new_recovery_hash text,
  p_request_id uuid
)
returns table (
  status text,
  profile_id uuid,
  nickname text,
  credential_version integer,
  created_at timestamptz,
  recovery_changed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_completed_profile_id uuid;
begin
  select request.profile_id into v_completed_profile_id
  from public.identity_request_results request
  where request.auth_user_id = p_auth_user_id
    and request.request_id = p_request_id
    and request.action = 'rotate_recovery';

  if found then
    select * into v_profile
    from public.profiles
    where id = v_completed_profile_id
      and active_auth_user_id = p_auth_user_id;
    if found then
      return query select 'ROTATED_REPLAY'::text, v_profile.id,
        v_profile.nickname, v_profile.credential_version, v_profile.created_at, false;
      return;
    end if;
    return query select 'IDENTITY_REPLACED'::text, null::uuid,
      null::text, null::integer, null::timestamptz, false;
    return;
  end if;

  select * into v_profile
  from public.profiles
  where id = p_profile_id
    and active_auth_user_id = p_auth_user_id
  for update;

  if not found then
    return query select 'IDENTITY_REPLACED'::text, null::uuid,
      null::text, null::integer, null::timestamptz, false;
    return;
  end if;

  update public.profiles as target
  set recovery_hash = p_new_recovery_hash,
      credential_version = target.credential_version + 1
  where target.id = v_profile.id
  returning target.* into v_profile;

  insert into public.identity_request_results (
    auth_user_id, request_id, action, profile_id
  ) values (p_auth_user_id, p_request_id, 'rotate_recovery', v_profile.id);

  return query select 'ROTATED'::text, v_profile.id,
    v_profile.nickname, v_profile.credential_version, v_profile.created_at, true;
end;
$$;

revoke all on function public.recover_profile(uuid, text, text, uuid, text) from public;
revoke all on function public.recover_profile(uuid, text, text, uuid, text) from anon, authenticated;
grant execute on function public.recover_profile(uuid, text, text, uuid, text) to service_role;

revoke all on function public.rotate_profile_recovery(uuid, uuid, text, uuid) from public;
revoke all on function public.rotate_profile_recovery(uuid, uuid, text, uuid) from anon, authenticated;
grant execute on function public.rotate_profile_recovery(uuid, uuid, text, uuid) to service_role;

comment on table public.identity_recovery_failures is
  'Short-lived recovery failure counters. Source identifiers are stored only as SHA-256 digests.';
comment on function public.recover_profile(uuid, text, text, uuid, text) is
  'Atomically rebinds a profile, rotates its recovery code and invalidates the previous auth binding.';
