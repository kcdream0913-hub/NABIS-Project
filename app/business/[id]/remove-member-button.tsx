"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RemoveMemberButton({
  businessId,
  memberRowId,
  role,
}: {
  businessId: string;
  memberRowId: string;
  role: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("businesses")
        .select("owner_user_id")
        .eq("id", businessId)
        .single();
      setIsOwner(data?.owner_user_id === user.id);
    }
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // The owner's own row can't be removed this way.
  if (!isOwner || role === "owner") return null;

  async function remove() {
    await supabase.from("business_members").delete().eq("id", memberRowId);
    router.refresh();
  }

  return (
    <button
      onClick={remove}
      aria-label="Remove from team"
      className="rounded-md p-1.5 text-ink-soft hover:bg-mist hover:text-rhodo"
    >
      <X size={15} />
    </button>
  );
}
