// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect } from "react";
import { api } from "../lib/api";

// The server of Next could not ask for the theme (the backend was not reachable for it, for instance with an untrusted https certificate): then the colours, fonts and styles come from the browser.
export default function ThemeFallback({ has, stamp }) {  // stamp: changes with every render of the layout (also after router.refresh()), so a changed theme is asked for again
  useEffect(() => {
    if (has) return;
    api("/theme/").then((t) => {
      if (!t) return;
      if (t.fonts_url && !document.querySelector(`link[href="${t.fonts_url}"]`)) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = t.fonts_url; document.head.appendChild(l); }
      if (t.css) { let s = document.getElementById("theme-live"); if (!s) { s = document.createElement("style"); s.id = "theme-live"; document.head.appendChild(s); } s.textContent = t.css; }
    }).catch(() => {});
  }, [has, stamp]);
  return null;
}
