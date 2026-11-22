// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { api } from "./api";

// Parts that are always in the menu: a click first checks that they are installed and on; when not, the person is asked (with the cost) to install and switch them on.
export const GATED = { "/dashboard/admin/siteimport": "siteimport" };

// onClick of a link: returns true when the click was taken over (the link must not be followed now)
export function gateClick(e, href, router) {
  const plugin = GATED[href];
  if (!plugin) return false;
  e?.preventDefault?.();
  api(`/system/plugin-gate/?plugin=${plugin}`)
    .then((d) => { if (d.on) router.push(href); else window.dispatchEvent(new CustomEvent("open-plugin-gate", { detail: { plugin, href, info: d } })); })
    .catch(() => router.push(href));
  return true;
}
