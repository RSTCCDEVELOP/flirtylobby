// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { headers } from "next/headers";
import Link from "next/link";
import { detectLang, pick } from "../lib/i18n";
import { getModules } from "../lib/modules-server";
import { getSecurity } from "../lib/security-server";
import CookieSettingsButton from "./CookieSettingsButton";
import { getSite } from "../lib/site-server";
import { getMenu } from "../lib/pages-server";
import { Logo } from "./BrandingContext";
import FooterEdit from "./FooterEdit";

const SOCIAL = { facebook: "Facebook", instagram: "Instagram", x: "X", linkedin: "LinkedIn", youtube: "YouTube", tiktok: "TikTok" };
const PRIVACY = { nl: "Privacybeleid", en: "Privacy policy" };

export default async function SiteFooter() {
  const [cfg, mods, site, menu] = await Promise.all([getSecurity(), getModules(), getSite(), getMenu()]);
  const lang = detectLang((await headers()).get("accept-language"), cfg?.languages, cfg?.default_language);
  const t = (k) => pick(cfg?.cookies?.texts, lang, cfg?.default_language, k);
  // the pages of the menu as links (what is for everybody: the items with an address, and under a menu heading its pages)
  const label = (it) => it.titles?.[lang] || it.titles?.nl || it.titles?.en || Object.values(it.titles || {})[0] || "";
  const href = (it) => it.urls?.[lang] || it.url || "";
  const navLinks = (menu?.items || []).filter((i) => i.audience === "all" && i.devices?.desktop !== false).flatMap((i) => [i, ...(i.children || []).filter((c) => c.audience === "all")]).filter((i) => href(i) && label(i) && !i.cta).slice(0, 10);
  const place = site ? [site.postal_code, site.city].filter(Boolean).join(" ") : "";
  const street = site ? [site.street, site.house_number].filter(Boolean).join(" ") : "";
  const hasContact = !!(site && (street || place || site.phone || site.contact_email));
  return (
    <footer className="site-footer">
      <FooterEdit />
      <div className="foot-brand"> {/* shown by the footer layout (Thema → Footer): logo and/or name, with the footer text */}
        <span className="foot-logo"><Logo /></span>
        <strong className="foot-name">{site?.site_name || site?.company_name || ""}</strong>
        {site?.footer_text && <span className="foot-text">{site.footer_text}</span>}
      </div>
      {navLinks.length > 0 && (
        <nav className="foot-nav" aria-label="Menu">
          {navLinks.map((i) => /^(https?:|mailto:|tel:)/.test(href(i)) ? <a key={i.id} href={href(i)}>{label(i)}</a> : <Link key={i.id} href={href(i)}>{label(i)}</Link>)}
        </nav>
      )}
      {hasContact && (
        <address className="foot-contact">
          {site.company_name && <strong>{site.company_name}</strong>}
          {street && <span>{street}</span>}
          {place && <span>{place}{site.country && site.country !== "Nederland" ? `, ${site.country}` : ""}</span>}
          {site.phone && <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>}
          {site.contact_email && <a href={`mailto:${site.contact_email}`}>{site.contact_email}</a>}
        </address>
      )}
      <div className="foot-links">
        {mods.privacy_pages !== false && <Link href="/privacy">{PRIVACY[lang] || PRIVACY[cfg?.default_language] || PRIVACY.nl}</Link>}
        {cfg?.cookies?.enabled && <CookieSettingsButton label={t("policy_link")} event="open-cookie-policy" />}
        {cfg?.cookies?.enabled && <CookieSettingsButton label={t("settings")} />}
      </div>
      {site && Object.keys(site.social || {}).length > 0 && (
        <div className="foot-social">{Object.entries(site.social).map(([k, url]) => <a key={k} href={url} target="_blank" rel="noopener noreferrer">{SOCIAL[k] || k}</a>)}</div>
      )}
      {site && (
        <div className="foot-meta">
          <span>© {new Date().getFullYear()} {site.company_name || site.site_name}</span>
          {site.kvk && <span>KvK {site.kvk}</span>}
          {site.vat_id && <span>BTW {site.vat_id}</span>}
          {site.contact_email && !hasContact && <a href={`mailto:${site.contact_email}`}>{site.contact_email}</a>}
          {site.footer_text && <span>{site.footer_text}</span>}
        </div>
      )}
    </footer>
  );
}
