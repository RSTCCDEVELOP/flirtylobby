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
  const makeNow = async () => { const r = await run("now", () => api("/backups/create/", { method: "POST", body: {} })); if (r?.made) await alertDialog(`${tx("Backup klaar")}\n${r.made.file} (${size(r.made.size)})\n${tx("Map")}: ${d.folder}`); };
  const saveJob = (j, patch) => run(`job-${j.frequency}`, () => api(`/backups/jobs/${j.frequency}/`, { method: "PUT", body: { ...j, ...patch } }));
  const runJob = async (j) => { const r = await run(`run-${j.frequency}`, () => api(`/backups/jobs/${j.frequency}/run/`, { method: "POST", body: {} })); if (r) await alertDialog(tx("Backup klaar")); };
  const saveLimits = () => run("limits", () => api("/backups/limits/", { method: "PUT", body: lim }), tx("Limieten opgeslagen. Oudere backups boven de limiet zijn verwijderd."));
  const remove = async (b) => { if (await confirmDialog(tx("Backup \"{0}\" verwijderen?", b.file), { danger: true })) run("del", () => api(`/backups/${b.id}/`, { method: "DELETE" })); };
  async function download(b) {
    const res = await fetch(`${apiBase()}/api/backups/${b.id}/download/`, { headers: { Authorization: `Token ${getToken()}` } });
    if (!res.ok) return setMsg({ ok: false, text: tx("Downloaden mislukt.") });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await res.blob()); a.download = b.file; a.click();
  }
  async function upload(file) {
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    await run("upload", () => api("/backups/upload/", { method: "POST", body: fd }), tx("De backup is toegevoegd aan de lijst."));
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
          {canManage && <>
            <button type="button" className="btn" disabled={!!busy} onClick={() => fileIn.current?.click()}>{tx("Backup uploaden (.zip)")}</button>
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
          <div className="table-wrap"><table>
            <thead><tr><th>{tx("Datum")}</th><th>{tx("Soort")}</th><th>{tx("Grootte")}</th><th>{tx("Inhoud")}</th><th /></tr></thead>
            <tbody>
              {d.backups.map((b) => (
                <tr key={b.id}>
                  <td><strong>{when(b.created_at)}</strong><br /><small className="muted">{b.file}{b.created_by ? ` · ${b.created_by}` : ""}</small></td>
                  <td><span className={`badge ${b.frequency === "manual" ? "off" : "ok"}`}>{tx(KIND[b.frequency] || b.frequency)}</span>{b.note && <><br /><small className="muted">{b.note}</small></>}</td>
                  <td>{b.exists ? size(b.size) : <span className="badge off">{tx("bestand weg")}</span>}</td>
                  <td><small className="muted">{tx("{0} pagina's, {1} indelingen, {2} teksten, {3} bestanden", b.stats?.pages ?? 0, b.stats?.layouts ?? 0, b.stats?.texts ?? 0, b.stats?.files ?? 0)}{b.stats?.skipped?.length ? ` · ${tx("{0} overgeslagen (te groot)", b.stats.skipped.length)}` : ""}</small></td>
                  <td className="actions">
                    {canEdit && <button type="button" className="btn sm" disabled={!b.exists} onClick={() => download(b)}>{tx("Download")}</button>}
                    {canManage && <button type="button" className="btn sm primary" disabled={!b.exists || !!busy} onClick={() => setRestoring({ backup: b, parts: new Set(b.parts.map((p) => p.key)) })}>{tx("Terugzetten")}</button>}
                    {canManage && <button type="button" className="btn sm danger" disabled={!!busy} onClick={() => remove(b)}>{tx("Verwijder")}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {busy === "restore" && <div className="imp-bar imp-wait" role="progressbar"><span /></div>}
      </Collapsible>

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
    </>
  );
}
