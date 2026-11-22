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

// "SANDBOX" in the header: while the sandbox is on, external connections (e-mail, payments ...) are simulated. For the people who may switch it, the label is a BUTTON that switches the sandbox on and
// off (to test live too) and it stays in the header, also when the sandbox is off, until "Sandbox-knop tonen" is switched off in Admin -> Sandbox.
export default function SandboxPill() {
  const [st, setSt] = useState({ enabled: false, button: false });
  const [busy, setBusy] = useState(false);
  useUpdates("sandbox-status", () => api("/sandbox/status/"), 60000, (s) => setSt({ enabled: !!s?.enabled, button: !!s?.button, can: !!s?.can_toggle }));
  useEffect(() => {
    const load = () => refreshNow("sandbox-status");
    window.addEventListener("sandbox-changed", load);
    return () => window.removeEventListener("sandbox-changed", load);
  }, []);
  const toggle = async () => {
    setBusy(true);
    try { await api("/sandbox/settings/", { method: "PUT", body: { enabled: !st.enabled } }); setSt((x) => ({ ...x, enabled: !x.enabled })); window.dispatchEvent(new Event("sandbox-changed")); } catch { /* the label stays as it is */ }
    setBusy(false);
  };
  if (st.button) {
    return (
      <button type="button" className={`sandbox-pill sandbox-pill--btn${st.enabled ? "" : " off"}`} disabled={busy} onClick={toggle} aria-pressed={st.enabled}
        title={st.enabled ? tx("Sandbox staat aan: externe koppelingen zijn gesimuleerd. Klik om hem uit te zetten (live).") : tx("Sandbox staat uit: alles is live. Klik om hem aan te zetten (gesimuleerd).")}>
        <IconFlask /> {st.enabled ? "SANDBOX" : "LIVE"}
      </button>
    );
  }
  if (!st.enabled) return null;
  return <span className="sandbox-pill" title={tx("Externe koppelingen zijn gesimuleerd: e-mail, betalingen en andere koppelingen worden niet echt verstuurd")}><IconFlask /> SANDBOX</span>;
}
