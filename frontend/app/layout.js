import "./globals.css";
import { BrandingProvider } from "../components/BrandingContext";
import Gates from "../components/Gates";
import { ContentProvider, EditBanner } from "../components/EditMode";
import { SessionProvider } from "../components/Session";
import { ModulesProvider } from "../components/Modules";
import { UiProvider } from "../components/Ui";
import { getModules } from "../lib/modules-server";
import { getSecurity } from "../lib/security-server";
import { LOGO_SETS } from "../lib/logos";
import { absoluteUrl, getSeo } from "../lib/seo";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const absolute = (p) => (p ? (p.startsWith("http") || p.startsWith("/logos/") ? p : API + p) : undefined);

export const dynamic = "force-dynamic"; // theme comes from the API on every request

// Runs before first paint: saved choice, else the OS preference (prevents a light flash)
const themeScript = (mode) => `try{var t=localStorage.getItem("theme");if(!t){var d="${mode}";t=d==="light"||d==="dark"?d:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}`;

// Design settings ("Vormgeving") are validated server-side, so the CSS is safe to inline
async function getTheme() {
  try {
    const base = process.env.API_URL_INTERNAL || "http://localhost:8000";
    const res = await fetch(`${base}/api/theme/`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function getBranding() {
  try {
    const base = process.env.API_URL_INTERNAL || "http://localhost:8000";
    const res = await fetch(`${base}/api/branding/`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata() {
  const [branding, theme, seo] = await Promise.all([getBranding(), getTheme(), getSeo()]);
  const set = LOGO_SETS[theme?.values?.brand_logo];
  const a = { ...(branding?.assets || {}), ...(set?.assets || {}) };
  const site = seo?.site || {};
  const name = site.default_title || set?.alt || "Studio2";
  const verify = seo?.verification || {};
  const og = absolute(site.default_og_image || branding?.assets?.og_image);
  return {
    ...(site.site_url ? { metadataBase: new URL(site.site_url) } : {}),
    title: { default: name, template: site.title_template || "%s" },
    description: site.default_description || undefined,
    icons: { icon: absolute(a.favicon) || undefined, apple: absolute(a.icon) || undefined },
    robots: site.allow_indexing === false ? "noindex, nofollow" : site.ai_meta === "noai" ? "index, follow, noai, noimageai" : undefined,
    verification: {
      google: verify.google || undefined, yandex: verify.yandex || undefined,
      other: { ...(verify.bing ? { "msvalidate.01": verify.bing } : {}), ...(verify.pinterest ? { "p:domain_verify": verify.pinterest } : {}) },
    },
    openGraph: { siteName: site.name || name, type: "website", ...(og ? { images: [og] } : {}) },
    twitter: { card: og ? "summary_large_image" : "summary", ...(site.twitter ? { site: site.twitter } : {}) },
  };
}

async function getContent() {
  try {
    const base = process.env.API_URL_INTERNAL || "http://localhost:8000";
    const res = await fetch(`${base}/api/content/`, { cache: "no-store" });
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

async function getLanguages() {
  try {
    const base = process.env.API_URL_INTERNAL || "http://localhost:8000";
    const res = await fetch(`${base}/api/languages/`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }) {
  const [theme, langs, branding, security, content, modules, seo] = await Promise.all([getTheme(), getLanguages(), getBranding(), getSecurity(), getContent(), getModules(), getSeo()]);
  const jsonld = (seo?.jsonld || []).map((o) => ({ ...o, logo: o.logo ? absoluteUrl(o.logo) : undefined }));
  const def = langs?.languages?.find((l) => l.code === langs.default);
  return (
    <html lang={def?.code || "nl"} dir={def?.rtl ? "rtl" : "ltr"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript(theme?.values?.default_mode) }} />
        {theme?.fonts_url && <link rel="stylesheet" href={theme.fonts_url} />}
        {theme?.css && <style id="theme-live" dangerouslySetInnerHTML={{ __html: theme.css }} />}
      </head>
      <body>
        <ModulesProvider value={modules}>
        <UiProvider value={theme?.values}>
        <SessionProvider>
          <BrandingProvider value={branding} logoSet={theme?.values?.brand_logo}>
            <ContentProvider initial={content} defaultLang={langs?.default || "nl"} languages={(langs?.languages || []).map((l) => l.code)}>
              {children}
              <EditBanner />
            </ContentProvider>
            <Gates cfg={security} />
        {jsonld.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld).replace(/</g, "\\u003c") }} />}
          </BrandingProvider>
        </SessionProvider>
        </UiProvider>
        </ModulesProvider>
      </body>
    </html>
  );
}
