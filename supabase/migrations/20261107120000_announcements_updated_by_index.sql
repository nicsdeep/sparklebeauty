-- Index the one foreign key without one (found by the performance check that mirrors Supabase's
-- "unindexed foreign keys" advisor). Every other foreign key is indexed (20261102090000).
create index if not exists announcements_updated_by_idx on public.announcements (updated_by);
