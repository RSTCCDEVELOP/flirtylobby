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

export async function getOwnPage(key) {
  try {
    const res = await fetch(`${base()}/api/pages/public/${encodeURIComponent(key)}/`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
