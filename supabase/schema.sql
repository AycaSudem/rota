-- Rota: Supabase veritabanı şeması
-- Supabase panelinde: SQL Editor > New query > bu dosyanın tamamını yapıştır > Run

-- Çalışma odaları (6 haneli kodla katılınır)
create table if not exists public.rooms (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  name text not null check (char_length(name) between 1 and 40),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

-- Biten oturumlar (odanın günlük odak tablosu için)
create table if not exists public.focus_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  room_code text references public.rooms(code) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  minutes int not null check (minutes between 0 and 600),
  topics_done int not null default 0 check (topics_done between 0 and 200),
  created_at timestamptz not null default now()
);
create index if not exists focus_logs_room_day on public.focus_logs (room_code, created_at);

-- Satır düzeyinde güvenlik: herkes okur, herkes yalnızca kendi adına yazar
alter table public.rooms enable row level security;
alter table public.focus_logs enable row level security;

drop policy if exists "odalar okunur" on public.rooms;
create policy "odalar okunur" on public.rooms for select to authenticated using (true);
drop policy if exists "oda kur" on public.rooms;
create policy "oda kur" on public.rooms for insert to authenticated with check (created_by = auth.uid());

drop policy if exists "kayitlar okunur" on public.focus_logs;
create policy "kayitlar okunur" on public.focus_logs for select to authenticated using (true);
drop policy if exists "kendi kaydini ekle" on public.focus_logs;
create policy "kendi kaydini ekle" on public.focus_logs for insert to authenticated with check (user_id = auth.uid());

-- Oda üyeleri: Rota'sı kapalı olan arkadaşlar da odada "son görülme" ile görünsün
create table if not exists public.room_members (
  room_code text not null references public.rooms(code) on delete cascade,
  user_id uuid not null default auth.uid(),
  name text not null check (char_length(name) between 1 and 30),
  state text not null default 'idle' check (state in ('working','break','away','phone','idle','done')),
  topic text not null default '' check (char_length(topic) <= 120),
  left_count int not null default 0 check (left_count between 0 and 500),
  total int not null default 0 check (total between 0 and 500),
  updated_at timestamptz not null default now(),
  primary key (room_code, user_id)
);
alter table public.room_members enable row level security;

drop policy if exists "uyeler okunur" on public.room_members;
create policy "uyeler okunur" on public.room_members for select to authenticated using (true);
drop policy if exists "kendi uyeligini ekle" on public.room_members;
create policy "kendi uyeligini ekle" on public.room_members for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "kendi uyeligini guncelle" on public.room_members;
create policy "kendi uyeligini guncelle" on public.room_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "kendi uyeligini sil" on public.room_members;
create policy "kendi uyeligini sil" on public.room_members for delete to authenticated using (user_id = auth.uid());

-- Not: Odadaki canlı durum (kim çalışıyor, dürtmeler, ortak sprint) Supabase Realtime
-- "presence" ve "broadcast" ile çalışır; bunlar için ek tablo gerekmez.
