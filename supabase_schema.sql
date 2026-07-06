-- 같이집중: Supabase 보안 스키마
-- 새 Supabase 프로젝트의 SQL Editor에서 실행하세요.
-- Dashboard > Authentication > Providers에서 Anonymous Sign-Ins도 활성화해야 합니다.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-F0-9]{6}$'),
  name text not null check (char_length(name) between 1 and 40),
  host_id uuid not null references auth.users(id) on delete cascade,
  is_locked boolean not null default false,
  phase text not null default 'lobby' check (phase in ('lobby', 'focus', 'break')),
  focus_seconds integer not null default 1500 check (focus_seconds between 10 and 7200),
  break_seconds integer not null default 300 check (break_seconds between 10 and 3600),
  timer_end_at timestamptz,
  cycle_count integer not null default 0 check (cycle_count >= 0),
  participant_count integer not null default 1 check (participant_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists private.room_secrets (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  pin_hash text not null
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 16),
  task text not null default '' check (char_length(task) <= 80),
  is_ready boolean not null default false,
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 16),
  content text not null check (char_length(content) between 1 and 300),
  created_at timestamptz not null default now()
);

create table if not exists private.rate_limits (
  user_id uuid not null,
  action text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1,
  primary key (user_id, action)
);

create index if not exists rooms_public_created_idx
  on public.rooms(created_at desc) where is_locked = false;
create index if not exists participants_room_id_idx on public.participants(room_id);
create index if not exists messages_room_created_idx on public.messages(room_id, created_at);

alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.messages enable row level security;
alter table public.rooms force row level security;
alter table public.participants force row level security;
alter table public.messages force row level security;

create or replace function public.is_focus_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participants
    where room_id = p_room_id
      and user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_focus_room_member(uuid) from public;
grant execute on function public.is_focus_room_member(uuid) to authenticated;

drop policy if exists "public rooms or joined locked rooms are readable" on public.rooms;
create policy "public rooms or joined locked rooms are readable"
  on public.rooms for select
  to authenticated
  using (is_locked = false or (select public.is_focus_room_member(id)));

drop policy if exists "room members can read participants" on public.participants;
create policy "room members can read participants"
  on public.participants for select
  to authenticated
  using ((select public.is_focus_room_member(room_id)));

drop policy if exists "room members can read messages" on public.messages;
create policy "room members can read messages"
  on public.messages for select
  to authenticated
  using ((select public.is_focus_room_member(room_id)));

revoke all on public.rooms, public.participants, public.messages from anon;
revoke insert, update, delete on public.rooms, public.participants, public.messages from authenticated;
grant select on public.rooms, public.participants, public.messages to authenticated;

create or replace function private.enforce_rate_limit(
  p_user_id uuid,
  p_action text,
  p_max_requests integer,
  p_window interval
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into private.rate_limits (user_id, action, window_started_at, request_count)
  values (p_user_id, p_action, now(), 1)
  on conflict (user_id, action) do update
  set request_count = case
        when private.rate_limits.window_started_at < now() - p_window then 1
        else private.rate_limits.request_count + 1
      end,
      window_started_at = case
        when private.rate_limits.window_started_at < now() - p_window then now()
        else private.rate_limits.window_started_at
      end
  returning request_count into v_count;

  if v_count > p_max_requests then
    raise exception using errcode = 'P0001', message = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  end if;
end;
$$;

create or replace function public.create_focus_room(
  p_name text,
  p_pin text,
  p_focus_seconds integer,
  p_break_seconds integer,
  p_nickname text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_room_id uuid;
  v_code text;
begin
  if v_user_id is null then raise exception '인증이 필요합니다.'; end if;
  perform private.enforce_rate_limit(v_user_id, 'create_room', 5, interval '1 hour');

  if char_length(trim(coalesce(p_name, ''))) not between 1 and 40
    or char_length(trim(coalesce(p_nickname, ''))) not between 1 and 16 then
    raise exception '입력값이 올바르지 않습니다.';
  end if;
  if p_pin is not null and p_pin !~ '^[0-9]{4}$' then
    raise exception '입력값이 올바르지 않습니다.';
  end if;
  if p_focus_seconds not between 10 and 7200 or p_break_seconds not between 10 and 3600 then
    raise exception '입력값이 올바르지 않습니다.';
  end if;

  loop
    v_code := upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 6));
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;

  insert into public.rooms (
    code, name, host_id, is_locked, focus_seconds, break_seconds, participant_count
  ) values (
    v_code, trim(p_name), v_user_id, p_pin is not null,
    p_focus_seconds, p_break_seconds, 1
  ) returning id into v_room_id;

  if p_pin is not null then
    insert into private.room_secrets (room_id, pin_hash)
    values (v_room_id, crypt(p_pin, gen_salt('bf')));
  end if;

  insert into public.participants (room_id, user_id, nickname, is_host)
  values (v_room_id, v_user_id, trim(p_nickname), true);

  return v_room_id;
