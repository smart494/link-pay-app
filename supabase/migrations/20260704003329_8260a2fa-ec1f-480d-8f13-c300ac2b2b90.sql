
-- ENUMS
create type public.transaction_type as enum ('transfer','top_up','withdrawal');
create type public.transaction_status as enum ('pending','completed','failed');
create type public.request_status as enum ('open','paid','expired','cancelled');
create type public.account_type as enum ('bank','card');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  paylink_id text not null unique,
  avatar_url text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles self read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles lookup by handle" on public.profiles for select to authenticated using (true);
create policy "profiles self update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles self insert" on public.profiles for insert to authenticated with check (auth.uid() = id);

-- WALLETS
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  balance numeric(14,2) not null default 0,
  currency text not null default 'USD',
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.wallets to authenticated;
grant all on public.wallets to service_role;
alter table public.wallets enable row level security;
create policy "wallets self" on public.wallets for select to authenticated using (auth.uid() = user_id);
create policy "wallets self update" on public.wallets for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- TRANSACTIONS
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles(id) on delete set null,
  recipient_id uuid references public.profiles(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  type public.transaction_type not null,
  note text,
  status public.transaction_status not null default 'completed',
  created_at timestamptz not null default now()
);
create index on public.transactions (sender_id, created_at desc);
create index on public.transactions (recipient_id, created_at desc);
grant select, insert on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "tx participant read" on public.transactions for select to authenticated using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "tx self insert" on public.transactions for insert to authenticated with check (
  (type = 'top_up' and recipient_id = auth.uid() and sender_id is null) or
  (type = 'withdrawal' and sender_id = auth.uid() and recipient_id is null)
);

-- PAYMENT REQUESTS
create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2),
  note text,
  status public.request_status not null default 'open',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.payment_requests to authenticated;
grant all on public.payment_requests to service_role;
alter table public.payment_requests enable row level security;
create policy "req owner all" on public.payment_requests for all to authenticated using (auth.uid() = requester_id) with check (auth.uid() = requester_id);
create policy "req public read" on public.payment_requests for select to authenticated using (true);

-- LINKED ACCOUNTS
create table public.linked_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_name text not null,
  account_type public.account_type not null,
  masked_number text not null,
  balance numeric(14,2),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.linked_accounts to authenticated;
grant all on public.linked_accounts to service_role;
alter table public.linked_accounts enable row level security;
create policy "la owner all" on public.linked_accounts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- SETTINGS
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  two_factor_enabled boolean not null default false,
  biometric_enabled boolean not null default false,
  dark_mode boolean not null default false,
  language text not null default 'en',
  currency_preference text not null default 'USD',
  notification_preferences jsonb not null default '{"email":true,"push":true,"transactions":true,"marketing":false}'::jsonb,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.settings to authenticated;
grant all on public.settings to service_role;
alter table public.settings enable row level security;
create policy "settings owner all" on public.settings for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- HANDLE NEW USER TRIGGER
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle text;
  candidate text;
  n int := 0;
  full_name_val text;
begin
  full_name_val := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'user');
  base_handle := lower(regexp_replace(full_name_val, '[^a-zA-Z0-9]', '', 'g'));
  if length(base_handle) = 0 then base_handle := 'user'; end if;
  candidate := base_handle;
  while exists(select 1 from public.profiles where paylink_id = candidate) loop
    n := n + 1;
    candidate := base_handle || n::text;
  end loop;

  insert into public.profiles (id, full_name, email, phone, paylink_id)
  values (new.id, full_name_val, new.email, new.raw_user_meta_data->>'phone', candidate);

  insert into public.wallets (user_id, balance) values (new.id, 0);
  insert into public.settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- TRANSFER RPC
create or replace function public.send_money(recipient_handle text, transfer_amount numeric, transfer_note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sender uuid := auth.uid();
  recipient uuid;
  sender_balance numeric;
  tx_id uuid;
begin
  if sender is null then raise exception 'Not authenticated'; end if;
  if transfer_amount is null or transfer_amount <= 0 then raise exception 'Amount must be positive'; end if;

  select id into recipient from public.profiles where paylink_id = recipient_handle;
  if recipient is null then raise exception 'Recipient not found'; end if;
  if recipient = sender then raise exception 'Cannot send to yourself'; end if;

  select balance into sender_balance from public.wallets where user_id = sender for update;
  if sender_balance is null then raise exception 'Wallet not found'; end if;
  if sender_balance < transfer_amount then raise exception 'Insufficient balance'; end if;

  update public.wallets set balance = balance - transfer_amount, updated_at = now() where user_id = sender;
  update public.wallets set balance = balance + transfer_amount, updated_at = now() where user_id = recipient;

  insert into public.transactions (sender_id, recipient_id, amount, type, note, status)
  values (sender, recipient, transfer_amount, 'transfer', transfer_note, 'completed')
  returning id into tx_id;

  return tx_id;
end;
$$;

grant execute on function public.send_money(text, numeric, text) to authenticated;

-- TOP UP RPC (updates wallet + logs tx atomically)
create or replace function public.top_up(top_amount numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tx_id uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if top_amount is null or top_amount <= 0 then raise exception 'Amount must be positive'; end if;
  update public.wallets set balance = balance + top_amount, updated_at = now() where user_id = uid;
  insert into public.transactions (sender_id, recipient_id, amount, type, note, status)
  values (null, uid, top_amount, 'top_up', 'Wallet top-up', 'completed') returning id into tx_id;
  return tx_id;
end;
$$;
grant execute on function public.top_up(numeric) to authenticated;
