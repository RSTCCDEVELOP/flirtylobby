// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import TwoFactorProfile from "./TwoFactorProfile";
import { IconLock, IconShield } from "./Icons";

// Shown instead of the site while two-step verification is required for this person (by the site policy or by a superadmin) and not set up yet:
// right after the first login it has to be set up here. The server refuses everything else until it is done.
export default function TwoFactorGate() {
  const { user, setUser, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const bypass = async () => {  // a superadmin or superadmin+ skips the set-up for this login (the server remembers it for 12 hours; a new login asks again)
    setBusy(true); setErr("");
    try { setUser(await api("/auth/2fa/bypass/", { method: "POST", body: {} })); }
    catch (e) { setErr(errorText(e)); setBusy(false); }
  };
  const badge = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 46, height: 46, borderRadius: 12, flex: "0 0 auto", background: "color-mix(in srgb, var(--e2e-primary, #e8803f) 12%, transparent)", color: "var(--e2e-primary, #e8803f)" };
  const line = "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.12)))";
  return (
    <div className="overlay" style={{ background: "var(--bg)" }}>
      <div className="card modal" role="dialog" aria-modal="true" aria-labelledby="tf-gate-title" style={{ maxWidth: 640, width: "100%", display: "grid", gap: "1.1rem", padding: "1.6rem 1.8rem" }}>
        <div style={{ display: "flex", gap: ".9rem", alignItems: "flex-start" }}>
          <span style={badge} aria-hidden="true"><IconShield /></span>
          <div style={{ display: "grid", gap: ".3rem", minWidth: 0 }}>
            <h2 id="tf-gate-title" style={{ margin: 0, fontSize: "1.2rem" }}>{tx("Stel tweestapsverificatie in")}</h2>
            <p className="muted" style={{ margin: 0, fontSize: ".88rem" }}>{tx("Voor jouw account ({0}) is tweestapsverificatie verplicht. Stel het nu in; daarna ga je verder naar de website.", user.email)}</p>
          </div>
        </div>
        <div style={{ borderTop: line, paddingTop: "1rem" }}><TwoFactorProfile /></div>
        {err && <div className="alert" role="alert">{err}</div>}
        {user.twofa?.can_bypass && (
          <div role="group" aria-label={tx("Overslaan")} style={{ display: "flex", alignItems: "center", gap: ".8rem", flexWrap: "wrap", padding: ".7rem .9rem", borderRadius: "var(--e2e-radius, 10px)", border: line, background: "color-mix(in srgb, var(--e2e-primary, #e8803f) 5%, transparent)" }}>
            <span style={{ ...badge, width: 34, height: 34, borderRadius: 9 }} aria-hidden="true"><IconLock /></span>
            <span style={{ flex: "1 1 260px", display: "grid", gap: ".1rem", minWidth: 0 }}>
              <strong style={{ fontSize: ".85rem" }}>{tx("Overslaan als superadmin")}</strong>
              <small className="muted">{tx("Als superadmin kun je dit voor deze login overslaan. Bij de volgende login vraagt het systeem er weer om.")}</small>
            </span>
            <button type="button" className="btn" disabled={busy} onClick={bypass} title={tx("Twee-staps verificatie nu overslaan")}>{tx("Bypass")}</button>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", borderTop: line, paddingTop: ".9rem" }}>
          <button type="button" className="btn" onClick={logout}>{tx("Uitloggen")}</button>
        </div>
      </div>
    </div>
  );
}
