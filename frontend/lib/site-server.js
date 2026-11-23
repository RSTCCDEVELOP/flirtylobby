// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net
import { cache } from "react";
import { renderConfig } from "./render-cache";

// The website's own data (name, domains, footer, maintenance) from Systeem -> Basisgegevens.
async function getSiteRaw() {
  return renderConfig();  // the fresh call of this page view (it also tells the page cache what to do)
}

export const getSite = cache(getSiteRaw);  // one answer per page view: the same call in generateMetadata and in the layout is made once
