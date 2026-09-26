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

revoke all on function public.rotate_profile_recovery(uuid, uuid, text, uuid) from public;
revoke all on function public.rotate_profile_recovery(uuid, uuid, text, uuid) from anon, authenticated;
grant execute on function public.rotate_profile_recovery(uuid, uuid, text, uuid) to service_role;

comment on function public.rotate_profile_recovery(uuid, uuid, text, uuid) is
  'Rotates the recovery credential once per request ID and safely replays the current identity.';
