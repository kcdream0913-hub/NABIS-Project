import { describe, it, expect } from "vitest";
import {
  REACTION_KINDS,
  REACTION_KIND_LIST,
  nextReaction,
  reactionCountDelta,
  summaryEmojis,
  totalReactions,
  type ReactionKind,
} from "../reactions";

// §5.1 — the reaction set is the single source of truth.
describe("REACTION_KINDS", () => {
  it("has exactly 5 entries", () => {
    expect(REACTION_KINDS).toHaveLength(5);
  });

  it("matches the DB CHECK list exactly, in order", () => {
    expect(REACTION_KIND_LIST).toEqual([
      "like",
      "celebrate",
      "support",
      "insightful",
      "namaste",
    ]);
  });

  it("every entry has an emoji, labelEn and labelNe", () => {
    for (const r of REACTION_KINDS) {
      expect(r.emoji.length).toBeGreaterThan(0);
      expect(r.labelEn.trim().length).toBeGreaterThan(0);
      expect(r.labelNe.trim().length).toBeGreaterThan(0);
    }
  });

  it("has no negative reaction (§3)", () => {
    const banned = ["dislike", "down", "angry", "sad", "thumbsdown"];
    expect(REACTION_KIND_LIST.some((k) => banned.includes(k))).toBe(false);
  });
});

// §5.2 — same kind twice = removal; different kind = change, not add.
describe("reaction toggle logic", () => {
  it("tapping the held kind removes it", () => {
    expect(nextReaction("like", "like")).toBeNull();
    expect(reactionCountDelta("like", null)).toBe(-1);
  });

  it("tapping a different kind changes it (count unchanged)", () => {
    expect(nextReaction("like", "namaste")).toBe("namaste");
    expect(reactionCountDelta("like", "namaste")).toBe(0);
  });

  it("tapping from none adds it", () => {
    expect(nextReaction(null, "celebrate")).toBe("celebrate");
    expect(reactionCountDelta(null, "celebrate")).toBe(1);
  });

  it("count math: add then change then remove nets to zero", () => {
    let count = 10;
    let mine: ReactionKind | null = null;
    const apply = (tapped: ReactionKind) => {
      const next = nextReaction(mine, tapped);
      count += reactionCountDelta(mine, next);
      mine = next;
    };
    apply("like"); // +1 -> 11
    apply("support"); // change -> 11
    apply("support"); // remove -> 10
    expect(count).toBe(10);
    expect(mine).toBeNull();
  });
});

describe("summary row", () => {
  it("shows up to 3 distinct emojis, most-used first", () => {
    const counts = { like: 5, celebrate: 1, support: 9, insightful: 2 };
    // support(9) > like(5) > insightful(2), celebrate(1) drops off at max 3
    expect(summaryEmojis(counts, 3)).toEqual(["🤝", "👍", "💡"]);
  });

  it("totalReactions sums all kinds", () => {
    expect(totalReactions({ like: 3, namaste: 4 })).toBe(7);
    expect(totalReactions({})).toBe(0);
  });
});
