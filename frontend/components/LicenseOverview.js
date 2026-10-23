// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import { Busy } from "./PageLoader";
import { api, errorText } from "../lib/api";
import { money } from "../lib/format";
import { tx } from "../lib/t";

const PERIOD = { 1: "maand", 3: "kwartaal", 12: "jaar" };
const METHOD_HINT = {
  online: "Je betaalt zelf aan het einde van elke periode online (iDEAL, kaart) en de licentie loopt dan een periode door.",
  auto: "Het bedrag wordt aan het einde van elke periode automatisch afgeschreven (Mollie of Stripe). Je geeft één keer toestemming met de eerste betaling.",
  invoice: "Je krijgt een factuur van de reseller en betaalt op rekening. Een superadmin legt vast dat de factuur is betaald; dan loopt de licentie door.",
};
const eur = (v) => money(Number(v || 0), "EUR");

// The licence for administrators: what it costs (what is in use), how it is paid, and the state of the subscription. Admin -> Systeem -> Licentie.
export default function LicenseOverview() {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(() => api("/system/license/usage/").then(setD).catch((e) => setError(errorText(e))), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return error ? <div className="alert">{error}</div> : <Busy />;
  const b = d.billing || { allowed: [], methods: [] };
  const run = async (label, fn) => {
    setBusy(label); setError("");
    try { const r = await fn(); if (r?.url) { if (/^https?:/.test(r.url)) window.location.href = r.url; else window.location.assign(r.url); return; } await load(); } catch (e) { setError(errorText(e)); }
    setBusy("");
  };
  const groups = [...new Set(d.items.map((i) => i.group))];
  const period = tx(PERIOD[d.months] || `${d.months} maanden`);
  return (
    <>
      <h1>{tx("Licentie")}</h1>
      {!d.has && <div className="alert">{tx("Er is geen licentie ingesteld. De website werkt ook zonder licentie, maar onderaan elke pagina staat dat er geen licentie in gebruik is.")}</div>}
      {d.expired && <div className="alert">{tx("De licentie is verlopen. Bezoekers zien de onderhoudspagina tot de licentie is verlengd. Beheerders kunnen nog gewoon werken.")}</div>}
      {error && <div className="alert">{error}</div>}
      <div className="lic-cols">
        <section className="lic-col card" style={{ display: "grid", gap: ".6rem", alignContent: "start" }}>
          <h3>{tx("Jouw licentie")}</h3>
          <div><small className="muted">{tx("Licentienummer")}</small><br /><strong style={{ fontFamily: "monospace" }}>{d.number || "—"}</strong></div>
          <div><small className="muted">{tx("Opdrachtgever")}</small><br /><strong>{d.client || "—"}</strong>{d.client_address && <><br /><small>{d.client_address}</small></>}</div>
          <div><small className="muted">{tx("Geldig tot")}</small><br /><strong>{d.valid_until ? new Date(d.valid_until).toLocaleDateString() : tx("Geen einddatum")}</strong></div>
          {(d.reseller?.name || d.reseller?.email || d.reseller?.url) && (
            <div><small className="muted">{tx("Reseller")}</small><br /><strong>{d.reseller.name || "—"}</strong>
              {d.reseller.email && <><br /><a href={`mailto:${d.reseller.email}`}>{d.reseller.email}</a></>}
              {d.reseller.url && <><br /><a href={d.reseller.url} target="_blank" rel="noopener noreferrer">{tx("Bestel of betaal je licentie")}</a></>}</div>
          )}
        </section>

        <section className="lic-col card" style={{ display: "grid", gap: ".5rem", alignContent: "start" }}>
          <h3>{tx("Kosten: wat is in gebruik")}</h3>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}><span>{tx("Basis (kern-CMS)")}</span><strong>{eur(d.base_price)}</strong></div>
          {groups.map((g) => (
            <div key={g} style={{ display: "grid", gap: ".2rem" }}>
              <small className="muted">{tx(g)}</small>
              {d.items.filter((i) => i.group === g).map((i) => (
                <div key={`${i.kind}:${i.key}`} className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}><span>{tx(i.label)}</span><span>{eur(i.price)}</span></div>
              ))}
            </div>
          ))}
          <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} />
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}><span>{tx("Per maand")}</span><strong>{eur(d.monthly)}</strong></div>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}><span>{tx("Per kwartaal")}</span><strong>{eur(d.quarterly)}</strong></div>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}><span>{tx("Per jaar")}</span><strong>{eur(d.yearly)}</strong></div>
          <small className="muted">{tx("Alle bedragen zijn incl. btw. Je betaalt per {0}: {1}.", period, eur(d.price))} {tx("Wat je aan- of uitzet verandert de prijs meteen.")}</small>
        </section>

        <section className="lic-col card" style={{ display: "grid", gap: ".6rem", alignContent: "start" }}>
          <h3>{tx("Betaalmethode")}</h3>
          {b.methods.map((m) => (
            <label key={m.key} className="check" style={{ alignItems: "flex-start", opacity: m.offered ? 1 : 0.5 }}>
              <input type="radio" name="method" disabled={!m.offered || !!busy} checked={b.method === m.key} onChange={() => run("method", () => api("/system/license/method/", { method: "PUT", body: { method: m.key } }))} />
              <span><strong>{tx(m.label)}</strong>{!m.offered && <> <small className="muted">({tx("niet beschikbaar")})</small></>}<br /><small className="muted">{tx(METHOD_HINT[m.key])}</small></span>
            </label>
          ))}
          {b.method === "online" && (
            d.can_pay
              ? <div><button type="button" className="btn primary" disabled={!!busy} onClick={() => run("pay", () => api("/system/license/pay/", { method: "POST", body: {} }))}>{tx("Licentie verlengen")} · {eur(d.price)} / {period}</button></div>
              : <p className="muted" style={{ margin: 0 }}>{tx("Online verlengen is niet ingesteld. Neem contact op met de reseller, of laat een superadmin de licentie aanpassen bij Super admin → Licentie.")}</p>
          )}
          {b.method === "auto" && (
            <div style={{ display: "grid", gap: ".4rem" }}>
              <span>{tx("Abonnement")}: <span className={`badge ${b.sub_status === "active" ? "ok" : "off"}`}>{b.sub_status === "active" ? tx("actief") : b.sub_status === "cancelled" ? tx("gestopt") : tx("niet gestart")}</span>
                {b.sub_provider && <small className="muted"> · {b.sub_provider}</small>}</span>
              <div className="row" style={{ justifyContent: "flex-start" }}>
                {b.sub_status !== "active"
                  ? <button type="button" className="btn primary" disabled={!!busy || !d.can_pay} onClick={() => run("sub", () => api("/system/license/subscribe/", { method: "POST", body: {} }))}>{tx("Automatische incasso starten")} · {eur(d.price)} / {period}</button>
                  : <button type="button" className="btn danger" disabled={!!busy} onClick={() => run("stop", () => api("/system/license/subscribe/", { method: "DELETE" }))}>{tx("Abonnement stoppen")}</button>}
              </div>
              {!b.provider && <small className="muted">{tx("Er is nog geen betaallink (Mollie of Stripe) gekoppeld bij Admin → API keys.")}</small>}
            </div>
          )}
          {b.method === "invoice" && <p className="muted" style={{ margin: 0 }}>{tx("Betaal de factuur van de reseller. Zodra een superadmin heeft vastgelegd dat hij is betaald, loopt de licentie een periode door.")}</p>}
        </section>
      </div>
    </>
  );
}
