import type { ReactNode } from "react";
import { AppProvider } from "@/lib/store";
import AppShell from "@/components/AppShell";
import OnboardingRedirect from "@/components/OnboardingRedirect";

// The authenticated app: sidebar + topbar chrome around every app route. Auth
// screens and the public legal pages live outside this group and render bare.
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <OnboardingRedirect />
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
