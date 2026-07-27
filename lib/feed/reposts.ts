// BL-SOCIAL-02 §4.1/§4.5 + R6 — repost target rules, mirrored from the DB trigger
// enforce_repost_view(): a post may be reposted into its OWN view or into bridge,
// nothing else. A `nepal` post reposted into `us` is a cross-view leak; the trigger
// rejects it and so must the UI — never render a control the trigger will reject.

export type PostView = "us" | "nepal" | "bridge";

// Allowed repost targets for a post of the given view.
//   us     -> [us, bridge]
//   nepal  -> [nepal, bridge]
//   bridge -> [bridge]
export function repostTargets(postView: PostView): PostView[] {
  return postView === "bridge" ? ["bridge"] : [postView, "bridge"];
}

// §4.1: the cross-view repost control is offered only when the viewer's current
// view is `bridge` or matches the post's view. Combined with repostTargets so the
// UI can decide, per (postView, currentView), exactly which targets to show.
export function visibleRepostTargets(
  postView: PostView,
  currentView: PostView,
): PostView[] {
  if (currentView !== "bridge" && currentView !== postView) return [];
  return repostTargets(postView);
}

export type ShareChannel = "dm" | "copy_link" | "native";
