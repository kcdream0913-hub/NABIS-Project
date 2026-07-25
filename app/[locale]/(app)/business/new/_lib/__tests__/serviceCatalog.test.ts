import { describe, it, expect } from "vitest";
import {
  SECTOR_SLUGS, SERVICE_CATALOG, SECTOR_BIO_LABEL, CUSTOMER_CHIPS, YEARS_CHIPS, CROSSBORDER_CHIPS,
} from "../serviceCatalog";

describe("serviceCatalog integrity", () => {
  it("every one of the 15 sectors has a non-empty catalog", () => {
    expect(SECTOR_SLUGS).toHaveLength(15);
    for (const slug of SECTOR_SLUGS) {
      expect(SERVICE_CATALOG[slug]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("every chip has non-empty en and ne, and ids are unique within a sector", () => {
    for (const slug of SECTOR_SLUGS) {
      const chips = SERVICE_CATALOG[slug];
      const ids = new Set<string>();
      for (const c of chips) {
        expect(c.en.trim()).not.toBe("");
        expect(c.ne.trim()).not.toBe("");
        expect(ids.has(c.id)).toBe(false);
        ids.add(c.id);
      }
    }
  });

  it("every sector has a bilingual bio label", () => {
    for (const slug of SECTOR_SLUGS) {
      expect(SECTOR_BIO_LABEL[slug].en.trim()).not.toBe("");
      expect(SECTOR_BIO_LABEL[slug].ne.trim()).not.toBe("");
    }
  });

  it("fixed chip lists are complete and bilingual", () => {
    for (const list of [CUSTOMER_CHIPS, YEARS_CHIPS, CROSSBORDER_CHIPS]) {
      expect(list.length).toBeGreaterThan(0);
      for (const c of list) {
        expect(c.en.trim()).not.toBe("");
        expect(c.ne.trim()).not.toBe("");
      }
    }
  });
});
