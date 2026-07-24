import { describe, it, expect } from "vitest";
import {
  destinationCountryFor,
  directionEndpoints,
  offeringTypeToCategory,
  offeringMatchesTrip,
  matchOfferings,
  rangesOverlap,
  type TripFilter,
} from "../tripPlanner";
import type { Offering } from "../offerings";

function offering(partial: Partial<Offering>): Offering {
  return {
    id: "o", owner_type: "profile", business_id: null, profile_id: "p", sector: "tourism-hospitality",
    type: "trek", title: "T", title_ne: null, description: null, description_ne: null,
    country: null, region: null, direction_tags: [], price_from: null, price_currency: "USD",
    price_unit: "per_person", duration_days: null, group_min: null, group_max: null,
    seasons: [], festival_slugs: [], available_from: null, available_to: null, media: [],
    status: "published", created_at: "2026-01-01", updated_at: "2026-01-01",
    ...partial,
  };
}

const trip = (p: Partial<TripFilter>): TripFilter => ({ direction: "", destinationCountry: null, startDate: "", endDate: "", ...p });

describe("directionEndpoints / destinationCountryFor", () => {
  it("maps the fixed directions to ISO endpoints", () => {
    expect(directionEndpoints("np_to_us")).toEqual({ origin: "NP", destination: "US" });
    expect(directionEndpoints("us_to_np")).toEqual({ origin: "US", destination: "NP" });
    expect(directionEndpoints("other")).toEqual({ origin: null, destination: null });
  });
  it("derives the destination corridor side", () => {
    expect(destinationCountryFor("np_to_us")).toBe("us");
    expect(destinationCountryFor("us_to_np")).toBe("np");
    expect(destinationCountryFor("other", "NP")).toBe("np");
    expect(destinationCountryFor("other", "FR")).toBe(null);
  });
});

describe("offeringTypeToCategory", () => {
  it("buckets types into the 5 budget categories", () => {
    expect(offeringTypeToCategory("stay")).toBe("stay");
    expect(offeringTypeToCategory("transport")).toBe("transport");
    expect(offeringTypeToCategory("food_experience")).toBe("food");
    expect(offeringTypeToCategory("trek")).toBe("activity");
    expect(offeringTypeToCategory("event_package")).toBe("activity");
  });
});

describe("rangesOverlap", () => {
  it("open bounds always overlap", () => expect(rangesOverlap(null, null, null, null)).toBe(true));
  it("disjoint ranges do not overlap", () => expect(rangesOverlap("2026-01-01", "2026-01-10", "2026-02-01", "2026-02-05")).toBe(false));
  it("touching ranges overlap", () => expect(rangesOverlap("2026-01-01", "2026-02-01", "2026-02-01", "2026-03-01")).toBe(true));
});

describe("offeringMatchesTrip", () => {
  it("empty direction_tags match any direction", () => {
    expect(offeringMatchesTrip(offering({ direction_tags: [] }), trip({ direction: "np_to_us" }))).toBe(true);
  });
  it("non-empty tags must include the chosen direction", () => {
    expect(offeringMatchesTrip(offering({ direction_tags: ["us_to_np"] }), trip({ direction: "np_to_us" }))).toBe(false);
    expect(offeringMatchesTrip(offering({ direction_tags: ["np_to_us"] }), trip({ direction: "np_to_us" }))).toBe(true);
  });
  it("country only excludes when both sides are known and differ", () => {
    expect(offeringMatchesTrip(offering({ country: "np" }), trip({ destinationCountry: "us" }))).toBe(false);
    expect(offeringMatchesTrip(offering({ country: null }), trip({ destinationCountry: "us" }))).toBe(true);
  });
  it("date window must overlap the trip when both are set", () => {
    const o = offering({ available_from: "2026-06-01", available_to: "2026-06-30" });
    expect(offeringMatchesTrip(o, trip({ startDate: "2026-07-01", endDate: "2026-07-10" }))).toBe(false);
    expect(offeringMatchesTrip(o, trip({ startDate: "2026-06-15", endDate: "2026-06-20" }))).toBe(true);
  });
});

describe("matchOfferings", () => {
  it("ranks interest-matching offerings first without excluding others", () => {
    const trek = offering({ id: "trek", type: "trek" });
    const stay = offering({ id: "stay", type: "stay" });
    const ranked = matchOfferings([stay, trek], trip({}), ["trekking-outdoors"]);
    expect(ranked.map((o) => o.id)).toEqual(["trek", "stay"]);
    expect(ranked).toHaveLength(2);
  });
});
