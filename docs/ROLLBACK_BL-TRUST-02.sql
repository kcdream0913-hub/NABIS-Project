-- Rollback for BL-TRUST-02 — true inverse, references-first (drop the trigger, then its function),
-- then restore the (buggy, column-blind) access_purchases INSERT policy exactly as it was.

drop trigger if exists trg_protect_report_intake on public.reports;
drop function if exists public.protect_report_intake();

-- Restores the original policy verbatim: `to authenticated with check (buyer_user_id = auth.uid())`
-- (bare auth.uid(), as it was). This re-opens the column-blind write it fixed — rollback only.
create policy access_purchases_insert_own on public.access_purchases
  for insert to authenticated
  with check (buyer_user_id = auth.uid());
