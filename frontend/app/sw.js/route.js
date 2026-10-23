// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

export const dynamic = "force-dynamic";
const API = process.env.API_URL_INTERNAL || "http://localhost:8000";

// Minimal service worker (makes the site installable). Removes itself when the app is switched off.
export async function GET() {
  const theme = await fetch(`${API}/api/theme/`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
  const on = theme?.values?.device_app === "yes";
  const js = on
    ? `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {}); // network only; the handler is what makes the app installable`
    : `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.registration.unregister()));`;
  return new Response(js, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-cache", "service-worker-allowed": "/" } });
}
