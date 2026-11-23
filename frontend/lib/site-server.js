// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net
import { cache } from "react";

// The website's own data (name, domains, footer, maintenance) from Systeem -> Basisgegevens.
async function getSiteRaw() {
  try {
    const res = await fetch(`${process.env.API_URL_INTERNAL || "http://localhost:8000"}/api/site/`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export const getSite = cache(getSiteRaw);  // one answer per page view: the same call in generateMetadata and in the layout is made once
