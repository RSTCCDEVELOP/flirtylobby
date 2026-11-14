// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconBolt, IconCheck, IconSend, IconTrash } from "../../../../components/Icons";
import Tabs from "../../../../components/Tabs";
import { api, errorText } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { tx } from "../../../../lib/t";
import { DEVICES, DW_CSS, ModulePicker, previewHtml, STEPS } from "./designKit";
import Wizard from "./DesignWizard";

export { ModulePicker, previewHtml };

const STATUS = { draft: "Concept", running: "Bezig", stopping: "Bezig met stoppen", done: "Klaar", error: "Mislukt" };

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
      <p className="muted" style={{ margin: 0 }}>{tx("Ontwerp je website in een paar stappen: stijl, kleuren, pagina's en foto's. Daarna maakt Easy2edit alle pagina's en importeer je ze als bewerkbare pagina's. Alles wat je invult wordt bewaard, ook als je halverwege stopt.")}</p>
      {err && <div className="alert">{err}</div>}
      <div className="row" style={{ justifyContent: "flex-start" }}><button type="button" className="btn primary" disabled={busy || d?.ai === false} onClick={create}><IconBolt /> {tx("Nieuw ontwerp")}</button></div>
      {d?.ai === false && <div className="alert">{tx("Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan.")}</div>}
      {d?.designs?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: ".45rem" }}>
          <strong>{tx("Mijn ontwerpen")}</strong>
          {d.designs.map((x) => (
            <div key={x.id} className="card" style={{ display: "flex", gap: ".7rem", alignItems: "center", padding: ".6rem .8rem" }}>
              <span style={{ flex: 1, minWidth: 0 }}><strong>{x.name}</strong> <span className={x.live || (x.status === "done" && !x.applied) ? "badge ok" : "badge off"}>{x.live ? tx("Live") : x.applied && x.status === "done" ? tx("Concept") : tx(STATUS[x.status] || x.status)}</span>
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


// Improve: starts the improvement of the design as it is now, with the points that the user wants Claude to look at.
const FOCUS = [["Opmaak en kleuren", "the visual design and colours"], ["Teksten", "the texts (clear, concrete, no filler)"], ["Mobiel", "the layout on a phone"], ["Toegankelijkheid", "accessibility and contrast"], ["Structuur voor de pagina-editor", "the structure (sections, one container per section, clean cards) so that it imports well into the page editor"]];
function ImprovePopup({ onClose, onStart, busy }) {
  const [tab, setTab] = useState("focus");
  const [pick, setPick] = useState([]);
  const [text, setText] = useState("");
  const canGo = pick.length > 0 || text.trim().length > 0; // no instruction, no changes
  const go = () => canGo && onStart([...pick.map((k) => FOCUS.find((f) => f[0] === k)?.[1]).filter(Boolean), text.trim()].filter(Boolean).join("; "));
  return createPortal(
    <div className="pb-objback" style={{ zIndex: 1300 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{DW_CSS}</style>
      <div className="pb-objpop" role="dialog" aria-label={tx("Verbeteren")} style={{ width: "min(620px, 94vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="pb-objhead"><strong>{tx("Ontwerp verbeteren met AI")}</strong><span style={{ flex: 1 }} /><button type="button" className="pb-panelx" onClick={onClose} aria-label={tx("Sluiten")}>×</button></div>
        <div style={{ padding: "1rem 1.3rem 1.3rem", overflowY: "auto", display: "grid", gap: ".9rem" }}>
          <Tabs value={tab} onChange={setTab} tabs={[["focus", "Waar op letten?"], ["how", "Hoe werkt het?"]]} />
          {tab === "focus" && (
            <div className="form" style={{ display: "grid", gap: ".9rem" }}>
              <div><strong style={{ fontSize: ".9rem" }}>{tx("Aandachtspunten")}</strong> <small className="muted">{tx("optioneel")}</small>
                <div style={{ display: "flex", flexWrap: "wrap", gap: ".45rem", marginTop: ".4rem" }}>
                  {FOCUS.map(([k]) => { const on = pick.includes(k); return <button type="button" key={k} className={`dw-chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setPick(on ? pick.filter((x) => x !== k) : [...pick, k])}>{on && <IconCheck />} {tx(k)}</button>; })}
                </div></div>
              <label>{tx("Eigen opdracht")} <small className="muted">{tx("optioneel")}</small><textarea rows={3} maxLength={400} value={text} onChange={(e) => setText(e.target.value)} placeholder={tx("bv. maak de koppen rustiger en geef de knoppen meer ruimte")} /></label>
              <small className="muted">{canGo ? tx("Easy2edit past alleen aan wat je hier vraagt.") : tx("Kies een aandachtspunt of schrijf een opdracht: zonder opdracht verandert er niets.")}</small>
              <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn" onClick={onClose}>{tx("Annuleren")}</button><button type="button" className="btn primary" disabled={busy || !canGo} onClick={go}><IconBolt /> {busy ? tx("Starten…") : tx("Start verbeteren")}</button></div>
            </div>
          )}
          {tab === "how" && (
            <div className="muted" style={{ display: "grid", gap: ".6rem" }}>
              <p style={{ margin: 0 }}>{tx("Easy2edit verbetert alle pagina's na elkaar: de opmaak, de teksten en de structuur. Je ziet de voortgang met een percentage.")}</p>
              <p style={{ margin: 0 }}>{tx("Je kunt het altijd stoppen. Wat al klaar was blijft bewaard; de rest blijft zoals het was.")}</p>
              <p style={{ margin: 0 }}>{tx("Na het verbeteren kun je de vorige versie terugzetten.")}</p>
            </div>
          )}
        </div>
      </div>
    </div>, document.body);
}

// Alles aanmaken: when the design is good, the pages are made and filled at once. Choices: how, and which parts.
function CreatePopup({ job, onClose, onCreate, onReview }) {
  const [tab, setTab] = useState("choices");
  const own = !job.brief?.theme; // an own style: a theme is made of it (named after the website)
  const [o, setO] = useState({ render: "blocks", theme: true, useTheme: true, modules: true, translate: (job.brief?.langs || []).length > 0 });
  const n = Object.keys(job.files || {}).filter((f) => f.endsWith(".html")).length;
  const photos = (job.brief?.photos || []).length;
  const sw = (k, l, h) => <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={!!o[k]} onChange={(e) => setO({ ...o, [k]: e.target.checked })} /><span /></span><span>{tx(l)} <small className="muted">{tx(h)}</small></span></label>;
  return createPortal(
    <div className="pb-objback" style={{ zIndex: 1300 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{DW_CSS}</style>
      <div className="pb-objpop" role="dialog" aria-label={tx("Alles aanmaken")} style={{ width: "min(640px, 94vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="pb-objhead"><strong>{tx("Alles aanmaken")}</strong><span style={{ flex: 1 }} /><button type="button" className="pb-panelx" onClick={onClose} aria-label={tx("Sluiten")}>×</button></div>
        <div style={{ padding: "1rem 1.3rem 1.3rem", overflowY: "auto", display: "grid", gap: ".9rem" }}>
          <Tabs value={tab} onChange={setTab} tabs={[["choices", "Keuzes"], ["what", "Wat wordt er gemaakt?"]]} />
          {tab === "choices" && (
            <div className="form" style={{ display: "grid", gap: ".9rem" }}>
              <div className="dw-grid" style={{ display: "grid", gap: ".7rem", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                {[["blocks", "Bewerkbaar (blokken)", "Alles aan te passen met de pagina-editor, de modules en de systeemobjecten."], ["design", "Exact (1 op 1)", "De pagina ziet er precies uit als het ontwerp."]].map(([k, l, h]) => (
                  <button type="button" key={k} className={`dw-opt ${o.render === k ? "on" : ""}`} aria-pressed={o.render === k} onClick={() => setO({ ...o, render: k })}><b>{tx(l)}</b><small>{tx(h)}</small></button>
                ))}
              </div>
              {own
                ? <>{sw("theme", `${tx("Thema maken")}: ${job.brief?.name || ""}`, "Je eigen stijl (kleuren, lettertype, hoeken) komt als thema in de bibliotheek, met de naam van de website")}
                  {o.theme && sw("useTheme", "Het thema meteen gebruiken op de website", "Je kunt later altijd een ander thema kiezen bij Thema")}</>
                : <div className="alert ok">{tx("Het gekozen thema van je systeem wordt gebruikt")}: <b>{job.brief?.theme_name}</b></div>}
              {sw("modules", "Modules aanzetten", "De modules die de pagina's nodig hebben")}
              {(job.brief?.langs || []).length > 0 && sw("translate", "Ook vertalen", "Naar de andere talen van het ontwerp")}
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <button type="button" className="btn" onClick={onReview}>{tx("Eerst controleren")}</button>
                <button type="button" className="btn primary" disabled={!(job.brief?.name || "").trim()} onClick={() => onCreate(o)} title={!(job.brief?.name || "").trim() ? tx("De naam van de website is verplicht") : undefined}><IconCheck /> {tx("Alles aanmaken")}</button>
              </div>
            </div>
          )}
          {tab === "what" && (
            <div className="muted" style={{ display: "grid", gap: ".6rem" }}>
              <p style={{ margin: 0 }}>{`${n} ${tx("pagina's")} · ${photos} ${tx("foto's")}`}</p>
              <p style={{ margin: 0 }}>{tx("De pagina's worden aangemaakt en gevuld met de inhoud van het ontwerp, met de afbeeldingen in de mediabibliotheek. Je ziet de voortgang met een percentage.")}</p>
              <p style={{ margin: 0 }}>{tx("Er wordt niets overschreven. Wat er daarna niet goed is, verwijder je weer met één klik bij de geïmporteerde sites.")}</p>
              <p style={{ margin: 0 }}>{tx("Liever eerst kijken? Kies Eerst controleren: dan zie je een voorstel dat je goedkeurt.")}</p>
            </div>
          )}
        </div>
      </div>
    </div>, document.body);
}

// The workspace: the step plan while it is a draft; when the website has been made: the chat on the left, the website on the right (per page, on a computer, iPad or phone). When it is good: import it.
export function AiCreatorPopup({ jobId, onClose, onImport, onApply }) {
  const [job, setJob] = useState(null);
  const [err, setErr] = useState("");
  const [page, setPage] = useState("index.html");
  const [dev, setDev] = useState("web");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [again, setAgain] = useState(false); // back to the step plan of a finished design
  const [improveOpen, setImproveOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [back, setBack] = useState(false); // back to the steps as soon as the work has stopped
  const chat = useRef(null);

  // The files of a design (html with css) can be several MB: only the full load asks for them; the answers of saving and polling are light and keep the files that are already here.
  const merge = useCallback((r) => setJob((prev) => ({ ...r, files: r.files && Object.keys(r.files).length ? r.files : prev?.files || {} })), []);
  const reload = useCallback(async (full = true) => { try { merge(await api(`/sitecreator/${jobId}/${full ? "?files=1" : ""}`)); } catch (e) { setErr(errorText(e)); } }, [jobId, merge]);
  const was = useRef("");
  useEffect(() => { reload(true); }, [reload]);
  useEffect(() => { if (job?.status !== "running" && job?.status !== "stopping") return undefined; const t = setTimeout(() => reload(false), 2000); return () => clearTimeout(t); }, [job, reload]);
  const liveRev = useRef(false); // a change to a concept that is live: when it is made, the live pages are rebuilt from it
  const [liveGo, setLiveGo] = useState(false);
  useEffect(() => { const busyNow = (x) => x === "running" || x === "stopping"; if (busyNow(was.current) && job?.status && !busyNow(job.status)) reload(true).then(() => { if (liveRev.current) { liveRev.current = false; setLiveGo(true); } }); was.current = job?.status || ""; }, [job?.status, reload]); // ready: now fetch the files
  const applyLive = useCallback(async () => { if (!job || !onApply) return; setBusy("live"); try { await onApply(job, { live: true, theme: false, modules: false, render: "blocks", off: job.modules_off_effective || job.brief?.modules_off || [] }); await reload(false); } finally { setBusy(""); } }, [job, onApply, reload]);
  useEffect(() => { // the change was made (not a failed one): apply it to the live pages
    if (!liveGo || !job || job.status === "running" || job.status === "stopping" || !Object.keys(job.files || {}).length) return;
    setLiveGo(false);
    if (String((job.messages || []).slice(-1)[0]?.text || "").startsWith("Aangepast")) applyLive();
  }, [liveGo, job, applyLive]);
  useEffect(() => { chat.current?.scrollTo({ top: 1e6 }); }, [job?.messages?.length, job?.status]);

  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim() || sending || job?.status === "running" || job?.status === "stopping") return;
    setSending(true); setErr("");
    try { merge(await api(`/sitecreator/${jobId}/revise/`, { method: "POST", body: { text, page } })); setText(""); liveRev.current = !!job?.applied && !!onApply; }
    catch (x) { setErr(errorText(x)); }
    finally { setSending(false); }
  };
  const running = job?.status === "running" || job?.status === "stopping";
  const act = async (what, path, body) => { setBusy(what); setErr(""); try { merge(await api(`/sitecreator/${jobId}/${path}/`, { method: "POST", body: body || {} })); return true; } catch (x) { setErr(errorText(x)); return false; } finally { setBusy(""); } };
  const stop = () => act("stop", "stop");
  const toSteps = async () => { if (running) { setBack(true); await stop(); } else setAgain(true); };
  useEffect(() => { if (back && job && job.status !== "running" && job.status !== "stopping") { setBack(false); setAgain(true); } }, [back, job]);
  const restore = () => act("restore", "restore").then((ok) => ok && reload(true));
  const improve = async (focus) => { if (await act("improve", "generate", { improve: true, focus })) setImproveOpen(false); };
  const wizard = job && (job.status === "draft" || job.status === "error" || again);
  // Closing a design that is still a concept (in the steps): save it for later or throw it away. Escape or "Doorgaan" keeps the window open.
  const requestClose = async () => {
    if (!job || !wizard || running) { onClose(); return; }
    const what = await confirmDialog(tx("Dit ontwerp is nog een concept. Wil je het bewaren om later verder te gaan, of verwijderen?"), {
      title: tx("Ontwerp sluiten"), okLabel: tx("Sluiten"), cancelLabel: tx("Doorgaan met ontwerpen"),
      choices: [{ value: "save", label: tx("Opslaan"), hint: tx("Je vindt het concept terug bij Mijn ontwerpen.") }, { value: "delete", label: tx("Verwijderen"), hint: tx("Wat je hebt ingevuld en de geüploade documenten gaan verloren.") }],
    });
    if (!what) return;
    if (what === "delete") await api(`/sitecreator/${job.id}/`, { method: "DELETE" }).catch(() => {});
    onClose();
  };
  const pages = job?.pages || [];
  const width = DEVICES.find((d) => d[0] === dev)[2];
  const ready = job && Object.keys(job.files || {}).some((n) => n.endsWith(".html"));
  const cur = job?.files?.[page] ? page : pages.find((p) => job?.files?.[p.file])?.file || "index.html";

  return createPortal(
    <div className="pb-objback">
      <div className="pb-objpop" role="dialog" aria-label={tx("Website ontwerpen")} style={{ width: "min(96vw, 1700px)", maxWidth: "none", height: "94vh", maxHeight: "94vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="pb-objhead"><strong>{tx("Website ontwerpen")}{job?.name ? `: ${job.name}` : ""}</strong>
          {!wizard && job && <button type="button" className="btn sm" style={{ marginLeft: ".8rem" }} disabled={back} onClick={toSteps}>← {back ? tx("Bezig met stoppen…") : tx("Terug naar de stappen")}</button>}<span style={{ flex: 1 }} />
          {!wizard && job?.applied && <span className={job.live ? "badge ok" : "badge off"} style={{ marginRight: ".6rem" }} title={tx("Elke aanpassing aan dit concept wordt direct op de live pagina's toegepast.")}>{busy === "live" ? tx("Live bijwerken…") : job.live ? tx("Live") : tx("Concept")}</span>}
          {!wizard && job?.applied && !job.live && ready && !running && <button type="button" className="btn sm" style={{ marginRight: ".4rem" }} disabled={!!busy} onClick={applyLive}>{tx("Live bijwerken")}</button>}
          {!wizard && ready && <span className="pb-seg" style={{ marginRight: ".6rem" }}>{DEVICES.map(([k, l]) => <button type="button" key={k} className={dev === k ? "on" : ""} onClick={() => setDev(k)}>{tx(l)}</button>)}</span>}
          {!wizard && ready && !running && <button type="button" className="btn sm" style={{ marginRight: ".4rem" }} onClick={() => setImproveOpen(true)}><IconBolt /> {tx("Verbeteren")}</button>}
          {!wizard && ready && !running && (onApply
            ? <button type="button" className="btn primary sm" style={{ marginRight: ".6rem" }} onClick={() => setCreateOpen(true)}><IconCheck /> {tx("Alles aanmaken")}</button>
            : <button type="button" className="btn primary sm" style={{ marginRight: ".6rem" }} onClick={() => onImport(job)}>{tx("Importeren in Easy2edit")}</button>)}
          <button type="button" className="pb-panelx" onClick={requestClose} aria-label={tx("Sluiten")}>×</button></div>
        {improveOpen && <ImprovePopup onClose={() => setImproveOpen(false)} onStart={improve} busy={busy === "improve"} />}
        {createOpen && job && <CreatePopup job={job} onClose={() => setCreateOpen(false)} onReview={() => { setCreateOpen(false); onImport(job); }} onCreate={(o) => { setCreateOpen(false); onApply(job, { ...o, off: job.modules_off_effective || job.brief?.modules_off || [] }); }} />}
        {!job && <p className="muted" style={{ padding: "1rem" }}>{err || tx("Laden…")}</p>}
        {wizard && <Wizard key={job.id + (again ? "a" : "")} job={job} onJob={merge} onReload={() => reload(true)} onApply={onApply ? (o) => onApply(job, o) : undefined} onImprove={() => setImproveOpen(true)} onWorkspace={ready && job.status !== "draft" ? () => setAgain(false) : undefined} onGenerate={(j) => { setAgain(false); merge(j); }} />}
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: ".6rem", marginTop: ".6rem", flexWrap: "wrap" }}>
                      <small className="muted" style={{ flex: 1, minWidth: 180 }}>{tx("Je kunt dit venster sluiten: het ontwerp wordt doorgemaakt en staat daarna onder Mijn ontwerpen.")}</small>
                      <button type="button" className="btn sm danger" disabled={job.status === "stopping" || busy === "stop"} onClick={stop}>{job.status === "stopping" ? tx("Bezig met stoppen…") : tx("Stoppen")}</button>
                    </div>
                  </div>
                )}
                {err && <div className="alert">{err}</div>}
                {!running && job.can_restore && <button type="button" className="btn sm" style={{ alignSelf: "flex-start" }} disabled={!!busy} onClick={restore}>{busy === "restore" ? tx("Bezig…") : tx("Vorige versie terugzetten")}</button>}
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
                ) : <p className="muted" style={{ alignSelf: "center" }}>{running ? tx("Easy2edit ontwerpt je website… de eerste pagina verschijnt hier zodra hij klaar is.") : ""}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>, document.body);
}
