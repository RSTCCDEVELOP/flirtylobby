import "./globals.css";
import { BrandingProvider } from "../components/BrandingContext";
import Gates from "../components/Gates";
import { ContentProvider, EditBanner } from "../components/EditMode";
import { SessionProvider } from "../components/Session";
import { ModulesProvider } from "../components/Modules";
import { UiProvider } from "../components/Ui";
import { CartProvider } from "../components/Cart";
import { ChatProvider, ChatWidget } from "../components/Chat";
import DialogHost from "../components/DialogHost";
import DomTranslate from "../components/DomTranslate";
import { MenuProvider } from "../components/SiteMenu";
import { getBackgrounds, getMenu } from "../lib/pages-server";
import PageBackdrop from "../components/PageBackdrop";
import PageSettingsButton from "../components/PageSettingsButton";
import LangRoot from "../components/LangRoot";
import VersionNotice from "../components/VersionNotice";
import { getBuildId } from "../lib/version-server";
import AdminBar from "../components/AdminBar";
import DeviceGate from "../components/DeviceGate";
import { getModules } from "../lib/modules-server";
import { getSecurity } from "../lib/security-server";
import { LOGO_SETS } from "../lib/logos";
import SandboxBadge from "../components/SandboxBadge";
import { absoluteUrl, getSeo } from "../lib/seo";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const absolute = (p) => (p ? (p.startsWith("http") || p.startsWith("/logos/") ? p : API + p) : undefined);

export const dynamic = "force-dynamic"; // theme comes from the API on every request

export async function generateViewport() {
  const t = await getTheme();
  return { themeColor: t?.values?.device_app === "yes" ? t.values.primary : undefined, width: "device-width", initialScale: 1 };
}

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
    ...(theme?.values?.device_app === "yes" ? { manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: site.name || name, statusBarStyle: "default" } } : {}),
    robots: site.allow_indexing === false ? "noindex, nofollow" : site.ai_meta === "noai" ? "index, follow, noai, noimageai" : undefined,
    verification: {
      google: verify.google || undefined, yandex: verify.yandex || undefined,
      other: { ...(verify.bing ? { "msvalidate.01": verify.bing } : {}), ...(verify.pinterest ? { "p:domain_verify": verify.pinterest } : {}) },
    },
    openGraph: { siteName: site.name || name, type: "website", ...(og ? { images: [og] } : {}) },
    twitter: { card: og ? "summary_large_image" : "summary", ...(site.twitter ? { site: site.twitter } : {}) },
  };
}

async function getSandbox() {
  try {
    const base = process.env.API_URL_INTERNAL || "http://localhost:8000";
    const res = await fetch(`${base}/api/sandbox/status/`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
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
  const [theme, langs, branding, security, content, modules, seo, sandbox, menu, backgrounds] = await Promise.all([getTheme(), getLanguages(), getBranding(), getSecurity(), getContent(), getModules(), getSeo(), getSandbox(), getMenu(), getBackgrounds()]);
  const jsonld = (seo?.jsonld || []).map((o) => ({ ...o, logo: o.logo ? absoluteUrl(o.logo) : undefined }));
  const def = langs?.languages?.find((l) => l.code === langs.default);
  return (
    <html lang={def?.code || "nl"} dir={def?.rtl ? "rtl" : "ltr"} data-tabs={theme?.values?.tab_style || "pills"} data-popup={theme?.values?.system_popup || "clean"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript(theme?.values?.default_mode) }} />
        {theme?.fonts_url && <link rel="stylesheet" href={theme.fonts_url} />}
        {theme?.css && <style id="theme-live" dangerouslySetInnerHTML={{ __html: theme.css }} />}
      </head>
      <body>
        <ModulesProvider value={modules}>
        <UiProvider value={theme?.values}>
        <SessionProvider>
        <CartProvider>
        <ChatProvider>
        <MenuProvider value={menu}>
        <LangRoot languages={langs?.languages || []} defaultLanguage={langs?.default || "nl"}>
          <BrandingProvider value={branding} logoSet={theme?.values?.brand_logo}>
            <ContentProvider initial={content} defaultLang={langs?.default || "nl"} languages={(langs?.languages || []).map((l) => l.code)}>
              <PageBackdrop map={backgrounds} />
              {children}
              <EditBanner />
              <PageSettingsButton />
            </ContentProvider>
            <Gates cfg={security} />
        <SandboxBadge status={sandbox} />
        {jsonld.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld).replace(/</g, "\\u003c") }} />}
          </BrandingProvider>
        <ChatWidget />
        <DialogHost />
        <VersionNotice current={getBuildId()} />
        <DomTranslate />
        <AdminBar />
        <DeviceGate devices={{ mobile: theme?.values?.device_mobile !== "no", tablet: theme?.values?.device_tablet !== "no", desktop: theme?.values?.device_desktop !== "no", app: theme?.values?.device_app === "yes" }} />
        </LangRoot>
        </MenuProvider>
        </ChatProvider>
        </CartProvider>
        </SessionProvider>
        </UiProvider>
        </ModulesProvider>
      </body>
    </html>
  );
}
