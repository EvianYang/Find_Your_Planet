-- Prefer questions that neither player has seen recently. At start, the game function asks for the
-- prompt ids of each member's last few started games (any partner, any room) and leaves them out of
-- the draw while enough other questions remain. Nothing here changes stored games.

create index if not exists participants_profile_recent_idx
  on public.participants (profile_id, joined_at desc);

create or replace function public.recent_prompt_ids(
  p_room_id uuid,
  p_game_limit integer default 5
)
returns table (prompt_id text)
language sql
stable
security definer
set search_path = ''
as $$
  with recent_rooms as (
    select
      other.room_id,
      row_number() over (partition by other.profile_id order by other.joined_at desc) as recency
    from public.participants as member
    join public.participants as other
      on other.profile_id = member.profile_id
    where member.room_id = p_room_id
      and other.room_id <> p_room_id
      -- Only games that actually started have prompts; rooms left in the lobby don't count.
      and exists (
        select 1
        from public.rounds as started
        where started.room_id = other.room_id
      )
  )
  select distinct played.prompt_json ->> 'id'
  from recent_rooms
  join public.rounds as played
    on played.room_id = recent_rooms.room_id
  where recent_rooms.recency <= least(greatest(p_game_limit, 0), 20);
$$;

revoke all on function public.recent_prompt_ids(uuid, integer) from public;
revoke all on function public.recent_prompt_ids(uuid, integer) from anon, authenticated;
grant execute on function public.recent_prompt_ids(uuid, integer) to service_role;

comment on function public.recent_prompt_ids(uuid, integer) is
  'Prompt ids from each member''s last started games, for avoiding repeats at start. Service role only.';
