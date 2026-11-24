// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect } from "react";

// The header that sticks ("after") or appears ("start") after a part of the screen is scrolled: the theme value header_sticky is "after": the header sticks once the visitor has scrolled header_sticky_pct percent of the screen height, or header_sticky_px pixels (header_sticky_unit says which). Past that, <html data-hstuck="1"> is set
// and the style sheet fixes the header at the top (the other values, "yes" and "no", need nothing here). A change of the value in the editor is followed at once.
export default function StickyHeader() {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (root.dataset.hsticky !== "after" && root.dataset.hsticky !== "start") { if (root.dataset.hstuck) delete root.dataset.hstuck; return; }
        const at = Number(root.dataset.hstickyat) || 0;
        const far = root.dataset.hstickyunit === "px" ? at : (at / 100) * window.innerHeight;  // pixels, or a percentage of the screen height
        if (window.scrollY > far) root.dataset.hstuck = "1"; else delete root.dataset.hstuck;
      });
    };
    run();
    window.addEventListener("scroll", run, { passive: true });
    window.addEventListener("resize", run);
    const mo = new MutationObserver(run);
    mo.observe(root, { attributes: true, attributeFilter: ["data-hsticky", "data-hstickyat", "data-hstickyunit"] });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", run); window.removeEventListener("resize", run); mo.disconnect(); delete root.dataset.hstuck; };
  }, []);
  return null;
}
