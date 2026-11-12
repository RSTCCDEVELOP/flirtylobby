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
import { useModules } from "./Modules";
import { useSession } from "./Session";

const SKIP = ["/dashboard", "/login", "/registreren", "/wachtwoord", "/admin"];

// Measures how heavy the page was that the visitor just loaded (all the data that came over the network and the number of requests) and tells the server.
// For the module Energie: page weight, requests and the estimated CO2 per page view. No cookies and nothing personal; not for people who can edit.
export default function EnergyBeacon() {
  const path = usePathname();
  const { user, ready } = useSession();
  const mods = useModules();
  const first = useRef(true);
  useEffect(() => {
    if (!ready || !path || mods.energy === false || user?.is_staff || SKIP.some((p) => path.startsWith(p))) return undefined;
    const from = first.current ? 0 : performance.now() - 100; // the first page: everything since the start; after that: what came in since the click
    const isFirst = first.current;
    first.current = false;
    const t = setTimeout(() => {
      try {
        let bytes = 0, requests = 0;
        const nav = performance.getEntriesByType("navigation")[0];
        if (isFirst && nav) { bytes += nav.transferSize || nav.encodedBodySize || 0; requests += 1; }
        for (const e of performance.getEntriesByType("resource")) {
          if (e.startTime < from) continue;
          if (e.transferSize === 0 && e.encodedBodySize > 0) continue; // came from the cache: nothing was sent
          requests += 1;
          bytes += e.transferSize || 0;
        }
        if (bytes < 1000 || requests < 1) return;
        fetch(`${apiBase()}/api/energy/beacon/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, bytes, requests }), keepalive: true }).catch(() => {});
      } catch { /* measuring is never allowed to break the page */ }
    }, isFirst ? 3500 : 2500);
    return () => clearTimeout(t);
  }, [path, ready, user, mods.energy]);
  return null;
}
