// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net
"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { IconCard, IconEye, IconEyeOff, IconLock, IconPlus, IconStar, IconTrash } from "./Icons";

// The tab Betaalgegevens of a company and of a user: several ways to pay (bank account, direct debit, PayPal, other), kept encrypted by the server and shown masked.
// For a user there is also the switch "pays through a company / pays privately" (like the choice at an order).
const SECTION = { border: "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.12)))", borderRadius: "var(--e2e-radius, 10px)", padding: ".8rem .9rem", display: "grid", gap: ".7rem" };
const GRID = { display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: ".8rem 1rem" };
const KIND_LABEL = { bank: "Bankrekening", sepa: "Automatische incasso (SEPA)", paypal: "PayPal", other: "Anders" };
const LAYOUT = {  // field, label, columns of 12, max length
  bank: [["holder", "Naam rekeninghouder", 6, 120], ["iban", "IBAN", 6, 42], ["bic", "BIC", 4, 11], ["bank_name", "Bank", 8, 80]],
  sepa: [["holder", "Naam rekeninghouder", 6, 120], ["iban", "IBAN", 6, 42], ["bic", "BIC", 4, 11], ["mandate_ref", "Kenmerk machtiging", 4, 40], ["mandate_date", "Datum machtiging", 4, 10]],
  paypal: [["email", "PayPal-adres", 12, 160]],
  other: [["value", "Gegevens", 12, 200]],
};
const NEW = (kind) => ({ id: "", kind, label: tx(KIND_LABEL[kind]), default: false, note: "", holder: "", iban: "", bic: "", bank_name: "", mandate_ref: "", mandate_date: "", email: "", value: "" });

