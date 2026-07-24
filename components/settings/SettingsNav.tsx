"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { User, Shield, Palette, Smartphone, Download, LifeBuoy, type LucideIcon } from "lucide-react";

type NavItem = { href: string; key: string; icon: LucideIcon };

// Phase A sections only. Notifications/Security (Phase B) and Blocked/Business
// (Phase C) are intentionally absent — no dead links until they're built.
const ITEMS: NavItem[] = [
  { href: "/settings/account", key: "account", icon: User },
  { href: "/settings/privacy", key: "privacy", icon: Shield },
  { href: "/settings/appearance", key: "appearance", icon: Palette },
  { href: "/settings/devices", key: "devices", icon: Smartphone },
  { href: "/settings/data", key: "data", icon: Download },
  { href: "/settings/support", key: "support", icon: LifeBuoy },
];

export default function SettingsNav() {
  const t = useTranslations("settings.nav");
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible" aria-label={t("aria")}>
      {ITEMS.map(({ href, key, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-primary-soft text-chip-ink" : "text-ink-soft hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <Icon size={17} strokeWidth={1.9} className="shrink-0" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
