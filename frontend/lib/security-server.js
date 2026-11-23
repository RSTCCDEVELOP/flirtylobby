// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net
import { cache } from "react";
import { cachedFetch } from "./render-cache";

// Server-side helpers (SSR pages and layout)
async function getSecurityRaw() {
  try {
    const base = process.env.API_URL_INTERNAL || "http://localhost:8000";
    const res = await cachedFetch(`${base}/api/security/public/`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export const getSecurity = cache(getSecurityRaw);  // one answer per page view: the same call in generateMetadata and in the layout is made once
