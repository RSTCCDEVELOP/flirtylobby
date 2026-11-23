// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { notFound } from "next/navigation";
import { cache } from "react";
import { cachedFetch } from "./render-cache";

const base = () => process.env.API_URL_INTERNAL || "http://localhost:8000";

// Header menu (only what is switched on in Admin -> Pagina's)
async function getMenuRaw() {
  try {
    const res = await cachedFetch(`${base()}/api/pages/menu/`);
    if (!res.ok) return { items: [], settings: null };
    const d = await res.json();
    return { items: d.items || [], settings: d.settings || null };
  } catch {
    return { items: [], settings: null };
  }
}

// Page backgrounds (picture/video from the media library), by page path
async function getBackgroundsRaw() {
  try {
    const res = await cachedFetch(`${base()}/api/pages/backgrounds/`);
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

// Is a built-in page switched on? (unknown or unreachable = on, so the site never breaks)
export async function pageOn(key) {
  try {
    const res = await cachedFetch(`${base()}/api/pages/state/`);
    return res.ok ? (await res.json()).on?.[key] !== false : true;
  } catch {
    return true;
  }
}

export async function requirePage(key) {
  if (!(await pageOn(key))) notFound();
}

// The html design of a page (a page that was taken over from an html file, also the start page); "" when it has none.
async function getDesignRaw(key) {
  try {
    const res = await cachedFetch(`${base()}/api/pages/design/${encodeURIComponent(key)}/`);
    return res.ok ? (await res.json()).design || "" : "";
  } catch {
    return "";
  }
}

async function getOwnPageRaw(key) {
  try {
    const res = await cachedFetch(`${base()}/api/pages/public/${encodeURIComponent(key)}/`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// The fixed elements of a page that its blocks have taken over (the start page of an import: the standard logo, title, text and photos are then not shown, not even for a moment).
async function getMovedRaw(key) {
  try {
    const res = await cachedFetch(`${base()}/api/pages/layout/${encodeURIComponent(key)}/`);
    return res.ok ? (await res.json()).moved || [] : [];
  } catch {
    return [];
  }
}

// The energy label at the bottom of the website (only when the administrator switched it on in Admin -> Energie): drawn on the server, so it is in the page at once
async function getEnergyBadgeRaw() {
  try {
    const res = await cachedFetch(`${base()}/api/energy/badge/`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export const getMenu = cache(getMenuRaw);  // one answer per page view: the same call in generateMetadata and in the layout is made once
export const getBackgrounds = cache(getBackgroundsRaw);  // one answer per page view: the same call in generateMetadata and in the layout is made once
export const getDesign = cache(getDesignRaw);  // one answer per page view: the same call in generateMetadata and in the layout is made once
export const getOwnPage = cache(getOwnPageRaw);  // one answer per page view: the same call in generateMetadata and in the layout is made once
export const getMoved = cache(getMovedRaw);  // one answer per page view: the same call in generateMetadata and in the layout is made once
export const getEnergyBadge = cache(getEnergyBadgeRaw);  // one answer per page view: the same call in generateMetadata and in the layout is made once
