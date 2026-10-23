// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api, downloadFile, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { IconCheck, IconReceipt } from "./Icons";

const langNow = () => { try { return localStorage.getItem("lang") || "nl"; } catch { return "nl"; } };
const eur = (v) => `€ ${Number(v).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const TITLES = { pkg: "Pakketten", mod: "Losse modules", plug: "Plugins", host: "Hosting (aanbevolen per installatie)" };

// The price list: standard installations against packages, single modules and plugins (also the system object "Prijslijst"), with a PDF.
export default function PriceList() {
  const [m, setM] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { api("/sales/pricelist/").then(setM).catch((e) => setMsg(errorText(e))); }, []);
  if (!m) return msg ? <div className="alert">{msg}</div> : null;
  const cell = { padding: ".45rem .6rem", borderBottom: "1px solid var(--line)", textAlign: "center", whiteSpace: "nowrap" };
  const left = { ...cell, textAlign: "left", whiteSpace: "normal", minWidth: 240, paddingLeft: "1rem", position: "sticky", left: 0, background: "var(--card)", zIndex: 1 };
  const vert = { writingMode: "vertical-rl", whiteSpace: "nowrap", height: 190, minWidth: 0, width: 54, padding: ".6rem .3rem", textAlign: "left" }; // the names run from top to bottom
  const hd = { ...cell, textTransform: "none", letterSpacing: 0, fontWeight: 700, fontSize: ".82rem", verticalAlign: "bottom", background: "var(--card)" };
  return (
    <div style={{ display: "grid", gap: ".8rem" }}>
      <div className="row between" style={{ alignItems: "center" }}>
        <p className="muted" style={{ margin: 0 }}>{tx("Alle prijzen zijn per maand en exclusief btw. Een onderdeel in een pakket wordt één keer gerekend.")}</p>
        <button type="button" className="btn primary sm" onClick={() => downloadFile(`/sales/pricelist/pdf/?lang=${langNow()}`, "easy2edit-prijslijst.pdf").catch((e) => setMsg(errorText(e)))}><IconReceipt /> {tx("Download PDF")}</button>
      </div>
      {msg && <div className="alert">{msg}</div>}
      <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 12 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: ".88rem" }}>
          <thead>
            <tr>
              <th style={{ ...hd, ...left, verticalAlign: "bottom" }}>{tx("Onderdeel")}</th>
              <th style={{ ...hd, ...vert }}>{tx("Los per maand")}</th>
              {m.installations.map((i) => <th key={i.key} style={{ ...hd, ...vert }}>{tx(i.name)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr><td style={left}>{tx("Basis (website, bewerkmodus, media, thema's, talen, beveiliging, back-ups)")}</td><td style={cell}>{eur(m.base)}</td>{m.installations.map((i) => <td key={i.key} style={cell}><IconCheck /></td>)}</tr>
            {m.sections.map((s) => (
              <FragmentRows key={s.key} title={tx(TITLES[s.key])} cols={m.installations.length + 2} rows={s.rows} inst={m.installations} cell={cell} left={left} />
            ))}
            <tr style={{ fontWeight: 800 }}><td style={left}>{tx("Totaal per maand")}</td><td style={cell} />{m.installations.map((i) => <td key={i.key} style={{ ...cell, color: "var(--blue)" }}>{eur(i.total)}</td>)}</tr>
            <tr style={{ fontWeight: 800 }}><td style={left}>{tx("Totaal per maand incl. aanbevolen hosting")}</td><td style={cell} />{m.installations.map((i) => <td key={i.key} style={{ ...cell, color: "var(--blue)" }}>{eur(i.total_host)}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <p style={{ margin: 0, fontWeight: 700 }}>{tx("Alles is gebaseerd op fair use. Bij veel dataverbruik (opslag, verkeer of e-mail) volgt een naheffing.")}</p>
    </div>
  );
}

function FragmentRows({ title, cols, rows, inst, cell, left }) {
  return (
    <>
      <tr><td colSpan={cols} style={{ ...left, fontWeight: 800, background: "color-mix(in srgb, var(--blue) 12%, var(--card))" }}>{title}</td></tr>
      {rows.map((r) => (
        <tr key={r.key}>
          <td style={left}>{tx(r.label)}</td>
          <td style={cell}>{r.price ? eur(r.price) : "–"}</td>
          {inst.map((i) => <td key={i.key} style={cell}>{r.in[i.key] ? <IconCheck /> : ""}</td>)}
        </tr>
      ))}
    </>
  );
}
