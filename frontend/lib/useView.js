// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import { tx } from "./t";
import { useAdminSetup } from "./adminsetup";

// THE matching of every search field of the system: not sensitive for capitals and accents, and every text is searched in what the person SEES (the translation) and in the Dutch source text,
// so "sandbox" and "testomgeving" both find the tile, in every language.
export const norm = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export const haystack = (texts) => norm(texts.flat().filter(Boolean).flatMap((t) => { const s = String(t); let seen = s; try { seen = tx(s); } catch {} return seen === s ? [s] : [s, seen]; }).join(" "));
export const matches = (q, ...texts) => { const words = norm(q).split(/\s+/).filter(Boolean); if (!words.length) return true; const h = haystack(texts); return words.every((w) => h.includes(w)); };

// Tiles or list, per screen, remembered for this user (localStorage "view:<id>"). The search text is not remembered.
// const view = useView("integrations");  view.mode = "tiles" | "list";  view.q = search text;  view.match(...texts) -> bool
export function useView(id, initial = "tiles") {
  const [mode, setModeState] = useState(initial);
  const [q, setQ] = useState("");
  const site = useAdminSetup().view;  // the starting value of the website (easy2edit admin setup); the own choice of the person wins
  useEffect(() => {
    let own = "";
    try { const v = localStorage.getItem(`view:${id}`); if (v === "tiles" || v === "list") own = v; } catch {}
    if (own) setModeState(own);
    else if (initial === "tiles" && (site === "tiles" || site === "list")) setModeState(site);
  }, [id, site, initial]);
  const setMode = useCallback((m) => {
    setModeState(m);
    try { localStorage.setItem(`view:${id}`, m); } catch {}
  }, [id]);
  const match = useCallback((...texts) => matches(q, ...texts), [q]);
  useEffect(() => { // the search field above the tiles of Admin (TileSearch) drives the lists on the page too
    const on = (e) => setQ(String(e.detail ?? ""));
    window.addEventListener("tilesearch", on);
    return () => window.removeEventListener("tilesearch", on);
  }, []);
  return { id, mode, setMode, q, setQ, match, cls: mode === "list" ? " view-list" : "" };
}
