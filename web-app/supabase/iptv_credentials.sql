-- Create a per-user IPTV credentials table (Supabase)
-- Run this in Supabase SQL Editor.

create table if not exists public.iptv_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null default '',
  password text not null default '',
  api_url text not null default '',
  m3u_url text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.iptv_credentials enable row level security;

-- Users can read only their row
create policy "iptv_credentials_select_own"
  on public.iptv_credentials
  for select
  using (auth.uid() = user_id);

-- Users can insert only their row
create policy "iptv_credentials_insert_own"
  on public.iptv_credentials
  for insert
  with check (auth.uid() = user_id);

-- Users can update only their row
create policy "iptv_credentials_update_own"
  on public.iptv_credentials
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete only their row
create policy "iptv_credentials_delete_own"
  on public.iptv_credentials
  for delete
  using (auth.uid() = user_id);
