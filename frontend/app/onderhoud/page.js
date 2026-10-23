// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import MaintenanceNotice from "../../components/MaintenanceNotice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Onderhoud", robots: "noindex" };

async function getSite() {
  try {
    const res = await fetch(`${process.env.API_URL_INTERNAL || "http://localhost:8000"}/api/site/`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// The page of the maintenance mode (Basisgegevens): no header, no menus, only the flags for the language. Everything on the website leads here while it is on; /login stays open for administrators.
export default async function Maintenance() {
  const site = await getSite();
  return (
    <main className="maintenance maintenance-page" role="alert">
      <MaintenanceNotice site={site} />
    </main>
  );
}
