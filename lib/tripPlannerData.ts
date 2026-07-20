import type { View } from "./types";
import type { InterestSlug } from "./interests";

export type RecommendationCategory = "stay" | "activity" | "transport" | "food" | "other";

export type RecommendationTemplate = {
  id: string;
  title: string;
  category: RecommendationCategory;
  view: View;
  interests: InterestSlug[];
  estimatedCostUSD: number;
  note: string;
};

// Curated starting points, not live vendor listings — there is no marketplace
// data to pull from yet (Phase 3). These are illustrative templates a member
// can add to their itinerary and edit; real bookable listings are a Phase 3
// dependency (see docs/TASK_BREAKDOWN.md Task 1.3/1.4).
export const RECOMMENDATION_TEMPLATES: RecommendationTemplate[] = [
  { id: "r1", title: "Kathmandu heritage day (Durbar Square, Swayambhunath, Boudhanath)", category: "activity", view: "nepal", interests: ["culture-heritage"], estimatedCostUSD: 35, note: "Full-day guided walk across the three main heritage sites. Hire a licensed local guide rather than booking ahead." },
  { id: "r2", title: "Annapurna foothills trek prep (Ghandruk/Poon Hill, 3–4 days)", category: "activity", view: "nepal", interests: ["trekking-outdoors"], estimatedCostUSD: 220, note: "Budget covers guide + porter for a short teahouse trek. Longer routes (Annapurna Base Camp, EBC) scale roughly linearly by day." },
  { id: "r3", title: "Pokhara wellness weekend (lakeside yoga + spa)", category: "activity", view: "nepal", interests: ["wellness-retreat"], estimatedCostUSD: 150, note: "Two nights lakeside, half-day yoga retreat, one spa treatment. Ask in the Nepal View directory for current wellness operators." },
  { id: "r4", title: "Chitwan wildlife safari (2 days, 1 night)", category: "activity", view: "nepal", interests: ["wildlife-nature"], estimatedCostUSD: 180, note: "Jungle safari + canoe ride, standard lodge package. Verify rhino/tiger sighting expectations are set realistically by the operator." },
  { id: "r5", title: "Newari food crawl (Patan + Bhaktapur)", category: "food", view: "nepal", interests: ["food-culinary"], estimatedCostUSD: 40, note: "Half-day, several small stops rather than one restaurant. Good fit for a small group." },
  { id: "r6", title: "Handicraft & textile sourcing trip (Patan, Bhaktapur workshops)", category: "activity", view: "nepal", interests: ["shopping-crafts", "business-networking"], estimatedCostUSD: 60, note: "For members exploring import/export — several Vendor Showcase members offer workshop visits; ask in Business Opportunities." },
  { id: "r7", title: "Dashain or Tihar festival visit (seasonal)", category: "activity", view: "nepal", interests: ["festivals-events", "culture-heritage"], estimatedCostUSD: 0, note: "Timing-dependent — check the Events tab for corridor meetups during festival season before booking flights." },
  { id: "r8", title: "Diaspora business mixer (NABIS / Chamber events)", category: "activity", view: "us", interests: ["business-networking"], estimatedCostUSD: 25, note: "Check the Events tab for the current NABIS/Chamber calendar — ticket price varies by event." },
  { id: "r9", title: "Cross-border sourcing trip (US buyer meets Nepal vendor)", category: "activity", view: "bridge", interests: ["business-networking", "shopping-crafts"], estimatedCostUSD: 0, note: "No fixed cost — coordinate directly with a Vendor Showcase business; several already do freight-split arrangements (see Business Opportunities channel)." },
  { id: "r10", title: "Domestic flight, Kathmandu ↔ Pokhara", category: "transport", view: "nepal", interests: [], estimatedCostUSD: 130, note: "Round trip, standard fare. Book a week ahead in peak season (Oct–Nov, Mar–Apr)." },
  { id: "r11", title: "Mid-range hotel, Kathmandu (per night)", category: "stay", view: "nepal", interests: [], estimatedCostUSD: 45, note: "3-star equivalent, Thamel or Boudha area. Budget guesthouses run $10–15/night; high-end $150+." },
  { id: "r12", title: "Private driver, Kathmandu Valley day trip", category: "transport", view: "nepal", interests: ["culture-heritage", "shopping-crafts"], estimatedCostUSD: 55, note: "Full day, driver + fuel. Cheaper than a tour package if you already have a plan." },
];

export function recommendationsFor(view: View, interests: InterestSlug[]): RecommendationTemplate[] {
  return RECOMMENDATION_TEMPLATES.filter((r) => {
    const viewMatch = view === "bridge" ? true : r.view === view || r.view === "bridge";
    if (!viewMatch) return false;
    if (interests.length === 0) return true;
    return r.interests.length === 0 || r.interests.some((i) => interests.includes(i));
  });
}
