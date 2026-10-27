// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// In the editor every pop-up opens at the button that was clicked (not in the middle of the screen, not far away at a corner).
// `anchorFromEvent(e)` takes the place of a click (the button under it); `anchorStyle(anchor, width)` gives the fixed position that keeps the pop-up inside the window.

export function anchorFromEvent(e) {
  const el = e?.target?.closest?.("button, a, [role='button']");
  if (!el || typeof window === "undefined") return null;
  const b = el.getBoundingClientRect();
  return { left: b.left, top: b.bottom + 8, bottom: b.top };
}

export function anchorStyle(anchor, width = 520) {
  if (typeof window === "undefined" || !anchor) return undefined;
  const w = Math.min(width, window.innerWidth - 16);
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - w - 8));
  const top = Math.max(8, Math.min(anchor.top, window.innerHeight - 320));
  return { position: "fixed", top, left, width: w, margin: 0, maxHeight: `calc(100vh - ${top}px - .8rem)`, overflow: "auto" };
}
