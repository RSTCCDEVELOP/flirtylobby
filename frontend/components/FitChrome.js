// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef } from "react";

// In the page editor the outline, the bar and the buttons of a system object or widget follow what it really shows: never wider than the object, not over the whole block. The object is measured by
// what it paints (text, pictures, buttons, anything with a background, border or shadow): the left and right edge of that. A widget in a frame tells its own box (the frame stores it as data-box-l / data-box-r).
// The edges are put on the item as the variables --bx-l and --bx-w (px, from the left of the item) and data-box; the style sheet draws the outline and puts the bar there. Without a box (empty, hidden) the whole item counts.
const PAINTS = /^(img|svg|canvas|video|input|button|select|textarea)$/i;
export function paintedBox(root) {
  let l = Infinity, r = -Infinity;
  const add = (a, b) => { if (b - a > 0) { if (a < l) l = a; if (b > r) r = b; } };
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) {
      if (!n.nodeValue.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) add(q.left, q.right);
      continue;
    }
    const cs = getComputedStyle(n);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    if (n.tagName === "IFRAME") {  // a widget: the frame tells where its own content is
      const q = n.getBoundingClientRect();
      if (n.dataset.boxL !== undefined) add(q.left + Number(n.dataset.boxL), q.left + Number(n.dataset.boxR));
      else if (q.width > 1) add(q.left, q.right);
      continue;
    }
    let paints = PAINTS.test(n.tagName);
    if (!paints) {
      const bg = cs.backgroundColor;
      paints = (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") || cs.backgroundImage !== "none" || cs.boxShadow !== "none"
        || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0 || parseFloat(cs.borderRightWidth) > 0;
    }
    if (paints) { const q = n.getBoundingClientRect(); add(q.left, q.right); }
  }
  return l === Infinity ? null : { l, r };
}

export default function FitChrome({ children }) {
  const ref = useRef(null);
  useEffect(() => {
    const box = ref.current;
    const item = box && box.closest(".pb-item");
    if (!item) return undefined;
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const b = paintedBox(box), it = item.getBoundingClientRect();
        if (!b || it.width < 1) { item.removeAttribute("data-box"); return; }
        const pad = 2;  // a little air around the object
        const l = Math.max(0, b.l - it.left - pad), r = Math.min(it.width, b.r - it.left + pad);
        item.style.setProperty("--bx-l", `${Math.round(l)}px`);
        item.style.setProperty("--bx-w", `${Math.max(24, Math.round(r - l))}px`);
        item.setAttribute("data-box", "1");
      });
    };
    run();
    const ro = new ResizeObserver(run); ro.observe(box); ro.observe(item);
    const mo = new MutationObserver(run); mo.observe(box, { subtree: true, childList: true, characterData: true, attributes: true });
    window.addEventListener("message", run);  // a widget in a frame tells its box
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); window.removeEventListener("message", run); item.removeAttribute("data-box"); };
  }, []);
  return <div ref={ref} style={{ width: "100%" }}>{children}</div>;
}
