import { absoluteUrl, getSeo } from "../../lib/seo";
import { LOGO_SETS } from "../../lib/logos";

export const dynamic = "force-dynamic";
const API = process.env.API_URL_INTERNAL || "http://localhost:8000";

// Web app manifest: only available while "App op mobiel" is switched on (Vormgeving -> Weergave per apparaat)
export async function GET() {
  const [theme, branding, seo] = await Promise.all([
    fetch(`${API}/api/theme/`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    fetch(`${API}/api/branding/`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    getSeo(),
  ]);
  const v = theme?.values || {};
  if (v.device_app !== "yes") return new Response("Not found", { status: 404 });
  const set = LOGO_SETS[v.brand_logo];
  const icon = absoluteUrl((set?.assets || branding?.assets || {}).icon || "/logo-rstcc.png");
  const name = seo?.site?.name || set?.alt || "Studio2";
  const body = {
    name, short_name: name.slice(0, 12), start_url: "/", scope: "/", display: "standalone", orientation: "portrait-primary",
    background_color: v.light_page || "#ffffff", theme_color: v.primary || "#1b97d3",
    icons: [{ src: icon, sizes: "192x192", type: "image/png", purpose: "any" }, { src: icon, sizes: "512x512", type: "image/png", purpose: "any" }],
  };
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/manifest+json" } });
}
