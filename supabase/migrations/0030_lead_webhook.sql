-- ============================================================================
-- Webhook sortant « nouveau lead » (roadmap item 62).
--
-- lead_webhook_url    : URL https qui reçoit un POST JSON à chaque lead
--                       qualifié ou demande de rappel (NULL = pas de webhook).
-- lead_webhook_secret : secret de signature HMAC, chiffré par l'application
--                       (lib/crypto.ts), jamais stocké en clair. Généré à
--                       l'enregistrement de l'URL, régénérable depuis le
--                       dashboard.
-- ============================================================================

alter table chatbots
  add column if not exists lead_webhook_url text,
  add column if not exists lead_webhook_secret text;
