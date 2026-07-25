import { describe, it, expect } from "vitest";
import { assembleBio } from "../bioAssembler";
import { EMPTY_ANSWERS, type Answers } from "../answers";
import { SERVICE_CATALOG, CUSTOMER_CHIPS, YEARS_CHIPS } from "../serviceCatalog";

const WORKED: Answers = {
  ...EMPTY_ANSWERS,
  services: ["trekking", "guided-tours", "homestay"],
  customers: ["tourists", "diaspora"],
  years: "3-10",
  crossborder: "yes",
};

const EN_EXPECTED =
  "Annapurna Trails & Stays is a tourism and hospitality business in Pokhara, Nepal, operating for 3 to 10 years. We offer trekking, guided tours and homestay. We work with tourists and visitors and Nepalis living abroad. We are open to working with partners and buyers in the United States.";

const NE_EXPECTED =
  "Annapurna Trails & Stays पोखरा, नेपालमा रहेको पर्यटन तथा आतिथ्य क्षेत्रको व्यवसाय हो, जुन ३ देखि १० वर्षदेखि सञ्चालनमा छ। हामी ट्रेकिङ, गाइड सहितको भ्रमण र होमस्टे सेवा उपलब्ध गराउँछौं। हामी पर्यटक तथा आगन्तुक र विदेशमा रहेका नेपालीहरूसँग काम गर्छौं। हामी संयुक्त राज्य अमेरिकाका साझेदार तथा खरिदकर्ताहरूसँग काम गर्न इच्छुक छौं।";

describe("assembleBio — worked example (§8)", () => {
  it("matches the EN worked example exactly", () => {
    expect(
      assembleBio({ name: "Annapurna Trails & Stays", city: "Pokhara", primarySector: "tourism-hospitality", answers: WORKED, locale: "en" }),
    ).toBe(EN_EXPECTED);
  });

  it("matches the NE worked example exactly", () => {
    expect(
      assembleBio({ name: "Annapurna Trails & Stays", city: "Pokhara", primarySector: "tourism-hospitality", answers: WORKED, locale: "ne" }),
    ).toBe(NE_EXPECTED);
  });
});

describe("assembleBio — sparse answers omit sentences cleanly", () => {
  const sparse: Answers = { ...EMPTY_ANSWERS, services: ["trekking"] };
  const en = assembleBio({ name: "Solo Guides", city: null, primarySector: "tourism-hospitality", answers: sparse, locale: "en" });
  const ne = assembleBio({ name: "Solo Guides", city: null, primarySector: "tourism-hospitality", answers: sparse, locale: "ne" });

  it("omits sentences 3–5 when their input is empty", () => {
    expect(en).toBe("Solo Guides is a tourism and hospitality business in Nepal. We offer trekking.");
    expect(en).not.toContain("We work with");
    expect(en).not.toContain("United States");
  });

  it("has no dangling comma, double space, empty parens, and ends in one terminator", () => {
    for (const s of [en, ne]) {
      expect(s).not.toMatch(/, ?[.।]/); // no ", ." or ", ।"
      expect(s).not.toMatch(/ {2,}/); // no double space
      expect(s).not.toMatch(/\(\s*\)/); // no empty parens
      expect(s).not.toMatch(/[.।]{2,}$/); // not a double terminator
    }
    expect(en.endsWith(".")).toBe(true);
    expect(ne.endsWith("।")).toBe(true);
  });
});

describe("assembleBio — never leaks a raw chip id", () => {
  const ids = [
    ...Object.values(SERVICE_CATALOG).flat().map((c) => c.id),
    ...CUSTOMER_CHIPS.map((c) => c.id),
    ...YEARS_CHIPS.map((c) => c.id),
  ];
  it("emits labels, not ids (no hyphenated id appears verbatim)", () => {
    const en = assembleBio({ name: "X", city: "Pokhara", primarySector: "tourism-hospitality", answers: WORKED, locale: "en" });
    for (const id of ids) if (id.includes("-")) expect(en).not.toContain(id);
  });
});

describe("assembleBio — NE has no Latin digits (name exempt)", () => {
  it("uses Devanagari numerals only", () => {
    const ne = assembleBio({ name: "Annapurna Trails & Stays", city: "Pokhara", primarySector: "tourism-hospitality", answers: WORKED, locale: "ne" });
    // The worked-example name carries no digits, so the whole NE output should be Latin-digit-free.
    expect(ne).not.toMatch(/[0-9]/);
  });
});
