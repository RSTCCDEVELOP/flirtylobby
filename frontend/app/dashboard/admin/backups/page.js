// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../../../../lib/t";
import { useCallback, useEffect, useRef, useState } from "react";
import Collapsible from "../../../../components/Collapsible";
import { useAuth } from "../../../../components/AuthContext";
import { lvl } from "../../../../lib/perms";
import { api, apiBase, errorText, getToken } from "../../../../lib/api";
import { alertDialog, confirmDialog } from "../../../../lib/dialog";
import { LoaderArt } from "../../../../components/PageLoader";
import BackupTemplate from "../../../../components/BackupTemplate";

const KIND = { daily: "Per dag", weekly: "Per week", monthly: "Per maand", manual: "Handmatig", restore: "Voor terugzetten" };
const WEEKDAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
const size = (n) => (n > 2 ** 20 ? `${(n / 2 ** 20).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const when = (d) => (d ? new Date(d).toLocaleString() : "–");

const Sw = ({ checked, onChange, disabled, label }) => (
  <label className="check sec-toggle">
    <span className="switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span /></span>
    {label && <span>{label}</span>}
  </label>
);

export default function BackupsAdmin() {
  const { user } = useAuth();
  const L = lvl(user, "backups");
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [restoring, setRestoring] = useState(null); // {backup, parts: Set}
  const [asTemplate, setAsTemplate] = useState(null); // a backup that is saved as a template (superadmin)
  const [lim, setLim] = useState(null);
  const fileIn = useRef(null);

  const take = useCallback((r) => { setD(r); setLim(r.limits); }, []);
  const load = useCallback(() => api("/backups/").then(take).catch((e) => setMsg({ ok: false, text: errorText(e) })), [take]);
  useEffect(() => { load(); }, [load]);

  async function run(label, fn, okText) {
    setBusy(label); setMsg(null);
    try { const r = await fn(); if (r?.backups) take(r); if (okText) setMsg({ ok: true, text: okText }); return r; } catch (e) { setMsg({ ok: false, text: errorText(e) }); await alertDialog(errorText(e)); }
    finally { setBusy(""); }
  }
  const makeNow = async () => { const r = await run("now", () => api("/backups/create/", { method: "POST", body: {} })); if (r?.made) setDl({ b: r.made, ask: true }); };  // the backup is made: now the question what to do with it
  const fresh = (b) => Date.now() - new Date(b.created_at).getTime() < 30 * 60 * 1000;  // a template is only made of a backup that was just made
  const makeForTemplate = async () => { const r = await run("now", () => api("/backups/create/", { method: "POST", body: {} })); if (r?.made) setAsTemplate(r.made); };
  const saveJob = (j, patch) => run(`job-${j.frequency}`, () => api(`/backups/jobs/${j.frequency}/`, { method: "PUT", body: { ...j, ...patch } }));
  const runJob = async (j) => { const r = await run(`run-${j.frequency}`, () => api(`/backups/jobs/${j.frequency}/run/`, { method: "POST", body: {} })); if (r) await alertDialog(tx("Backup klaar")); };
  const saveLimits = () => run("limits", () => api("/backups/limits/", { method: "PUT", body: lim }), tx("Limieten opgeslagen. Oudere backups boven de limiet zijn verwijderd."));
  const remove = async (b) => { if (await confirmDialog(tx("Backup \"{0}\" verwijderen?", b.file), { danger: true })) run("del", () => api(`/backups/${b.id}/`, { method: "DELETE" })); };
  // Download: ask what to do: 1. download (to the download folder), 2. save locally (choose the folder and name on this computer), 3. both
  const [dl, setDl] = useState(null);
  const saveBlob = (blob, name) => {  // (the link must be in the page: Safari and Firefox ignore a click on a link that is not)
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.style.display = "none";
    document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
  };
  async function doDownload(how, item) {
    const b = item || dl.b;
    setDl({ b, busy: true, pct: 0, loaded: 0, total: b.size || 0, step: tx("Verbinden met de server…") });
    try {
      const res = await fetch(`${apiBase()}/api/backups/${b.id}/download/`, { headers: { Authorization: `Token ${getToken()}` } });
      if (!res.ok) { let t = tx("Downloaden mislukt."); try { t = (await res.json()).detail || t; } catch {} throw new Error(t); }
      // read the file piece by piece: the bar and the percentage are real
      const total = Number(res.headers.get("Content-Length")) || b.size || 0;
      const chunks = []; let loaded = 0;
      if (res.body?.getReader) {
        const rd = res.body.getReader();
        for (;;) {
          const { done, value } = await rd.read();
          if (done) break;
          chunks.push(value); loaded += value.length;
          setDl({ b, busy: true, loaded, total, pct: total ? Math.min(99, Math.round((loaded / total) * 100)) : 0, step: tx("Downloaden…") });
        }
      } else { chunks.push(new Uint8Array(await res.arrayBuffer())); loaded = chunks[0].length; }
      setDl({ b, busy: true, loaded, total: total || loaded, pct: 100, step: how === "download" ? tx("Bewaren…") : tx("Kies waar je de backup bewaart…") });
      const blob = new Blob(chunks, { type: "application/zip" });
      let saved = false;
      if (how === "local" || how === "both") {
        if (typeof window.showSaveFilePicker === "function") {
          try { const h = await window.showSaveFilePicker({ suggestedName: b.file, types: [{ description: "Backup (.zip)", accept: { "application/zip": [".zip"] } }] }); const w = await h.createWritable(); await w.write(blob); await w.close(); saved = true; }
          catch (e) { if (e?.name === "AbortError" && how === "local") { setDl(null); return; } }
        }
        if (!saved && how === "local") { saveBlob(blob, b.file); saved = true; setMsg({ ok: true, text: tx("Deze browser kan geen map kiezen: de backup is gedownload.") }); }
      }
      if (how === "download" || how === "both") saveBlob(blob, b.file);
      if (!(how === "local" && !saved) && !(how === "local")) setMsg({ ok: true, text: tx("De backup is gedownload.") });
      else if (saved && typeof window.showSaveFilePicker === "function") setMsg({ ok: true, text: tx("De backup is lokaal opgeslagen.") });
      setDl(null);
    } catch (e) { setDl(null); setMsg({ ok: false, text: errorText(e) }); await alertDialog(errorText(e)); }
  }
  const download = (b) => doDownload("download", b);  // the Download button of the list downloads at once
  async function upload(file) {
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    const r = await run("upload", () => api("/backups/upload/", { method: "POST", body: fd }), tx("De backup is toegevoegd aan de lijst."));
    // uploaded: ask at once whether to put it back now
    if (r?.made && canManage && r.made.exists !== false && (r.made.parts || []).length && await confirmDialog(tx("De backup is geladen. Wil je hem nu terugzetten of alleen opslaan bij de backups?"), { okLabel: tx("Terugzetten"), cancelLabel: tx("Opslaan bij de backups") })) setRestoring({ backup: r.made, parts: new Set(r.made.parts.map((p) => p.key)) });
  }
  async function doRestore() {
    const { backup, parts } = restoring;
    setRestoring(null);
    const r = await run("restore", () => api(`/backups/${backup.id}/restore/`, { method: "POST", body: { parts: [...parts] } }));
    if (r?.results) {
      window.dispatchEvent(new Event("pages-changed")); window.dispatchEvent(new Event("languages-changed"));
      await alertDialog(`${tx("Terugzetten klaar")}\n\n${r.results.map((x) => `${x.ok ? "✓" : "✗"} ${x.label || x.key}: ${x.message}`).join("\n")}\n\n${tx("Een backup van de situatie daarvoor staat in de lijst (Voor terugzetten).")}`);
    }
  }

  if (!d) return <p className="muted">{msg?.text || "…"}</p>;
  const canEdit = L >= 2, canManage = L >= 3;
  return (
    <>
      <h1>{tx("Backup")}</h1>
      <p className="muted">{tx("Een backup bevat je pagina's, menu's, teksten, afbeeldingen en video's, het gekozen thema en de instellingen van modules en plugins. De standaardgegevens van easy2edit zelf (standaardpagina's, ingebouwde thema's) zitten er niet in, tenzij je ze hebt aangepast; zo kan een backup de werking van de engine niet verstoren.")}</p>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}

      <Collapsible id="backup-now" title={tx("Nu een backup maken")}>
        <div className="row" style={{ justifyContent: "flex-start" }}>
          <button type="button" className="btn primary" disabled={!canEdit || !!busy} onClick={makeNow}>{busy === "now" ? tx("Bezig…") : tx("Backup maken")}</button>
          {d.superadmin && <button type="button" className="btn" disabled={!canEdit || !!busy} onClick={makeForTemplate}>{tx("Backup maken en opslaan als template")}</button>}
          {canManage && <>
            <button type="button" className="btn" disabled={!!busy} onClick={() => fileIn.current?.click()}>{tx("Backup uploaden (.zip)")}</button>
            <button type="button" className="btn" disabled={!!busy} onClick={() => fileIn.current?.click()}>{tx("Backup terugzetten (.zip)")}</button>
            <input ref={fileIn} type="file" accept=".zip,application/zip" hidden onChange={(e) => { upload(e.target.files[0]); e.target.value = ""; }} />
          </>}
          <small className="muted">{tx("Map")}: <code>{d.folder}</code></small>
        </div>
        {busy === "now" && <div className="imp-bar imp-wait" role="progressbar"><span /></div>}
      </Collapsible>

      <Collapsible id="backup-jobs" title={tx("Automatische backups")}>
        <p className="muted" style={{ margin: 0 }}>{tx("Kies per dag, per week en per maand of er een backup wordt gemaakt. Bij een nieuwe backup wordt de oudste boven het aantal dat je bewaart verwijderd.")}</p>
        <div className="theme-grid" style={{ marginTop: ".6rem" }}>
          {d.jobs.map((j) => (
            <div key={j.frequency} className="card" style={{ display: "grid", gap: ".6rem", alignContent: "start" }}>
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                <strong>{tx(KIND[j.frequency])}</strong>
                <Sw checked={j.enabled} disabled={!canEdit} onChange={(v) => saveJob(j, { enabled: v })} />
              </div>
              <label>{tx("Tijd")}
                <select value={j.hour} disabled={!canEdit} onChange={(e) => saveJob(j, { hour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select>
              </label>
              {j.frequency === "weekly" && <label>{tx("Dag van de week")}<select value={j.weekday} disabled={!canEdit} onChange={(e) => saveJob(j, { weekday: Number(e.target.value) })}>{WEEKDAYS.map((w, i) => <option key={i} value={i}>{tx(w)}</option>)}</select></label>}
              {j.frequency === "monthly" && <label>{tx("Dag van de maand")}<select value={j.day} disabled={!canEdit} onChange={(e) => saveJob(j, { day: Number(e.target.value) })}>{Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>}
              <label>{tx("Aantal backups bewaren")} <small className="muted">{tx("maximaal {0}", j.limit)}</small>
                <input type="number" min={1} max={j.limit} value={j.keep} disabled={!canEdit} onChange={(e) => saveJob(j, { keep: Number(e.target.value) })} />
              </label>
              <small className="muted">{j.last_run_at ? `${tx("Laatst")}: ${when(j.last_run_at)} · ${j.last_status === "failed" ? tx("mislukt") : tx("gelukt")}` : tx("Nog niet uitgevoerd")}{j.last_error ? ` — ${j.last_error}` : ""}</small>
              <button type="button" className="btn sm" disabled={!canEdit || !!busy} onClick={() => runJob(j)}>{busy === `run-${j.frequency}` ? tx("Bezig…") : tx("Nu uitvoeren")}</button>
            </div>
          ))}
        </div>
      </Collapsible>

      <Collapsible id="backup-list" title={`${tx("Backups")} (${d.backups.length})`}>
        {!d.backups.length ? <p className="muted">{tx("Er zijn nog geen backups.")}</p> : (
          <div style={{ display: "grid", gap: ".7rem" }}>
            {d.backups.map((b) => (
              <div key={b.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: ".5rem 1.2rem", alignItems: "start", padding: ".8rem 1rem", borderRadius: 12, background: "color-mix(in srgb, var(--eco-leaf, #7cc59a) 11%, transparent)", minWidth: 0 }}>
                <div style={{ minWidth: 0, overflowWrap: "anywhere" }}><strong>{when(b.created_at)}</strong><br /><small className="muted">{b.file}{b.created_by ? ` · ${b.created_by}` : ""}</small></div>
                <div style={{ minWidth: 0, overflowWrap: "anywhere" }}><span className={`badge ${b.frequency === "manual" ? "off" : "ok"}`}>{tx(KIND[b.frequency] || b.frequency)}</span> {b.exists ? <small className="muted">{size(b.size)}</small> : <span className="badge off">{tx("bestand weg")}</span>}{b.note && <><br /><small className="muted">{b.note}</small></>}</div>
                <small className="muted" style={{ minWidth: 0, overflowWrap: "anywhere" }}>{tx("{0} pagina's, {1} indelingen, {2} teksten, {3} bestanden", b.stats?.pages ?? 0, b.stats?.layouts ?? 0, b.stats?.texts ?? 0, b.stats?.files ?? 0)}{b.stats?.skipped?.length ? ` · ${tx("{0} overgeslagen (te groot)", b.stats.skipped.length)}` : ""}</small>
                <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap", gridColumn: "1 / -1", justifyContent: "flex-end" }}>
                  {canEdit && <button type="button" className="btn sm" disabled={!b.exists} onClick={() => download(b)}>{tx("Download")}</button>}
                  {d.superadmin && <button type="button" className="btn sm" disabled={!b.exists || !!busy || !fresh(b)} title={fresh(b) ? undefined : tx("Een template kan alleen van een net gemaakte backup worden gemaakt: maak eerst een nieuwe backup")} onClick={() => setAsTemplate(b)}>{tx("Opslaan als template")}</button>}
                  {canManage && <button type="button" className="btn sm primary" disabled={!b.exists || !!busy} onClick={() => setRestoring({ backup: b, parts: new Set(b.parts.map((p) => p.key)) })}>{tx("Terugzetten")}</button>}
                  {canManage && <button type="button" className="btn sm danger" disabled={!!busy} onClick={() => remove(b)}>{tx("Verwijder")}</button>}
                </div>
              </div>
            ))}
          </div>
        )}
        {busy === "restore" && <div className="imp-bar imp-wait" role="progressbar"><span /></div>}
      </Collapsible>

      {asTemplate && <BackupTemplate backup={asTemplate} onClose={() => setAsTemplate(null)} />}

      {d.superadmin && lim && (
        <Collapsible id="backup-limits" title={tx("Limieten (superadmin)")}>
          <p className="muted" style={{ margin: 0 }}>{tx("Hoeveel backups een beheerder per soort mag bewaren. Staat een beheerder hoger ingesteld, dan geldt deze limiet. Een lagere limiet verwijdert meteen de oudste backups.")}</p>
          <div className="theme-grid" style={{ marginTop: ".6rem" }}>
            {[["daily", "Per dag"], ["weekly", "Per week"], ["monthly", "Per maand"], ["manual", "Handmatig"]].map(([k, l]) => (
              <label key={k}>{tx(l)}<input type="number" min={1} max={365} value={lim[k]} onChange={(e) => setLim({ ...lim, [k]: Number(e.target.value) })} /></label>
            ))}
          </div>
          <Sw checked={!!lim.include_secrets} onChange={(v) => setLim({ ...lim, include_secrets: v })} label={<span>{tx("API keys en andere geheimen in de backup opnemen")} <small className="muted">{tx("handig bij een complete herstart, maar het bestand moet dan goed bewaard worden")}</small></span>} />
          <div className="row" style={{ justifyContent: "flex-start" }}><button type="button" className="btn primary" disabled={!!busy} onClick={saveLimits}>{tx("Opslaan")}</button></div>
        </Collapsible>
      )}

      {restoring && (
        <div className="overlay" onClick={() => setRestoring(null)}>
          <div className="card modal form" onClick={(e) => e.stopPropagation()}>
            <h2>{tx("Backup terugzetten")}</h2>
            <p className="muted" style={{ margin: 0 }}>{tx("Kies wat je terugzet uit {0}. Wat in de backup staat wordt overschreven; wat later is gemaakt blijft staan. Vlak ervoor wordt een backup van nu gemaakt.", restoring.backup.file)}</p>
            <div style={{ display: "grid", gap: ".4rem", maxHeight: "40vh", overflow: "auto" }}>
              {restoring.backup.parts.map((p) => (
                <Sw key={p.key} checked={restoring.parts.has(p.key)} label={tx(p.label)} onChange={(v) => setRestoring((r) => { const n = new Set(r.parts); v ? n.add(p.key) : n.delete(p.key); return { ...r, parts: n }; })} />
              ))}
            </div>
            <div className="row">
              <button type="button" className="btn" onClick={() => setRestoring(null)}>{tx("Annuleren")}</button>
              <button type="button" className="btn primary" disabled={!restoring.parts.size} onClick={doRestore}>{tx("Terugzetten")}</button>
            </div>
          </div>
        </div>
      )}
      {dl && (
        <div className="overlay" onClick={() => !dl.busy && setDl(null)}>
          <div className="card modal" role="dialog" aria-label={tx("Backup downloaden")} style={{ width: "min(480px, 94vw)", display: "grid", gap: ".8rem" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0 }}>{dl.ask ? tx("Backup klaar") : tx("Backup downloaden")}</h2>
            <small className="muted">{dl.b.file} · {size(dl.b.size)}</small>
            {dl.ask && !dl.busy && <p style={{ margin: 0 }}>{tx("De backup staat in de lijst. Wil je hem nu ook downloaden of lokaal opslaan?")}</p>}
            {dl.busy ? (
              <div className="dl-progress" role="status" aria-live="polite">
                <div className="dl-anim" aria-hidden="true"><LoaderArt kind="tree" size={44} /></div>
                <div className="adv-run-top"><span>{dl.step}</span><strong>{dl.pct || 0} %</strong></div>
                <div className="adv-run-bar"><div style={{ width: `${Math.max(3, dl.pct || 0)}%` }} /></div>
                <small className="muted">{size(dl.loaded || 0)}{dl.total ? ` / ${size(dl.total)}` : ""}</small>
              </div>
            ) : (
              <div className="sp-options">
                {[["download", "Downloaden", "Naar de downloadmap van je browser."], ["local", "Lokaal opslaan", "Kies zelf de map en de naam op je computer."], ["both", "Allebei", "Downloaden én lokaal opslaan."]].map(([k, t, h]) => (
                  <button key={k} type="button" className="sp-option" onClick={() => doDownload(k)}><span style={{ display: "grid", gap: ".15rem" }}><strong>{tx(t)}</strong><small className="muted">{tx(h)}</small></span></button>
                ))}
              </div>
            )}
            {!dl.busy && <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn" onClick={() => setDl(null)}>{dl.ask ? tx("Niet nu") : tx("Annuleren")}</button></div>}
          </div>
        </div>
      )}
    </>
  );
}
