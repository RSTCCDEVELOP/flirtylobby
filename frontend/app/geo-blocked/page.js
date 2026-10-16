import { headers } from "next/headers";
import { detectLang, pick } from "../../lib/i18n";
import { getSecurity } from "../../lib/security-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Niet beschikbaar", robots: "noindex" };

// Standard page shown to visitors from blocked countries (see middleware.js)
export default async function GeoBlocked() {
  const cfg = await getSecurity();
  const lang = detectLang((await headers()).get("accept-language"), cfg?.languages, cfg?.default_language);
  const texts = cfg?.geo?.texts;
  return (
    <main className="uc">
      <h1>{pick(texts, lang, cfg?.default_language, "title") || "Not available"}</h1>
      <p>{pick(texts, lang, cfg?.default_language, "message")}</p>
    </main>
  );
}
