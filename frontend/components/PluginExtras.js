// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import PluginFrame from "./PluginFrame";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";

// Tab "Systeemobjecten" of a plugin: the blocks it offers for pages (edit mode), each with a live preview and an on/off switch.
export function PluginObjects({ p }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState("");
  const load = () => api("/sysobjects/admin/").then((l) => setRows(l.filter((o) => o.kind === "plugin_part" && o.data?.name === p.name))).catch((e) => { setErr(errorText(e)); setRows([]); });
  useEffect(() => { load(); }, [p.name, p.enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = async (o) => { try { await api(`/sysobjects/admin/${o.id}/`, { method: "PATCH", body: { enabled: !o.enabled } }); load(); } catch (e) { setErr(errorText(e)); } };
  if (rows === null) return <p className="muted">{tx("Laden…")}</p>;
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <p className="muted" style={{ margin: 0 }}>{tx("Deze blokken zet je in de bewerkmodus op een pagina (systeemobjecten). Ze nemen de vormgeving van het gekozen thema over. Bezoekers zien alleen wat voor hen is gedeeld.")}</p>
      {err && <div className="alert">{err}</div>}
      {!rows.length && !err && <p className="muted">{p.enabled ? tx("Deze plugin heeft geen systeemobjecten.") : tx("Zet de plugin aan om de systeemobjecten te zien.")}</p>}
      <div className="po-grid">
        {rows.map((o) => (
          <div key={o.id} className="card po-card">
            <div className="row between" style={{ alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <strong>{tx(o.data.title)}</strong>
                <small className="muted" style={{ display: "block", wordBreak: "break-all" }}>{o.slug}</small>
              </div>
              <label className="check sec-toggle" title={tx("Zichtbaar voor pagina's")}><span className="switch"><input type="checkbox" checked={o.enabled} onChange={() => toggle(o)} /><span /></span></label>
            </div>
            <small className="muted">{o.used_on?.length ? `${tx("Gebruikt op")}: ${o.used_on.join(", ")}` : tx("Nog op geen enkele pagina gebruikt")}</small>
            <button type="button" className="btn sm" onClick={() => setOpen(open === o.slug ? "" : o.slug)}>{open === o.slug ? tx("Voorbeeld verbergen") : tx("Voorbeeld tonen")}</button>
            {open === o.slug && <div className="po-preview"><PluginFrame name={p.name} file={o.data.file} title={tx(o.data.title)} route={{ path: "/", params: {}, query: o.data.query || {} }} bare /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Tab "Omschrijving" of a plugin: what the plugin does, in every language of the system.
export function PluginAbout({ p }) {
  const [langs, setLangs] = useState(null);
  const [only, setOnly] = useState("all");
  useEffect(() => { api("/languages/").then((d) => setLangs(d.languages || [])).catch(() => setLangs([])); }, []);
  if (!langs) return <p className="muted">{tx("Laden…")}</p>;
  const texts = p.descriptions || {};
  const nl = p.description;
  const done = langs.filter((l) => texts[l.code] || l.code === "nl").length;
  const list = langs.filter((l) => (only === "missing" ? !texts[l.code] && l.code !== "nl" : true));
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="row between">
        <p className="muted" style={{ margin: 0 }}>{tx("De omschrijving van {0} in alle talen van het systeem.", p.title)} <strong>{done}</strong> / {langs.length} {tx("talen")}</p>
        <div className="row" style={{ gap: ".4rem" }}>
          <button type="button" className={`btn sm${only === "all" ? " primary" : ""}`} onClick={() => setOnly("all")}>{tx("Alle talen")}</button>
          <button type="button" className={`btn sm${only === "missing" ? " primary" : ""}`} onClick={() => setOnly("missing")}>{tx("Ontbrekend")}</button>
        </div>
      </div>
      {!langs.length ? <p className="muted">{tx("Geen talen.")}</p> : (
        <div className="po-grid po-about">
          {list.map((l) => {
            const t = texts[l.code] || (l.code === "nl" ? nl : "");
            return (
              <div key={l.code} className={`card po-card${t ? "" : " po-missing"}`} dir={l.rtl ? "rtl" : undefined}>
                <div className="row" style={{ gap: ".5rem", alignItems: "baseline" }}><strong>{l.native_name || l.name}</strong><span className="badge">{l.code}</span></div>
                <p style={{ margin: 0 }}>{t || <span className="muted">{tx("Nog niet vertaald")}. {nl}</span>}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
