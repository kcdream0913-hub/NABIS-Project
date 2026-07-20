import { createClient } from "@/lib/supabase/client";

export async function logAction(
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {}
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });
}
