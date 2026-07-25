import { describe, it, expect } from "vitest";
import { parseAnswers, safeParseAnswers, EMPTY_ANSWERS, type Answers } from "../answers";

describe("answers schema", () => {
  it("round-trips through JSON.stringify/parse unchanged", () => {
    const a: Answers = {
      services: ["trekking", "homestay"],
      customers: ["tourists"],
      years: "3-10",
      differentiator: "We are family-run since 1998",
      differentiatorLocale: "en",
      crossborder: "yes",
      extraServices: "airport pickup",
    };
    const round = parseAnswers(JSON.parse(JSON.stringify(a)));
    expect(round).toEqual(a);
  });

  it("fills defaults for a sparse/empty blob", () => {
    expect(parseAnswers({})).toEqual(EMPTY_ANSWERS);
  });

  it("rejects services longer than the catalog bound", () => {
    const over = { services: ["a", "b", "c", "d", "e"] };
    expect(safeParseAnswers(over, { maxServices: 4 }).success).toBe(false);
  });

  it("rejects an invalid crossborder value", () => {
    expect(safeParseAnswers({ crossborder: "maybe" }).success).toBe(false);
  });

  it("rejects an invalid differentiatorLocale", () => {
    expect(safeParseAnswers({ differentiatorLocale: "fr" }).success).toBe(false);
  });

  it("coerces blank strings to null", () => {
    expect(parseAnswers({ differentiator: "   ", years: "" })).toMatchObject({
      differentiator: null,
      years: null,
    });
  });
});
