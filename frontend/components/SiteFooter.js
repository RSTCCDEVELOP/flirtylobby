import { headers } from "next/headers";
import Link from "next/link";
import { detectLang, pick } from "../lib/i18n";
import { getModules } from "../lib/modules-server";
import { getSecurity } from "../lib/security-server";
import CookieSettingsButton from "./CookieSettingsButton";

const PRIVACY = { nl: "Privacybeleid", en: "Privacy policy" };

export default async function SiteFooter() {
  const [cfg, mods] = await Promise.all([getSecurity(), getModules()]);
  const lang = detectLang((await headers()).get("accept-language"), cfg?.languages, cfg?.default_language);
  const t = (k) => pick(cfg?.cookies?.texts, lang, cfg?.default_language, k);
  return (
    <footer className="site-footer">
      {mods.privacy_pages !== false && <Link href="/privacy">{PRIVACY[lang] || PRIVACY[cfg?.default_language] || PRIVACY.nl}</Link>}
      {cfg?.cookies?.enabled && <CookieSettingsButton label={t("policy_link")} event="open-cookie-policy" />}
      {cfg?.cookies?.enabled && <CookieSettingsButton label={t("settings")} />}
    </footer>
  );
}
