// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// Where a link opens: "self" (the same window), "tab" (a new tab) or "window" (a new, separate window).
export const OPEN_OPTIONS = [["self", "Zelfde venster"], ["tab", "Nieuw tabblad"], ["window", "Nieuw venster"]];
export const WINDOW_FEATURES = "popup=yes,width=1100,height=750,noopener,noreferrer";

// the choice of a stored object: `open`, or the older yes/no `new_tab`
export const openOf = (o) => (o?.open === "tab" || o?.open === "window" ? o.open : o?.new_tab ? "tab" : "self");

// props for an <a> / <Link>: a new tab uses target, a new window opens through window.open
export function linkProps(o) {
  const v = openOf(o);
  if (v === "tab") return { target: "_blank", rel: "noopener noreferrer" };
  if (v === "window") return { rel: "noopener noreferrer", onClick: (e) => { const h = e.currentTarget.href; if (!h) return; e.preventDefault(); window.open(h, "_blank", WINDOW_FEATURES); } };
  return {};
}
