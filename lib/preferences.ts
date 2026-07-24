/**
 * User preferences — the app-managed shape stored in profiles.preferences (jsonb).
 * Read/merge/write via mergePreferences so partial updates never clobber sibling
 * keys (e.g. saving a timezone must not drop visibility). Phase A uses visibility,
 * sharing_defaults, data_usage_opt_in, timezone; the notifications block is
 * reserved for Phase B (stored-only until an email worker exists).
 */
export type Visibility = "public" | "private" | "bridge";
export type NotificationFrequency = "immediate" | "daily" | "off";

export interface Preferences {
  visibility: Visibility;
  data_usage_opt_in: boolean;
  sharing_defaults: { show_email: boolean; show_phone: boolean };
  timezone: string; // IANA
  notifications: {
    email: { messages: boolean; verification: boolean; events: boolean; connections: boolean };
    frequency: NotificationFrequency;
    login_alerts: boolean;
  };
}

export const DEFAULT_PREFERENCES: Preferences = {
  visibility: "public",
  data_usage_opt_in: true,
  sharing_defaults: { show_email: false, show_phone: false },
  timezone: "America/New_York",
  notifications: {
    email: { messages: true, verification: true, events: true, connections: true },
    frequency: "immediate",
    login_alerts: true,
  },
};

/** Deep-merge a stored (possibly partial / empty) preferences blob over the defaults. */
export function readPreferences(raw: unknown): Preferences {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<Preferences>;
  const d = DEFAULT_PREFERENCES;
  return {
    visibility: p.visibility ?? d.visibility,
    data_usage_opt_in: p.data_usage_opt_in ?? d.data_usage_opt_in,
    sharing_defaults: { ...d.sharing_defaults, ...(p.sharing_defaults ?? {}) },
    timezone: p.timezone ?? d.timezone,
    notifications: {
      email: { ...d.notifications.email, ...(p.notifications?.email ?? {}) },
      frequency: p.notifications?.frequency ?? d.notifications.frequency,
      login_alerts: p.notifications?.login_alerts ?? d.notifications.login_alerts,
    },
  };
}

/**
 * Merge a partial patch onto the current stored blob (defaults-filled first) and
 * return the full object to persist — so a single-field save keeps every sibling.
 */
export function mergePreferences(current: unknown, patch: Partial<Preferences>): Preferences {
  const base = readPreferences(current);
  return {
    ...base,
    ...patch,
    sharing_defaults: { ...base.sharing_defaults, ...(patch.sharing_defaults ?? {}) },
    notifications: {
      ...base.notifications,
      ...(patch.notifications ?? {}),
      email: { ...base.notifications.email, ...(patch.notifications?.email ?? {}) },
    },
  };
}
