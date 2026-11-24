// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, apiBase, errorText } from "../lib/api";
import { tx } from "../lib/t";
import Tabs from "./Tabs";

// The tab Design of a standard installation, in two parts: 1. Settings: choose the pages of this website that belong to the installation (kept with ALL their texts and pictures,
// exactly like this when the installation is set). 2. Samples: a picture of the whole page of every chosen page: made when the page is switched on, removed when it is switched off.
// The pictures present the installation.
export const sampleUrl = (preset, page) => `${apiBase()}/api/system/presets/${preset}/samples/${page}.jpg`;

export default function PresetDesign({ preset }) {
  const [sub, setSub] = useState("settings");
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [stamp, setStamp] = useState(() => Date.now());  // (a new picture: the browser loads it again)
  const [big, setBig] = useState(null);
  const timer = useRef(null);
  const load = (d) => { setData(d); return d; };
  useEffect(() => { api(`/system/presets/${preset}/design/`).then(load).catch((e) => setMsg({ ok: false, text: errorText(e) })); return () => clearTimeout(timer.current); }, [preset]);
  const waiting = !!data?.pages.some((p) => p.sample === "busy");
  useEffect(() => {  // while a picture is being made the list is asked again
    clearTimeout(timer.current);
    if (waiting) timer.current = setTimeout(() => api(`/system/presets/${preset}/design/`).then((d) => { load(d); setStamp(Date.now()); }).catch(() => {}), 3000);
    return () => clearTimeout(timer.current);
  }, [waiting, data, preset]);
  const rows = useMemo(() => (data?.pages || []).filter((p) => (p.title + " " + p.key).toLowerCase().includes(q.trim().toLowerCase())), [data, q]);
  if (!data) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Bezig…")}</p>;
  const chosen = data.pages.filter((p) => p.saved);
  const push = async (keys) => {  // every switch is saved at once: the package of the page is made, and its picture
    setBusy(true); setMsg(null);
    try { load(await api(`/system/presets/${preset}/design/`, { method: "POST", body: { pages: keys } })); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const flip = (k, on) => { const cur = data.pages.filter((p) => p.saved).map((p) => p.key); push(on ? [...cur, k] : cur.filter((x) => x !== k)); };
  const themeAct = async (action) => {  // keep the look of this website in the installation, or take it away
    setBusy(true); setMsg(null);
    try { const r = await api(`/system/presets/${preset}/design/theme/`, { method: "POST", body: { action } }); setData({ ...data, theme: r.theme }); setMsg({ ok: true, text: action === "capture" ? tx("Het thema van deze website is opgeslagen in de installatie.") : tx("Het thema is uit de installatie gehaald.") }); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const again = async (k) => {
    setBusy(true);
    try { load(await api(`/system/presets/${preset}/design/sample/`, { method: "POST", body: { page: k } })); setStamp(Date.now()); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  return (<>
    <Tabs value={sub} onChange={setSub} tabs={[["settings", "Settings"], ["samples", "Samples"]]} />
    {sub === "settings" && (<>
      <p className="muted" style={{ margin: 0 }}>{tx("Kies de pagina's van deze website die bij de installatie horen. Ze worden bewaard met al hun teksten en alle gekoppelde afbeeldingen en video's. Wordt de installatie ingesteld, dan zijn de pagina's precies zo. Een pagina met een eigen inhoud blijft staan tenzij je kiest om hem te vervangen. Een schakelaar is meteen opgeslagen.")}</p>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: ".5rem" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoek een pagina…")} aria-label={tx("Zoeken")} style={{ flex: 1 }} />
        <button type="button" className="btn sm" disabled={busy} onClick={() => push(data.pages.map((p) => p.key))}>{tx("Alles aan")}</button>
        <button type="button" className="btn sm" disabled={busy} onClick={() => push([])}>{tx("Alles uit")}</button>
      </div>
      <div className="pdz-list">
        {rows.map((p) => (
          <label key={p.key} className="check sec-toggle pdz-row">
            <span className="switch"><input type="checkbox" checked={p.saved} disabled={busy} onChange={(e) => flip(p.key, e.target.checked)} /><span /></span>
            <span className="pdz-name">{p.title}<small className="muted" style={{ display: "block" }}>{p.path || `/${p.key}`}</small></span>
            <span className="badge">{p.kind === "content" ? tx("Eigen pagina") : tx("Standaardpagina")}</span>
            {p.in_menu && <span className="badge ok">{tx("In het menu")}</span>}
            {p.missing?.length > 0 && <span className="badge off" title={p.missing.join("\n")}>{tx("{0} afbeeldingen ontbreken", p.missing.length)}</span>}
          </label>
        ))}
        {!rows.length && <p className="muted">{tx("Geen pagina gevonden.")}</p>}
      </div>
      {chosen.some((p) => p.missing?.length) && <div className="alert">{tx("Van sommige pagina's staan afbeeldingen niet (meer) op deze website; die kunnen niet met de installatie mee. Zet ze eerst terug (bijvoorbeeld door de website opnieuw te importeren) en zet de pagina uit en weer aan.")}</div>}
      <section className="pdz-theme">
        <h4>{tx("Kleurenthema van de installatie")}</h4>
        {data.theme ? (
          <div className="pdz-theme-row">
            <span className="pdz-sw" aria-hidden="true">{Object.values(data.theme.colors).map((c, i) => <i key={i} style={{ background: c }} />)}</span>
            <span><strong>{data.theme.name}</strong><small className="muted" style={{ display: "block" }}>{(data.theme.fonts || []).join(" · ")}</small></span>
          </div>
        ) : <p className="muted" style={{ margin: 0 }}>{tx("Er is nog geen thema opgeslagen: de installatie brengt de kleuren van de website niet mee.")}</p>}
        <p className="muted" style={{ margin: ".25rem 0 .5rem", fontSize: ".82rem" }}>{tx("Het thema (kleuren, lettertypen, vormen, logo's en foto's van de startpagina) wordt bij elke wijziging van de pagina's vanzelf bijgewerkt. Bij het instellen van de installatie wordt gevraagd of dit thema of een ander kleurenthema wordt gebruikt.")}</p>
        <div className="row" style={{ justifyContent: "flex-start", gap: ".5rem" }}>
          <button type="button" className="btn sm primary" disabled={busy} onClick={() => themeAct("capture")}>{data.theme ? tx("Thema opnieuw vastleggen") : tx("Thema van deze website opslaan")}</button>
          {data.theme && <button type="button" className="btn sm" disabled={busy} onClick={() => themeAct("remove")}>{tx("Thema verwijderen")}</button>}
        </div>
      </section>
      <small className="muted">{tx("{0} pagina's gekozen", chosen.length)}{data.saved_at ? ` · ${tx("laatst opgeslagen")} ${new Date(data.saved_at).toLocaleString()}` : ""}</small>
    </>)}
    {sub === "samples" && (<>
      <p className="muted" style={{ margin: 0 }}>{tx("Een afbeelding van de hele pagina, gemaakt als je de pagina aanzet bij Settings en weggehaald als je hem uitzet. De afbeeldingen laten zien hoe de installatie eruitziet als de installatie wordt gepresenteerd.")}</p>
      <div className="pdz-samples">
        {chosen.map((p) => (
          <div key={p.key} className="pdz-sample">
            <div className="pdz-shot">
              {p.sample === "ready" && <button type="button" onClick={() => setBig(p)} aria-label={tx("Groot bekijken")}><img src={`${sampleUrl(preset, p.key)}?v=${stamp}`} alt={p.title} loading="lazy" /></button>}
              {p.sample === "busy" && <span className="muted">{tx("Bezig met een afbeelding maken…")}</span>}
              {p.sample === "none" && <span className="muted">{tx("Nog geen afbeelding.")}</span>}
              {String(p.sample).startsWith("error") && <span className="muted">{String(p.sample).replace(/^error:\s*/, "")}</span>}
            </div>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: ".4rem" }}>
              <strong>{p.title}</strong>
              <button type="button" className="btn sm" disabled={busy || p.sample === "busy"} onClick={() => again(p.key)}>{tx("Opnieuw maken")}</button>
            </div>
          </div>
        ))}
        {!chosen.length && <p className="muted">{tx("Zet eerst pagina's aan bij Settings.")}</p>}
      </div>
    </>)}
    {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
    {big && (
      <div className="overlay" onClick={() => setBig(null)}>
        <div className="card modal pdz-big" onClick={(e) => e.stopPropagation()}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><strong>{big.title}</strong><button type="button" className="btn sm" onClick={() => setBig(null)}>{tx("Sluiten")}</button></div>
          <div className="pdz-bigimg"><img src={`${sampleUrl(preset, big.key)}?v=${stamp}`} alt={big.title} /></div>
        </div>
      </div>
    )}
  </>);
}
