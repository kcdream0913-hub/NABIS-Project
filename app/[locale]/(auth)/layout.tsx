import type { ReactNode } from "react";
import AuthLocaleSwitch from "@/components/AuthLocaleSwitch";

// Chrome-free auth frame: a centered card on the app background — logo + form
// only, no sidebar, top bar, view switcher, or search. The language switch sits
// in the footer so a Nepali-only visitor can switch before signing in.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">{children}</div>
        <div className="mt-6 flex justify-center">
          <AuthLocaleSwitch />
        </div>
      </div>
    </div>
  );
}