export default function PaymentDetails({ base, canEdit, forUser = false }) {
  const [d, setD] = useState(null);
  const [items, setItems] = useState([]);
  const [shown, setShown] = useState(false);  // the full values are on the screen (the person pressed Tonen)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [payer, setPayer] = useState({ on: false, entity: "" });

  const take = (r) => { setD(r); setItems(r.items || []); setPayer({ on: !!r.pays_via_company, entity: r.billing_entity ? String(r.billing_entity) : "" }); };
  useEffect(() => { setD(null); setShown(false); api(base).then(take).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, [base]);

  const setItem = (i, k, v) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const reveal = async () => {
    setBusy(true); setMsg(null);
    try { const r = await api(`${base}reveal/`, { method: "POST", body: {} }); setItems(r.items || []); setShown(true); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const body = { items };
      if (forUser) { body.pays_via_company = payer.on; body.billing_entity = payer.entity ? Number(payer.entity) : null; }
      take(await api(base, { method: "PUT", body })); setShown(false); setMsg({ ok: true, text: tx("Opgeslagen.") });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };

  if (!d) return <p className="muted">{msg ? msg.text : tx("Laden…")}</p>;
  const kinds = (d.kinds || []).map((k) => k.key);
  const companies = d.companies || [];
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div role="note" style={{ display: "flex", gap: ".6rem", alignItems: "flex-start", padding: ".6rem .8rem", borderRadius: "var(--e2e-radius, 10px)", background: "color-mix(in srgb, var(--e2e-primary, #e8803f) 7%, transparent)", fontSize: ".82rem" }}>
        <IconLock width={16} height={16} style={{ flex: "0 0 auto", marginTop: ".1rem" }} />
        <span>{tx("Betaalgegevens worden versleuteld opgeslagen: ze zijn in de database niet leesbaar. Op het scherm staan ze afgeschermd; met Tonen zie je ze. Creditcardnummers worden nooit bewaard: betalen met een kaart gaat via de betaalprovider.")}</span>
      </div>

      {forUser && (
        <section style={SECTION}>
          <strong style={{ fontSize: ".9rem" }}>{tx("Wie betaalt?")}</strong>
          <label className="check sec-toggle">
            <span className="switch"><input type="checkbox" checked={payer.on} disabled={!canEdit || (!companies.length && !payer.on)} onChange={(e) => setPayer((p) => ({ on: e.target.checked, entity: e.target.checked && !p.entity && companies.length === 1 ? String(companies[0].id) : p.entity }))} /><span /></span>
            <span>{payer.on ? tx("Betaalt via het bedrijf") : tx("Betaalt zelf (privé)")}</span>
          </label>
          {payer.on && companies.length > 0 && (
            <div className="e2e-field" style={{ maxWidth: 420 }}>
              <label className="e2e-label" htmlFor="pd-company"><span>{tx("Bedrijf")}</span></label>
              <select id="pd-company" className="e2e-input" value={payer.entity} disabled={!canEdit} onChange={(e) => setPayer((p) => ({ ...p, entity: e.target.value }))}>
                <option value="">{tx("Kies een bedrijf")}</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? ` · ${c.city}` : ""}</option>)}
              </select>
            </div>
          )}
          <span className="muted" style={{ fontSize: ".8rem" }}>{companies.length ? tx("Zo bepaalt het systeem bij een bestelling of factuur wie de rekening krijgt: het bedrijf of de gebruiker zelf.") : tx("Koppel eerst een bedrijf aan deze gebruiker (tab Rechten, Entiteiten) om via een bedrijf te kunnen betalen.")}</span>
        </section>
      )}

      {d.locked && <div className="alert">{tx("De opgeslagen betaalgegevens kunnen niet worden gelezen (andere sleutel). Wat je nu invult vervangt ze.")}</div>}

      <section style={SECTION}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".6rem", flexWrap: "wrap" }}>
          <strong style={{ fontSize: ".9rem", display: "flex", alignItems: "center", gap: ".4rem" }}><IconCard width={15} height={15} />{tx("Betaalgegevens")} <span className="muted" style={{ fontWeight: 500 }}>({items.length})</span></strong>
          {items.length > 0 && <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" disabled={busy || shown} onClick={reveal}>{shown ? <IconEyeOff width={14} height={14} /> : <IconEye width={14} height={14} />} {shown ? tx("Getoond") : tx("Tonen")}</button>}
        </div>
        {!items.length && <p className="muted" style={{ margin: 0 }}>{tx("Nog geen betaalgegevens. Voeg een bankrekening, machtiging of PayPal toe.")}</p>}
        {items.map((it, i) => (
          <div key={it.id || `n${i}`} style={{ ...SECTION, background: "color-mix(in srgb, var(--e2e-primary, #e8803f) 4%, transparent)" }}>
            <div style={{ display: "flex", gap: ".6rem", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="e2e-field" style={{ flex: "1 1 200px" }}>
                <label className="e2e-label" htmlFor={`pd-label-${i}`}><span>{tx("Naam")}<span style={{ color: "var(--e2e-danger)" }}> *</span></span></label>
                <input id={`pd-label-${i}`} className="e2e-input" value={it.label || ""} maxLength={80} disabled={!canEdit} onChange={(e) => setItem(i, "label", e.target.value)} />
              </div>
              <div className="e2e-field" style={{ flex: "0 1 230px" }}>
                <label className="e2e-label" htmlFor={`pd-kind-${i}`}><span>{tx("Soort")}</span></label>
                <select id={`pd-kind-${i}`} className="e2e-input" value={it.kind} disabled={!canEdit} onChange={(e) => setItem(i, "kind", e.target.value)}>{kinds.map((k) => <option key={k} value={k}>{tx(KIND_LABEL[k] || k)}</option>)}</select>
              </div>
              <button type="button" className={`e2e-btn e2e-btn--sm ${it.default ? "" : "e2e-btn--ghost"}`} disabled={!canEdit} aria-pressed={!!it.default} title={tx("Standaard betaalgegeven")} onClick={() => setItems((xs) => xs.map((x, j) => ({ ...x, default: j === i })))}><IconStar width={14} height={14} /> {it.default ? tx("Standaard") : tx("Maak standaard")}</button>
              {canEdit && <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx("Verwijderen")} title={tx("Verwijderen")} onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}><IconTrash width={14} height={14} /></button>}
            </div>
            <div style={GRID}>
              {(LAYOUT[it.kind] || []).map(([k, label, span, max]) => (
                <div key={k} className="e2e-field" style={{ gridColumn: `span ${span}` }}>
                  <label className="e2e-label" htmlFor={`pd-${k}-${i}`}><span>{tx(label)}</span></label>
                  <input id={`pd-${k}-${i}`} className="e2e-input" type={k === "mandate_date" ? "date" : "text"} value={it[k] || ""} maxLength={max} disabled={!canEdit} autoComplete="off" spellCheck={false} onChange={(e) => setItem(i, k, e.target.value)} />
                </div>
              ))}
              <div className="e2e-field" style={{ gridColumn: "span 12" }}>
                <label className="e2e-label" htmlFor={`pd-note-${i}`}><span>{tx("Notitie")}</span></label>
                <input id={`pd-note-${i}`} className="e2e-input" value={it.note || ""} maxLength={300} disabled={!canEdit} onChange={(e) => setItem(i, "note", e.target.value)} />
              </div>
            </div>
          </div>
        ))}
        {canEdit && items.length < (d.max || 10) && (
          <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
            {kinds.map((k) => <button key={k} type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" onClick={() => setItems((xs) => [...xs, { ...NEW(k), default: !xs.length }])}><IconPlus width={14} height={14} /> {tx(KIND_LABEL[k] || k)}</button>)}
          </div>
        )}
      </section>

      {msg && <div className={msg.ok ? "e2e-hint" : "alert"} role={msg.ok ? "status" : "alert"}>{msg.text}</div>}
      {canEdit && <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? tx("Bezig…") : tx("Betaalgegevens opslaan")}</button></div>}
    </div>
  );
}
