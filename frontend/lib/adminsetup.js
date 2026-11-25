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
export const SETUP_DEFAULTS = { view: "tiles", page_size: "all", hidden_tiles: [], blocks: { ai: true, presets: true, backup: true, about: true }, sidebar: "remember", menu_search: true, sidebar_width: "normal", width: "full", density: "normal", tile_size: "normal", font: "normal", frame: "dark", reduce_motion: false };
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

// The look of the admin (tab Uiterlijk): set as data-adm-* attributes on <html>; globals.css does the rest. Called by the shell of the dashboard, so a change shows at once.
export function applyAdminLook(s) {
  const el = document.documentElement;
  const set = (k, v, dflt) => { if (v && v !== dflt) el.setAttribute(`data-adm-${k}`, v); else el.removeAttribute(`data-adm-${k}`); };
  set("width", s.width, "full"); set("density", s.density, "normal"); set("tile", s.tile_size, "normal"); set("font", s.font, "normal"); set("frame", s.frame, "dark"); set("sbw", s.sidebar_width, "normal");
  if (s.reduce_motion) el.setAttribute("data-adm-motion", "off"); else el.removeAttribute("data-adm-motion");
}
export function clearAdminLook() { ["width", "density", "tile", "font", "sbw", "motion", "frame"].forEach((k) => document.documentElement.removeAttribute(`data-adm-${k}`)); }
