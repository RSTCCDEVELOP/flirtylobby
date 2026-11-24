// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect } from "react";

// The header that sticks after a part of the screen is scrolled: the theme value header_sticky is "afterNN" (NN = percent of the screen height: 10, 25, 50, 100). Past that, <html data-hstuck="1"> is set
// and the style sheet fixes the header at the top (the other values, "yes" and "no", need nothing here). A change of the value in the editor is followed at once.
export default function StickyHeader() {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const m = /^after(\d+)$/.exec(root.dataset.hsticky || "");
        if (!m) { if (root.dataset.hstuck) delete root.dataset.hstuck; return; }
        const far = (Number(m[1]) / 100) * window.innerHeight;
        if (window.scrollY > far) root.dataset.hstuck = "1"; else delete root.dataset.hstuck;
      });
    };
    run();
    window.addEventListener("scroll", run, { passive: true });
    window.addEventListener("resize", run);
    const mo = new MutationObserver(run);
    mo.observe(root, { attributes: true, attributeFilter: ["data-hsticky"] });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", run); window.removeEventListener("resize", run); mo.disconnect(); delete root.dataset.hstuck; };
  }, []);
  return null;
}
