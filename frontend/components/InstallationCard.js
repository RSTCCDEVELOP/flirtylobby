// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import { IconCheck, IconX } from "./Icons";

const eur = (v) => Number(v).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TITLES = { pkg: "Pakketten", mod: "Losse modules", plug: "Plugins", host: "Aanbevolen hosting" };

// The system object "Standaardinstallatie": what is in it (matrix) and the price per month.
export default function InstallationCard({ d }) {
  return (
    <div className="card" style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", alignItems: "stretch" }}>
        <div style={{ display: "grid", gap: ".4rem", alignContent: "start" }}>
          <h2 style={{ margin: 0 }}>{tx(d.name)}</h2>
          <p className="muted" style={{ margin: 0 }}>{tx(d.desc)}</p>
        </div>
        <div style={{ border: "1px solid var(--line)", borderRadius: 14, padding: "1rem 1.2rem", display: "grid", gap: ".2rem", background: "color-mix(in srgb, var(--blue) 8%, var(--card))", alignContent: "center" }}>
          <small className="muted">{tx("Prijs per maand")}</small>
          <strong style={{ fontSize: "2rem", lineHeight: 1.1 }}>€ {eur(d.price)}</strong>
          <small className="muted">{tx("excl. btw")} · {tx("met hosting")} € {eur(d.price_host)}</small>
        </div>
      </div>
      <div style={{ display: "grid", gap: ".5rem" }}>
        <strong>{tx("Wat zit erin")}</strong>
        <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
          <Row label={tx("Basis (website, bewerkmodus, media, thema's, talen, beveiliging, back-ups)")} price={d.base} on />
          {d.sections.map((s) => (
            <details key={s.key} open={s.key !== "mod"}>
              <summary style={{ padding: ".55rem .9rem", cursor: "pointer", fontWeight: 800, background: "color-mix(in srgb, var(--blue) 10%, var(--card))" }}>{tx(TITLES[s.key])}</summary>
              {s.rows.map((r) => <Row key={r.label} label={tx(r.label)} price={r.price} on={r.in} />)}
            </details>
          ))}
        </div>
        <small className="muted">{tx("Alles is gebaseerd op fair use. Bij veel dataverbruik (opslag, verkeer of e-mail) volgt een naheffing.")}</small>
      </div>
    </div>
  );
}

function Row({ label, price, on }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6rem 1fr auto", gap: ".5rem", alignItems: "center", padding: ".4rem .9rem", borderTop: "1px solid var(--line)", opacity: on ? 1 : 0.5 }}>
      <span style={{ display: "inline-flex", color: on ? "var(--blue)" : "var(--muted)" }}>{on ? <IconCheck /> : <IconX />}</span>
      <span>{label}</span>
      <small className="muted">{price ? `€ ${eur(price)}` : ""}</small>
    </div>
  );
}
