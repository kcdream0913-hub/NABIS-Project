// Trip-planner interest tags — deliberately separate from lib/sectors.ts
// (business sectors and travel interests are different taxonomies that would
// drift apart if forced to share one list). Names/descriptions translate via
// the "interests" namespace in messages/{locale}.json + useInterests().
export const INTEREST_SLUGS = [
  "trekking-outdoors",
  "culture-heritage",
  "food-culinary",
  "wildlife-nature",
  "wellness-retreat",
  "business-networking",
  "shopping-crafts",
  "festivals-events",
] as const;

export type InterestSlug = (typeof INTEREST_SLUGS)[number];
