import { tx } from "../../lib/t";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getModules } from "../../lib/modules-server";
import CookieSettingsButton from "../../components/CookieSettingsButton";
import { pageMetadata } from "../../lib/seo";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";
import { detectLang, pick } from "../../lib/i18n";
import { getSecurity } from "../../lib/security-server";

export const dynamic = "force-dynamic";
export const generateMetadata = async () => ({ title: tx("Cookiebeleid"), ...(await pageMetadata("/cookies")) });

export default async function Cookies() {
  if ((await getModules()).privacy_pages === false) notFound();
  const cfg = await getSecurity();
  const lang = detectLang((await headers()).get("accept-language"), cfg?.languages, cfg?.default_language);
  const t = (k) => pick(cfg?.cookies?.texts, lang, cfg?.default_language, k);
  const offered = ["necessary", ...["analytics", "marketing", "preferences"].filter((c) => cfg?.cookies?.[c])];
  return (
    <div className="site">
      <SiteHeader />
      <main className="doc">
        <h1>{t("policy_title")}</h1>
        <p className="doc-body">{t("policy_body")}</p>
        <h2>{t("title")}</h2>
        <ul className="doc-list">
          {offered.map((c) => (
            <li key={c}><strong>{t(`cat_${c}`)}</strong><span>{t(`cat_${c}_desc`)}</span></li>
          ))}
        </ul>
        {cfg?.cookies?.enabled && <CookieSettingsButton label={t("settings")} className="btn primary" />}
      </main>
      <SiteFooter />
    </div>
  );
}
