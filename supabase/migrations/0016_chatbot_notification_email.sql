-- ============================================================================
-- Per-chatbot destination for the agentic "notify the owner" email tool
-- (docs/roadmap.md item 33). Replaces the address that was hardcoded in
-- lib/agenticTools.ts. Nullable: the tool is only offered to the model when
-- allow_email_tool is on AND this is set (checked in the chat routes), so an
-- existing chatbot with the toggle on stays silent until its owner fills it.
-- ============================================================================

alter table chatbots
  add column if not exists notification_email text;

comment on column chatbots.notification_email is
  'Address that receives the lead notification sent by the notify_bot_owner tool (lib/agenticTools.ts). Format validated in app/api/chatbots/[id]/route.ts. Null = tool not offered, even if allow_email_tool is true.';
