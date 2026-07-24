"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchOnboarded } from "@/lib/onboarding";

// After login, a member who hasn't completed (or skipped) the first-run flow is
// sent once to /welcome. Runs a single time per app mount so it never traps: once
// onboarded is set, or if they leave /welcome by choice, they're not bounced back.
// Exempts /welcome (target) and /onboarding (OAuth/invite redemption entry).
const EXEMPT = ["/welcome", "/onboarding"];

export default function OnboardingRedirect() {
  const pathname = usePathname(); // locale-stripped by next-intl
  const router = useRouter();

  useEffect(() => {
    if (EXEMPT.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    let active = true;
    (async () => {
      const { data: { user } } = await createClient().auth.getUser();
      if (!user || !active) return;
      const onboarded = await fetchOnboarded(user.id);
      if (!active) return;
      if (!onboarded) router.replace("/welcome");
    })();
    return () => { active = false; };
    // Run once per mount (redirect-once semantics), not on every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
