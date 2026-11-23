// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { tx } from "../lib/t";
import { refreshNow, useUpdates } from "../lib/updates";

// Small pill on every page while the sandbox is on (set up in Admin -> Sandbox).
// The first state comes from the server (no flash), after that it follows the real state: switched off in Admin -> Sandbox, in the header or in another tab, the label is gone at once
// (it used to stay on the login page until a full reload, as if the sandbox had switched itself on again).
export default function SandboxBadge({ status }) {
  const [st, setSt] = useState(status || null);
  useUpdates("sandbox-status", () => api("/sandbox/status/"), 60000, (s) => setSt(s));
  useEffect(() => {
    const load = () => refreshNow("sandbox-status");
    window.addEventListener("sandbox-changed", load);
    window.addEventListener("token-changed", load);  // after logging in or out the answer is asked again
    return () => { window.removeEventListener("sandbox-changed", load); window.removeEventListener("token-changed", load); };
  }, []);
  if (!st?.banner) return null;
  return <div className="sandbox-badge" title={tx("Externe koppelingen zijn gesimuleerd")}>SANDBOX</div>;
}
