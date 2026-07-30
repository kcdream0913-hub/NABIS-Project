-- Rollback for BL-ADMIN-ACCOUNTS. Restores admin_delete_account to nonexistent
-- and removes the two admin business policies. Does NOT restore any account
-- or business already deleted through admin_delete_account or the new admin
-- business-delete policy while it was live — that data loss is the intended,
-- permanent effect of the feature having been used, same convention as
-- ROLLBACK_BL-ACCT-DELETE-FK.sql's note.

drop policy if exists businesses_admin_delete on public.businesses;
drop policy if exists businesses_admin_insert on public.businesses;
drop function if exists public.admin_delete_account(uuid);
