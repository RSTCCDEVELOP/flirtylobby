// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { api, errorText } from "../lib/api";
import { resetIntegrationsCache } from "../lib/integrations";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import { IconLock, IconRefresh } from "./Icons";
import Loading from "./Loading";

const STATE = { ok: ["Actueel", "ok"], update: ["Verandert", "warn"], missing: ["Nieuw", "warn"], local: ["Alleen hier", ""] };

// API keys -> Updaten (superadmin only): look at the API links of the easy2edit server, see which ones changed (keys are never shown) and bring them up to date.
// The keys travel encrypted from the server and are opened here.
export default function ApiLinksUpdate({ onChanged }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (!user?.is_staff) return null;
  const check = async () => {
    setBusy(true); setMsg(null);
    try { setD(await api("/admin/integrations/links/")); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const start = () => { setOpen(true); setD(null); check(); };
  const update = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await api("/admin/integrations/links/", { method: "POST", body: {} });
      setD(r); resetIntegrationsCache(); onChanged?.();
      const n = (r.results || []).filter((x) => x.ok).length;
      setMsg({ ok: true, text: n ? tx("{0} koppelingen bijgewerkt.", String(n)) : tx("Alles is al actueel.") });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const todo = (d?.links || []).filter((x) => x.state === "update" || x.state === "missing").length;
  return (
    <>
      <button type="button" className="btn" onClick={start} title={tx("De API-koppelingen controleren en bijwerken via de easy2edit-server")}><IconRefresh width={15} height={15} /> {tx("Updaten")}</button>
      {open && (
        <div className="overlay" onClick={() => !busy && setOpen(false)}>
          <div className="card modal" role="dialog" aria-label={tx("API-koppelingen bijwerken")} style={{ width: "min(720px, 96vw)", display: "grid", gap: ".9rem", maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>{tx("API-koppelingen bijwerken")}</h2>
              <button type="button" className="btn sm" onClick={() => !busy && setOpen(false)} aria-label={tx("Sluiten")}>×</button>
            </div>
            <p className="muted" style={{ margin: 0 }}>{tx("De koppelingen die de easy2edit-server voor elke website meegeeft (superadmin+). Hier zie je welke zijn veranderd op de server. Sleutels en instellingen worden versleuteld overgenomen; ze worden hier nooit getoond.")}</p>
            {msg && <div className={msg.ok ? "alert ok" : "alert"} role="status">{msg.text}</div>}
            {busy && !d ? <Loading compact /> : d && !d.ok ? <div className="alert" role="alert">{d.error}</div> : d && (
              <div className="table-wrap" style={{ border: 0 }}>
                <table>
                  <thead><tr><th>{tx("Koppeling")}</th><th>{tx("Status")}</th><th>{tx("Wat verandert")}</th></tr></thead>
                  <tbody>
                    {d.links.map((x) => {
                      const diff = x.fields.filter((f) => f.differs);
                      return (
                        <tr key={x.slug}>
                          <td><strong>{x.name}</strong><br /><small className="muted">{x.provider}</small></td>
                          <td><span className={`badge ${STATE[x.state]?.[1] || ""}`}>{tx(STATE[x.state]?.[0] || x.state)}</span></td>
                          <td>{diff.length ? diff.map((f) => <span key={f.field} className="badge" style={{ marginRight: ".3rem" }}>{f.field}{f.secret ? <> <IconLock width={11} height={11} /></> : null}</span>) : <span className="muted">–</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="row" style={{ justifyContent: "flex-end", gap: ".6rem" }}>
              <button type="button" className="btn" disabled={busy} onClick={check}>{tx("Opnieuw controleren")}</button>
              <button type="button" className="btn primary" disabled={busy || !d?.ok || !todo} onClick={update}>{busy ? tx("Bezig…") : todo ? `${tx("Bijwerken")} (${todo})` : tx("Alles is actueel")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
