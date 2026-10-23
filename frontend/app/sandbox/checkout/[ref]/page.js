// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../../../../lib/t";
import { use, useEffect, useState } from "react";
import { api, errorText } from "../../../../lib/api";

const money = (p) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: p.currency }).format(p.amount);
const RESULT = {
  paid: ["Betaling gelukt", "ok"], failed: ["Betaling mislukt", "fail"], canceled: ["Betaling geannuleerd", "fail"],
  expired: ["Betaling verlopen", "fail"], refunded: ["Betaling terugbetaald", "ok"],
};

// Simulated checkout page of a sandbox payment: the tester picks the outcome, nothing real happens
export default function SandboxCheckout({ params }) {
  const { ref } = use(params);
  const [p, setP] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api(`/sandbox/checkout/${ref}/`).then(setP).catch(() => setError(tx("Deze betaling bestaat niet of de sandbox staat uit."))); }, [ref]);

  async function pick(outcome) {
    setBusy(true);
    try { setP(await api(`/sandbox/checkout/${ref}/pay/`, { method: "POST", body: { outcome } })); } catch (e) { setError(errorText(e)); }
    setBusy(false);
  }

  return (
    <main className="login-page">
      <div className="card login-card" style={{ maxWidth: 440 }}>
        <span className="badge off" style={{ alignSelf: "center" }}>{tx("SANDBOX · geen echte betaling")}</span>
        {error && <div className="alert">{error}</div>}
        {p && (
          <>
            <h1 style={{ textAlign: "center", margin: 0 }}>{money(p)}</h1>
            <p className="muted" style={{ textAlign: "center", margin: 0 }}>{p.description || tx("Testbetaling")} · {p.provider === "stripe" ? tx("Stripe") : tx("Mollie")} · {p.ref}</p>
            {p.status === "open" ? (
              <>
                <p className="muted" style={{ margin: 0 }}>{tx("Kies hoe deze betaling afloopt:")}</p>
                <button className="btn primary" disabled={busy} onClick={() => pick("paid")}>{tx("Betalen (gelukt)")}</button>
                <button className="btn" disabled={busy} onClick={() => pick("failed")}>{tx("Mislukt")}</button>
                <button className="btn" disabled={busy} onClick={() => pick("canceled")}>{tx("Annuleren")}</button>
                <button className="btn" disabled={busy} onClick={() => pick("expired")}>{tx("Laten verlopen")}</button>
              </>
            ) : (
              <>
                <div className={RESULT[p.status]?.[1] === "ok" ? "alert ok" : "alert"}>{RESULT[p.status]?.[0] || p.status}</div>
                <a className="btn primary" href={p.return_url || "/"}>{p.return_url ? tx("Terug naar de winkel") : tx("Naar de website")}</a>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
