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
export default function AiCreditPopup({ info, onClose, amount: preset, beforePay }) {
  const p = info.proposal;
  const [amount, setAmount] = useState(preset || p.suggest);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const companies = info.companies || [];
  const [who, setWho] = useState(() => (info.payer?.mode === "company" && companies.some((c) => c.id === info.payer.entity) ? String(info.payer.entity) : "private"));  // who pays: "private" or the id of a company
  const accOf = who === "private" ? info.person?.account : companies.find((c) => String(c.id) === who)?.account;  // paying on account for the one who pays: {on, limit, open, may}
  const mayAccount = !!accOf?.may;
  const [how, setHow] = useState("");  // "" = the default (pay now when that works, else on account) | "now" | "account"
  const onAccount = mayAccount && (how === "account" || (how === "" && !info.can_pay));
  const room = accOf && accOf.limit > 0 ? Math.max(0, accOf.limit - accOf.open) : null;  // what may still be open
  const pay = async () => {
    setBusy(true); setErr("");
    try { if (beforePay) await beforePay(); const r = await api("/ai/me/topup/", { method: "POST", body: { amount, ...(onAccount ? { pay: "account" } : {}), ...(companies.length ? (who === "private" ? { payer: "private" } : { payer: "company", entity: Number(who) }) : {}) } }); window.location.href = r.url; }
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
        {(companies.length > 0 || info.person) && (
          <div className="stack-sm" role="group" aria-label={tx("Wie betaalt")} style={{ padding: ".7rem .8rem", borderRadius: 12, border: "1px solid var(--line)", background: "color-mix(in srgb, var(--blue) 5%, var(--card, #fff))" }}>
            <strong style={{ fontSize: ".9rem" }}>{tx("Wie betaalt en krijgt de factuur?")}</strong>
            {companies.length > 0 && (
              <div className="lg-seg" style={{ flexWrap: "wrap" }}>
                <button type="button" className={who === "private" ? "on" : ""} aria-pressed={who === "private"} onClick={() => setWho("private")}>{tx("Ik betaal zelf")}</button>
                {companies.map((c) => <button type="button" key={c.id} className={who === String(c.id) ? "on" : ""} aria-pressed={who === String(c.id)} onClick={() => setWho(String(c.id))}>{c.name} {tx("betaalt")}</button>)}
              </div>
            )}
            <span>{tx("Betaald door")}: <strong>{who === "private" ? (info.person?.name || info.person?.email) : (companies.find((c) => String(c.id) === who)?.name || "")}</strong>{who === "private" && info.person?.email && info.person?.name ? <small className="muted"> · {info.person.email}</small> : null}</span>
            <small className="muted">{who === "private" ? tx("De factuur komt op jouw naam.") : tx("De factuur komt op naam van het bedrijf.")} {tx("Het tegoed is altijd voor jou.")}</small>
          </div>
        )}
        {mayAccount && (
          <div className="stack-sm" role="group" aria-label={tx("Betalen")} style={{ padding: ".7rem .8rem", borderRadius: 12, border: "1px solid var(--line)", background: "color-mix(in srgb, var(--blue) 5%, var(--card, #fff))" }}>
            <strong style={{ fontSize: ".9rem" }}>{tx("Hoe betaal je?")}</strong>
            <div className="lg-seg">
              {info.can_pay && <button type="button" className={!onAccount ? "on" : ""} aria-pressed={!onAccount} onClick={() => setHow("now")}>{tx("Direct betalen")}</button>}
              <button type="button" className={onAccount ? "on" : ""} aria-pressed={onAccount} onClick={() => setHow("account")}>{tx("Op rekening")}</button>
            </div>
            {onAccount && <small className="muted">{tx("Het tegoed staat meteen klaar; je krijgt later een factuur.")} {tx("Nu openstaand")}: € {Number(accOf.open || 0).toFixed(2)}{room !== null ? ` · ${tx("nog ruimte")}: € ${room.toFixed(2)}` : ` · ${tx("geen maximum")}`}{room !== null && amount > room ? <strong style={{ color: "var(--danger, #b3261e)" }}> · {tx("dit bedrag past niet")}</strong> : null}</small>}
          </div>
        )}
        {!onAccount && info.can_pay && info.pay_via === "stripe" && <small className="muted">{tx("Je betaalt veilig via Stripe.")}</small>}
        {!info.can_pay && !mayAccount && <div className="alert">{tx("Betalen is nu niet mogelijk: de Stripe-koppeling van het systeem staat niet aan.")}</div>}
        {err && <div className="alert">{err}</div>}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>{tx("Later")}</button>
          <button type="button" className="btn primary" disabled={busy || (!info.can_pay && !onAccount) || (onAccount && room !== null && amount > room)} onClick={pay}>{busy ? tx("Bezig…") : `${onAccount ? tx("Op rekening bestellen") : tx("Betalen")} ${money(amount, info.currency)}`}</button>
        </div>
      </div>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(body, document.body);
}
