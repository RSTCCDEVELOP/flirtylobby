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
import { IconPin } from "./Icons";

// Look up an address: "RST Coaching Utrecht", "RST Coaching 3542 DH" or "3542 DH 46". Google (when linked in Admin -> API keys) or the free sources PDOK and OpenStreetMap.
// The chosen result {naam, street, house_number, postal_code, city, country, adres} goes to onPick; the caller fills its own fields.
export default function AddressFinder({ onPick, onBusiness, disabled = false, label, span = "1 / -1" }) {
  const [q, setQ] = useState("");  // always starts empty: never filled with the name of the company
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [src, setSrc] = useState("");
  const [err, setErr] = useState("");
  const [picked, setPicked] = useState("");
  const [biz, setBiz] = useState(null);  // the businesses at the chosen address (Google, with phone and website)
  const [bizBusy, setBizBusy] = useState(false);
  const [note, setNote] = useState("");
  const findBusinesses = async (r) => {  // an address was chosen: which businesses does Google know there? (phone number and website too)
    if (!onBusiness || !r.street) return;
    setBizBusy(true); setNote("");
    try {
      const x = await api("/system/setup/address-businesses/", { method: "POST", body: { street: r.street, house_number: r.house_number || "", postal_code: r.postal_code || "", city: r.city || "" } });
      if (!x.linked) setNote(tx("Koppel Google adressen (Admin → API keys) om ook de bedrijven op dit adres met telefoonnummer te vinden."));
      else if (x.results?.length) setBiz(x.results);
      else setNote(tx("Google kent geen bedrijven op dit adres."));
    } catch (e) { setNote(errorText(e)); }
    setBizBusy(false);
  };
  const run = async () => {
    const text = q.trim();
    if (text.length < 3 || busy) return;
    setBusy(true); setErr(""); setPicked(""); setRes(null);
    try { const r = await api("/system/setup/address/search/", { method: "POST", body: { q: text } }); setRes(r.results || []); setSrc(r.source || ""); }
    catch (e) { setErr(errorText(e)); }
    setBusy(false);
  };
  return (
    <div className="e2e-stack" style={{ gap: ".6rem", padding: ".75rem .9rem", border: "1px solid color-mix(in srgb, var(--e2e-primary, var(--blue)) 28%, var(--e2e-border, #e5e0d8))", borderRadius: "var(--e2e-radius, 10px)", background: "color-mix(in srgb, var(--e2e-primary, var(--blue)) 6%, var(--e2e-bg, #fff))", gridColumn: span }}>
      <label className="e2e-label" htmlFor="af-q"><span>{label || tx("Adres opzoeken (postcode)")}</span></label>
      <div style={{ display: "flex", gap: ".5rem", alignItems: "stretch" }}>
        <input id="af-q" type="text" inputMode="search" className="e2e-input" style={{ flex: 1, minWidth: 0 }} value={q} disabled={disabled} placeholder={tx("Postcode en huisnummer, bijvoorbeeld 3542 DH 46")} name="address-lookup" autoComplete="off" data-lpignore="true" data-1p-ignore="true"
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); run(); } }} />
        <button type="button" className="btn" disabled={disabled || busy || q.trim().length < 3} onClick={run}>{busy ? tx("Bezig…") : tx("Zoeken")}</button>
      </div>
      {err && <span className="e2e-error">{err}</span>}
      {res && !res.length && !err && <span className="e2e-hint">{tx("Niets gevonden. Probeer de naam met de plaats, of een postcode met huisnummer.")}</span>}
      {res && res.length > 0 && typeof document !== "undefined" && createPortal(
        <div className="overlay" style={{ zIndex: 3100 }} role="dialog" aria-modal="true" aria-label={tx("Kies het juiste adres:")} onClick={() => setRes(null)}>
          <div className="card modal" style={{ maxWidth: 560, width: "100%", maxHeight: "86vh", display: "flex", flexDirection: "column", gap: ".8rem", padding: "1.2rem 1.4rem" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{tx("Kies het juiste adres:")}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: ".85rem", overflowY: "auto", minHeight: 0, padding: ".2rem" }}>
              {res.map((r) => (
                <button key={r.id} type="button" disabled={disabled} onClick={() => { onPick(r); setPicked(r.naam || r.adres); setRes(null); findBusinesses(r); }}
                  style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "flex-start", gap: ".7rem", padding: ".8rem 1rem", borderRadius: "var(--e2e-radius, 10px)", cursor: "pointer", font: "inherit", color: "inherit", border: "1px solid var(--e2e-border, var(--line, #e5e0d8))", background: "color-mix(in srgb, var(--e2e-primary, var(--blue)) 5%, var(--e2e-bg, var(--card, #fff)))" }}>
                  <span aria-hidden="true" style={{ flex: "none", marginTop: ".15rem", color: "var(--e2e-primary, var(--blue))" }}><IconPin width={16} height={16} /></span>
                  <span style={{ display: "grid", gap: ".15rem", minWidth: 0, flex: 1 }}>
                    {r.naam && <strong>{r.naam}</strong>}
                    <span>{[[r.street, r.house_number].filter(Boolean).join(" "), [r.postal_code, r.city].filter(Boolean).join(" "), r.country].filter(Boolean).join(", ") || r.adres}</span>
                  </span>
                  {r.bron && <small className="e2e-hint" style={{ flex: "none" }}>{r.bron}</small>}
                </button>
              ))}
            </div>
            {src === "free" && <small className="e2e-hint">{tx("Gratis adresbronnen (PDOK en OpenStreetMap). Met de koppeling Google adressen (Admin → API keys) vind je ook kleine bedrijven.")}</small>}
            <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="btn" onClick={() => setRes(null)}>{tx("Sluiten")}</button></div>
          </div>
        </div>, document.body)}
      {bizBusy && <span className="e2e-hint">{tx("Bedrijven op dit adres zoeken…")}</span>}
      {note && <span className="e2e-hint">{note}</span>}
      {biz && typeof document !== "undefined" && createPortal(
        <div className="overlay" style={{ zIndex: 3100 }} role="dialog" aria-modal="true" aria-label={tx("Kies het bedrijf op dit adres:")} onClick={() => setBiz(null)}>
          <div className="card modal" style={{ maxWidth: 600, width: "100%", maxHeight: "86vh", display: "flex", flexDirection: "column", gap: ".9rem", padding: "1.2rem 1.4rem" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{tx("Kies het bedrijf op dit adres:")}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: ".85rem", overflowY: "auto", minHeight: 0, padding: ".2rem" }}>
              {biz.map((b) => (
                <button key={b.id} type="button" onClick={() => { onBusiness(b); setPicked(b.naam); setBiz(null); }}
                  style={{ width: "100%", textAlign: "left", display: "flex", flexDirection: "column", gap: ".2rem", padding: ".8rem 1rem", borderRadius: "var(--e2e-radius, 10px)", cursor: "pointer", font: "inherit", color: "inherit", border: "1px solid var(--e2e-border, var(--line, #e5e0d8))", background: "color-mix(in srgb, var(--e2e-primary, var(--blue)) 5%, var(--e2e-bg, var(--card, #fff)))" }}>
                  <strong>{b.naam}</strong>
                  <span>{[[b.street, b.house_number].filter(Boolean).join(" "), [b.postal_code, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</span>
                  <span style={{ opacity: .8 }}>{[b.phone, b.website && b.website.replace(/^https?:\/\//, "").replace(/\/$/, "")].filter(Boolean).join(" · ") || tx("Geen telefoonnummer bekend")}</span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="btn" onClick={() => setBiz(null)}>{tx("Geen van deze")}</button></div>
          </div>
        </div>, document.body)}
      {picked && <span className="e2e-hint">{tx("Ingevuld: {0}. Controleer de gegevens en pas ze zo nodig aan.", picked)}</span>}
    </div>
  );
}
