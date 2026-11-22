// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

// Do the screens of Ecologi exist? `enabled`: the management screens (a superadmin, while the module and the API -- the link "Ecologi" in Admin -> API keys -- are on); `admin`: the tile "Bomen en giften"
// of the administrator (the superadmin allowed it). Used by the menus and the tiles.
let cached = null;
export function useEcologiState() {
  const [st, setSt] = useState(cached?.st || { enabled: false, admin: false });
  useEffect(() => {
    let live = true;
    const load = () => api("/ecologi/state/").then((r) => { cached = { st: { enabled: !!r.enabled, admin: !!r.admin }, at: Date.now() }; if (live) setSt(cached.st); }).catch(() => { if (live) setSt({ enabled: false, admin: false }); });
    if (!cached || Date.now() - cached.at > 30000) load(); else setSt(cached.st);
    const again = () => { cached = null; load(); };
    window.addEventListener("integrations-changed", again);
    return () => { live = false; window.removeEventListener("integrations-changed", again); };
  }, []);
  return st;
}
export const useEcologiOn = () => useEcologiState().enabled;
export const useEcologiAdminOn = () => useEcologiState().admin;
