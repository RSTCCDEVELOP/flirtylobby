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
import KitScope from "../../../../lib/ui-kit/KitScope";

import Loading from "../../../../components/Loading";
const MODES = [["copy", "Naast mijn pagina's zetten", "De pagina's van de template komen erbij. Jouw bestaande pagina's blijven staan."], ["replace", "In plaats van mijn pagina's", "Een pagina met hetzelfde adres wordt vervangen door die van de template."]];

// The result of the check after a template was read in: every part with OK or what is wrong (and what was repaired).
function CheckReport({ check }) {
  if (!check?.items) return null;
  return (
    <ul style={{ margin: ".5rem 0 0", paddingLeft: 0, listStyle: "none", display: "grid", gap: ".25rem" }} data-easy2edit-tag="ui-check-report">
      {check.items.map((i) => (
        <li key={i.key} style={{ display: "flex", gap: ".5rem", alignItems: "flex-start" }}>
          <span aria-hidden="true" style={{ flex: "none", width: 18, height: 18, borderRadius: "50%", display: "grid", placeItems: "center", background: i.ok ? "var(--e2e-success, #16a34a)" : "var(--e2e-danger, #dc2626)", color: "#fff", fontSize: 11, marginTop: 2 }}>{i.ok ? "✓" : "!"}</span>
          <span><strong>{tx(i.label)}</strong>{i.fixed ? <small className="muted"> · {tx("hersteld")}</small> : null}<br /><small className="muted">{i.detail}</small></span>
        </li>
      ))}
    </ul>
  );
}

