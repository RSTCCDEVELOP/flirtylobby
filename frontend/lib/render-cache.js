// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { cache as perRequest } from "react";

// The page cache of the web server (Admin -> Cache, on by default): the public answers that every page needs (theme, branding, languages, modules, menu ...) are kept for a moment in the
// memory of the web server, so a page does not ask the backend for them again and again. Every page view makes ONE fresh call to /api/site/: it carries the setting and a generation number;
// when anything is changed in the system (the backend starts a new generation) everything kept here is dropped at once, so an edit shows immediately.
const API = () => process.env.API_URL_INTERNAL || "http://localhost:8000";
const store = new Map();  // address -> { t, data }
const cfg = { on: true, ttl: 60000, gen: null };

export const renderConfig = perRequest(async () => {
  try {
    const res = await fetch(`${API()}/api/site/`, { cache: "no-store" });
    const site = res.ok ? await res.json() : null;
    if (site) {
      cfg.on = site.page_cache !== false;
      cfg.ttl = Math.max(5, Number(site.page_cache_seconds) || 60) * 1000;
      if (site.cache_gen !== cfg.gen) { store.clear(); cfg.gen = site.cache_gen; }
    }
    return site;
  } catch {
    return null;
  }
});

// Like fetch(address) for a public GET that is the same for every visitor; returns something with ok, status and json(). Only answers that went well are kept.
export async function cachedFetch(url) {
  await renderConfig();
  const hit = cfg.on ? store.get(url) : null;
  if (hit && Date.now() - hit.t < cfg.ttl) return { ok: true, status: 200, json: async () => structuredClone(hit.data) };
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return res;
  const data = await res.json();
  if (cfg.on) {
    if (store.size > 500) store.clear();
    store.set(url, { t: Date.now(), data });
  }
  return { ok: true, status: res.status, json: async () => structuredClone(data) };
}
