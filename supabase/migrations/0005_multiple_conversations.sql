-- ============================================================================
-- 0004 modeled "one conversation per (chatbot, identity)": the "Nouvelle
-- conversation" button deleted the existing row and a fresh one was
-- (re)created on the next message. In practice that meant starting a new
-- conversation destroyed the previous one, with no way to switch back to
-- it — not what was wanted. Dropping the uniqueness lets a (chatbot,
-- identity) pair have several conversations; the app now tracks/switches
-- between them by conversation id instead of assuming there's only one.
-- ============================================================================

drop index if exists conversations_chatbot_user_unique;
drop index if exists conversations_chatbot_visitor_unique;
