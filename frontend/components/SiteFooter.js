import { headers } from "next/headers";
import Link from "next/link";
import { detectLang, pick } from "../lib/i18n";
import { getModules } from "../lib/modules-server";
import { getSecurity } from "../lib/security-server";
import CookieSettingsButton from "./CookieSettingsButton";
import { getSite } from "../lib/site-server";

const SOCIAL = { facebook: "Facebook", instagram: "Instagram", x: "X", linkedin: "LinkedIn", youtube: "YouTube", tiktok: "TikTok" };
const PRIVACY = { nl: "Privacybeleid", en: "Privacy policy" };

export default async function SiteFooter() {
  const [cfg, mods, site] = await Promise.all([getSecurity(), getModules(), getSite()]);
  const lang = detectLang((await headers()).get("accept-language"), cfg?.languages, cfg?.default_language);
  const t = (k) => pick(cfg?.cookies?.texts, lang, cfg?.default_language, k);
  return (
    <footer className="site-footer">
      {mods.privacy_pages !== false && <Link href="/privacy">{PRIVACY[lang] || PRIVACY[cfg?.default_language] || PRIVACY.nl}</Link>}
      {cfg?.cookies?.enabled && <CookieSettingsButton label={t("policy_link")} event="open-cookie-policy" />}
      {cfg?.cookies?.enabled && <CookieSettingsButton label={t("settings")} />}
      {site && Object.keys(site.social || {}).length > 0 && (
        <div className="foot-social">{Object.entries(site.social).map(([k, url]) => <a key={k} href={url} target="_blank" rel="noopener noreferrer">{SOCIAL[k] || k}</a>)}</div>
      )}
      {site && (
        <div className="foot-meta">
          <span>© {new Date().getFullYear()} {site.company_name || site.site_name}</span>
          {site.kvk && <span>KvK {site.kvk}</span>}
          {site.vat_id && <span>BTW {site.vat_id}</span>}
          {site.contact_email && <a href={`mailto:${site.contact_email}`}>{site.contact_email}</a>}
          {site.footer_text && <span>{site.footer_text}</span>}
        </div>
      )}
    </footer>
  );
}
