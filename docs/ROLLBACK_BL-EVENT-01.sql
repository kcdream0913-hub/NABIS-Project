-- ROLLBACK for BL-EVENT-01 — exact inverse, in reverse order. Restores prod to its
-- pre-migration state (events_host_id_fkey NO ACTION, no status/host_business_id, the
-- original insert-only policy set). Statements NOT wrapped in begin/commit (wrap to apply).

-- 4'. Restore events_host_id_fkey to its original NO-ACTION form (no on-delete clause).
alter table public.events drop constraint events_host_id_fkey;
alter table public.events add constraint events_host_id_fkey
  foreign key (host_id) references public.profiles(id);

-- 3'. Drop the added UPDATE + DELETE policies.
drop policy events_delete_host on public.events;
drop policy events_update_host on public.events;

-- 2'. Restore the original insert policy (host_id = auth.uid() only; bare auth.uid(),
--     no host_business_id ownership branch).
drop policy events_insert_host on public.events;
create policy events_insert_host on public.events
  for insert to authenticated
  with check (host_id = auth.uid());

-- 1'. Drop the added columns (host_business_id before status; order is not significant
--     since neither depends on the other, but mirror the forward add).
alter table public.events drop column host_business_id;
alter table public.events drop column status;
