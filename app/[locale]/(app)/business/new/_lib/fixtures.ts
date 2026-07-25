// Fixtures for WEBSITE_IMPORT_MODE=fixture — CI + demo run with no socket opened.
import type { Extracted } from "./websiteGuards";

export const WEBSITE_FIXTURE: Extracted = {
  name: "Himalaya Freight Co.",
  bio: "Kathmandu-based freight forwarding and customs clearance for importers and exporters across the US–Nepal corridor.",
  phone: "+977 1 4567890",
  city: "Kathmandu",
  addressLine: "Teku, Kathmandu",
  logoCandidate: "https://example.com.np/logo.png",
  socialLinks: ["https://facebook.com/himalayafreight"],
};
