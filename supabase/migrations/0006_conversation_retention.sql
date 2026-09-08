-- ============================================================================
-- GDPR (docs/roadmap.md item 20, plan A): automatic retention purge.
-- Conversations/messages had no expiry — storing chat content forever
-- violates the data-minimization principle (RGPD art. 5.1.e). This
-- schedules a daily job, via pg_cron, that deletes conversations inactive
-- for more than RETENTION_DAYS; `messages` follows automatically via the
-- existing `on delete cascade` from supabase/migrations/0004_conversations.sql.
--
-- RETENTION_DAYS = 90 below — chosen as a reasonable pilot default, not a
-- hard technical constraint. To change it later, re-run cron.schedule with
-- the same job name ('purge-old-conversations') and a new interval: it
-- upserts rather than duplicating the job.
--
-- If `create extension pg_cron` errors, enable it first via the Supabase
-- dashboard: Database > Extensions > pg_cron, then re-run this file.
-- ============================================================================

create extension if not exists pg_cron;

select cron.schedule(
  'purge-old-conversations',
  '0 3 * * *', -- daily at 03:00 UTC
  $$ delete from conversations where updated_at < now() - interval '90 days' $$
);
