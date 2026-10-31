// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, errorText } from "../../../lib/api";
import { tx } from "../../../lib/t";
import AiCreditPopup from "../../../components/AiCreditPopup";
import { money, num, short } from "../../../components/AiCharts";

const KIND = { topup: "Gekocht", usage: "Gebruikt", adjust: "Aangepast" };

// The AI of the user himself: credit (when it has to be bought), the use of the last 30 days and the history.
export default function MyAi() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [buy, setBuy] = useState(false);
  const sp = useSearchParams();
  const paid = sp.get("paid"), ref = sp.get("ref"), wantBuy = sp.get("buy");
  const load = useCallback(() => api("/ai/me/").then(setD).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { // back from Stripe: ask whether it is paid; the credit is added at once
    if (!(paid && ref)) return;
    api("/ai/me/topup/confirm/", { method: "POST", body: { ref } }).then((r) => { if (r.status === "paid") { setMsg({ ok: true, text: tx("Bedankt! Je tegoed is bijgeschreven.") }); load(); } }).catch(() => {});
  }, [paid, ref, load]);
  useEffect(() => { if (paid) { setMsg({ ok: true, text: tx("Bedankt! Zodra de betaling binnen is, staat het tegoed hieronder.") }); const t = setTimeout(load, 2500); return () => clearTimeout(t); } return undefined; }, [paid, load]);
  useEffect(() => { if (d && wantBuy) setBuy(true); }, [!!d, wantBuy]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Laden…")}</p>;
  const m = (n) => money(n, d.currency);
  return (
    <>
      <h1>{tx("AI")}</h1>
      <p className="muted">{tx("Wat jij aan AI hebt gebruikt en, als je tegoed moet kopen, hoeveel tegoed je nog hebt.")}</p>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      <div className="cards" style={{ marginTop: 0 }}>
        {d.credit_required && <div className="card stat"><span>{tx("Tegoed")}</span><strong style={{ fontSize: "1.6rem" }}>{m(d.balance)}</strong>{d.low && <small style={{ color: "var(--danger)" }}>{tx("Bijna op: koop tegoed")}</small>}
          <button type="button" className="btn primary sm" onClick={() => setBuy(true)}>{tx("Tegoed kopen")}</button></div>}
        <div className="card stat"><span>{tx("Aanroepen (30 dagen)")}</span><strong style={{ fontSize: "1.6rem" }}>{num(d.month.calls)}</strong></div>
        <div className="card stat"><span>{tx("Tokens in")}</span><strong style={{ fontSize: "1.6rem" }}>{short(d.month.tokens_in)}</strong></div>
        <div className="card stat"><span>{tx("Tokens uit")}</span><strong style={{ fontSize: "1.6rem" }}>{short(d.month.tokens_out)}</strong></div>
        <div className="card stat"><span>{tx("Kosten (30 dagen)")}</span><strong style={{ fontSize: "1.6rem" }}>{m(d.month.charged)}</strong></div>
      </div>
      {d.credit_required && (
        <div className="card"><strong>{tx("Tegoed: wat erbij en eraf ging")}</strong>
          <div className="table-wrap"><table className="table"><thead><tr><th>{tx("Wanneer")}</th><th>{tx("Wat")}</th><th>{tx("Bedrag")}</th><th>{tx("Tegoed daarna")}</th></tr></thead>
            <tbody>{d.ledger.map((r, i) => <tr key={i}><td>{new Date(r.at).toLocaleString()}</td><td>{tx(KIND[r.kind] || r.kind)}{r.note ? ` · ${r.note}` : ""}</td><td>{m(r.amount)}</td><td>{m(r.balance)}</td></tr>)}
              {!d.ledger.length && <tr><td colSpan={4} className="muted">{tx("Nog niets.")}</td></tr>}</tbody></table></div>
        </div>
      )}
      <div className="card"><strong>{tx("Laatste aanroepen")}</strong>
        <div className="table-wrap"><table className="table"><thead><tr><th>{tx("Wanneer")}</th><th>{tx("Waar")}</th><th>{tx("Model")}</th><th>{tx("Tokens in")}</th><th>{tx("Tokens uit")}</th><th>{tx("Kosten")}</th></tr></thead>
          <tbody>{d.recent.map((r, i) => <tr key={i}><td>{new Date(r.at).toLocaleString()}</td><td>{r.source}</td><td>{r.model}</td><td>{num(r.tokens_in)}</td><td>{num(r.tokens_out)}</td><td>{r.ok ? m(r.charged) : tx("mislukt")}</td></tr>)}
            {!d.recent.length && <tr><td colSpan={6} className="muted">{tx("Nog geen AI-gebruik in de afgelopen 30 dagen.")}</td></tr>}</tbody></table></div>
      </div>
      {buy && <AiCreditPopup info={d} onClose={() => { setBuy(false); load(); }} />}
    </>
  );
}
