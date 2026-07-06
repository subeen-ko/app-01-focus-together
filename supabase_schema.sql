-- 같이집중 MVP용 Supabase 스키마
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행하세요.

create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) = 6),
  name text not null check (char_length(name) between 1 and 40),
  host_id text not null,
  is_locked boolean not null default false,
  phase text not null default 'lobby' check (phase in ('lobby', 'focus', 'break')),
  focus_seconds integer not null default 1500 check (focus_seconds between 10 and 7200),
  break_seconds integer not null default 300 check (break_seconds between 10 and 3600),
  timer_end_at timestamptz,
  cycle_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- PIN 해시는 공개 room 조회 결과와 분리합니다.
create table if not exists public.room_secrets (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  pin_hash text not null
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id text not null,
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
  user_id text not null,
  nickname text not null,
  content text not null check (char_length(content) between 1 and 300),
  created_at timestamptz not null default now()
);

create index if not exists participants_room_id_idx on public.participants(room_id);
create index if not exists messages_room_created_idx on public.messages(room_id, created_at);

alter table public.rooms enable row level security;
alter table public.room_secrets enable row level security;
alter table public.participants enable row level security;
alter table public.messages enable row level security;

drop policy if exists "rooms are publicly readable" on public.rooms;
create policy "rooms are publicly readable"
  on public.rooms for select
  to anon, authenticated
  using (true);

drop policy if exists "participants are publicly readable" on public.participants;
create policy "participants are publicly readable"
  on public.participants for select
  to anon, authenticated
  using (true);

-- MVP는 로그인 없이 브라우저 UUID를 사용합니다.
-- 정식 서비스에서는 Supabase Auth의 auth.uid() 기반 정책으로 교체하세요.
drop policy if exists "participants can update their client row" on public.participants;
create policy "participants can update their client row"
  on public.participants for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "messages are publicly readable" on public.messages;
create policy "messages are publicly readable"
  on public.messages for select
  to anon, authenticated
  using (true);

drop policy if exists "messages can be sent during break" on public.messages;
create policy "messages can be sent during break"
  on public.messages for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.rooms
      where rooms.id = messages.room_id
        and rooms.phase = 'break'
    )
  );

create or replace function public.create_focus_room(
  p_name text,
  p_pin text,
  p_focus_seconds integer,
  p_break_seconds integer,
  p_user_id text,
  p_nickname text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_code text;
begin
  if trim(p_name) = '' or trim(p_nickname) = '' then
    raise exception '방 이름과 닉네임이 필요합니다.';
  end if;
  if p_pin is not null and p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN은 숫자 4자리여야 합니다.';
  end if;

  loop
    v_code := upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 6));
    exit when not exists (select 1 from rooms where code = v_code);
  end loop;

  insert into rooms (code, name, host_id, is_locked, focus_seconds, break_seconds)
  values (
    v_code,
    trim(p_name),
    p_user_id,
    p_pin is not null,
    p_focus_seconds,
    p_break_seconds
  )
  returning id into v_room_id;

  if p_pin is not null then
    insert into room_secrets (room_id, pin_hash)
    values (v_room_id, crypt(p_pin, gen_salt('bf')));
  end if;

  insert into participants (room_id, user_id, nickname, is_host)
  values (v_room_id, p_user_id, trim(p_nickname), true);

  return v_room_id;
end;
$$;

create or replace function public.join_focus_room(
  p_code text,
  p_pin text,
  p_user_id text,
  p_nickname text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room rooms%rowtype;
  v_pin_hash text;
begin
  select * into v_room from rooms where code = upper(trim(p_code));
  if not found then
    raise exception '방을 찾을 수 없습니다.';
  end if;

  if v_room.is_locked then
    select pin_hash into v_pin_hash from room_secrets where room_id = v_room.id;
    if p_pin is null or crypt(p_pin, v_pin_hash) <> v_pin_hash then
      raise exception 'PIN이 올바르지 않습니다.';
    end if;
  end if;

  insert into participants (room_id, user_id, nickname)
  values (v_room.id, p_user_id, trim(p_nickname))
  on conflict (room_id, user_id)
  do update set nickname = excluded.nickname;

  return v_room.id;
end;
$$;

create or replace function public.start_focus_session(
  p_room_id uuid,
  p_user_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room rooms%rowtype;
begin
  select * into v_room from rooms where id = p_room_id for update;
  if v_room.host_id <> p_user_id then
    raise exception '호스트만 시작할 수 있습니다.';
  end if;
  if exists (select 1 from participants where room_id = p_room_id and not is_ready) then
    raise exception '아직 준비하지 않은 참가자가 있습니다.';
  end if;
  if not exists (select 1 from participants where room_id = p_room_id) then
    raise exception '참가자가 없습니다.';
  end if;

  update rooms
  set phase = 'focus',
      cycle_count = cycle_count + 1,
      timer_end_at = now() + make_interval(secs => focus_seconds)
  where id = p_room_id;
end;
$$;

create or replace function public.advance_focus_phase(
  p_room_id uuid,
  p_user_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room rooms%rowtype;
begin
  select * into v_room from rooms where id = p_room_id for update;
  if v_room.host_id <> p_user_id then
    raise exception '호스트만 타이머를 전환할 수 있습니다.';
  end if;

  if v_room.phase = 'focus' then
    update rooms
    set phase = 'break',
        timer_end_at = now() + make_interval(secs => break_seconds)
    where id = p_room_id;
  else
    update rooms set phase = 'lobby', timer_end_at = null where id = p_room_id;
    update participants set is_ready = false where room_id = p_room_id;
  end if;
end;
$$;

create or replace function public.leave_focus_room(
  p_room_id uuid,
  p_user_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_host boolean;
  v_next_user_id text;
begin
  select is_host into v_was_host
  from participants
  where room_id = p_room_id and user_id = p_user_id;

  delete from participants where room_id = p_room_id and user_id = p_user_id;

  if not exists (select 1 from participants where room_id = p_room_id) then
    delete from rooms where id = p_room_id;
  elsif coalesce(v_was_host, false) then
    select user_id into v_next_user_id
    from participants
    where room_id = p_room_id
    order by joined_at
    limit 1;

    update participants set is_host = (user_id = v_next_user_id) where room_id = p_room_id;
    update rooms set host_id = v_next_user_id where id = p_room_id;
  end if;
end;
$$;

grant execute on function public.create_focus_room(text, text, integer, integer, text, text) to anon, authenticated;
grant execute on function public.join_focus_room(text, text, text, text) to anon, authenticated;
grant execute on function public.start_focus_session(uuid, text) to anon, authenticated;
grant execute on function public.advance_focus_phase(uuid, text) to anon, authenticated;
grant execute on function public.leave_focus_room(uuid, text) to anon, authenticated;

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
