"use client";

import { tx } from "../../../lib/t";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../../../lib/api";
import { confirmDialog } from "../../../lib/dialog";
import { money } from "../../../lib/format";

const BADGE = { pending: "off", trial: "ok", active: "ok", past_due: "off", canceled: "off", expired: "off" };

export default function MySubscriptions() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => api("/subscriptions/me/").then(setD).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);

  async function act(s, what) {
    if (what === "cancel" && !(await confirmDialog(tx("Opzeggen? Je houdt toegang tot het einde van de betaalde periode."), { danger: true }))) return;
    try {
      const r = await api(`/subscriptions/me/${s.id}/${what}/`, { method: "POST", body: { return_base: window.location.origin } });
      if (r.checkout_path) { window.location.href = r.checkout_path; return; }
      await load();
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }

  if (!d) return <p className="muted">{msg?.text || tx("Laden…")}</p>;
  const list = d.subscriptions.filter((s) => s.status !== "expired" || s.period_end);
  return (
    <>
      <div className="page-head"><h1>{tx("Mijn abonnementen")}</h1><Link className="btn" href="/abonnementen">{tx("Alle abonnementen")}</Link></div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}
      {d.likes_left !== null && d.gates?.likes && <div className="alert ok" style={{ marginBottom: "1rem" }}>{tx("Likes over vandaag")}: <strong>{d.likes_left}</strong></div>}
      <div className="sub-plans">
        {list.map((s) => (
          <div className="card sub-plan" key={s.id}>
            <div className="sub-plan-top"><strong>{s.plan_name}</strong><span className={`badge ${BADGE[s.status]}`}>{tx(s.status_label)}</span></div>
            <div className="sub-price">{s.manual ? tx("Gratis") : money(s.price)} <small>{s.recurring ? tx("per periode") : tx("eenmalig")}</small></div>
            <div className="muted" style={{ fontSize: ".85rem" }}>
              {s.period_end ? `${s.status === "canceled" || s.cancel_at_period_end ? tx("Loopt af op") : s.recurring ? tx("Volgende betaling") : tx("Toegang tot")} ${new Date(s.period_end).toLocaleDateString()}` : tx("Onbeperkt")}
            </div>
            {s.open_order && <div className="alert">{tx("Openstaand")}: {money(s.open_order.total)} ({s.open_order.number})</div>}
            <div className="sub-actions">
              {s.open_order && <button className="btn sm primary" onClick={() => act(s, "pay")}>{tx("Nu betalen")}</button>}
              {s.status === "canceled" && s.period_end && new Date(s.period_end) > new Date() && <button className="btn sm" onClick={() => act(s, "resume")}>{tx("Weer verlengen")}</button>}
              {["trial", "active", "past_due"].includes(s.status) && !s.cancel_at_period_end && s.recurring && <button className="btn sm danger" onClick={() => act(s, "cancel")}>{tx("Opzeggen")}</button>}
            </div>
          </div>
        ))}
        {!list.length && <p className="muted">{tx("Je hebt nog geen abonnement.")} <Link href="/abonnementen">{tx("Bekijk de abonnementen")}</Link></p>}
      </div>
    </>
  );
}
