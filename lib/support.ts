// Pilot support / admin routing. The support admin is the founder's account; the
// id is overridable via env so it can track admin_users without a code change.
export const SUPPORT_ADMIN_ID =
  process.env.NEXT_PUBLIC_SUPPORT_ADMIN_ID || "1258b010-291b-434c-a6a4-a1f6fee0d9b9";

// A member can request verification by DMing the admin — EXCEPT the admin, who
// would be messaging themselves (get_or_create_direct_thread rejects that with a
// 400 "Cannot start a thread with yourself"). So hide the control in that one case.
export function canRequestVerification(currentUserId: string | null | undefined): boolean {
  return !!currentUserId && currentUserId !== SUPPORT_ADMIN_ID;
}
