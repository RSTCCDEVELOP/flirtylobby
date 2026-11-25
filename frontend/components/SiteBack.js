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

// The back button of a page. It is only there when the editor switched it on for that page (page editor -> Pagina -> Terug-knop);
// cfg = {on, pos: left|center|right, place: page|float, size: sm|md|lg}. "page" = in the page above the content, "float" = fixed just under the header.
export default function SiteBack({ cfg }) {
  const pathname = usePathname();
  const float = cfg?.on && cfg.place === "float";
  useEffect(() => {
    if (!float) return undefined;
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
  }, [float, pathname]);
  if (!cfg?.on || !pathname || pathname.startsWith("/dashboard")) return null;
  return <div className={`site-back ${float ? "float" : "inpage"}`} data-pos={cfg.pos || "left"} data-size={cfg.size || "md"}><BackButton pathname={pathname} fallback="/" /></div>;
}
