// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { apiBase } from "./api";

// Tell the statistics what a visitor chose in a pop-up (no personal data). Never throws.
export function statEvent(module, event) {
  try {
    fetch(`${apiBase()}/api/stats/event/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module, event }), keepalive: true }).catch(() => {});
  } catch {}
}
