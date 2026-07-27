create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id)
);

create table if not exists public.anniversaries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  anniversary_date date not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists household_members_user_idx on public.household_members(user_id);
create index if not exists anniversaries_household_date_idx on public.anniversaries(household_id, anniversary_date);
create unique index if not exists anniversaries_household_name_date_idx on public.anniversaries(household_id, lower(btrim(name)), anniversary_date);

create or replace function private.validate_anniversary_date()
returns trigger language plpgsql set search_path = public, private as $$
begin
  if new.anniversary_date > current_date then raise exception 'anniversary date cannot be in the future'; end if;
  return new;
end;
$$;
drop trigger if exists anniversaries_date_guard on public.anniversaries;
create trigger anniversaries_date_guard before insert or update on public.anniversaries for each row execute function private.validate_anniversary_date();

create or replace function private.is_household_member(target_household uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from public.household_members where household_id = target_household and user_id = auth.uid());
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.anniversaries enable row level security;

create policy "members can view households" on public.households for select to authenticated using (private.is_household_member(id));
create policy "users can view own membership" on public.household_members for select to authenticated using (user_id = auth.uid());
create policy "members can view anniversaries" on public.anniversaries for select to authenticated using (private.is_household_member(household_id));
create policy "members can add anniversaries" on public.anniversaries for insert to authenticated with check (private.is_household_member(household_id) and created_by = auth.uid());
create policy "members can edit anniversaries" on public.anniversaries for update to authenticated using (private.is_household_member(household_id)) with check (private.is_household_member(household_id));
create policy "members can delete anniversaries" on public.anniversaries for delete to authenticated using (private.is_household_member(household_id));

create or replace function public.create_household()
returns public.households language plpgsql security definer set search_path = public, private as $$
declare result public.households;
declare code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then raise exception 'already belongs to a household'; end if;
  loop
    code := upper(substr(encode(gen_random_bytes(8), 'base64'), 1, 10));
    code := regexp_replace(code, '[^A-Z0-9]', 'X', 'g');
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  insert into public.households(invite_code, created_by) values (code, auth.uid()) returning * into result;
  insert into public.household_members(household_id, user_id) values (result.id, auth.uid());
  return result;
end;
$$;

create or replace function public.join_household(input_code text)
returns public.households language plpgsql security definer set search_path = public, private as $$
declare result public.households;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then raise exception 'already belongs to a household'; end if;
  select * into result from public.households where invite_code = upper(btrim(input_code));
  if result.id is null then raise exception 'invite code not found'; end if;
  insert into public.household_members(household_id, user_id) values (result.id, auth.uid());
  return result;
end;
$$;

revoke all on function public.create_household() from public;
grant execute on function public.create_household() to authenticated;
revoke all on function public.join_household(text) from public;
grant execute on function public.join_household(text) to authenticated;
