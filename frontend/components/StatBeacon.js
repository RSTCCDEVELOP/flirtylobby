// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { apiBase } from "../lib/api";
import { useSession } from "./Session";

// Counts a page view for the statistics: the page, where the visitor came from (only on the first page of a visit) and the language.
// No cookies and nothing personal. Not for the dashboard, the login, or people who can edit.
export default function StatBeacon() {
  const path = usePathname();
  const { user, ready } = useSession();
  const last = useRef("");
  useEffect(() => {
    if (!ready || !path || path === last.current) return;
    if (path.startsWith("/dashboard") || path.startsWith("/login") || user?.is_staff) return;
    last.current = path;
    try {
      let ref = "";
      if (!sessionStorage.getItem("stat:seen")) { sessionStorage.setItem("stat:seen", "1"); ref = document.referrer || ""; }
      const lang = document.documentElement.lang || "";
      fetch(`${apiBase()}/api/stats/hit/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, referrer: ref, lang }), keepalive: true }).catch(() => {});
    } catch {}
  }, [path, ready, user]);
  return null;
}
