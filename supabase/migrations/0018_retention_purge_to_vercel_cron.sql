-- ============================================================================
-- Retention purge moved from pg_cron (SQL-only, migration 0006) to a Vercel
-- Cron Job (app/api/cron/purge-conversations/route.ts, lib/retentionPurge.ts)
-- — docs/roadmap.md item 48's known gap: pg_cron can delete conversation
-- rows, but it can't reach Supabase Storage to remove the matching visitor-
-- uploaded file objects. conversation_files rows (and the storage_path they
-- hold) cascade away the instant their conversation is deleted, so the old
-- SQL-only job silently orphaned every uploaded file forever, even though
-- its own metadata was correctly purged.
--
-- The two jobs can't coexist: if pg_cron still fired on its own schedule, it
-- could delete a conversation before the app-level job ever got a chance to
-- read its files' storage_path, making that cleanup impossible after the
-- fact. Wrapped in a existence check so this is safe to run whether or not
-- migration 0006 ever actually ran on this database (e.g. a fresh install).
-- ============================================================================

do $$
begin
  -- Guard on the extension itself first: if pg_cron was never enabled (0006
  -- never ran, or never got past the "enable the extension by hand" step
  -- its own comment warns about), the `cron.job` table doesn't exist at
  -- all, and querying it would error rather than just finding no rows.
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-old-conversations') then
      perform cron.unschedule('purge-old-conversations');
    end if;
  end if;
end $$;
