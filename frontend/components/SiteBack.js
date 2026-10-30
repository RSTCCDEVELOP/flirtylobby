// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import BackButton from "./BackButton";

// A "back" button on every page of the website (not on the home page): to the page the visitor came from, else to the home page.
// (The dashboard has its own, in its menu bar.)
export default function SiteBack() {
  const pathname = usePathname();
  useEffect(() => { // the button hangs just under the header, whatever its height (the menu can wrap onto a second row), with a little space
    const set = () => {
      const h = document.querySelector(".site-header");
      document.documentElement.style.setProperty("--site-back-top", `${Math.max(0, Math.round(h ? h.getBoundingClientRect().bottom : 0)) + 12}px`);
    };
    set();
    const h = document.querySelector(".site-header");
    const ro = h && typeof ResizeObserver !== "undefined" ? new ResizeObserver(set) : null;
    if (ro) ro.observe(h);
    window.addEventListener("resize", set); window.addEventListener("scroll", set, { passive: true });
    return () => { ro?.disconnect(); window.removeEventListener("resize", set); window.removeEventListener("scroll", set); };
  }, [pathname]);
  if (!pathname || pathname === "/" || pathname.startsWith("/dashboard")) return null;
  return <div className="site-back"><BackButton pathname={pathname} fallback="/" /></div>;
}
