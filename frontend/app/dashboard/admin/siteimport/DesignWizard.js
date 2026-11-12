// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net


"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconArchive, IconBolt, IconCheck, IconImage, IconPaperclip, IconTrash } from "../../../../components/Icons";
import { api, apiUpload, downloadFile, errorText, mediaUrl } from "../../../../lib/api";
import Tabs from "../../../../components/Tabs";
import { confirmDialog } from "../../../../lib/dialog";
import { tx } from "../../../../lib/t";
import { SITE_KINDS } from "./aiPrompt";
import { COLOR_ROLES, contrast, DARK_ROLES, DEFAULT_COLORS, DEFAULT_DARK, DesignPromptPopup, DEVICES, DW_CSS, Field, FONT_NAMES, FONTS, LAST, MODES, ModulePicker, PAGE_EXTRA, PAGE_SUGGEST, pagesOf, previewHtml, STEPS, STYLE_TAGS, styleTile, THEME_DARK, THEME_MAP } from "./designKit";

// The title and the explanation above every step.
const META = [
  ["Vertel over je website", "Naam, soort site en talen. Heb je al een ontwerp uit een AI-prompt? Lees het ZIP-bestand in, dan verbetert Claude dat met jouw keuzes."],
  ["Kies de stijl", "Begin bij een thema uit je systeem: de kleuren en hoeken worden overgenomen. Of kies je eigen stijl met een paar sfeerwoorden."],
  ["Kleuren en weergave", "Stel het kleurenpalet af, kies licht, donker of allebei, en bepaal het lettertype en de ronde hoeken."],
  ["Welke pagina's krijgt de website?", "De eerste pagina is de startpagina. Je past de namen en de volgorde van het menu aan."],
  ["Modules en plugins", "Alles wat je systeem kan, doet standaard mee. Zet uit wat je niet nodig hebt en kies de systeemobjecten die op de pagina's moeten komen."],
  ["Foto's voor je ontwerp", "Upload je eigen foto's. Claude gebruikt ze op de plekken waar ze passen, op basis van jouw omschrijving."],
  ["Controleer het ontwerp", "Zo ziet je website eruit met deze keuzes. Er is nog geen inhoud gemaakt: de teksten zijn voorbeelden."],
];

// The bar of an upload with its percentage; at 100% the server is still working on it.
const UploadBar = ({ pct, label }) => (
  <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ width: "100%" }}>
    <div className="progress-top"><span>{pct >= 100 ? tx("Verwerken…") : label}</span><strong>{pct}%</strong></div>
    <div className="progress-track"><i style={{ width: `${Math.max(2, pct)}%` }} /></div>
  </div>
);

const Sun = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></svg>;
const Moon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" /></svg>;
const Both = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="8" /><path d="M12 4v16" /><path d="M12 4a8 8 0 010 16z" fill="currentColor" /></svg>;
const MODE_ICON = { light: Sun, dark: Moon, both: Both };

