-- Bubble Space 初始資料結構
-- 安全原則：只使用 CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS，不刪除既有資料。

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  due_date date not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.todos enable row level security;

-- 明確授權需要的最小權限；不依賴「Automatically expose new tables」。
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.todos from anon, authenticated;
grant usage on schema public to authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.todos to authenticated;

do $$ begin
  create policy "profiles_select_own" on public.profiles
    for select using (auth.uid() = id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "profiles_update_own" on public.profiles
    for update using (auth.uid() = id) with check (auth.uid() = id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "todos_select_own" on public.todos
    for select using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "todos_insert_own" on public.todos
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "todos_update_own" on public.todos
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "todos_delete_own" on public.todos
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists todos_set_updated_at on public.todos;
create trigger todos_set_updated_at
before update on public.todos
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    case when lower(new.email) = 'wenchang10802270@gmail.com' then 'admin' else 'member' end
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    role = excluded.role,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();

create index if not exists todos_user_due_date_idx on public.todos (user_id, due_date);
