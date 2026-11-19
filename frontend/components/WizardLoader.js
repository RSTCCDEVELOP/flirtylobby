// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { tx } from "../lib/t";
import { wizardLoadingOn } from "../lib/planFlag";
import Loading from "./Loading";

// A dark layer with the loader while the onboarding goes on to the design wizard (the page is loading and the wizard is not there yet): it shows that something is busy.
// It starts when the onboarding leaves for Website ontwerpen (startWizardLoading) and goes when the wizard is on the screen (stopWizardLoading); after 20 seconds it goes anyway.
export default function WizardLoader() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(wizardLoadingOn());
    sync();
    window.addEventListener("wizard-loading", sync);
    const t = setInterval(sync, 1000); // (the 20 seconds run out by themselves)
    return () => { window.removeEventListener("wizard-loading", sync); clearInterval(t); };
  }, []);
  if (!on || typeof document === "undefined") return null;
  return createPortal(
    <div role="alert" aria-busy="true" aria-label={tx("Even geduld, de wizard wordt voorbereid…")} style={{ position: "fixed", inset: 0, zIndex: 4000, background: "rgba(8, 12, 24, .72)", display: "grid", placeItems: "center", backdropFilter: "blur(2px)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", color: "#fff", textAlign: "center", padding: "1.5rem" }}>
        <Loading size={44} />
        <strong>{tx("Even geduld, de wizard wordt voorbereid…")}</strong>
      </div>
    </div>, document.body);
}
