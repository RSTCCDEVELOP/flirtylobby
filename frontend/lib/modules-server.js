// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net
import { cache } from "react";
import { cachedFetch } from "./render-cache";

async function getModulesRaw() {
  try {
    const base = process.env.API_URL_INTERNAL || "http://localhost:8000";
    const res = await cachedFetch(`${base}/api/modules/`);
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

export const getModules = cache(getModulesRaw);  // one answer per page view: the same call in generateMetadata and in the layout is made once