end;
$$;

create or replace function public.join_focus_room(
  p_code text,
  p_pin text,
  p_nickname text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_room public.rooms%rowtype;
  v_pin_hash text;
  v_is_new boolean;
begin
  if v_user_id is null then raise exception '인증이 필요합니다.'; end if;
  perform private.enforce_rate_limit(v_user_id, 'join_room', 30, interval '10 minutes');

  if upper(trim(coalesce(p_code, ''))) !~ '^[A-F0-9]{6}$'
    or char_length(trim(coalesce(p_nickname, ''))) not between 1 and 16 then
    raise exception '방 코드 또는 PIN을 확인해주세요.';
  end if;

  select * into v_room
  from public.rooms
  where code = upper(trim(p_code));

  if not found then raise exception '방 코드 또는 PIN을 확인해주세요.'; end if;

  if v_room.is_locked then
    select pin_hash into v_pin_hash
    from private.room_secrets
    where room_id = v_room.id;
    if p_pin is null or crypt(p_pin, v_pin_hash) <> v_pin_hash then
      raise exception '방 코드 또는 PIN을 확인해주세요.';
    end if;
  end if;

  v_is_new := not exists (
    select 1 from public.participants
    where room_id = v_room.id and user_id = v_user_id
  );

  insert into public.participants (room_id, user_id, nickname)
  values (v_room.id, v_user_id, trim(p_nickname))
  on conflict (room_id, user_id)
  do update set nickname = excluded.nickname;

  if v_is_new then
    update public.rooms
    set participant_count = participant_count + 1
    where id = v_room.id;
  end if;

  return v_room.id;
end;
$$;

create or replace function public.update_focus_participant(
  p_room_id uuid,
  p_task text default null,
  p_is_ready boolean default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception '인증이 필요합니다.'; end if;
  perform private.enforce_rate_limit(v_user_id, 'update_participant', 120, interval '1 minute');
  if p_task is not null and char_length(p_task) > 80 then
    raise exception '입력값이 올바르지 않습니다.';
  end if;

  update public.participants
  set task = coalesce(p_task, task),
      is_ready = coalesce(p_is_ready, is_ready)
  where room_id = p_room_id and user_id = v_user_id;

  if not found then raise exception '권한이 없습니다.'; end if;
end;
$$;

create or replace function public.start_focus_session(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_room public.rooms%rowtype;
begin
  if v_user_id is null then raise exception '인증이 필요합니다.'; end if;
  perform private.enforce_rate_limit(v_user_id, 'timer_control', 20, interval '1 minute');

  select * into v_room
  from public.rooms
  where id = p_room_id and host_id = v_user_id
  for update;
  if not found then raise exception '권한이 없습니다.'; end if;

  if exists (
    select 1 from public.participants
    where room_id = p_room_id and not is_ready
  ) then
    raise exception '아직 준비하지 않은 참가자가 있습니다.';
  end if;

  update public.rooms
  set phase = 'focus',
      cycle_count = cycle_count + 1,
      timer_end_at = now() + make_interval(secs => focus_seconds)
  where id = p_room_id;
end;
$$;

create or replace function public.advance_focus_phase(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_room public.rooms%rowtype;
begin
  if v_user_id is null then raise exception '인증이 필요합니다.'; end if;
  perform private.enforce_rate_limit(v_user_id, 'timer_control', 20, interval '1 minute');

  select * into v_room
  from public.rooms
  where id = p_room_id and host_id = v_user_id
  for update;
  if not found then raise exception '권한이 없습니다.'; end if;

  if v_room.phase = 'focus' then
    update public.rooms
    set phase = 'break',
        timer_end_at = now() + make_interval(secs => break_seconds)
    where id = p_room_id;
  else
    update public.rooms set phase = 'lobby', timer_end_at = null where id = p_room_id;
    update public.participants set is_ready = false where room_id = p_room_id;
  end if;
end;
$$;

create or replace function public.send_focus_message(
  p_room_id uuid,
  p_content text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_nickname text;
  v_message_id uuid;
begin
  if v_user_id is null then raise exception '인증이 필요합니다.'; end if;
  perform private.enforce_rate_limit(v_user_id, 'send_message', 20, interval '1 minute');
  if char_length(trim(coalesce(p_content, ''))) not between 1 and 300 then
    raise exception '입력값이 올바르지 않습니다.';
  end if;

  select participants.nickname into v_nickname
  from public.participants
  join public.rooms on rooms.id = participants.room_id
  where participants.room_id = p_room_id
    and participants.user_id = v_user_id
    and rooms.phase = 'break';

  if not found then raise exception '권한이 없습니다.'; end if;

  insert into public.messages (room_id, user_id, nickname, content)
  values (p_room_id, v_user_id, v_nickname, trim(p_content))
  returning id into v_message_id;
  return v_message_id;
end;
$$;

create or replace function public.leave_focus_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_was_host boolean;
  v_next_user_id uuid;
begin
  if v_user_id is null then raise exception '인증이 필요합니다.'; end if;
  perform private.enforce_rate_limit(v_user_id, 'leave_room', 30, interval '1 minute');

  delete from public.participants
  where room_id = p_room_id and user_id = v_user_id
  returning is_host into v_was_host;
  if not found then return; end if;

  if not exists (select 1 from public.participants where room_id = p_room_id) then
    delete from public.rooms where id = p_room_id;
  else
    update public.rooms
    set participant_count = greatest(0, participant_count - 1)
    where id = p_room_id;

    if v_was_host then
      select user_id into v_next_user_id
      from public.participants
      where room_id = p_room_id
      order by joined_at
      limit 1;

      update public.participants
      set is_host = (user_id = v_next_user_id)
      where room_id = p_room_id;
      update public.rooms set host_id = v_next_user_id where id = p_room_id;
    end if;
  end if;
end;
$$;

revoke all on function public.create_focus_room(text, text, integer, integer, text) from public;
revoke all on function public.join_focus_room(text, text, text) from public;
revoke all on function public.update_focus_participant(uuid, text, boolean) from public;
revoke all on function public.start_focus_session(uuid) from public;
revoke all on function public.advance_focus_phase(uuid) from public;
revoke all on function public.send_focus_message(uuid, text) from public;
revoke all on function public.leave_focus_room(uuid) from public;

grant execute on function public.create_focus_room(text, text, integer, integer, text) to authenticated;
grant execute on function public.join_focus_room(text, text, text) to authenticated;
grant execute on function public.update_focus_participant(uuid, text, boolean) to authenticated;
grant execute on function public.start_focus_session(uuid) to authenticated;
grant execute on function public.advance_focus_phase(uuid) to authenticated;
grant execute on function public.send_focus_message(uuid, text) to authenticated;
grant execute on function public.leave_focus_room(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.participants;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
