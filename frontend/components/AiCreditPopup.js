// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { money } from "./AiCharts";

// The offer to buy AI credit: a slider from a minimum to a maximum (it ends higher for someone who uses more) with a suggestion from the use of the last 30 days.
// Paying goes through the payment link; when it is paid the credit is added. info = the answer of /ai/me/.
export default function AiCreditPopup({ info, onClose }) {
  const p = info.proposal;
  const [amount, setAmount] = useState(p.suggest);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pay = async () => {
    setBusy(true); setErr("");
    try { const r = await api("/ai/me/topup/", { method: "POST", body: { amount } }); window.location.href = r.url; }
    catch (e) { setErr(errorText(e)); setBusy(false); }
  };
  const body = (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card modal form" role="dialog" aria-label={tx("AI-tegoed kopen")} style={{ maxWidth: 480 }} onMouseDown={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0 }}>{tx("AI-tegoed kopen")}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {info.balance <= 0 ? tx("Je AI-tegoed is op.") : `${tx("Je tegoed is")} ${money(info.balance, info.currency)}.`} {tx("De afgelopen 30 dagen gebruikte je")} <strong>{money(p.used_month, info.currency)}</strong> {tx("aan AI.")}
        </p>
        <div className="ai-slider">
          <div className="ai-slider-val">{money(amount, info.currency)}</div>
          <input type="range" min={p.min} max={p.max} step={p.step} value={amount} onChange={(e) => setAmount(Number(e.target.value))} aria-label={tx("Bedrag")} />
          <div className="row" style={{ justifyContent: "space-between" }}><small className="muted">{money(p.min, info.currency)}</small><small className="muted">{tx("Voorstel")}: {money(p.suggest, info.currency)}</small><small className="muted">{money(p.max, info.currency)}</small></div>
        </div>
        {info.can_pay && info.pay_via === "stripe" && <small className="muted">{tx("Je betaalt veilig via Stripe.")}</small>}
        {!info.can_pay && <div className="alert">{tx("Betalen is nu niet mogelijk: de Stripe-koppeling van het systeem staat niet aan.")}</div>}
        {err && <div className="alert">{err}</div>}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>{tx("Later")}</button>
          <button type="button" className="btn primary" disabled={busy || !info.can_pay} onClick={pay}>{busy ? tx("Bezig…") : `${tx("Betalen")} ${money(amount, info.currency)}`}</button>
        </div>
      </div>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(body, document.body);
}
