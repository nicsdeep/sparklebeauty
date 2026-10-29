-- Stop signed-in users from granting themselves privileges through public.profiles.
--
-- The "customer update own profile" policy lets a customer update every column of
-- their own row, including role and loyalty_points. Policies can't restrict columns,
-- so a trigger guards the sensitive ones instead:
--   - role: only an admin may set or change it (staff may not promote anyone)
--   - loyalty_points: only staff or admins may change it
-- Requests made with the service role or as postgres (server code, the sign-up
-- trigger, migrations) are not affected.

create or replace function public.is_role_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- Only requests coming from the app's API roles are restricted.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role <> 'customer' and not public.is_role_admin() then
      raise exception 'Only an admin can create a profile with role %', new.role
        using errcode = '42501';
    end if;
    if new.loyalty_points <> 0 and not public.is_admin() then
      raise exception 'Only staff can set loyalty points' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role and not public.is_role_admin() then
    raise exception 'Only an admin can change a user''s role' using errcode = '42501';
  end if;
  if new.loyalty_points is distinct from old.loyalty_points and not public.is_admin() then
    raise exception 'Only staff can change loyalty points' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_profile_privileges
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileges();