// Admin > Website > Templates: a whole starting website (pages, pictures, menu, and maybe a theme and a set of components) as one zip, with example pictures. Choose one and it is yours: change it in the editor.
// The library is the folder resource/templates of the product; a superadmin can add more (a zip).
export default function TemplatesPage() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [pick, setPick] = useState(null);   // the template in the pop-up {t, n (picture), mode}
  const [done, setDone] = useState(null);
  const [q, setQ] = useState("");
  const [verify, setVerify] = useState(null);
  const file = useRef(null);
  const load = useCallback(() => api("/templates/").then(setD).catch((e) => setErr(errorText(e))), []);
  useEffect(() => { load(); }, [load]);
  const img = (t, n) => `${apiBase()}/api/templates/${t.key}/preview/${n}/`;
  const use = async () => {
    setBusy(pick.t.key); setErr("");
    try { setDone(await api("/templates/", { method: "POST", body: { action: "apply", key: pick.t.key, mode: pick.mode, scope: pick.scope === "system" ? "system" : "pages" } })); setPick(null); }
    catch (e) { setErr(errorText(e)); }
    setBusy("");
  };
  const check = async (t) => {
    setBusy(t.key); setErr("");
    try { setVerify({ name: t.name, report: await api("/templates/", { method: "POST", body: { action: "verify", key: t.key } }) }); } catch (e) { setErr(errorText(e)); }
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
  if (!d) return err ? <div className="alert">{err}</div> : <p className="muted"><Loading /></p>;
  const list = d.templates.filter((t) => !q.trim() || `${t.name} ${t.description} ${t.author}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <KitScope tag="ui-cards" className="stack">
      <div className="page-head"><div><h1>{tx("Templates")}</h1>
        <p className="muted" style={{ margin: 0 }}>{tx("Een template is een complete website om mee te beginnen: pagina's, afbeeldingen en menu, soms met een eigen thema. Kies er een, bekijk de voorbeelden en gebruik hem. Daarna pas je alles zelf aan in de editor.")}</p></div></div>
      {err && <div className="alert">{err}</div>}
      {done?.scope === "system" && (
        <div className={`alert ${done.check?.ok ? "ok" : ""}`}>
          <strong>{tx("Het systeem is ingesteld met de template.")}</strong> {tx("Een backup van daarvoor staat klaar")}: {done.safety_backup}.
          {done.notes?.length > 0 && <ul style={{ margin: ".4rem 0 0", paddingLeft: "1.2rem" }}>{done.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          <CheckReport check={done.check} />
          <p style={{ margin: ".5rem 0 0" }}><Link className="e2e-btn e2e-btn--sm" href="/">{tx("Bekijk je website")}</Link></p>
        </div>
      )}
      {verify && <div className={`alert ${verify.report.ok ? "ok" : ""}`}><strong>{tx("Controle van")} {verify.name}</strong><CheckReport check={verify.report} /></div>}
      {done && done.scope !== "system" && (
        <div className="alert ok">
          <strong>{tx("De template is gebruikt.")}</strong> {done.pages} {tx("pagina's")}{done.media ? `, ${done.media} ${tx("afbeeldingen")}` : ""}{done.menu_items ? `, ${done.menu_items} ${tx("menu-items")}` : ""}.
          {done.notes?.length > 0 && <ul style={{ margin: ".4rem 0 0", paddingLeft: "1.2rem" }}>{done.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          <p style={{ margin: ".5rem 0 0" }}><Link className="e2e-btn e2e-btn--sm" href="/">{tx("Bekijk je website")}</Link></p>
        </div>
      )}
      <div className="row" style={{ justifyContent: "flex-start", gap: ".6rem", flexWrap: "wrap", alignItems: "center" }}>
        <input type="search" className="e2e-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoeken…")} style={{ maxWidth: "20rem" }} />
        {d.manage && <>
          <input ref={file} type="file" accept=".zip" onChange={upload} style={{ display: "none" }} />
          <button type="button" className="e2e-btn e2e-btn--outline" disabled={busy === "upload"} onClick={() => file.current?.click()}>{busy === "upload" ? "…" : tx("Template toevoegen (zip)")}</button>
          <small className="muted">{tx("Alleen een superadmin. De bibliotheek staat in resource/templates.")}</small>
        </>}
      </div>
      <div className="tpl-grid">
        {list.map((t) => (
          <div key={t.key} className="e2e-card tpl-card">
            {t.previews > 0 ? <button type="button" className="tpl-img" onClick={() => setPick({ t, n: 0, mode: "copy", scope: t.system && !t.has_pages ? "system" : "pages" })} aria-label={t.name}><img src={img(t, 0)} alt="" loading="lazy" /></button> : <div className="tpl-img empty" />}
            <strong>{t.name}</strong> <small className="muted">v{t.version}{t.author ? ` · ${t.author}` : ""}</small>
            {t.description && <small className="muted">{t.description}</small>}
            <span className="row" style={{ gap: ".35rem", flexWrap: "wrap" }}>
              {t.system && <span className="e2e-badge">{tx("Volledig systeem")}</span>}
              {t.has_theme && <span className="e2e-badge">{tx("Met eigen thema")}</span>}
              {t.components && <span className="e2e-badge">{tx("Met componentenset")}</span>}
            </span>
            <span className="row" style={{ justifyContent: "space-between", gap: ".4rem", marginTop: "auto" }}>
              <button type="button" className="e2e-btn e2e-btn--sm e2e-btn--outline" onClick={() => setPick({ t, n: 0, mode: "copy", scope: t.system && !t.has_pages ? "system" : "pages" })}>{tx("Bekijken")}</button>
              <span className="row" style={{ gap: ".4rem" }}>
                {d.manage && t.system && <button type="button" className="e2e-btn e2e-btn--sm e2e-btn--outline" disabled={!!busy} onClick={() => check(t)} title={tx("Controleer of de modules, plugins, het thema, de talen, de pagina's en de database kloppen")}>{tx("Controleren")}</button>}
                {d.manage && <button type="button" className="e2e-btn e2e-btn--sm e2e-btn--outline" style={{ color: "var(--e2e-danger)" }} disabled={!!busy} onClick={() => remove(t)}>{tx("Verwijderen")}</button>}
                {d.can_use && <button type="button" className="e2e-btn e2e-btn--sm" disabled={!!busy} onClick={() => setPick({ t, n: 0, mode: "copy", scope: t.system && !t.has_pages ? "system" : "pages" })}>{tx("Gebruiken")}</button>}
              </span>
            </span>
          </div>
        ))}
        {!list.length && <p className="muted">{d.templates.length ? tx("Niets gevonden.") : tx("Er zijn nog geen templates. Een superadmin kan er een toevoegen (zip) of zet hem in resource/templates.")}</p>}
      </div>
      {pick && (
        <div className="overlay" onClick={() => !busy && setPick(null)}>
          <div className="card modal" style={{ width: "min(900px, 94vw)", maxHeight: "92vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="row between"><h2 style={{ margin: 0 }}>{pick.t.name}</h2><button type="button" className="e2e-btn e2e-btn--sm e2e-btn--outline" onClick={() => setPick(null)}>{tx("Sluiten")}</button></div>
            {pick.t.description && <p className="muted" style={{ margin: 0 }}>{pick.t.description}</p>}
            {pick.t.previews > 0 && (
              <>
                <img className="tpl-big" src={img(pick.t, pick.n)} alt={pick.t.name} />
                {pick.t.previews > 1 && <div className="row" style={{ gap: ".4rem", flexWrap: "wrap" }}>{Array.from({ length: pick.t.previews }, (_, i) => <button type="button" key={i} className={`tpl-thumb${pick.n === i ? " on" : ""}`} onClick={() => setPick({ ...pick, n: i })}><img src={img(pick.t, i)} alt="" /></button>)}</div>}
              </>
            )}
            {d.can_use ? (
              <>
                {pick.t.system && d.manage && (
                  <>
                    <strong>{tx("Wat zet je in?")}</strong>
                    {pick.t.has_pages && <label className="e2e-check" style={{ alignItems: "flex-start" }}><input type="radio" name="tpl-scope" checked={pick.scope !== "system"} onChange={() => setPick({ ...pick, scope: "pages" })} /><span><strong>{tx("Alleen de pagina's")}</strong><br /><small className="muted">{tx("Zoals een gewone template: de pagina's met afbeeldingen en menu.")}</small></span></label>}
                    <label className="e2e-check" style={{ alignItems: "flex-start" }}><input type="radio" name="tpl-scope" checked={pick.scope === "system"} onChange={() => setPick({ ...pick, scope: "system" })} /><span><strong>{tx("Het hele systeem")}</strong><br /><small className="muted">{tx("Eerst een backup van alles (zodat je kunt terugzetten), daarna de modules, plugins, het thema, de talen, het dashboard, de componentenset en de pagina's van de template. Gegevens van gebruikers zitten er niet in en blijven zoals ze zijn. Na afloop controleert het systeem of alles klopt.")}</small></span></label>
                  </>
                )}
                {pick.scope !== "system" && <strong>{tx("Hoe gebruiken?")}</strong>}
                {pick.scope !== "system" && MODES.map(([k, l, h]) => <label key={k} className="e2e-check" style={{ alignItems: "flex-start" }}><input type="radio" name="tpl-mode" checked={pick.mode === k} onChange={() => setPick({ ...pick, mode: k })} /><span><strong>{tx(l)}</strong><br /><small className="muted">{tx(h)}</small></span></label>)}
                {(pick.t.has_theme || pick.t.components) && <small className="muted">{pick.t.has_theme ? tx("Het thema van de template wordt in gebruik genomen. ") : ""}{pick.t.components ? tx("De componentenset van de template wordt in gebruik genomen.") : ""}</small>}
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="e2e-btn e2e-btn--outline" onClick={() => setPick(null)}>{tx("Annuleren")}</button>
                  <button type="button" className="e2e-btn" disabled={!!busy} onClick={use}>{busy ? tx("Bezig…") : tx("Deze template gebruiken")}</button>
                </div>
              </>
            ) : <small className="muted">{tx("Je hebt geen rechten om pagina's te beheren, dus je kunt een template alleen bekijken.")}</small>}
          </div>
        </div>
      )}
    </KitScope>
  );
}
