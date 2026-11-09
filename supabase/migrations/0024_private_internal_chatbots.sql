-- ============================================================================
-- chatbots.is_public defaults to true at the column level (migration 0007,
-- sized for 'site_widget': no extra step to start embedding). Creating a
-- 'second_cerveau' (item 52) or 'contract_analyzer' (item 23) chatbot never
-- set it explicitly, so every one of those created before this migration
-- ended up is_public=true by default — reachable via the anonymous
-- /api/public-chat endpoint by anyone who had (or guessed) its id, even
-- though neither one's dashboard UI ever exposed a way to embed it.
-- app/api/chatbots/route.ts now sets is_public explicitly at creation, and
-- lib/publicChatAccess.ts's getAccessibleChatbot now rejects any use_case
-- other than 'site_widget' regardless of is_public — this backfills
-- existing rows to match, closing the gap for chatbots created before today.
-- ============================================================================

update chatbots
set is_public = false
where use_case <> 'site_widget' and is_public = true;
