// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { tx } from "../../lib/t";
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
      <h1>{pick(texts, lang, cfg?.default_language, "title") || tx("Not available")}</h1>
      <p>{pick(texts, lang, cfg?.default_language, "message")}</p>
    </main>
  );
}
