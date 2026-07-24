"use client";
import {
  Home, Contact, Hash, CalendarDays, Map, Building2, MessageSquare,
  ClipboardCheck, Settings, ShieldCheck, Star, type LucideIcon,
} from "lucide-react";

/** Nav glyphs. lucide renders rounded caps/joins already; use strokeWidth ~1.9. */
export const NAV_ICON = {
  feed: Home,
  members: Contact,
  channels: Hash,
  events: CalendarDays,
  trip: Map,
  register: Building2,
  messages: MessageSquare,
  admin: ClipboardCheck, // review queue — NOT the alert-shield
  settings: Settings,    // mechanic gear
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof NAV_ICON;

/** Verified = blue shield-check. */
export function VerifiedIcon({ size = 16 }: { size?: number }) {
  return <ShieldCheck size={size} strokeWidth={2.2} className="text-primary" />;
}

/** Bridge Verified = solid gold star. */
export function BridgeStar({ size = 16 }: { size?: number }) {
  return <Star size={size} strokeWidth={0} fill="currentColor" className="text-bridge" />;
}
