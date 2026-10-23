// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { notFound } from "next/navigation";
import GamesPage from "../../components/GamesPage";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spelletjes" };

// /games: the games of the games plugin, as a page of the website (header, footer and look of the theme). Only when the plugin page is set to public.
async function isPublic() {
  try {
    const res = await fetch(`${process.env.API_URL_INTERNAL || "http://localhost:8000"}/api/plugins/public/?path=/games`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function GamesSitePage() {
  if (!(await isPublic())) notFound();
  return (
    <div className="site">
      <SiteHeader />
      <main className="shop"><GamesPage /></main>
      <SiteFooter />
    </div>
  );
}
