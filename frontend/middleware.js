import { NextResponse } from "next/server";

const API = process.env.API_URL_INTERNAL || "http://localhost:8000";
let cfgCache = { t: 0, v: null };
const geoCache = new Map(); // ip -> { t, allowed }

async function getConfig() {
  if (Date.now() - cfgCache.t < 15000) return cfgCache.v;
  try {
    const res = await fetch(`${API}/api/security/public/`, { cache: "no-store" });
    cfgCache = { t: Date.now(), v: res.ok ? await res.json() : null };
  } catch {
    cfgCache = { t: Date.now(), v: null };
  }
  return cfgCache.v;
}

// the addresses of the standard pages in every language lead to the one page: /subscriptions, /abos ... -> /abonnementen
let aliasCache = { t: 0, v: {} };
async function getAliases() {
  if (Date.now() - aliasCache.t < 15000) return aliasCache.v;
  try {
    const res = await fetch(`${API}/api/pages/aliases/`, { cache: "no-store" });
    aliasCache = { t: Date.now(), v: res.ok ? (await res.json()).aliases || {} : {} };
  } catch {
    aliasCache = { t: Date.now(), v: {} };
  }
  return aliasCache.v;
}

let siteCache = { t: 0, v: null };
async function getSite() {
  if (Date.now() - siteCache.t < 10000) return siteCache.v;
  try {
    const res = await fetch(`${API}/api/site/`, { cache: "no-store" });
    siteCache = { t: Date.now(), v: res.ok ? await res.json() : null };
  } catch {
    siteCache = { t: Date.now(), v: null };
  }
  return siteCache.v;
}

async function isAllowed(ip, country) {
  const hit = geoCache.get(ip);
  if (hit && Date.now() - hit.t < 60000) return hit.allowed;
  let allowed = true; // never lock everybody out when the API is unreachable
  try {
    const q = new URLSearchParams({ ip, ...(country ? { country } : {}) });
    const res = await fetch(`${API}/api/security/check/?${q}`, { cache: "no-store" });
    if (res.ok) allowed = (await res.json()).allowed;
  } catch {}
  geoCache.set(ip, { t: Date.now(), allowed });
  if (geoCache.size > 5000) geoCache.clear();
  return allowed;
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  // other domain names of the website are sent on to the main address (Systeem -> Basisgegevens)
  const site = await getSite();
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase().split(":")[0];
  if (site?.redirect_aliases && site.primary_host && host && site.aliases?.includes(host)) {
    const to = new URL(`${site.frontend_url}${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(to, 308);
  }
  const cfg = await getConfig();
  let res;

  // maintenance mode: every page of the website becomes the maintenance page (503); only the login and the dashboard (administrators) stay reachable
  const open = pathname === "/login" || pathname.startsWith("/dashboard") || pathname.startsWith("/onderhoud") || /^\/(robots\.txt|sw\.js|manifest\.webmanifest|build-id)$/.test(pathname);
  if (site?.maintenance && !open && !req.cookies.get("maint_ok")) return NextResponse.rewrite(new URL("/onderhoud", req.url), { status: 503, headers: { "Retry-After": "3600" } });

  const alias = (await getAliases())[pathname.replace(/\/+$/, "") || "/"];
  if (alias && alias !== pathname && !pathname.startsWith("/dashboard")) return NextResponse.rewrite(new URL(`${alias}${req.nextUrl.search}`, req.url));

  const adminArea = pathname.startsWith("/dashboard") || pathname === "/login";
  if (cfg?.geo?.enabled && !pathname.startsWith("/geo-blocked") && !(cfg.geo.admin_bypass && adminArea)) {
    // nginx sets X-Real-IP to the real peer address
    const ip = req.headers.get("x-real-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "127.0.0.1";
    const country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || req.headers.get("cloudfront-viewer-country");
    if (ip && !(await isAllowed(ip, country))) {
      res = NextResponse.rewrite(new URL("/geo-blocked", req.url), { status: 403 });
    }
  }
  res = res || NextResponse.next();

  if (cfg?.basic?.security_headers !== false) {
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "SAMEORIGIN"); // our own device preview (edit mode) shows pages in a frame
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
    if (cfg?.basic?.hsts && req.headers.get("x-forwarded-proto") === "https") {
      res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"],
};
