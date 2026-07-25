import { describe, it, expect } from "vitest";
import { localizeCountry, localizeCity } from "../localizePlace";

describe("localizeCountry", () => {
  it("localizes US variants to अमेरिका in ne", () => {
    expect(localizeCountry("ne", "United States")).toBe("अमेरिका");
    expect(localizeCountry("ne", "USA")).toBe("अमेरिका");
    expect(localizeCountry("ne", "us")).toBe("अमेरिका");
  });
  it("localizes Nepal to नेपाल in ne", () => {
    expect(localizeCountry("ne", "Nepal")).toBe("नेपाल");
  });
  it("keeps the stored value in en", () => {
    expect(localizeCountry("en", "United States")).toBe("United States");
  });
  it("falls back to the stored value for unknown countries", () => {
    expect(localizeCountry("ne", "Canada")).toBe("Canada");
  });
  it("returns empty for null/blank", () => {
    expect(localizeCountry("ne", null)).toBe("");
    expect(localizeCountry("ne", "  ")).toBe("");
  });
});

describe("localizeCity", () => {
  it("localizes corridor (Nepal) cities in ne", () => {
    expect(localizeCity("ne", "Kathmandu")).toBe("काठमाडौँ");
    expect(localizeCity("ne", "pokhara")).toBe("पोखरा");
    expect(localizeCity("ne", "Lalitpur")).toBe("ललितपुर");
  });
  it("leaves US cities in Latin (fallback)", () => {
    expect(localizeCity("ne", "New York")).toBe("New York");
    expect(localizeCity("ne", "Dallas")).toBe("Dallas");
  });
  it("keeps the stored value in en", () => {
    expect(localizeCity("en", "Kathmandu")).toBe("Kathmandu");
  });
});
