"use client";

import { useEffect, useState } from "react";
import { Busy } from "../../../components/PageLoader";
import { api, errorText } from "../../../lib/api";
import { money } from "../../../lib/format";
import { tx } from "../../../lib/t";

// The licence for administrators: state, valid until and paying the renewal. Reachable when the licence has run out (the website then shows the maintenance page to everybody else).
export default function License() {
  const [lic, setLic] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/system/license/status/").then(setLic).catch((e) => setError(errorText(e))); }, []);
  if (!lic) return error ? <div className="alert">{error}</div> : <Busy />;
  const pay = async () => {
    setBusy(true); setError("");
    try {
      const r = await api("/system/license/pay/", { method: "POST", body: {} });
      if (/^https?:/.test(r.url)) window.location.href = r.url; else window.location.assign(r.url);
    } catch (e) { setError(errorText(e)); setBusy(false); }
  };
  return (
    <>
      <h1>{tx("Licentie")}</h1>
      {!lic.has && <div className="alert">{tx("Er is geen licentie ingesteld. De website werkt ook zonder licentie, maar onderaan elke pagina staat dat er geen licentie in gebruik is.")}</div>}
      {lic.expired && <div className="alert">{tx("De licentie is verlopen. Bezoekers zien de onderhoudspagina tot de licentie is verlengd. Beheerders kunnen nog gewoon werken.")}</div>}
      <div className="card" style={{ display: "grid", gap: ".6rem", maxWidth: 560 }}>
        <div><small className="muted">{tx("Licentienummer")}</small><br /><strong style={{ fontFamily: "monospace" }}>{lic.number || "—"}</strong></div>
        <div><small className="muted">{tx("Opdrachtgever")}</small><br /><strong>{lic.client || "—"}</strong>{lic.client_address && <><br /><small>{lic.client_address}</small></>}</div>
        <div><small className="muted">{tx("Geldig tot")}</small><br /><strong>{lic.valid_until ? new Date(lic.valid_until).toLocaleDateString() : tx("Geen einddatum")}</strong></div>
        {(lic.reseller?.name || lic.reseller?.email || lic.reseller?.url) && (
          <div><small className="muted">{tx("Reseller")}</small><br /><strong>{lic.reseller.name || "—"}</strong>
            {lic.reseller.email && <><br /><a href={`mailto:${lic.reseller.email}`}>{lic.reseller.email}</a></>}
            {lic.reseller.url && <><br /><a href={lic.reseller.url} target="_blank" rel="noopener noreferrer">{tx("Bestel of betaal je licentie")}</a></>}</div>
        )}
        {lic.can_pay ? (
          <div>
            <button type="button" className="btn primary" onClick={pay} disabled={busy}>{tx("Licentie verlengen")} · {money(Number(lic.price), "EUR")} / {lic.renew_months} {tx("maanden")}</button>
          </div>
        ) : <p className="muted" style={{ margin: 0 }}>{tx("Online verlengen is niet ingesteld. Neem contact op met de reseller, of laat een superadmin de licentie aanpassen bij Super admin → Licentie.")}</p>}
        {error && <div className="alert">{error}</div>}
      </div>
    </>
  );
}
