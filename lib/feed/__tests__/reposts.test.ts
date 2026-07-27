import { describe, it, expect } from "vitest";
import { repostTargets, visibleRepostTargets } from "../reposts";

// §5.6 — repost view options mirror the DB trigger enforce_repost_view().
describe("repostTargets", () => {
  it("a nepal post may repost to exactly nepal and bridge", () => {
    expect(repostTargets("nepal")).toEqual(["nepal", "bridge"]);
  });

  it("a us post may repost to exactly us and bridge", () => {
    expect(repostTargets("us")).toEqual(["us", "bridge"]);
  });

  it("a bridge post may repost only to bridge", () => {
    expect(repostTargets("bridge")).toEqual(["bridge"]);
  });
});

// §4.1 — the control shows only when the viewer's view is bridge or matches.
describe("visibleRepostTargets", () => {
  it("hides the control when viewing a nepal post from the us view", () => {
    expect(visibleRepostTargets("nepal", "us")).toEqual([]);
  });

  it("offers nepal+bridge for a nepal post viewed from bridge", () => {
    expect(visibleRepostTargets("nepal", "bridge")).toEqual(["nepal", "bridge"]);
  });

  it("offers nepal+bridge for a nepal post viewed from nepal", () => {
    expect(visibleRepostTargets("nepal", "nepal")).toEqual(["nepal", "bridge"]);
  });
});
