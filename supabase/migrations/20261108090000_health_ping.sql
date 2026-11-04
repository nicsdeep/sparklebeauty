-- Keep-alive / health check (docs/supabase-keep-alive.md): a tiny read-only function the daily
-- Vercel cron calls through the API, so a free-tier project isn't paused for inactivity.
-- It reads no tables and writes nothing. Remove with: drop function public.ping();
create or replace function public.ping()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$ select now() $$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
