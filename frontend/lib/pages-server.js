// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { notFound } from "next/navigation";

const base = () => process.env.API_URL_INTERNAL || "http://localhost:8000";

// Header menu (only what is switched on in Admin -> Pagina's)
export async function getMenu() {
  try {
    const res = await fetch(`${base()}/api/pages/menu/`, { cache: "no-store" });
    if (!res.ok) return { items: [], settings: null };
    const d = await res.json();
    return { items: d.items || [], settings: d.settings || null };
  } catch {
    return { items: [], settings: null };
  }
}

// Page backgrounds (picture/video from the media library), by page path
export async function getBackgrounds() {
  try {
    const res = await fetch(`${base()}/api/pages/backgrounds/`, { cache: "no-store" });
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

// Is a built-in page switched on? (unknown or unreachable = on, so the site never breaks)
export async function pageOn(key) {
  try {
    const res = await fetch(`${base()}/api/pages/state/`, { cache: "no-store" });
    return res.ok ? (await res.json()).on?.[key] !== false : true;
  } catch {
    return true;
  }
}

export async function requirePage(key) {
  if (!(await pageOn(key))) notFound();
}

// The html design of a page (a page that was taken over from an html file, also the start page); "" when it has none.
export async function getDesign(key) {
  try {
    const res = await fetch(`${base()}/api/pages/design/${encodeURIComponent(key)}/`, { cache: "no-store" });
    return res.ok ? (await res.json()).design || "" : "";
  } catch {
    return "";
  }
}

export async function getOwnPage(key) {
  try {
    const res = await fetch(`${base()}/api/pages/public/${encodeURIComponent(key)}/`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// The fixed elements of a page that its blocks have taken over (the start page of an import: the standard logo, title, text and photos are then not shown, not even for a moment).
export async function getMoved(key) {
  try {
    const res = await fetch(`${base()}/api/pages/layout/${encodeURIComponent(key)}/`, { cache: "no-store" });
    return res.ok ? (await res.json()).moved || [] : [];
  } catch {
    return [];
  }
}
