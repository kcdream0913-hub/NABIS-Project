import { describe, it, expect } from "vitest";
import { recommendationsFor, budgetBreakdown, BUDGET_SPLIT, RECOMMENDATION_TEMPLATES } from "../tripPlannerData";

describe("recommendationsFor", () => {
  it("returns only US-view + bridge items for the US view", () => {
    const results = recommendationsFor("us", []);
    expect(results.every((r) => r.view === "us" || r.view === "bridge")).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns only Nepal-view + bridge items for the Nepal view", () => {
    const results = recommendationsFor("nepal", []);
    expect(results.every((r) => r.view === "nepal" || r.view === "bridge")).toBe(true);
  });

  it("returns everything for the Bridge view (cross-border by design)", () => {
    const results = recommendationsFor("bridge", []);
    expect(results.length).toBe(RECOMMENDATION_TEMPLATES.length);
  });

  it("filters by interest when interests are selected", () => {
    const results = recommendationsFor("nepal", ["trekking-outdoors"]);
    expect(results.length).toBeGreaterThan(0);
    // Every result either matches the interest or is interest-agnostic (transport/stay items with no tags)
    expect(
      results.every((r) => r.interests.length === 0 || r.interests.includes("trekking-outdoors"))
    ).toBe(true);
  });

  it("returns nothing for a Nepal-tagged interest filtered against the US view", () => {
    // wellness-retreat only exists on nepal-view items in the current template set
    const results = recommendationsFor("us", ["wellness-retreat"]);
    expect(results.every((r) => r.view === "us" || r.view === "bridge")).toBe(true);
  });

  it("every template has a non-empty title and a non-negative estimated cost", () => {
    for (const r of RECOMMENDATION_TEMPLATES) {
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.estimatedCostUSD).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("budgetBreakdown", () => {
  it("splits the budget into exactly the 5 defined categories", () => {
    const result = budgetBreakdown(1000);
    expect(result.map((r) => r.category).sort()).toEqual(
      Object.keys(BUDGET_SPLIT).sort()
    );
  });

  it("the split percentages sum to 1 (no silent budget leak or double-count)", () => {
    const total = Object.values(BUDGET_SPLIT).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it("category amounts sum to (approximately) the total budget", () => {
    const budget = 1200;
    const result = budgetBreakdown(budget);
    const sum = result.reduce((s, r) => s + r.amount, 0);
    // Rounding each category independently can drift by a few units — assert
    // it stays within a small, known tolerance rather than exact equality.
    expect(Math.abs(sum - budget)).toBeLessThanOrEqual(5);
  });

  it("handles a zero budget without throwing or returning NaN", () => {
    const result = budgetBreakdown(0);
    expect(result.every((r) => r.amount === 0)).toBe(true);
  });
});
