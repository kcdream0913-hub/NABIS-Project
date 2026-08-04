-- Rollback for BL-FEEDBACK-02. True inverse: drop the table, which drops its two indexes and its
-- three RLS policies (insert / select / update) with it. Nothing references public.feedback, so
-- no CASCADE is needed (and none is used, so this can never silently drop an unrelated dependent).

-- Drop the table first — that removes trg_protect_feedback_intake with it (a trigger belongs to
-- its table) — then the now-dependency-free intake function.
drop table if exists public.feedback;
drop function if exists public.protect_feedback_intake();
