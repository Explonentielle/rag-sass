-- ============================================================================
-- Let a member remove their own membership row (docs/roadmap.md item 30).
-- The original users_organizations_delete policy only allowed an
-- owner/admin to delete a membership row — which also blocked a plain
-- member from removing *themselves* ("leave organization"), since deleting
-- your own row still requires is_org_admin(organization_id) today. The API
-- route (app/api/organizations/[id]/members/[userId]/route.ts) already
-- enforces the real business rule (can't remove the last owner) before
-- attempting the delete — this policy just stops RLS from blocking a
-- self-removal that the app has already approved.
-- ============================================================================

drop policy if exists users_organizations_delete on users_organizations;

create policy users_organizations_delete on users_organizations
  for delete using (is_org_admin(organization_id) or user_id = auth.uid());
