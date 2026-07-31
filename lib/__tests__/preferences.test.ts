import { describe, it, expect } from "vitest";
import { readPreferences, mergePreferences, DEFAULT_PREFERENCES } from "../preferences";

// The Notifications settings form (BL-ENGAGE-01) and the Privacy form both save
// via mergePreferences, relying on two invariants that were previously untested:
// (1) a partial notifications.email patch must NOT drop the sibling email
//     categories (deep-merge, not shallow overwrite), and
// (2) writing only `notifications` must preserve every unrelated top-level key
//     (visibility, timezone, sharing_defaults) — the read-modify-write contract.
// A shallow-spread regression in mergePreferences would silently wipe a user's
// other choices the moment they toggle a single switch.
describe("readPreferences", () => {
  it("fills the notifications defaults from an empty blob", () => {
    expect(readPreferences(undefined).notifications).toEqual(DEFAULT_PREFERENCES.notifications);
    expect(readPreferences({}).notifications).toEqual(DEFAULT_PREFERENCES.notifications);
    expect(readPreferences(null).notifications).toEqual(DEFAULT_PREFERENCES.notifications);
  });

  it("deep-merges a partial notifications blob over the defaults", () => {
    const p = readPreferences({ notifications: { email: { messages: false } } });
    // The one overridden category flips; the other three keep their defaults.
    expect(p.notifications.email).toEqual({
      messages: false,
      verification: true,
      events: true,
      connections: true,
    });
    expect(p.notifications.frequency).toBe("immediate");
    expect(p.notifications.login_alerts).toBe(true);
  });
});

describe("mergePreferences", () => {
  it("patching one email category preserves the other three (deep-merge)", () => {
    const base = readPreferences({});
    const next = mergePreferences(base, {
      notifications: { ...base.notifications, email: { ...base.notifications.email, events: false } },
    });
    expect(next.notifications.email).toEqual({
      messages: true,
      verification: true,
      events: false,
      connections: true,
    });
  });

  it("writing only `notifications` preserves unrelated top-level siblings", () => {
    // Simulate the form's read-modify-write: a stored blob with a non-default
    // visibility + timezone, then a notifications-only save.
    const stored = { visibility: "private", timezone: "Asia/Kathmandu" };
    const next = mergePreferences(stored, {
      notifications: { ...DEFAULT_PREFERENCES.notifications, frequency: "daily" },
    });
    expect(next.visibility).toBe("private");
    expect(next.timezone).toBe("Asia/Kathmandu");
    expect(next.notifications.frequency).toBe("daily");
  });

  it("does not mutate the base object", () => {
    const base = readPreferences({});
    const before = JSON.stringify(base);
    mergePreferences(base, { notifications: { ...base.notifications, login_alerts: false } });
    expect(JSON.stringify(base)).toBe(before);
  });
});
