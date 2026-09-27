create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  active_auth_user_id uuid not null unique references auth.users (id),
  recovery_hash text not null unique,
  credential_version integer not null default 1,
  created_at timestamptz not null default now(),
  constraint profiles_nickname_length
    check (char_length(btrim(nickname)) between 1 and 20),
  constraint profiles_nickname_trimmed
    check (nickname = btrim(nickname)),
  constraint profiles_credential_version_positive
    check (credential_version > 0),
  constraint profiles_recovery_hash_format
    check (recovery_hash ~ '^[0-9a-f]{64}$')
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on table public.profiles from public, anon, authenticated;

comment on table public.profiles is
  'Stable application profiles. Browser access is denied; identity Edge Functions mediate access.';
comment on column public.profiles.recovery_hash is
  'SHA-256 of the normalized high-entropy recovery code; plaintext is never stored.';
