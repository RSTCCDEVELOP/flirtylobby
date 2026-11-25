// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

// The starting values of the admin and the dashboards (Admin -> easy2edit admin setup). One request for the whole page; every screen reads it with useAdminSetup().
// A choice of the person himself (tiles or list, page size, sidebar) always wins over these values.
export const SETUP_DEFAULTS = { view: "tiles", page_size: "all", hidden_tiles: [], blocks: { ai: true, presets: true, backup: true, about: true }, sidebar: "remember", menu_search: true };
let cache = null, pending = null;
const listeners = new Set();

export function loadAdminSetup(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (!pending || force) pending = api("/admin-setup/").then((d) => { cache = d.settings; listeners.forEach((f) => f(cache)); return cache; }).catch(() => cache || SETUP_DEFAULTS).finally(() => { pending = null; });
  return pending;
}

export function setAdminSetup(next) { cache = next; listeners.forEach((f) => f(next)); }

export function useAdminSetup() {
  const [s, setS] = useState(cache || SETUP_DEFAULTS);
  useEffect(() => {
    let live = true;
    listeners.add(setS);
    loadAdminSetup().then((v) => { if (live) setS(v); });
    return () => { live = false; listeners.delete(setS); };
  }, []);
  return s;
}