// The step plan. Every change is saved at once (a draft on the server), so you can stop and continue later.
export default function Wizard({ job, onJob, onGenerate, onReload, onApply, onImprove, onWorkspace }) {
  const [b, setB] = useState(job.brief || {});
  const [step, setStep] = useState(Math.min(LAST, job.brief?.step || 0));
  const [themes, setThemes] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [save, setSave] = useState("saved"); // saved | dirty | saving | error
  const [err, setErr] = useState(job.error || "");
  const [busy, setBusy] = useState("");
  const [dev, setDev] = useState("web");
  const [promptOpen, setPromptOpen] = useState(false);
  const [allLangs, setAllLangs] = useState(false);
  const [pmode, setPmode] = useState("light");
  const [ppage, setPpage] = useState("index.html");
  const [palNote, setPalNote] = useState("");
  const [up, setUp] = useState(null); // {what, pct}: an upload that is going on, with its percentage
  const [render, setRender] = useState("blocks"); // Toepassen: editable blocks (the page editor) or exactly as the file
  const pend = useRef({}), timer = useRef(null), body = useRef(null);
  const zipRef = useRef(null), photoRef = useRef(null), docRef = useRef(null);
  const [docs, setDocs] = useState(job.docs || []);
  const [docNote, setDocNote] = useState("");

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const patch = pend.current;
    if (!Object.keys(patch).length) return null;
    pend.current = {};
    setSave("saving");
    try {
      const data = patch.photos ? { ...patch, photos: patch.photos.map((p) => ({ id: p.id, note: p.note || "" })) } : patch;
      const r = await api(`/sitecreator/${job.id}/`, { method: "PATCH", body: data });
      if (patch.photos) setB((o) => ({ ...o, photos: r.brief.photos }));
      setSave("saved");
      return r;
    } catch (e) { pend.current = { ...patch, ...pend.current }; setSave("error"); setErr(errorText(e)); return null; }
  }, [job.id]);
  const upd = (patch) => { setB((o) => ({ ...o, ...patch })); pend.current = { ...pend.current, ...patch }; setSave("dirty"); clearTimeout(timer.current); timer.current = setTimeout(flush, 600); };
  useEffect(() => () => { flush(); }, [flush]);
  useEffect(() => { api("/sitecreator/").then((d) => setThemes(d.themes || [])).catch(() => {}); api("/sitecreator/catalog/").then(setCatalog).catch(() => {}); }, []);
  useEffect(() => { // a document is being read: show the progress, and take over the settings that Claude made when it is ready
    if (!docs.some((d) => d.status === "reading")) return undefined;
    const t = setTimeout(async () => {
      try {
        const r = await api(`/sitecreator/${job.id}/`);
        const fin = r.docs.find((d) => d.status === "done" && docs.find((o) => o.id === d.id)?.status === "reading");
        setDocs(r.docs);
        if (fin) { setB((o) => ({ ...r.brief, ...pend.current, step: o.step })); setDocNote(`${tx("Claude heeft de instellingen ingevuld uit")} ${fin.name}. ${tx("Controleer ze in de stappen.")}`); }
      } catch { /* try again */ }
    }, 1400);
    return () => clearTimeout(t);
  }, [docs, job.id]);
  const addDocs = async (files) => {
    const list = Array.from(files || []); if (!list.length) return;
    setErr(""); setDocNote("");
    for (const f of list) {
      if (!/\.(pdf|docx|txt|md)$/i.test(f.name)) { setErr(tx("Kies een PDF-, Word- (.docx) of tekstbestand.")); continue; }
      try { const fd = new FormData(); fd.append("file", f); setUp({ what: "doc", pct: 0 }); const r = await apiUpload(`/sitecreator/${job.id}/document/`, fd, (pct) => setUp({ what: "doc", pct })); setDocs(r.docs); }
      catch (x) { setErr(errorText(x)); }
      finally { setUp(null); }
    }
  };
  const delDoc = async (d) => {
    if (!(await confirmDialog(tx("Dit document verwijderen? De instellingen die Claude eruit heeft gehaald blijven staan."), { danger: true, title: tx("Document verwijderen"), okLabel: tx("Verwijderen") }))) return;
    try { setDocs((await api(`/sitecreator/${job.id}/document/${d.id}/`, { method: "DELETE" })).docs); } catch (x) { setErr(errorText(x)); }
  };
  const reapply = async (d) => {
    try { await flush(); const r = await api(`/sitecreator/${job.id}/document/${d.id}/apply/`, { method: "POST" }); setDocs(r.docs); setB((o) => ({ ...r.brief, step: o.step })); setDocNote(tx("De instellingen uit het document zijn opnieuw toegepast.")); }
    catch (x) { setErr(errorText(x)); }
  };
  const go = (n) => {
    if (n > 0 && !(b.name || "").trim()) { setStep(0); upd({ step: 0 }); setErr(tx("Geef de website een naam. De naam van de website is verplicht.")); body.current?.scrollTo({ top: 0 }); return; }
    setErr(""); setStep(n); upd({ step: n }); body.current?.scrollTo({ top: 0 });
  };
  useEffect(() => { if (!pagesOf(b).length && b.mode !== "improve") upd({ pages: (PAGE_SUGGEST[b.kind || "company"] || PAGE_SUGGEST.company).join(", ") }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (step === 2 && !Object.keys(b.colors || {}).length) upd({ colors: DEFAULT_COLORS }); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const colors = { ...DEFAULT_COLORS, ...DEFAULT_DARK, ...(b.colors || {}) };
  const cmode = b.color_mode || "light";
  const langList = catalog?.languages || [];
  const mainCode = ((b.lang || "").match(/\(([a-z-]+)\)\s*$/) || [])[1] || "";
  const improve = b.mode === "improve";
  const pages = pagesOf(b);
  const setPages = (l) => upd({ pages: l.join(", ") });
  const off = b.modules_off || [];
  const htmlFiles = Object.keys(job.files || {}).filter((n) => n.endsWith(".html")).sort((a, c) => (a === "index.html" ? -1 : c === "index.html" ? 1 : a.localeCompare(c)));
  const realDesign = improve && htmlFiles.length > 0; // a design was read in: the preview shows that design itself
  const cur = htmlFiles.includes(ppage) ? ppage : htmlFiles[0];
  const modCount = catalog ? catalog.modules.filter((m) => !off.includes(m.key)).length : 0;
  const done = [!!(b.name || "").trim(), !!(b.theme || (b.style_tags || []).length || b.style), !!Object.keys(b.colors || {}).length, pages.length > 0, step > 4 || off.length + (b.objects || []).length > 0, (b.photos || []).length > 0, false];

  const pickTheme = (t) => {
    if (!t) { upd({ theme: "", theme_name: "" }); return; }
    upd({ theme: t.key, theme_name: t.name, colors: { ...Object.fromEntries(Object.entries(THEME_MAP).map(([k, tk]) => [k, t.colors[tk]])), ...Object.fromEntries(Object.entries(THEME_DARK).map(([k, tk]) => [k, t.colors[tk]]).filter(([, v]) => v)) }, radius: t.radius });
  };
  const readZip = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    if (f.size > 40 * 2 ** 20) { setErr(tx("Het ZIP-bestand is te groot (maximaal 40 MB). Laat grote afbeeldingen weg: je kunt je foto's apart uploaden bij stap Foto's.")); return; }
    setBusy("zip"); setErr("");
    try {
      await flush();
      const fd = new FormData(); fd.append("file", f);
      setUp({ what: "zip", pct: 0 });
      const r = await apiUpload(`/sitecreator/${job.id}/zip/`, fd, (pct) => setUp({ what: "zip", pct }));
      setB((o) => ({ ...o, ...r.brief })); onJob(r); onReload?.(); // the files of the design come in a separate (light) call
      if (r.notes?.length) setErr(r.notes.join(" "));
    } catch (x) { setErr(errorText(x)); } finally { setBusy(""); setUp(null); }
  };
  const readPalette = async (quiet) => { // the colours, font and corners of the design that was read in (ZIP) become the settings
    try {
      await flush();
      const r = await api(`/sitecreator/${job.id}/palette/`, { method: "POST" });
      setB((o) => ({ ...o, ...r.brief, step: o.step })); setPalNote(r.note || ""); onJob(r);
    } catch (x) { if (!quiet) setErr(errorText(x)); }
  };
  useEffect(() => { if (b.mode === "improve" && !b.palette_from_zip && Object.keys(job.files || {}).length) readPalette(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const addPhotos = async (files) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith("image/")); if (!list.length) return;
    setBusy("photo"); setErr("");
    try {
      const fd = new FormData(); list.forEach((f) => fd.append("files", f)); fd.append("tags", "design");
      setUp({ what: "photo", pct: 0 });
      const r = await apiUpload("/media/upload/", fd, (pct) => setUp({ what: "photo", pct }));
      upd({ photos: [...(b.photos || []), ...r.items.map((i) => ({ id: i.id, note: "", url: i.url, file: "", name: i.name }))] });
      await flush();
      if (r.errors?.length) setErr(r.errors.join(" "));
    } catch (x) { setErr(errorText(x)); } finally { setBusy(""); setUp(null); }
  };
  const apply = async () => { // the design is read in: make the pages and fill them with the content
    setBusy("apply"); setErr("");
    try { await flush(); await onApply({ render, translate: (b.langs || []).length > 0, off: b.modules_off || [] }); }
    catch (x) { setErr(errorText(x)); setBusy(""); }
  };
  const generate = async () => {
    setBusy("gen"); setErr("");
    try { await flush(); const r = await api(`/sitecreator/${job.id}/generate/`, { method: "POST" }); onGenerate(r); }
    catch (x) { setErr(errorText(x)); setBusy(""); }
  };

  const colorRow = (k, l) => (
    <div key={k} className="dw-color">
      <input type="color" value={colors[k]} aria-label={tx(l)} onChange={(e) => upd({ colors: { ...colors, [k]: e.target.value } })} />
      <span><b>{tx(l)}</b></span>
      <input type="text" value={colors[k]} maxLength={7} onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && upd({ colors: { ...colors, [k]: e.target.value } })} />
    </div>
  );
  const ratio = (l, a, c) => { const r = contrast(a, c); return <span key={l} className={r >= 4.5 ? "badge ok" : "badge off"} title={tx("Leesbaarheid (minimaal 4,5)")}>{tx(l)}: {r.toFixed(1)}</span>; };

  return (
    <div className="dw">
      <style>{DW_CSS}</style>
      <aside className="dw-side">
        <div className="dw-brand"><strong>{b.name || tx("Nieuw ontwerp")}</strong><small>{tx("Stap")} {step + 1} {tx("van")} {STEPS.length}</small>
          <div className="dw-bar"><i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div></div>
        <ol className="dw-steps">
          {STEPS.map(([k, l, sub, Icon], i) => (
            <li key={k}><button type="button" className={`dw-step ${i === step ? "on" : ""} ${done[i] && i !== step ? "done" : ""}`} onClick={() => go(i)} aria-current={i === step ? "step" : undefined}>
              <span className="dw-dot">{done[i] && i !== step ? <IconCheck /> : <Icon />}</span>
              <span className="dw-txt"><b>{tx(l)}</b><small>{tx(sub)}</small></span></button></li>
          ))}
        </ol>
        <div className="dw-side-foot">
          <span>{save === "saving" ? tx("Opslaan…") : save === "error" ? tx("Opslaan mislukt") : save === "dirty" ? "…" : tx("Alles is bewaard")}</span>
          {onWorkspace && <button type="button" className="btn sm" onClick={onWorkspace}>← {tx("Terug naar het ontwerp")}</button>}
          <button type="button" className="btn sm" onClick={() => setPromptOpen(true)}><IconBolt /> {tx("AI-prompt voor een externe AI")}</button>
        </div>
      </aside>

      <section className="dw-main">
        {promptOpen && <DesignPromptPopup b={b} catalog={catalog} onClose={() => setPromptOpen(false)} />}
        <header className="dw-head"><span className="dw-kicker">{tx("Stap")} {step + 1} {tx("van")} {STEPS.length}</span><h2>{tx(META[step][0])}</h2><p>{tx(META[step][1])}</p></header>
        <div className="dw-body" ref={body}>
          {err && <div className="alert">{err}</div>}

          {step === 0 && (<>
            <div className="dw-panel">
              <h3>{tx("Doelstellingen uit een document")}</h3>
              <p className="dw-hint">{tx("Heb je de doelstellingen van de website in een PDF- of Word-document? Plaats het hier: Claude leest het en vult de instellingen van de stappen voor je in. Jij controleert ze daarna.")}</p>
              <div className="dw-drop" role="button" tabIndex={0} onClick={() => docRef.current.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && docRef.current.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addDocs(e.dataTransfer.files); }}>
                <IconPaperclip /> <b>{tx("Sleep een PDF- of Word-document hierheen of klik om te kiezen")}</b>
                <small style={{ display: "block", marginTop: ".3rem" }}>{tx("PDF, Word (.docx) of tekst · maximaal 10 MB. Het document wordt bewaard bij dit ontwerp, zodat je het later nog kunt controleren.")}</small>
                <input ref={docRef} type="file" accept=".pdf,.docx,.txt,.md,application/pdf" multiple hidden onChange={(e) => { addDocs(e.target.files); e.target.value = ""; }} />
              </div>
              {up?.what === "doc" && <UploadBar pct={up.pct} label={tx("Document uploaden…")} />}
              {docNote && <div className="alert ok">{docNote}</div>}
              {docs.map((d) => (
                <div key={d.id} className="dw-doc">
                  <div className="dw-doc-h">
                    <IconPaperclip />
                    <span style={{ flex: 1, minWidth: 0 }}><b style={{ overflowWrap: "anywhere" }}>{d.name}</b><small className="muted" style={{ display: "block" }}>{(d.size / 1024).toFixed(0)} KB · {new Date(d.uploaded_at).toLocaleString()}</small></span>
                    {d.status === "done" && <span className="badge ok">{tx("Gelezen")}</span>}
                    {d.status === "error" && <span className="badge off">{tx("Mislukt")}</span>}
                    <button type="button" className="btn sm" onClick={() => downloadFile(`/sitecreator/${job.id}/document/${d.id}/`, d.name).catch((x) => setErr(errorText(x)))}>{tx("Downloaden")}</button>
                    {d.status === "done" && <button type="button" className="btn sm" onClick={() => reapply(d)}>{tx("Opnieuw toepassen")}</button>}
                    <button type="button" className="btn sm danger" disabled={d.status === "reading"} aria-label={tx("Verwijderen")} onClick={() => delDoc(d)}><IconTrash /></button>
                  </div>
                  {d.status === "reading" && (
                    <div>
                      <div className="dw-prog"><i style={{ width: `${Math.max(4, d.percent || 0)}%` }} /></div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".82rem", marginTop: ".35rem" }}><span>{tx(d.step || "Bezig…")}</span><b>{Math.round(d.percent || 0)} %</b></div>
                    </div>
                  )}
                  {d.status === "error" && <div className="alert">{d.error}</div>}
                  {d.status === "done" && (
                    <div className="dw-doc-b">
                      {d.summary && <p style={{ margin: 0 }}>{d.summary}</p>}
                      {d.goals?.length > 0 && <div><small className="muted">{tx("Doelstellingen")}</small><ul>{d.goals.map((g, i) => <li key={i}>{g}</li>)}</ul></div>}
                      {d.applied?.length > 0 && <div><small className="muted">{tx("Ingevuld door Claude")}</small><div className="dw-chips">{d.applied.map((a) => <span key={a} className="dw-tag"><IconCheck /> {tx(a)}</span>)}</div></div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="dw-panel">
              <div className="dw-2">
                <Field label="Naam van de website *" hint="verplicht, ook de naam van het thema"><input value={b.name || ""} maxLength={120} required aria-required="true" onChange={(e) => upd({ name: e.target.value })} placeholder={tx("bv. Bakkerij De Zon")} style={!(b.name || "").trim() && step === 0 && err ? { borderColor: "var(--danger)" } : undefined} /></Field>
                <Field label="Soort website"><select value={b.kind || "company"} onChange={(e) => { upd({ kind: e.target.value }); if (!improve && !pages.length) upd({ pages: PAGE_SUGGEST[e.target.value].join(", ") }); }}>{SITE_KINDS.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select></Field>
              </div>
              <Field label="Wat moet de site vertellen?" hint="Optioneel: doelgroep, aanbod, bijzonderheden"><textarea rows={4} maxLength={1500} value={b.extra || ""} onChange={(e) => upd({ extra: e.target.value })} placeholder={tx("Wie is de doelgroep? Wat bied je aan? Wat maakt je anders?")} /></Field>
            </div>
            <div className="dw-panel">
              <h3>{tx("Talen")}</h3>
              <Field label="Hoofdtaal van de teksten">{langList.length ? (
                <select value={b.lang || ""} onChange={(e) => upd({ lang: e.target.value, langs: (b.langs || []).filter((c) => !e.target.value.endsWith(`(${c})`)) })}>
                  {b.lang && !langList.some((l) => `${l.native} (${l.code})` === b.lang) && <option value={b.lang}>{b.lang}</option>}
                  {langList.map((l) => <option key={l.code} value={`${l.native} (${l.code})`}>{l.native} ({l.name}){l.default ? ` · ${tx("standaard")}` : ""}</option>)}
                </select>) : <input value={b.lang || ""} maxLength={40} onChange={(e) => upd({ lang: e.target.value })} />}</Field>
              <div><b style={{ fontSize: ".84rem" }}>{tx("Andere talen")}</b> <small className="muted">{(b.langs || []).length} {tx("gekozen")}</small>
                <p className="dw-hint" style={{ margin: ".15rem 0 0" }}>{tx("De pagina's worden in de hoofdtaal gemaakt; het systeem vertaalt ze naar deze talen (bij het toepassen) en zet de taalkeuze in de header. Talen die uit staan, zet je aan bij Talen.")}</p>
                <div className="dw-chips">
                  {langList.filter((l) => l.code !== mainCode && (allLangs || l.enabled || (b.langs || []).includes(l.code))).map((l) => { const on = (b.langs || []).includes(l.code); return <button type="button" key={l.code} className={`dw-chip ${on ? "on" : ""}`} aria-pressed={on} title={l.enabled ? "" : tx("Staat uit in het systeem")} onClick={() => upd({ langs: on ? b.langs.filter((x) => x !== l.code) : [...(b.langs || []), l.code].slice(0, 15) })}>{on && <IconCheck />} {l.native}{l.enabled ? "" : " ·"}</button>; })}
                  {langList.length > 0 && <button type="button" className="dw-chip" onClick={() => setAllLangs(!allLangs)}>{allLangs ? tx("Minder talen") : tx("Alle talen tonen")}</button>}
                </div>
              </div>
              {(b.langs || []).length > 0 && <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={b.lang_switch !== false} onChange={(e) => upd({ lang_switch: e.target.checked })} /><span /></span><span>{tx("Taalkeuze (switch) in de header")} <small className="muted">{tx("De AI laat ruimte voor de schakelaar; het systeem plaatst hem.")}</small></span></label>}
            </div>
            <div className="dw-panel">
              <h3>{tx("Weergave")}</h3>
              <p className="dw-hint">{tx("Licht, donker of allebei met de lichtdonker-schakelaar van het systeem. De donkere kleuren stel je in bij stap 3.")}</p>
              <div className="dw-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                {MODES.map(([k, l, h]) => { const Ic = MODE_ICON[k]; return <button type="button" key={k} className={`dw-opt dw-mode ${cmode === k ? "on" : ""}`} aria-pressed={cmode === k} onClick={() => upd({ color_mode: k })}><Ic /><b>{tx(l)}</b><small>{tx(h)}</small></button>; })}
              </div>
            </div>
            <div className="dw-zip">
              <span><b>{tx("Ontwerp uit een AI-prompt verbeteren")}</b>
                <small className="muted" style={{ display: "block" }}>{improve ? `${tx("Ingelezen")}: ${Object.keys(job.files || {}).filter((n) => n.endsWith(".html")).length} ${tx("pagina's")}, ${Object.keys(job.files || {}).filter((n) => n.endsWith(".css")).length} css, ${(b.photos || []).length} ${tx("afbeeldingen")}` : tx("Lees het ZIP-bestand in dat de AI-prompt heeft opgeleverd.")}</small></span>
              <button type="button" className="btn" disabled={!!busy} onClick={() => zipRef.current.click()}><IconArchive /> {busy === "zip" ? tx("Bezig met inlezen…") : improve ? tx("Ander ZIP-bestand inlezen") : tx("ZIP-bestand inlezen")}</button>
              {improve && <button type="button" className="btn" onClick={() => upd({ mode: "new" })}>{tx("Toch helemaal nieuw ontwerpen")}</button>}
              <input ref={zipRef} type="file" accept=".zip,application/zip" hidden onChange={readZip} />
              {up?.what === "zip" && <UploadBar pct={up.pct} label={tx("ZIP-bestand uploaden…")} />}
            </div>
          </>)}

          {step === 1 && (<>
            <div className="dw-panel">
              <h3>{tx("Thema")}</h3>
              <div className="dw-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
                <button type="button" className={`dw-opt ${!b.theme ? "on" : ""}`} onClick={() => pickTheme(null)} style={{ justifyContent: "center", minHeight: 124 }}><b>{tx("Eigen stijl")}</b><small>{tx("Je kiest zelf de kleuren in de volgende stap. Bij het aanmaken wordt er een thema van gemaakt met de naam van je website.")}</small></button>
                {themes.map((t) => (
                  <button type="button" key={t.key} className={`dw-opt ${b.theme === t.key ? "on" : ""}`} onClick={() => pickTheme(t)}>
                    <span className="dw-band">{Object.values(THEME_MAP).map((k, i) => <i key={i} style={{ background: t.colors[k] }} />)}</span>
                    <b>{t.name} {t.active && <span className="badge ok">{tx("In gebruik")}</span>}</b>
                    <small>{t.fonts.join(" · ")} · {tx("hoeken")} {t.radius}px</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="dw-panel">
              <h3>{tx("Sfeer")} <span className="dw-count">{tx("maximaal 6")}</span></h3>
              <div className="dw-chips" style={{ marginTop: 0 }}>
                {STYLE_TAGS.map(([k, l]) => { const on = (b.style_tags || []).includes(k); return <button type="button" key={k} className={`dw-chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => upd({ style_tags: on ? b.style_tags.filter((x) => x !== k) : [...(b.style_tags || []), k].slice(0, 6) })}>{on && <IconCheck />} {tx(l)}</button>; })}
              </div>
              <Field label="Eigen omschrijving van de stijl" hint="Optioneel"><input value={b.style || ""} maxLength={300} onChange={(e) => upd({ style: e.target.value })} placeholder={tx("bv. veel ruimte, grote foto's, ronde vormen")} /></Field>
            </div>
          </>)}

          {step === 2 && (<>
            <div className="dw-panel">
              <h3>{tx("Weergave")}</h3>
              <div className="dw-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                {MODES.map(([k, l, h]) => { const Ic = MODE_ICON[k]; return <button type="button" key={k} className={`dw-opt dw-mode ${cmode === k ? "on" : ""}`} aria-pressed={cmode === k} onClick={() => upd({ color_mode: k })}><Ic /><b>{tx(l)}</b><small>{tx(h)}</small></button>; })}
              </div>
            </div>
            {improve && (
              <div className="dw-zip">
                <span><b>{tx("Kleuren uit je ontwerp")}</b>
                  <small className="muted" style={{ display: "block" }}>{palNote || (b.palette_from_zip ? tx("De kleuren, het lettertype en de hoeken zijn gelezen uit het ontwerp dat je hebt ingelezen. Pas je ze aan, dan gebruikt Claude jouw kleuren; laat je ze staan, dan blijft het ontwerp zoals het is.") : tx("Lees de kleuren, het lettertype en de hoeken uit het ingelezen ontwerp."))}</small></span>
                <button type="button" className="btn" onClick={() => readPalette(false)}>{tx("Opnieuw uit het ontwerp lezen")}</button>
              </div>
            )}
            <div className="dw-panel">
              <h3>{tx("Kleurenpalet")}</h3>
              <div className="dw-pal">{COLOR_ROLES.map(([k]) => <div key={k} title={colors[k]} style={{ background: colors[k] }} />)}</div>
              <div className="dw-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))" }}>{COLOR_ROLES.map(([k, l]) => colorRow(k, l))}</div>
              <div className="dw-tools">
                {ratio("Tekst op achtergrond", colors.text, colors.bg)}{ratio("Tekst op kaart", colors.text, colors.card)}{ratio("Tekst op hoofdkleur", "#ffffff", colors.primary)}
                {b.theme && <button type="button" className="btn sm" onClick={() => pickTheme(themes.find((t) => t.key === b.theme))}>{tx("Kleuren van het thema herstellen")}</button>}
              </div>
            </div>
            {cmode !== "light" && (
              <div className="dw-panel">
                <h3>{tx("Kleuren van de donkere weergave")}</h3>
                <p className="dw-hint">{tx("De hoofd- en tweede kleur blijven gelijk; de achtergrond, kaarten en tekst worden donker.")}</p>
                <div className="dw-pal" style={{ height: 40 }}>{DARK_ROLES.map(([k]) => <div key={k} title={colors[k]} style={{ background: colors[k] }} />)}</div>
                <div className="dw-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))" }}>{DARK_ROLES.map(([k, l]) => colorRow(k, l))}</div>
                <div className="dw-tools">{ratio("Tekst op achtergrond (donker)", colors.dtext, colors.dbg)}{ratio("Tekst op kaart (donker)", colors.dtext, colors.dcard)}</div>
              </div>
            )}
            <div className="dw-panel">
              <h3>{tx("Lettertype en vormen")}</h3>
              <div className="dw-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                {FONT_NAMES.map(([k, l]) => <button type="button" key={k} className={`dw-opt ${(b.font || "sans") === k ? "on" : ""}`} onClick={() => upd({ font: k })} style={{ fontFamily: FONTS[k] }}><span style={{ fontSize: "1.9rem", fontWeight: 800, lineHeight: 1.1 }}>Aa</span><b>{tx(l)}</b></button>)}
              </div>
              <Field label="Ronde hoeken van kaarten (px)">
                <span style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <input type="range" min="0" max="40" value={b.radius ?? 14} onChange={(e) => upd({ radius: Number(e.target.value) })} style={{ flex: 1 }} />
                  <span style={{ width: 70, height: 46, background: colors.primary, borderRadius: b.radius ?? 14, flex: "none" }} /><b style={{ width: 44 }}>{b.radius ?? 14}px</b>
                </span>
              </Field>
            </div>
          </>)}

          {step === 3 && (
            <div className="dw-panel">
              <h3>{tx("Menu")} <span className="dw-count">{pages.length} {tx("pagina's")}</span></h3>
              {improve && <p className="dw-hint">{tx("De pagina's komen uit het ZIP-bestand. Je kunt de namen in het menu aanpassen.")}</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: ".45rem" }}>
                {pages.map((p, i) => (
                  <div key={i} className="dw-page">
                    <b>{i + 1}</b>
                    <input style={{ flex: 1 }} value={p} maxLength={60} onChange={(e) => setPages(pages.map((x, j) => (j === i ? e.target.value.replace(/,/g, " ") : x)))} />
                    {i === 0 && <span className="badge">{tx("Startpagina")}</span>}
                    {!improve && <>
                      <button type="button" className="btn sm" disabled={i === 0} aria-label={tx("Omhoog")} onClick={() => { const l = [...pages]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; setPages(l); }}>↑</button>
                      <button type="button" className="btn sm" disabled={i === pages.length - 1} aria-label={tx("Omlaag")} onClick={() => { const l = [...pages]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; setPages(l); }}>↓</button>
                      <button type="button" className="btn sm danger" disabled={pages.length < 2} aria-label={tx("Verwijderen")} onClick={() => setPages(pages.filter((_, j) => j !== i))}><IconTrash /></button>
                    </>}
                  </div>
                ))}
              </div>
              {!improve && pages.length < 10 && (
                <div><small className="muted">{tx("Toevoegen")}</small>
                  <div className="dw-chips">
                    {[...new Set([...(PAGE_SUGGEST[b.kind || "company"] || []), ...PAGE_EXTRA])].filter((p) => !pages.includes(p)).map((p) => <button type="button" key={p} className="dw-chip" onClick={() => setPages([...pages, p])}>+ {tx(p)}</button>)}
                    <form onSubmit={(e) => { e.preventDefault(); const v = e.target.elements.np.value.trim().replace(/,/g, " "); if (v) { setPages([...pages, v]); e.target.reset(); } }} style={{ display: "inline-flex", gap: ".35rem" }}><input name="np" maxLength={60} placeholder={tx("Eigen pagina")} style={{ width: 170 }} /><button className="btn sm">{tx("Toevoegen")}</button></form>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && <ModulePicker catalog={catalog} off={off} objects={b.objects || []} onChange={(p) => upd({ modules_off: p.off, objects: p.objects })} />}

          {step === 5 && (<>
            <div className="dw-drop" role="button" tabIndex={0} onClick={() => photoRef.current.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && photoRef.current.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addPhotos(e.dataTransfer.files); }}>
              <IconImage /> <b>{busy === "photo" ? tx("Bezig met uploaden…") : tx("Sleep foto's hierheen of klik om te kiezen")}</b>
              <small style={{ display: "block", marginTop: ".3rem" }}>{tx("Ze komen ook in de mediabibliotheek (tag: design). Claude ziet de foto's niet: schrijf er kort bij wat erop staat.")}</small>
              <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
              {up?.what === "photo" && <div style={{ marginTop: ".7rem" }}><UploadBar pct={up.pct} label={tx("Foto's uploaden…")} /></div>}
            </div>
            {(b.photos || []).length > 0 && <div className="dw-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {(b.photos || []).map((p, i) => (
                <figure key={p.id} className="dw-photo" style={{ margin: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(p.url)} alt={p.name} />
                  <div>
                    <small className="muted" style={{ overflowWrap: "anywhere" }}>{p.file || p.name}</small>
                    <input value={p.note || ""} maxLength={200} placeholder={tx("Wat staat erop?")} onChange={(e) => upd({ photos: b.photos.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })} />
                    <button type="button" className="btn sm danger" onClick={() => upd({ photos: b.photos.filter((_, j) => j !== i) })}><IconTrash /> {tx("Verwijderen")}</button>
                  </div>
                </figure>
              ))}
            </div>}
            {!(b.photos || []).length && <p className="muted" style={{ margin: 0 }}>{tx("Geen foto's? Dat is niet erg: Claude maakt illustraties en je voegt later foto's toe.")}</p>}
          </>)}

          {step === 6 && (<>
            {realDesign && (
              <div className="dw-panel" style={{ borderColor: "var(--blue)" }}>
                <h3>{tx("Het ontwerp is ingelezen")}</h3>
                <p className="dw-hint">{`${htmlFiles.length} ${tx("pagina's")}, ${(b.photos || []).length} ${tx("afbeeldingen")}. ${tx("Klik op Toepassen: de pagina's worden gemaakt en gevuld met de inhoud van het ontwerp.")}`}</p>
                <div className="dw-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                  {[["blocks", "Bewerkbaar (blokken)", "Je kunt alles aanpassen met de pagina-editor, de modules en de systeemobjecten. Een benadering van het ontwerp."], ["design", "Exact (1 op 1)", "De pagina ziet er precies uit als het ontwerp. Teksten pas je aan door opnieuw toe te passen."]].map(([k, l, h]) => (
                    <button type="button" key={k} className={`dw-opt ${render === k ? "on" : ""}`} aria-pressed={render === k} onClick={() => setRender(k)}><b>{tx(l)}</b><small>{tx(h)}</small></button>
                  ))}
                </div>
              </div>
            )}
            <div className="dw-stat">
              {[
                [0, "Website", b.name || "—", `${tx((SITE_KINDS.find((k) => k[0] === b.kind) || [0, ""])[1])}${improve ? ` · ${tx("verbeteren uit ZIP")}` : ""}`],
                [1, "Stijl", [b.theme_name, ...(b.style_tags || []).map((t) => tx((STYLE_TAGS.find((x) => x[0] === t) || [0, t])[1]))].filter(Boolean).join(", ") || tx("Eigen stijl"), b.style || ""],
                [2, "Weergave en talen", tx((MODES.find((m) => m[0] === cmode) || [0, ""])[1]), `${tx("Hoofdtaal")}: ${b.lang || "—"}${(b.langs || []).length ? ` · ${tx("Andere talen")}: ${(b.langs || []).map((c) => (langList.find((l) => l.code === c) || { native: c }).native).join(", ")}${b.lang_switch === false ? "" : ` · ${tx("met taalkeuze")}`}` : ""}`],
                [3, "Pagina's", `${pages.length} ${tx("pagina's")}`, pages.join(", ")],
                [4, "Modules", `${modCount} ${tx("modules")} · ${(b.objects || []).length} ${tx("systeemobjecten")}`, off.length ? `${off.length} ${tx("uitgezet")}` : tx("Alles staat aan")],
                [5, "Foto's", `${(b.photos || []).length} ${tx("foto's")}`, (b.photos || []).length ? "" : tx("Claude maakt illustraties")],
              ].map(([n, l, v, sub]) => (
                <div key={l}><small>{tx(l)}</small><b style={{ overflowWrap: "anywhere" }}>{v}</b><small style={{ overflowWrap: "anywhere", flex: 1 }}>{sub}</small>
                  <button type="button" className="btn sm" style={{ alignSelf: "flex-start", marginTop: ".3rem" }} onClick={() => go(n)}>{tx("Wijzigen")}</button></div>
              ))}
            </div>
            <div className="dw-panel">
              <div className="dw-ph"><h3>{tx("Zo ziet de website eruit")}</h3>
                <span className="dw-tools">
                  {cmode === "both" && <span className="pb-seg">{[["light", "Licht"], ["dark", "Donker"]].map(([k, l]) => <button type="button" key={k} className={pmode === k ? "on" : ""} onClick={() => setPmode(k)}>{tx(l)}</button>)}</span>}
                  <span className="pb-seg">{DEVICES.map(([k, l]) => <button type="button" key={k} className={dev === k ? "on" : ""} onClick={() => setDev(k)}>{tx(l)}</button>)}</span>
                </span></div>
              {realDesign && <Tabs value={cur} onChange={setPpage} tabs={htmlFiles.map((f) => [f, (pages[htmlFiles.indexOf(f)] || f.replace(".html", ""))])} />}
              {realDesign && <small className="muted">{tx("Dit is het ontwerp uit je ZIP-bestand, met je foto's. Claude verbetert het en houdt de kleuren aan.")}</small>}
              <div style={{ display: "flex", justifyContent: "center", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 14, padding: "1rem", overflow: "hidden" }}>
                <div style={{ width: DEVICES.find((d) => d[0] === dev)[2], maxWidth: "100%", background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 12px 44px rgba(0,0,0,.3)" }}>
                  <iframe title={tx("Voorbeeld")} sandbox="" srcDoc={realDesign ? previewHtml(job.files, cur, b.photos || [], cmode === "both" ? pmode : cmode === "dark" ? "dark" : "light") : styleTile(b, cmode === "both" ? pmode : cmode)} style={{ display: "block", width: "100%", height: dev === "mobile" ? 1500 : dev === "tablet" ? 1250 : 1000, border: 0 }} />
                </div>
              </div>
            </div>
          </>)}
        </div>

        <footer className="dw-foot">
          <button type="button" className="btn" disabled={step === 0} onClick={() => go(step - 1)}>{tx("Vorige")}</button>
          <span className="dw-note">{step === LAST ? tx("Het maken van de pagina's kost AI-tegoed en duurt enkele minuten.") : `${tx("Stap")} ${step + 1} ${tx("van")} ${STEPS.length} · ${save === "saving" ? tx("Opslaan…") : tx("Alles is bewaard")}`}</span>
          {step < LAST
            ? <button type="button" className="btn primary" onClick={() => go(step + 1)}>{tx("Volgende")}</button>
            : realDesign && onApply
              ? <span style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
                {onImprove && <button type="button" className="btn" disabled={!!busy} onClick={onImprove} title={tx("Claude verbetert het ontwerp alleen als je zegt wat er moet gebeuren")}><IconBolt /> {tx("Verbeteren met opdracht…")}</button>}
                <button type="button" className="btn primary" disabled={!!busy || !htmlFiles.length || !(b.name || "").trim()} onClick={apply}>{busy === "apply" ? tx("Bezig…") : <><IconCheck /> {tx("Toepassen")}</>}</button>
              </span>
              : <button type="button" className="btn primary" disabled={!!busy || !pages.length || !(b.name || "").trim()} onClick={generate}><IconBolt /> {busy === "gen" ? tx("Starten…") : improve ? tx("Ontwerp verbeteren") : tx("Pagina's maken met AI")}</button>}
        </footer>
      </section>
    </div>
  );
}
