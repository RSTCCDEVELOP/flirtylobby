"use client";

import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import TwoFactorProfile from "./TwoFactorProfile";

// Shown instead of the site while two-step verification is required for this person (by the site policy or by a superadmin) and not set up yet:
// right after the first login it has to be set up here. The server refuses everything else until it is done.
export default function TwoFactorGate() {
  const { user, logout } = useAuth();
  return (
    <div className="overlay" style={{ background: "var(--bg)" }}>
      <div className="card modal" role="dialog" aria-modal="true" style={{ maxWidth: 620, width: "100%", display: "grid", gap: "1rem" }}>
        <h2 style={{ margin: 0 }}>{tx("Stel tweestapsverificatie in")}</h2>
        <p className="muted" style={{ margin: 0 }}>{tx("Voor jouw account ({0}) is tweestapsverificatie verplicht. Stel het nu in; daarna ga je verder naar de website.", user.email)}</p>
        <TwoFactorProfile />
        <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn" onClick={logout}>{tx("Uitloggen")}</button></div>
      </div>
    </div>
  );
}
