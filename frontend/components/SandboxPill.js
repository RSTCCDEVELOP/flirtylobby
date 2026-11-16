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
import { IconFlask } from "./Icons";

// "SANDBOX" in the header (dashboard and website) while the sandbox is on: external connections (e-mail, payments ...) are simulated. Set up in Admin -> Sandbox.
export default function SandboxPill() {
  const [on, setOn] = useState(false);
  useUpdates("sandbox-status", () => api("/sandbox/status/"), 60000, (s) => setOn(!!s?.enabled));
  useEffect(() => {
    const load = () => refreshNow("sandbox-status");
    window.addEventListener("sandbox-changed", load);
    return () => window.removeEventListener("sandbox-changed", load);
  }, []);
  if (!on) return null;
  return <span className="sandbox-pill" title={tx("Externe koppelingen zijn gesimuleerd: e-mail, betalingen en andere koppelingen worden niet echt verstuurd")}><IconFlask /> SANDBOX</span>;
}
