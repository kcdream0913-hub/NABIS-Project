// Moved to lib/socialLinks.ts so member profiles (BL-PROFILE-01) and businesses share ONE
// validator. Re-exported here so the business flow's existing imports keep working unchanged —
// do NOT re-implement; edit lib/socialLinks.ts.
export * from "@/lib/socialLinks";
