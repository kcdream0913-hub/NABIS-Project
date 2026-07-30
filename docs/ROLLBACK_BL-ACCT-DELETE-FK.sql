-- ROLLBACK for BL-ACCT-DELETE-FK — restores all 7 FKs to their original NO-ACTION form
-- (no `on delete` clause = NO ACTION, confdeltype 'a'). Exact inverse of BL-ACCT-DELETE-FK.sql.
--
-- After this rollback, delete_own_account() will AGAIN 23503-block for any user referenced
-- by these columns — that is the pre-migration behavior, restored on purpose. Not wrapped in
-- begin/commit; the verifier/runner wraps atomically.

alter table public.audit_logs drop constraint audit_logs_actor_id_fkey;
alter table public.audit_logs add constraint audit_logs_actor_id_fkey
  foreign key (actor_id) references public.profiles(id);

alter table public.business_members drop constraint business_members_added_by_fkey;
alter table public.business_members add constraint business_members_added_by_fkey
  foreign key (added_by) references public.profiles(id);

alter table public.channels drop constraint channels_owner_user_id_fkey;
alter table public.channels add constraint channels_owner_user_id_fkey
  foreign key (owner_user_id) references public.profiles(id);

alter table public.invites drop constraint invites_from_user_id_fkey;
alter table public.invites add constraint invites_from_user_id_fkey
  foreign key (from_user_id) references public.profiles(id);

alter table public.reports drop constraint reports_reporter_id_fkey;
alter table public.reports add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles(id);

alter table public.reports drop constraint reports_reviewer_id_fkey;
alter table public.reports add constraint reports_reviewer_id_fkey
  foreign key (reviewer_id) references public.profiles(id);

alter table public.verification_records drop constraint verification_records_reviewer_id_fkey;
alter table public.verification_records add constraint verification_records_reviewer_id_fkey
  foreign key (reviewer_id) references public.profiles(id);
