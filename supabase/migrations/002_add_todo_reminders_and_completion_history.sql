-- Add reminder and completion history fields without rebuilding existing data.

alter table public.todos
  add column if not exists reminder_at timestamptz,
  add column if not exists completed_at timestamptz;

-- Existing completed items receive the best available historical timestamp.
update public.todos
set completed_at = coalesce(updated_at, created_at, now())
where completed = true
  and completed_at is null;

create or replace function public.set_todo_completed_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.completed = true and old.completed = false and new.completed_at is null then
    new.completed_at = now();
  elsif new.completed = false then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists todos_set_completed_at on public.todos;
create trigger todos_set_completed_at
before update of completed on public.todos
for each row execute function public.set_todo_completed_at();

create index if not exists todos_user_reminder_at_idx
  on public.todos (user_id, reminder_at)
  where completed = false and reminder_at is not null;
