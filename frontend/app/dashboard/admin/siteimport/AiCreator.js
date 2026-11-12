// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconBolt, IconSend, IconTrash } from "../../../../components/Icons";
import Tabs from "../../../../components/Tabs";
import { api, errorText } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { tx } from "../../../../lib/t";
import { DEVICES, ModulePicker, previewHtml, STEPS } from "./designKit";
import Wizard from "./DesignWizard";

export { ModulePicker, previewHtml };

const STATUS = { draft: "Concept", running: "Bezig", done: "Klaar", error: "Mislukt" };

// The tab AI-creator: your designs (also the ones that were not finished: continue where you stopped) and a new one.
export function AiCreatorHome({ onOpen, refreshKey }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api("/sitecreator/").then(setD).catch((e) => setErr(errorText(e))), []);
  useEffect(() => { load(); }, [load, refreshKey]);
  const create = async () => { setBusy(true); setErr(""); try { const j = await api("/sitecreator/", { method: "POST", body: {} }); onOpen(j.id); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); } };
  const del = async (x) => { if (!(await confirmDialog(tx("Dit ontwerp verwijderen? Wat je hebt ingevuld en gemaakt gaat verloren, ook de geüploade documenten."), { danger: true, title: tx("Ontwerp verwijderen"), okLabel: tx("Verwijderen") }))) return; await api(`/sitecreator/${x.id}/`, { method: "DELETE" }).catch(() => {}); load(); };
  return (
    <div style={{ marginTop: ".75rem", display: "flex", flexDirection: "column", gap: ".8rem" }}>
      <p className="muted" style={{ margin: 0 }}>{tx("Ontwerp je website in een paar stappen: stijl, kleuren, pagina's en foto's. Daarna maakt Claude alle pagina's en importeer je ze als bewerkbare pagina's. Alles wat je invult wordt bewaard, ook als je halverwege stopt.")}</p>
      {err && <div className="alert">{err}</div>}
      <div className="row" style={{ justifyContent: "flex-start" }}><button type="button" className="btn primary" disabled={busy || d?.ai === false} onClick={create}><IconBolt /> {tx("Nieuw ontwerp")}</button></div>
      {d?.ai === false && <div className="alert">{tx("Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan.")}</div>}
      {d?.designs?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: ".45rem" }}>
          <strong>{tx("Mijn ontwerpen")}</strong>
          {d.designs.map((x) => (
            <div key={x.id} className="card" style={{ display: "flex", gap: ".7rem", alignItems: "center", padding: ".6rem .8rem" }}>
              <span style={{ flex: 1, minWidth: 0 }}><strong>{x.name}</strong> <span className={x.status === "done" ? "badge ok" : "badge off"}>{tx(STATUS[x.status] || x.status)}</span>
                <small className="muted" style={{ display: "block" }}>{x.status === "draft" ? `${tx("Stap")} ${x.step + 1} ${tx("van")} ${STEPS.length}: ${tx(STEPS[x.step]?.[1] || "")}` : `${x.pages} ${tx("pagina's")}`} · {new Date(x.updated_at).toLocaleString()}</small></span>
              <button type="button" className="btn sm primary" onClick={() => onOpen(x.id)}>{x.status === "draft" ? tx("Verder gaan") : tx("Openen")}</button>
              <button type="button" className="btn sm danger" onClick={() => del(x)} aria-label={tx("Verwijderen")}><IconTrash /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The workspace: the step plan while it is a draft; when the website has been made: the chat on the left, the website on the right (per page, on a computer, iPad or phone). When it is good: import it.
export function AiCreatorPopup({ jobId, onClose, onImport }) {
  const [job, setJob] = useState(null);
  const [err, setErr] = useState("");
  const [page, setPage] = useState("index.html");
  const [dev, setDev] = useState("web");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [again, setAgain] = useState(false); // back to the step plan of a finished design
  const chat = useRef(null);

  // The files of a design (html with css) can be several MB: only the full load asks for them; the answers of saving and polling are light and keep the files that are already here.
  const merge = useCallback((r) => setJob((prev) => ({ ...r, files: r.files && Object.keys(r.files).length ? r.files : prev?.files || {} })), []);
  const reload = useCallback(async (full = true) => { try { merge(await api(`/sitecreator/${jobId}/${full ? "?files=1" : ""}`)); } catch (e) { setErr(errorText(e)); } }, [jobId, merge]);
  const was = useRef("");
  useEffect(() => { reload(true); }, [reload]);
  useEffect(() => { if (job?.status !== "running") return undefined; const t = setTimeout(() => reload(false), 2000); return () => clearTimeout(t); }, [job, reload]);
  useEffect(() => { if (was.current === "running" && job?.status && job.status !== "running") reload(true); was.current = job?.status || ""; }, [job?.status, reload]); // ready: now fetch the files
  useEffect(() => { chat.current?.scrollTo({ top: 1e6 }); }, [job?.messages?.length, job?.status]);

  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim() || sending || job?.status === "running") return;
    setSending(true); setErr("");
    try { merge(await api(`/sitecreator/${jobId}/revise/`, { method: "POST", body: { text, page } })); setText(""); }
    catch (x) { setErr(errorText(x)); }
    finally { setSending(false); }
  };
  const running = job?.status === "running";
  const wizard = job && (job.status === "draft" || job.status === "error" || again);
  const pages = job?.pages || [];
  const width = DEVICES.find((d) => d[0] === dev)[2];
  const ready = job && Object.keys(job.files || {}).some((n) => n.endsWith(".html"));
  const cur = job?.files?.[page] ? page : pages.find((p) => job?.files?.[p.file])?.file || "index.html";

  return createPortal(
    <div className="pb-objback">
      <div className="pb-objpop" role="dialog" aria-label={tx("Website ontwerpen")} style={{ width: "min(96vw, 1700px)", maxWidth: "none", height: "94vh", maxHeight: "94vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="pb-objhead"><strong>{tx("Website ontwerpen")}{job?.name ? `: ${job.name}` : ""}</strong><span style={{ flex: 1 }} />
          {!wizard && ready && <span className="pb-seg" style={{ marginRight: ".6rem" }}>{DEVICES.map(([k, l]) => <button type="button" key={k} className={dev === k ? "on" : ""} onClick={() => setDev(k)}>{tx(l)}</button>)}</span>}
          {!wizard && ready && !running && <button type="button" className="btn sm" style={{ marginRight: ".4rem" }} onClick={() => setAgain(true)}>{tx("Stappen aanpassen")}</button>}
          {!wizard && ready && !running && <button type="button" className="btn primary sm" style={{ marginRight: ".6rem" }} onClick={() => onImport(job)}>{tx("Importeren in Easy2edit")}</button>}
          <button type="button" className="pb-panelx" onClick={onClose} aria-label={tx("Sluiten")}>×</button></div>
        {!job && <p className="muted" style={{ padding: "1rem" }}>{err || tx("Laden…")}</p>}
        {wizard && <Wizard key={job.id + (again ? "a" : "")} job={job} onJob={merge} onReload={() => reload(true)} onGenerate={(j) => { setAgain(false); merge(j); }} />}
        {job && !wizard && (
          <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(280px, 380px) 1fr" }}>
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0, borderRight: "1px solid var(--line)" }}>
              <div ref={chat} style={{ flex: 1, overflowY: "auto", padding: ".9rem", display: "flex", flexDirection: "column", gap: ".6rem" }}>
                {(job.messages || []).map((m, i) => (
                  <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "92%", padding: ".55rem .8rem", borderRadius: 12, background: m.role === "user" ? "color-mix(in srgb, var(--blue) 18%, var(--card))" : "var(--card)", border: "1px solid var(--line)", whiteSpace: "pre-wrap" }}>{m.text}</div>
                ))}
                {running && (
                  <div className="card" style={{ padding: ".7rem .9rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: ".5rem" }}><span>{job.step || tx("Bezig…")}</span><strong>{Math.round(job.progress || 0)} %</strong></div>
                    <div style={{ height: 8, borderRadius: 999, background: "var(--line)", overflow: "hidden", marginTop: ".5rem" }}><div style={{ width: `${Math.max(3, Math.min(100, job.progress || 0))}%`, height: "100%", background: "var(--blue)", transition: "width .4s" }} /></div>
                    <small className="muted" style={{ display: "block", marginTop: ".4rem" }}>{tx("Je kunt dit venster sluiten: het ontwerp wordt doorgemaakt en staat daarna onder Mijn ontwerpen.")}</small>
                  </div>
                )}
                {err && <div className="alert">{err}</div>}
              </div>
              <form onSubmit={send} style={{ padding: ".7rem", borderTop: "1px solid var(--line)", display: "flex", gap: ".5rem", alignItems: "flex-end" }}>
                <textarea rows={3} style={{ flex: 1 }} value={text} maxLength={2000} disabled={running} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(e); }} placeholder={tx("Wat moet er anders? bv. maak de kop rustiger, voeg een prijzenblok toe")} />
                <button className="btn primary" disabled={running || sending || !text.trim()} aria-label={tx("Aanpassen")}><IconSend /></button>
              </form>
            </div>
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
              {ready && <div style={{ padding: ".5rem .8rem 0" }}><Tabs value={cur} onChange={setPage} tabs={pages.filter((p) => job.files[p.file]).map((p) => [p.file, p.title])} /></div>}
              <div style={{ flex: 1, minHeight: 0, display: "flex", justifyContent: "center", background: "var(--bg)", padding: ".6rem" }}>
                {ready ? (
                  <div style={{ width, maxWidth: "100%", height: "100%", background: "#fff", boxShadow: dev === "web" ? "none" : "0 0 0 1px var(--line), 0 10px 40px rgba(0,0,0,.4)", opacity: running ? .6 : 1, transition: "opacity .3s" }}>
                    <iframe title={tx("Voorbeeld")} sandbox="" srcDoc={previewHtml(job.files, cur, job.brief?.photos)} style={{ display: "block", width: "100%", height: "100%", border: 0, background: "#fff" }} />
                  </div>
                ) : <p className="muted" style={{ alignSelf: "center" }}>{running ? tx("Claude ontwerpt je website… de eerste pagina verschijnt hier zodra hij klaar is.") : ""}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>, document.body);
}
