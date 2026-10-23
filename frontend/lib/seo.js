// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { headers } from "next/headers";
import { detectLang } from "./i18n";

const API_INTERNAL = process.env.API_URL_INTERNAL || "http://localhost:8000";
const API_PUBLIC = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Public origin of the website, as the visitor/crawler reached it
export async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:5173";
  return `${h.get("x-forwarded-proto") || "http"}://${host}`;
}

export async function getSeo() {
  try {
    const origin = await siteOrigin();
    const res = await fetch(`${API_INTERNAL}/api/seo/public/?base=${encodeURIComponent(origin)}`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export const absoluteUrl = (p) => (p ? (p.startsWith("http") || p.startsWith("/logos/") ? p : API_PUBLIC + p) : undefined);

// Metadata of one page from the SEO settings (language from the visitor's Accept-Language)
export async function pageMetadata(path, { absolute = false } = {}) {
  const seo = await getSeo();
  const byLang = seo?.pages?.[path] || {};
  const accept = (await headers()).get("accept-language");
  const lang = detectLang(accept, Object.keys(byLang), seo?.default_language);
  const p = byLang[lang] || byLang[seo?.default_language] || Object.values(byLang)[0];
  if (!p) return {};
  return {
    ...(p.title ? { title: absolute ? { absolute: p.title } : p.title } : {}),
    ...(p.description ? { description: p.description } : {}),
    ...(p.canonical ? { alternates: { canonical: p.canonical } } : {}),
    ...(p.noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      ...(p.title ? { title: p.title } : {}),
      ...(p.description ? { description: p.description } : {}),
      ...(p.og_image ? { images: [absoluteUrl(p.og_image)] } : {}),
    },
  };
}
