// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiBase, errorText } from "../../../../lib/api";
import { alertDialog, confirmDialog } from "../../../../lib/dialog";
import { tx } from "../../../../lib/t";

const MODES = [["copy", "Naast mijn pagina's zetten", "De pagina's van de template komen erbij. Jouw bestaande pagina's blijven staan."], ["replace", "In plaats van mijn pagina's", "Een pagina met hetzelfde adres wordt vervangen door die van de template."]];

// Admin > Website > Templates: a whole starting website (pages, pictures, menu, and maybe a theme and a set of components) as one zip, with example pictures. Choose one and it is yours: change it in the editor.
// The library is the folder resource/templates of the product; a superadmin can add more (a zip).
export default function TemplatesPage() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [pick, setPick] = useState(null);   // the template in the pop-up {t, n (picture), mode}
  const [done, setDone] = useState(null);
  const [q, setQ] = useState("");
  const file = useRef(null);
  const load = useCallback(() => api("/templates/").then(setD).catch((e) => setErr(errorText(e))), []);
  useEffect(() => { load(); }, [load]);
  const img = (t, n) => `${apiBase()}/api/templates/${t.key}/preview/${n}/`;
  const use = async () => {
    setBusy(pick.t.key); setErr("");
    try { setDone(await api("/templates/", { method: "POST", body: { action: "apply", key: pick.t.key, mode: pick.mode } })); setPick(null); }
    catch (e) { setErr(errorText(e)); }
    setBusy("");
  };
  const upload = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setBusy("upload"); setErr("");
    try { const fd = new FormData(); fd.append("file", f); setD(await api("/templates/", { method: "POST", body: fd })); } catch (x) { setErr(errorText(x)); }
    setBusy("");
  };
  const remove = async (t) => {
    if (!(await confirmDialog(tx("De template {0} uit de bibliotheek verwijderen? Websites die hem al gebruiken blijven zoals ze zijn.", t.name), { danger: true, okLabel: tx("Verwijderen") }))) return;
    setBusy(t.key);
    try { setD(await api("/templates/", { method: "POST", body: { action: "remove", key: t.key } })); } catch (e) { await alertDialog(errorText(e)); }
    setBusy("");
  };
  if (!d) return err ? <div className="alert">{err}</div> : <p className="muted">{tx("Laden…")}</p>;
  const list = d.templates.filter((t) => !q.trim() || `${t.name} ${t.description} ${t.author}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="stack">
      <div className="page-head"><div><h1>{tx("Templates")}</h1>
        <p className="muted" style={{ margin: 0 }}>{tx("Een template is een complete website om mee te beginnen: pagina's, afbeeldingen en menu, soms met een eigen thema. Kies er een, bekijk de voorbeelden en gebruik hem. Daarna pas je alles zelf aan in de editor.")}</p></div></div>
      {err && <div className="alert">{err}</div>}
      {done && (
        <div className="alert ok">
          <strong>{tx("De template is gebruikt.")}</strong> {done.pages} {tx("pagina's")}{done.media ? `, ${done.media} ${tx("afbeeldingen")}` : ""}{done.menu_items ? `, ${done.menu_items} ${tx("menu-items")}` : ""}.
          {done.notes?.length > 0 && <ul style={{ margin: ".4rem 0 0", paddingLeft: "1.2rem" }}>{done.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          <p style={{ margin: ".5rem 0 0" }}><Link className="btn sm primary" href="/">{tx("Bekijk je website")}</Link></p>
        </div>
      )}
      <div className="row" style={{ justifyContent: "flex-start", gap: ".6rem", flexWrap: "wrap", alignItems: "center" }}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoeken…")} style={{ maxWidth: "20rem" }} />
        {d.manage && <>
          <input ref={file} type="file" accept=".zip" onChange={upload} style={{ display: "none" }} />
          <button type="button" className="btn" disabled={busy === "upload"} onClick={() => file.current?.click()}>{busy === "upload" ? "…" : tx("Template toevoegen (zip)")}</button>
          <small className="muted">{tx("Alleen een superadmin. De bibliotheek staat in resource/templates.")}</small>
        </>}
      </div>
      <div className="tpl-grid">
        {list.map((t) => (
          <div key={t.key} className="card tpl-card">
            {t.previews > 0 ? <button type="button" className="tpl-img" onClick={() => setPick({ t, n: 0, mode: "copy" })} aria-label={t.name}><img src={img(t, 0)} alt="" loading="lazy" /></button> : <div className="tpl-img empty" />}
            <strong>{t.name}</strong> <small className="muted">v{t.version}{t.author ? ` · ${t.author}` : ""}</small>
            {t.description && <small className="muted">{t.description}</small>}
            <span className="row" style={{ gap: ".35rem", flexWrap: "wrap" }}>
              {t.has_theme && <span className="badge">{tx("Met eigen thema")}</span>}
              {t.components && <span className="badge">{tx("Met componentenset")}</span>}
            </span>
            <span className="row" style={{ justifyContent: "space-between", gap: ".4rem", marginTop: "auto" }}>
              <button type="button" className="btn sm" onClick={() => setPick({ t, n: 0, mode: "copy" })}>{tx("Bekijken")}</button>
              <span className="row" style={{ gap: ".4rem" }}>
                {d.manage && <button type="button" className="btn sm danger" disabled={!!busy} onClick={() => remove(t)}>{tx("Verwijderen")}</button>}
                {d.can_use && <button type="button" className="btn sm primary" disabled={!!busy} onClick={() => setPick({ t, n: 0, mode: "copy" })}>{tx("Gebruiken")}</button>}
              </span>
            </span>
          </div>
        ))}
        {!list.length && <p className="muted">{d.templates.length ? tx("Niets gevonden.") : tx("Er zijn nog geen templates. Een superadmin kan er een toevoegen (zip) of zet hem in resource/templates.")}</p>}
      </div>
      {pick && (
        <div className="overlay" onClick={() => !busy && setPick(null)}>
          <div className="card modal" style={{ width: "min(900px, 94vw)", maxHeight: "92vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="row between"><h2 style={{ margin: 0 }}>{pick.t.name}</h2><button type="button" className="btn sm" onClick={() => setPick(null)}>{tx("Sluiten")}</button></div>
            {pick.t.description && <p className="muted" style={{ margin: 0 }}>{pick.t.description}</p>}
            {pick.t.previews > 0 && (
              <>
                <img className="tpl-big" src={img(pick.t, pick.n)} alt={pick.t.name} />
                {pick.t.previews > 1 && <div className="row" style={{ gap: ".4rem", flexWrap: "wrap" }}>{Array.from({ length: pick.t.previews }, (_, i) => <button type="button" key={i} className={`tpl-thumb${pick.n === i ? " on" : ""}`} onClick={() => setPick({ ...pick, n: i })}><img src={img(pick.t, i)} alt="" /></button>)}</div>}
              </>
            )}
            {d.can_use ? (
              <>
                <strong>{tx("Hoe gebruiken?")}</strong>
                {MODES.map(([k, l, h]) => <label key={k} className="check" style={{ alignItems: "flex-start" }}><input type="radio" name="tpl-mode" checked={pick.mode === k} onChange={() => setPick({ ...pick, mode: k })} /><span><strong>{tx(l)}</strong><br /><small className="muted">{tx(h)}</small></span></label>)}
                {(pick.t.has_theme || pick.t.components) && <small className="muted">{pick.t.has_theme ? tx("Het thema van de template wordt in gebruik genomen. ") : ""}{pick.t.components ? tx("De componentenset van de template wordt in gebruik genomen.") : ""}</small>}
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="btn" onClick={() => setPick(null)}>{tx("Annuleren")}</button>
                  <button type="button" className="btn primary" disabled={!!busy} onClick={use}>{busy ? tx("Bezig…") : tx("Deze template gebruiken")}</button>
                </div>
              </>
            ) : <small className="muted">{tx("Je hebt geen rechten om pagina's te beheren, dus je kunt een template alleen bekijken.")}</small>}
          </div>
        </div>
      )}
    </div>
  );
}
