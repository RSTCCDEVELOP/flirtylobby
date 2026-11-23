// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconBolt, IconCamera, IconCheck, IconChat, IconEdit, IconImage, IconMenu, IconPalette, IconSearch, IconSend, IconTrash, IconVideo } from "../../../../components/Icons";
import Tabs from "../../../../components/Tabs";
import { api, apiUpload, errorText, mediaUrl } from "../../../../lib/api";
import { useBusy } from "../../../../lib/busy";
import { confirmDialog, promptDialog } from "../../../../lib/dialog";
import { tx, getLanguage } from "../../../../lib/t";
import { useAuth } from "../../../../components/AuthContext";
import { setActiveDesign } from "../../../../lib/activeDesign";
import Loading from "../../../../components/Loading";
import { captureFrame, saveAsJpg, saveAsPdf } from "../../../../lib/screenshot";
import { COLOR_ROLES, DARK_ROLES, DEFAULT_COLORS, DEFAULT_DARK, DEVICES, DW_CSS, FONT_NAMES, HexField, MODES, ModulePicker, previewHtml, STEPS, elementOfPath } from "./designKit";
import { analyseDesign, buildConvertPrompt } from "./aiPrompt";
import { componentListText } from "../../../../lib/ui-kit/componentList";
import { loadKit } from "../../../../lib/ui-kit/kitDoc";
import Wizard from "./DesignWizard";
import { BRIEF_STEPS, BriefStep, briefFilled, briefToText } from "./briefWizard";
import StartPlanPopup from "./StartWizard";
import { planAsked, planDone, useAiWelcomeOpen, stopWizardLoading } from "../../../../lib/planFlag";

export { ModulePicker, previewHtml };

const STATUS = { draft: "Concept", running: "Bezig", stopping: "Bezig met stoppen", done: "Klaar", error: "Mislukt" };

// The prompt that turns a finished HTML design into an import ZIP (with the modules and live system objects linked) by an external AI.
function ConvertPromptPopup({ onClose, designs = [] }) {
  const [catalog, setCatalog] = useState(null);
  const [tab, setTab] = useState("design");
  const [step, setStep] = useState(0);  // the wizard: one step per group of questions, the last step is the design files
  const [brief, setBrief] = useState(() => { try { return JSON.parse(localStorage.getItem("si:brief") || "{}") || {}; } catch { return {}; } });  // the answers stay when the window is closed
  useEffect(() => { try { localStorage.setItem("si:brief", JSON.stringify(brief)); } catch {} }, [brief]);
  const [themeBrief, setThemeBrief] = useState(null);  // the colours, fonts and corners of the chosen theme, as conditions for the design
  useEffect(() => {
    if (!brief.theme_key) { setThemeBrief(null); return; }
    api(`/sitecreator/theme-brief/?key=${encodeURIComponent(brief.theme_key)}`).then(setThemeBrief).catch(() => setThemeBrief(null));
  }, [brief.theme_key]);
  useEffect(() => { if (brief.compset_key && compMode === "none") setCompMode("list"); }, [brief.compset_key]);  // eslint-disable-line react-hooks/exhaustive-deps
  const [copied, setCopied] = useState(false);
  const [files, setFiles] = useState([]);  // [{name, text}] the html, css and svg files of the design
  const [compMode, setCompMode] = useState("list");  // the list of the UI-kit components (easy2edit_tag) that goes with the prompt: none | list | html | css
  const [kit, setKit] = useState(null);
  const [setKey, setSetKey] = useState("");  // the component set whose list goes with the prompt ("" = the set in use)
  const [sets, setSets] = useState([]);
  useEffect(() => { api("/components/sets/").then((d) => setSets(d.installed || [])).catch(() => {}); }, []);
  useEffect(() => { loadKit(setKey).then(setKit).catch(() => setKit(null)); }, [setKey]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { api("/sitecreator/catalog/").then(setCatalog).catch(() => setCatalog({})); }, []);
  const add = (list) => setFiles((cur) => { const m = new Map(cur.map((f) => [f.name, f])); list.forEach((f) => m.set(f.name, f)); return [...m.values()].sort((a, b) => a.name.localeCompare(b.name)); });
  const pick = async (e) => {
    setErr("");
    const out = [];
    for (const f of [...(e.target.files || [])]) {
      const name = (f.webkitRelativePath ? f.webkitRelativePath.split("/").slice(1).join("/") : f.name) || f.name;
      if (!/\.(html?|css|svg)$/i.test(name)) continue;
      if (f.size > 1500000) { setErr(`${name}: ${tx("is te groot (max 1,5 MB)")}`); continue; }
      out.push({ name, text: await f.text() });
    }
    add(out); e.target.value = "";
  };
  const fromDesign = async (id) => {
    if (!id) return;
    setBusy(true); setErr("");
    try { const j = await api(`/sitecreator/${id}/?files=1`); add(Object.entries(j.files || {}).filter(([n]) => /\.(html?|css|svg)$/i.test(n)).map(([name, text]) => ({ name, text: String(text) }))); } catch (x) { setErr(errorText(x)); } finally { setBusy(false); }
  };
  const info = files.length ? analyseDesign(files) : null;
  const text = buildConvertPrompt({ brief: briefToText(brief), themeBrief, compsetName: (sets.find((m) => m.key === brief.compset_key) || {}).name || (brief.compset_key ? brief.compset_key : ""), objects: catalog?.objects || [], rules: catalog?.rules || null, languages: catalog?.languages || [], mainCode: ((catalog?.languages || []).find((l) => l.default) || {}).code || "nl", files, componentsText: kit && compMode !== "none" ? componentListText(kit, compMode) : "" });
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { document.getElementById("si-cprompt")?.select(); document.execCommand("copy"); }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); a.download = "html-naar-easy2edit-zip-prompt.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const chips = info ? [[tx("HTML-bestanden"), files.filter((f) => /\.html?$/i.test(f.name)).length], [tx("CSS-bestanden"), files.filter((f) => /\.css$/i.test(f.name)).length], [tx("Kleuren"), info.colors.length], [tx("Lettertypen"), info.fonts.length], [tx("Afbeeldingen"), info.pics.length]] : [];
  return createPortal(
    <div className="pb-objback" style={{ zIndex: 1300 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pb-objpop" role="dialog" aria-label={tx("AI-prompt: HTML-ontwerp naar importeer-ZIP")} style={{ width: "min(900px, 94vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="pb-objhead"><strong>{tx("AI-prompt: HTML-ontwerp naar importeer-ZIP")}</strong><span style={{ flex: 1 }} /><button type="button" className="pb-panelx" onClick={onClose} aria-label={tx("Sluiten")}>×</button></div>
        <div style={{ padding: "1rem 1.2rem 1.2rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: ".8rem" }}>
          <Tabs value={tab} onChange={setTab} tabs={[["design", "Ontwerp"], ["prompt", "Prompt"], ["how", "Zo gebruik je het"]]} />
          {err && <div className="alert">{err}</div>}
          {tab === "design" && (
            <div className="form">
              <div role="list" aria-label={tx("Stappen")} style={{ display: "flex", gap: ".35rem", flexWrap: "wrap" }}>
                {[...BRIEF_STEPS.map((st) => st.title), "Ontwerpbestanden"].map((title, i) => (
                  <button type="button" key={title} role="listitem" onClick={() => setStep(i)} aria-current={step === i ? "step" : undefined} title={tx(title)}
                    style={{ width: "1.9rem", height: "1.9rem", borderRadius: "50%", border: `1px solid ${step === i ? "var(--blue)" : "var(--line)"}`, background: step === i ? "var(--blue)" : i < step ? "color-mix(in srgb, var(--blue) 18%, var(--card))" : "var(--card)", color: step === i ? "#fff" : "var(--text)", cursor: "pointer", fontWeight: 700, fontSize: ".8rem" }}>{i + 1}</button>
                ))}
              </div>
              <div className="row between" style={{ alignItems: "baseline" }}>
                <h3 style={{ margin: 0 }}>{tx("Stap")} {step + 1} {tx("van")} {BRIEF_STEPS.length + 1}: {tx(step < BRIEF_STEPS.length ? BRIEF_STEPS[step].title : "Ontwerpbestanden")}</h3>
                <small className="muted">{briefFilled(brief)} {tx("antwoorden in de prompt")}</small>
              </div>
              {step < BRIEF_STEPS.length ? <BriefStep step={BRIEF_STEPS[step]} brief={brief} setBrief={setBrief} onSet={setSetKey} /> : (
                <>
              <p className="muted" style={{ margin: 0 }}>{tx("Kies de bestanden van je HTML-ontwerp. Ze komen in de prompt, samen met de kleuren, lettertypen, hoeken, breedtes en meta-gegevens die de importer uit het ontwerp leest. Zo heeft de AI alles wat nodig is.")}</p>
                  <div className="row" style={{ justifyContent: "flex-start", alignItems: "center", gap: ".5rem", flexWrap: "wrap" }}>
                    <label className="btn primary" style={{ cursor: "pointer" }}>{tx("Bestanden kiezen")}<input type="file" multiple accept=".html,.htm,.css,.svg" onChange={pick} style={{ display: "none" }} /></label>
                    <label className="btn" style={{ cursor: "pointer" }}>{tx("Map kiezen")}<input type="file" webkitdirectory="" multiple onChange={pick} style={{ display: "none" }} /></label>
                    {designs.length > 0 && <select defaultValue="" onChange={(e) => { fromDesign(e.target.value); e.target.value = ""; }} disabled={busy} aria-label={tx("Uit een ontwerp")}><option value="">{tx("Uit een van mijn ontwerpen…")}</option>{designs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}
                    {files.length > 0 && <button type="button" className="btn" onClick={() => setFiles([])}>{tx("Leegmaken")}</button>}
                  </div>
                  {chips.length > 0 && <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>{chips.map(([l, n]) => <span key={l} className="badge">{l}: {n}</span>)}{info.dark && <span className="badge">{tx("Donkere modus")}</span>}</div>}
                  {files.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: ".25rem" }}>
                      {files.map((f) => <div key={f.name} className="row" style={{ justifyContent: "flex-start", gap: ".6rem", alignItems: "center" }}><span style={{ flex: 1, minWidth: 0 }}>{f.name} <small className="muted">{Math.ceil(f.text.length / 1024)} KB</small></span><button type="button" className="btn sm" onClick={() => setFiles((c) => c.filter((x) => x.name !== f.name))} aria-label={tx("Verwijderen")}><IconTrash /></button></div>)}
                    </div>
                  ) : <small className="muted">{tx("Nog geen bestanden: de prompt vraagt de AI dan om je ontwerp te lezen dat je er zelf bij plakt of bijvoegt.")}</small>}
                </>
              )}
              <div className="row" style={{ justifyContent: "space-between", gap: ".5rem", flexWrap: "wrap", marginTop: ".4rem" }}>
                <span className="row" style={{ gap: ".5rem" }}>
                  <button type="button" className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>{tx("Vorige")}</button>
                  {step < BRIEF_STEPS.length && <button type="button" className="btn" onClick={() => setStep(step + 1)}>{tx("Volgende")}</button>}
                  {briefFilled(brief) > 0 && <button type="button" className="btn" onClick={() => { setBrief({}); setStep(0); }}>{tx("Antwoorden wissen")}</button>}
                </span>
                <button type="button" className="btn primary" onClick={() => setTab("prompt")}>{tx("Naar de prompt")}</button>
              </div>
            </div>
          )}
          {tab === "prompt" && (
            <div className="form">
              <label>{tx("Componenten van easy2edit meesturen (easy2edit_tag)")}
                <select value={compMode} onChange={(e) => setCompMode(e.target.value)}>
                  <option value="none">{tx("Niet meesturen")}</option><option value="list">{tx("Alleen de lijst met tags")}</option><option value="html">{tx("Lijst met HTML")}</option><option value="css">{tx("Lijst, HTML en CSS")}</option>
                </select>
                {sets.length > 1 && <select value={setKey} onChange={(e) => setSetKey(e.target.value)} aria-label={tx("Componentenset")}><option value="">{tx("Set in gebruik")}</option>{sets.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}</select>}
                <small className="muted">{tx("De AI gebruikt dan kant-en-klare componenten; de import herkent ze aan hun easy2edit_tag en tekent ze in de kleuren van je thema.")}</small>
              </label>
              <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}><span className="badge">{tx("Systeemobjecten")}: {(catalog?.objects || []).length}</span>{chips.map(([l, n]) => <span key={l} className="badge">{l}: {n}</span>)}</div>
              <textarea id="si-cprompt" readOnly rows={16} value={text} onFocus={(e) => e.target.select()} style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: ".82rem" }} />
              <div className="row" style={{ justifyContent: "flex-start", alignItems: "center" }}>
                <button type="button" className="btn primary" onClick={copy} disabled={!catalog}><IconBolt /> {copied ? tx("Gekopieerd") : tx("Prompt kopiëren")}</button>
                <button type="button" className="btn" onClick={download} disabled={!catalog}>{tx("Downloaden als tekstbestand")}</button>
                <small className="muted">{text.length.toLocaleString()} {tx("tekens")}</small>
              </div>
            </div>
          )}
          {tab === "how" && (
            <ol className="muted" style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: ".5rem" }}>
              <li>{tx("Kies bij Ontwerp de HTML- en CSS-bestanden van je ontwerp.")}</li>
              <li>{tx("Kopieer de prompt en plak hem in een AI die bestanden kan maken (Claude, ChatGPT, Gemini). Voeg de afbeeldingen van je ontwerp toe als bijlage.")}</li>
              <li>{tx("De AI levert één ZIP-bestand op. Upload dat bij Website ontwerpen op het tabblad ZIP-bestand.")}</li>
            </ol>
          )}
        </div>
      </div>
    </div>, document.body);
}

// The tab AI-creator: your designs (also the ones that were not finished: continue where you stopped) and a new one.
// Superadmins: designs as json. Export of one design (the choices, the chat with the answers, the files) and a drop area to read json files again; an existing design is replaced or a row is added.
function DesignJsonDrop({ onDone, onErr }) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const take = async (list) => {
    const files = [...list].filter((f) => /\.json$/i.test(f.name) || f.type === "application/json");
    if (!files.length) { onErr(tx("Kies een json-bestand van een geëxporteerd ontwerp.")); return; }
    setBusy(true); onErr("");
    try {
      for (const f of files) {
        let data;
        try { data = JSON.parse(await f.text()); } catch { throw new Error(`${f.name}: ${tx("Dit is geen geldig json-bestand.")}`); }
        let parts = "all";
        if (data?.render?.files && Object.keys(data.render.files).length) {  // the file has made pages (a render): load the whole set or only the questions
          const pick = await confirmDialog(tx("Dit bestand bevat ook de gemaakte pagina's (render). Wat wil je inladen?"), { title: tx("Ontwerp inladen"), okLabel: tx("Complete set"), cancelLabel: tx("Overslaan"),
            choices: [{ value: "all", label: tx("Complete set"), hint: tx("De vragen met antwoorden, de keuzes en de gemaakte pagina's.") }, { value: "questions", label: tx("Alleen de vragen"), hint: tx("De vragen met antwoorden en de keuzes; de pagina's worden opnieuw gemaakt.") }] });
          if (!pick) continue;
          parts = pick;
        }
        let r = await api("/sitecreator/import/", { method: "POST", body: { data, parts } });
        if (r.exists) {
          const what = await confirmDialog(tx("Het ontwerp \"{0}\" bestaat al. Wat wil je doen?", r.name || f.name), { title: tx("Ontwerp bestaat al"), okLabel: tx("Vervangen"), cancelLabel: tx("Overslaan"),
            choices: [{ value: "replace", label: tx("Vervangen"), hint: tx("Het bestaande ontwerp krijgt de gegevens uit het bestand.") }, { value: "add", label: tx("Een rij toevoegen"), hint: tx("Het bestaande ontwerp blijft staan; het bestand komt als nieuw ontwerp ernaast.") }] });
          if (!what) continue;
          r = await api("/sitecreator/import/", { method: "POST", body: { data, mode: what, parts } });
        }
      }
      onDone();
    } catch (x) { onErr(errorText(x)); } finally { setBusy(false); }
  };
  return (
    <div role="button" tabIndex={0} aria-label={tx("Sleep een ontwerp (json) hierheen")} data-easy2edit-tag="ui-dropzone" onClick={() => !busy && input.current?.click()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) take(e.dataTransfer.files); }}
      style={{ display: "grid", justifyItems: "center", gap: ".2rem", padding: ".8rem", textAlign: "center", borderRadius: 12, cursor: busy ? "default" : "pointer", border: `2px dashed ${over ? "var(--blue)" : "var(--line)"}`, background: over ? "color-mix(in srgb, var(--blue) 10%, var(--card))" : "var(--bg)" }}>
      <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: over ? "var(--blue)" : "var(--muted)" }}><path d="M12 16V5" /><path d="M7.5 9.5L12 5l4.5 4.5" /><path d="M5 19h14" /></svg>
      <strong style={{ fontSize: ".85rem" }}>{busy ? tx("Bezig met inlezen…") : tx("Sleep een ontwerp (json) hierheen")}</strong>
      <small className="muted">{tx("of klik om een bestand te kiezen")}</small>
      <input ref={input} type="file" accept="application/json,.json" multiple style={{ display: "none" }} onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

export function AiCreatorHome({ onOpen, refreshKey, onWay, importsEmpty = null }) {
  const { user } = useAuth();
  const superadmin = !!user && !!(user.is_staff || user.is_superuser);
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [conv, setConv] = useState(false);
  const [plan, setPlan] = useState(false);  // the popup with the step plan
  const aiFirst = useAiWelcomeOpen();  // the AI explanation comes first
  const planShown = useRef(false);
  useEffect(() => { // the step plan opens by itself on an empty installation (no imports, no designs) and after a reset or a new installation, until it has been closed once
    if (!d || importsEmpty === null || planShown.current) return;
    planShown.current = true;
    const a = planAsked();
    if (a.flag || (importsEmpty && !(d.designs || []).length && !a.off)) setPlan(true); else stopWizardLoading();  // no wizard: the loader goes
    if (a.flag) api("/system/onboarding/done/", { method: "POST", body: {} }).catch(() => {}); // the design wizard starts: the last step of the onboarding is reached, it is complete
  }, [d, importsEmpty]);
  useEffect(() => { if (plan && !aiFirst) stopWizardLoading(); }, [plan, aiFirst]);  // the wizard is on the screen: the dark layer with the loader goes
  const closePlan = () => { setPlan(false); planDone(); };
  const load = useCallback(() => api("/sitecreator/").then(setD).catch((e) => setErr(errorText(e))), []);
  useEffect(() => { load(); }, [load, refreshKey]);
  const create = async (chat = false) => { setBusy(true); setErr(""); try { const j = await api("/sitecreator/", { method: "POST", body: {} }); if (chat) await api(`/sitecreator/${j.id}/`, { method: "PATCH", body: { chat: true } }); onOpen(j.id); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); } };
  const startChat = async (brief, firstText) => {  // the wizard is ready: the AI chat build starts with the choices and a first message with everything the customer said
    setBusy(true); setErr(""); closePlan();
    try {
      const j = await api("/sitecreator/", { method: "POST", body: {} });
      await api(`/sitecreator/${j.id}/`, { method: "PATCH", body: { ...brief, chat: true } });
      let chatErr = null;
      try { await api(`/sitecreator/${j.id}/chat/`, { method: "POST", body: { text: firstText, lang: getLanguage() } }); } catch (e) { chatErr = e; }  // first the first message is sent: the design is opened with it (opened earlier, the window kept showing an empty chat: the answer to the first message came after it had loaded)
      onOpen(j.id);
      if (chatErr) setErr(errorText(chatErr));
    } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  };
  const rename = async (x) => {  // a new name for the design
    const n = await promptDialog(tx("Nieuwe naam van het ontwerp"), x.name || "", { title: tx("Naam wijzigen"), okLabel: tx("Opslaan"), cancelLabel: tx("Annuleren") });
    if (n === null || n === undefined) return;
    const name = String(n).trim().slice(0, 120);
    if (!name || name === x.name) return;
    try { await api(`/sitecreator/${x.id}/`, { method: "PATCH", body: { name } }); await load(); } catch (e) { setErr(errorText(e)); }
  };
  const exportOne = async (x) => {
    try {
      const data = await api(`/sitecreator/${x.id}/export/`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = `${(x.name || "ontwerp").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ontwerp"}.design.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { setErr(errorText(e)); }
  };
  // A design that failed: opening it asks first: do the last order again, or go on with what is there
  const openDesign = async (x) => {
    if (x.status !== "error") return onOpen(x.id);
    const what = await confirmDialog(tx("Het ontwerpen van dit ontwerp is mislukt. Wil je de opdracht opnieuw laten doen, of verdergaan met wat er al is?"), {
      title: tx("Ontwerp mislukt"), okLabel: tx("Doorgaan"), cancelLabel: tx("Annuleren"),
      choices: [{ value: "retry", label: tx("Opdracht opnieuw doen"), hint: tx("De laatste opdracht wordt opnieuw uitgevoerd. Wat er al is, blijft bewaard.") },
        { value: "continue", label: tx("Verder gaan met wat er is"), hint: tx("Het ontwerp gaat open zoals het nu is. Je gaat verder in de chat.") }],
    });
    if (!what) return;
    setErr("");
    try { await api(`/sitecreator/${x.id}/failed/`, { method: "POST", body: { mode: what } }); } catch (e) { setErr(errorText(e)); return; }
    onOpen(x.id);
  };
  const del = async (x) => { if (!(await confirmDialog(tx("Dit ontwerp verwijderen? Wat je hebt ingevuld en gemaakt gaat verloren, ook de geüploade documenten."), { danger: true, title: tx("Ontwerp verwijderen"), okLabel: tx("Verwijderen") }))) return; await api(`/sitecreator/${x.id}/`, { method: "DELETE" }).catch(() => {}); load(); };
  return (
    <div style={{ marginTop: ".75rem", display: "flex", flexDirection: "column", gap: ".8rem" }}>
      <p className="muted" style={{ margin: 0 }}>{tx("Ontwerp je website in een gesprek met de AI: links de chat, rechts direct het voorbeeld. Wil je eerst een opzet laten maken? Start dan de wizard: die stelt een paar vragen (ook als je al een website, een ontwerp, een ZIP of een voorbeeldadres hebt) en zet de eerste opzet klaar. Alles wat je invult wordt bewaard, ook als je halverwege stopt.")}</p>
      {err && <div className="alert">{err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: ".6rem" }}>
        {[
          [IconChat, "AI chat build", () => create(true), busy || d?.ai === false],
          [IconMenu, "Wizard", () => setPlan(true), false],
        ].map(([Ic, label, go, off]) => <button type="button" key={label} className="btn" disabled={off} onClick={go} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: ".5rem", minHeight: "2.8rem", width: "100%", background: "#1e293b", color: "#fff", borderColor: "#334155", fontWeight: 600 }}><Ic /> {tx(label)}</button>)}
      </div>
      {conv && <ConvertPromptPopup onClose={() => setConv(false)} designs={d?.designs || []} />}
      {plan && !aiFirst && <StartPlanPopup onClose={closePlan} onStart={startChat} onInstalled={() => load()} onPick={(a) => { closePlan(); if (a.href) { window.location.href = a.href; } else if (a.tab && a.tab !== "ai") onWay?.(a); else if (a.auto === "prompt") setConv(true); }} />}
      {d?.ai === false && <div className="alert">{tx("Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan.")}</div>}
      {superadmin && <DesignJsonDrop onDone={load} onErr={setErr} />}
      {d?.designs?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: ".45rem" }}>
          <strong>{tx("Mijn ontwerpen")}</strong>
          {d.designs.map((x) => (
            <div key={x.id} className="card" style={{ display: "flex", gap: ".7rem", alignItems: "center", padding: ".6rem .8rem" }}>
              <span style={{ flex: 1, minWidth: 0 }}><strong>{x.name}</strong> {x.pages > 0 && <span title={tx("De pagina's zijn gemaakt")} aria-label={tx("De pagina's zijn gemaakt")} style={{ display: "inline-flex", verticalAlign: "middle", color: "var(--muted)" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg></span>} <span className={x.live || (x.status === "done" && !x.applied) ? "badge ok" : "badge off"}>{x.live ? tx("Live") : x.applied && x.status === "done" ? tx("Concept") : tx(STATUS[x.status] || x.status)}</span>
                <small className="muted" style={{ display: "block" }}>{x.chat && x.status === "draft" ? tx("AI chat build") : x.status === "draft" ? `${tx("Stap")} ${x.step + 1} ${tx("van")} ${STEPS.length}: ${tx(STEPS[x.step]?.[1] || "")}` : `${x.pages} ${tx("pagina's")}`} · {new Date(x.updated_at).toLocaleString()}</small></span>
              <button type="button" className="btn sm primary" onClick={() => openDesign(x)}>{x.status === "draft" ? tx("Verder gaan") : tx("Openen")}</button>
              <button type="button" className="btn sm" disabled={x.status === "running" || x.status === "stopping"} onClick={() => rename(x)} title={tx("Naam wijzigen")} aria-label={tx("Naam wijzigen")}><IconEdit /></button>
              {superadmin && <button type="button" className="btn sm" onClick={() => exportOne(x)} title={tx("Exporteren als json")} aria-label={tx("Exporteren als json")}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11" /><path d="M7.5 10.5L12 15l4.5-4.5" /><path d="M5 19h14" /></svg></button>}
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
              <small className="muted">{canGo ? tx("easy2edit past alleen aan wat je hier vraagt.") : tx("Kies een aandachtspunt of schrijf een opdracht: zonder opdracht verandert er niets.")}</small>
              <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn" onClick={onClose}>{tx("Annuleren")}</button><button type="button" className="btn primary" disabled={busy || !canGo} onClick={go}><IconBolt /> {busy ? tx("Starten…") : tx("Start verbeteren")}</button></div>
            </div>
          )}
          {tab === "how" && (
            <div className="muted" style={{ display: "grid", gap: ".6rem" }}>
              <p style={{ margin: 0 }}>{tx("easy2edit verbetert alle pagina's na elkaar: de opmaak, de teksten en de structuur. Je ziet de voortgang met een percentage.")}</p>
              <p style={{ margin: 0 }}>{tx("Je kunt het altijd stoppen. Wat al klaar was blijft bewaard; de rest blijft zoals het was.")}</p>
              <p style={{ margin: 0 }}>{tx("Na het verbeteren kun je de vorige versie terugzetten.")}</p>
            </div>
          )}
        </div>
      </div>
    </div>, document.body);
}

// The check of a design: the report of the validator (the same one the import uses) grouped by severity; errors block the import, warnings do not. Missing components get their own block.
function CheckReport({ rep, checking, onRecheck, job, onDesign, onLocate }) {
  const [pick, setPick] = useState({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const choose = async (type, actie, tag = "") => { setBusy(type + actie); setMsg(null); try { const r = await api(`/sitecreator/${job.id}/missing/`, { method: "POST", body: { type, actie, tag } }); setMsg({ ok: true, text: tx(r.melding) }); onDesign && onDesign(r.ontwerp); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } setBusy(""); };
  if (!rep) return <p className="muted">{checking ? tx("Bezig met controleren…") : tx("Nog niet gecontroleerd.")}</p>;
  const all = (rep.paginas || []).flatMap((p) => (p.meldingen || []).map((m) => ({ ...m, file: p.file })));
  const missing = (rep.paginas || []).flatMap((p) => (p.ontbrekende_componenten || []).map((m) => ({ ...m, file: p.file })));
  const fixes = (rep.paginas || []).flatMap((p) => (p.reparaties || []).map((m) => ({ ...m, file: p.file })));
  const groups = [["fout", "Fouten", "Deze blokkeren het aanmaken"], ["waarschuwing", "Waarschuwingen", "Het aanmaken kan doorgaan"], ["info", "Info", ""]];
  return (
    <div style={{ display: "grid", gap: ".8rem" }}>
      <div className={rep.fouten ? "alert" : "alert ok"}>{rep.fouten ? `${rep.fouten} ${tx("fouten")} · ${rep.waarschuwingen} ${tx("waarschuwingen")}` : `${tx("Geen fouten")} · ${rep.waarschuwingen || 0} ${tx("waarschuwingen")}`}</div>
      {groups.map(([k, l, h]) => {
        const list = all.filter((m) => m.ernst === k);
        return list.length > 0 && (
          <div key={k}><strong>{tx(l)}</strong> <small className="muted">{tx(h)}</small>
            <ul style={{ margin: ".3rem 0 0", paddingLeft: "1.1rem", display: "grid", gap: ".3rem" }}>
              {list.map((m, i) => <li key={i}><span>{m.melding}</span> <small className="muted">{m.file} {m.pad}{m.component ? ` · ${m.component}` : ""}</small>{onLocate && /^\/(inhoud|header|footer)/.test(m.pad || "") && <> <button type="button" className="btn sm" onClick={() => onLocate(m.file, m.pad)} title={tx("Toon deze plek in het voorbeeld")}>{tx("Toon in voorbeeld")}</button></>}{m.suggestie && <small className="muted" style={{ display: "block" }}>{m.suggestie}</small>}</li>)}
            </ul>
          </div>
        );
      })}
      {missing.length > 0 && (
        <div><strong>{tx("Ontbrekende componenten")}</strong> <small className="muted">{tx("Hier staat een placeholder: kies een bestaand component of vraag het component aan.")}</small>
          <ul style={{ margin: ".3rem 0 0", paddingLeft: "1.1rem", display: "grid", gap: ".3rem" }}>
            {missing.map((m, i) => {
              const near = m.dichtstbijzijnde_bestaande || [], ready = (job?.brief?.component_klaar || {})[m.voorgesteld_type], asked = (job?.brief?.aangevraagd || {})[m.voorgesteld_type], sel = pick[m.voorgesteld_type] || near[0] || "";
              return (
                <li key={i} style={{ display: "grid", gap: ".35rem" }}>
                  <span><b>{m.naam}</b> <small className="muted">({m.voorgesteld_type})</small> {m.doel}</span>
                  {ready && <div className="alert ok">{tx("Het component is klaar")}: <b>{ready}</b> <button type="button" className="btn sm primary" disabled={!!busy} onClick={() => choose(m.voorgesteld_type, "vervangen", ready)}>{tx("Placeholder vervangen")}</button></div>}
                  {asked && !ready && <small className="muted">{tx("Aangevraagd: je ziet hier wanneer het component klaar is.")}</small>}
                  <span className="row" style={{ gap: ".4rem", flexWrap: "wrap", alignItems: "center" }}>
                    {near.length > 0 && <><select value={sel} onChange={(e) => setPick({ ...pick, [m.voorgesteld_type]: e.target.value })} aria-label={tx("Bestaand component")}>{near.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                      <button type="button" className="btn sm" disabled={!!busy} onClick={() => choose(m.voorgesteld_type, "vervangen", sel)}>{tx("Vervangen door dit component")}</button></>}
                    <button type="button" className="btn sm" disabled={!!busy} onClick={() => choose(m.voorgesteld_type, "weglaten")}>{tx("Weglaten")}</button>
                    <button type="button" className="btn sm" disabled={!!busy || !!asked} onClick={() => choose(m.voorgesteld_type, "aanvragen")} title={tx("Het verzoek wordt beoordeeld en door de ontwikkelaars gebouwd. Een bestaand component uitbreiden gaat voor een nieuw component.")}>{asked ? tx("Aangevraagd") : tx("Component aanvragen")}</button>
                  </span>
                  <small className="muted">{tx("Of laat de placeholder staan: het ontwerp blijft dan een concept met een waarschuwing.")}</small>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {msg && <div className={msg.ok ? "alert ok" : "alert"} role="status">{msg.text}</div>}
      {fixes.length > 0 && <div><strong>{tx("Automatisch hersteld")}</strong><ul style={{ margin: ".3rem 0 0", paddingLeft: "1.1rem" }}>{fixes.map((m, i) => <li key={i}>{m.melding} <small className="muted">{m.file} {m.pad}</small></li>)}</ul></div>}
      <div><button type="button" className="btn" disabled={checking} onClick={onRecheck}>{checking ? tx("Bezig met controleren…") : tx("Opnieuw controleren")}</button></div>
    </div>
  );
}

// Alles aanmaken: when the design is good, the pages are made and filled at once. Choices: how, and which parts.
function CreatePopup({ job, onClose, onCreate, onReview, onDesign, onLocate }) {
  const [tab, setTab] = useState("choices");
  const [rep, setRep] = useState(job.brief?.controle || null); // the check of the design in the page format (easy2edit-pagina@1): errors block "Alles aanmaken", warnings do not
  const [checking, setChecking] = useState(false);
  const recheck = useCallback(() => { setChecking(true); api(`/sitecreator/${job.id}/controle/`).then(setRep).catch(() => {}).finally(() => setChecking(false)); }, [job.id]);
  useEffect(() => { recheck(); }, [recheck]);
  const blocked = (rep?.fouten || 0) > 0;
  const own = !job.brief?.theme; // an own style: a theme is made of it (named after the website)
  const [o, setO] = useState({ render: "blocks", theme: true, useTheme: true, modules: true, translate: (job.brief?.langs || []).length > 0, installation: job.brief?.installation || "" });
  const [installs, setInstalls] = useState(null);  // the standard installations (null = not loaded, [] = not allowed for this person)
  useEffect(() => { api("/system/presets/").then((r) => setInstalls(Array.isArray(r) ? r.map((x) => ({ key: x.key, name: x.name, active: !!x.active })) : [])).catch(() => setInstalls([])); }, []);
  const n = Object.keys(job.files || {}).filter((f) => f.endsWith(".html")).length;
  const photos = (job.brief?.photos || []).length;
  const sw = (k, l, h) => <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={!!o[k]} onChange={(e) => setO({ ...o, [k]: e.target.checked })} /><span /></span><span>{tx(l)} <small className="muted">{tx(h)}</small></span></label>;
  return createPortal(
    <div className="pb-objback" style={{ zIndex: 1300 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{DW_CSS}</style>
      <div className="pb-objpop" role="dialog" aria-label={tx("Alles aanmaken")} style={{ width: "min(640px, 94vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="pb-objhead"><strong>{tx("Alles aanmaken")}</strong><span style={{ flex: 1 }} /><button type="button" className="pb-panelx" onClick={onClose} aria-label={tx("Sluiten")}>×</button></div>
        <div style={{ padding: "1rem 1.3rem 1.3rem", overflowY: "auto", display: "grid", gap: ".9rem" }}>
          <Tabs value={tab} onChange={setTab} tabs={[["choices", "Keuzes"], ["check", `${tx("Controle")}${rep ? ` (${rep.fouten || 0}/${rep.waarschuwingen || 0})` : ""}`], ["what", "Wat wordt er gemaakt?"]]} />
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
              {installs && installs.length > 0 && (
                <div className="card" style={{ padding: ".7rem .9rem", display: "grid", gap: ".5rem", background: "color-mix(in srgb, var(--eco-leaf, #7cc59a) 12%, transparent)" }}>
                  <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={!!o.installation} onChange={(e) => setO({ ...o, installation: e.target.checked ? (job.brief?.installation || installs.find((x) => x.active)?.key || installs[0].key) : "" })} /><span /></span>
                    <span>{tx("De standaard installatie uitvoeren")} <small className="muted" style={{ display: "block" }}>{tx("Zet de modules en plugins van de installatie aan en maakt de demo-gegevens. Pagina's met inhoud worden niet overschreven.")}</small></span></label>
                  {o.installation && <select value={o.installation} onChange={(e) => setO({ ...o, installation: e.target.value })} aria-label={tx("Standaard installatie")}>{installs.map((x) => <option key={x.key} value={x.key}>{x.name}{x.key === job.brief?.installation ? ` · ${tx("gekozen in de vragen")}` : ""}</option>)}</select>}
                </div>
              )}
              {sw("modules", "Modules aanzetten", "De modules die de pagina's nodig hebben")}
              {(job.brief?.langs || []).length > 0 && sw("translate", "Ook vertalen", "Naar de andere talen van het ontwerp")}
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <button type="button" className="btn" onClick={onReview}>{tx("Eerst controleren")}</button>
                <button type="button" className="btn primary" disabled={!(job.brief?.name || "").trim() || blocked} onClick={() => onCreate(o)} title={blocked ? tx("Er zijn fouten in het ontwerp: zie het tabblad Controle") : !(job.brief?.name || "").trim() ? tx("De naam van de website is verplicht") : undefined}><IconCheck /> {tx("Alles aanmaken")}</button>
              </div>
            </div>
          )}
          {tab === "check" && <CheckReport rep={rep} checking={checking} onRecheck={recheck} job={job} onLocate={onLocate} onDesign={(d) => { onDesign && onDesign(d); recheck(); }} />}
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

// The photos that the pages of a chat design ask for: every slot has a search on iStock (the user downloads the photo there himself) and a place to put the downloaded photo in.
// A block under the chat (colours, photos): the header (in the main colour) always stays visible, with an arrow up/down; only the part below it scrolls.
// Where the photos and videos are searched: the free sources (Pexels, Unsplash) only when they are linked and switched on (Admin -> API keys), and iStock (licence needed, watermarked example). Without an active free source the choice is not shown and iStock is used. The choice is kept in this browser (only a convenience).
const SRC_NAMES = { pexels: "Pexels", unsplash: "Unsplash", istock: "iStock" };
const srcLabel = (s) => SRC_NAMES[s] || "iStock";
const freeTx = (src, k) => (src === "unsplash" ? tx(k).replace(/Pexels/g, "Unsplash") : tx(k));  // the texts of the free sources are written for Pexels: the name is swapped for Unsplash
let FREE_ON = null;  // null = not asked yet, otherwise {pexels: bool, unsplash: bool}: which free sources are linked and switched on
let FREE_P = null;
const loadFree = () => FREE_P || (FREE_P = api("/sitecreator/photo-sources/").then((r) => { FREE_ON = { pexels: !!r?.pexels, unsplash: !!r?.unsplash }; try { window.dispatchEvent(new Event("siSource")); } catch {} return FREE_ON; }).catch(() => { FREE_P = null; return null; }));
const freeList = () => ["pexels", "unsplash"].filter((k) => FREE_ON && FREE_ON[k]);
const sourceNow = () => {
  const on = freeList();
  if (!FREE_ON || !on.length) return "istock";  // as long as it is not known (or when no free source is active) iStock: Pexels is never assumed
  let v = "";
  try { v = localStorage.getItem("siSource") || ""; } catch {}
  if (v === "istock") return "istock";
  return on.includes(v) ? v : on[0];
};
function useSource() {  // one choice for the whole screen: every search field, the question in the chat and the dialog follow it
  const [source, set] = useState(sourceNow);
  const [, tick] = useState(0);  // the answer about the free sources also has to redraw the choice when the source itself stays the same
  useEffect(() => {
    const on = () => { set(sourceNow()); tick((n) => n + 1); };
    window.addEventListener("siSource", on);
    loadFree();
    return () => window.removeEventListener("siSource", on);
  }, []);
  const setSource = (v) => { try { localStorage.setItem("siSource", v); } catch {} set(v); try { window.dispatchEvent(new Event("siSource")); } catch {} };
  return [source, setSource, srcLabel(source)];
}
const SourceSelect = ({ value, onChange, style }) => !FREE_ON || !freeList().length ? null : <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={tx("Zoeken bij")} style={style}>{freeList().map((k) => <option key={k} value={k}>{srcLabel(k)}</option>)}<option value="istock">iStock</option></select>;

function Fold({ title, defaultOpen, children, shut }) {
  const [open, setOpen] = useState(!!defaultOpen);
  useEffect(() => { if (shut) setOpen(false); }, [shut]);  // while the AI is making the pages the block folds itself away
  const toggle = () => setOpen((o) => !o);
  return (
    <div data-easy2edit-tag="ui-fold" style={{ borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, maxHeight: open ? "45%" : "none", flex: "none" }}>
      <div role="button" tabIndex={0} aria-expanded={open} onClick={toggle} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(); } }}
        style={{ cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: ".4rem", padding: ".5rem .8rem", background: "var(--blue)", color: "#fff", userSelect: "none", flex: "none" }}>
        {title}
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto", flex: "none" }}>{open ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}</svg>
      </div>
      {open && <div style={{ overflowY: "auto", overflowX: "hidden", minHeight: 0, padding: ".5rem .8rem" }}>{children}</div>}
    </div>
  );
}

function PhotoSlots({ job, onJob, onShow, onAsk }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const slots = job.photo_slots || [];
  const [looking, setLooking] = useState(false);
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("photo");  // what the search field looks for: photos or videos
  const [source, setSource, srcName] = useSource();
  const [found, setFound] = useState(null);    // the results of the search field
  const [target, setTarget] = useState("");    // the slot where a result goes
  const [searching, setSearching] = useState(false);
  const tried = useRef("");
  const look = useCallback(async () => {
    setLooking(true); setErr("");
    try { const r = await api(`/sitecreator/${job.id}/istock/`, { method: "POST", body: { source } }); onJob(r); setNote(r.found ? `${r.found} ${tx("foto's en video's gevonden")} (${srcName})` : tx("Er is niets nieuws gevonden. Probeer een andere omschrijving of vul zelf een nummer in.")); } catch (x) { setErr(errorText(x)); } finally { setLooking(false); }
  }, [job.id, onJob, source, srcName]);
  // once per design the AI looks for a real iStock photo (number and address) for every empty slot
  useEffect(() => { if (slots.length && !job.istock_tried && job.status !== "running" && tried.current !== job.id) { tried.current = job.id; look(); } }, [slots.length, job.istock_tried, job.status, job.id, look]);
  const open = slots.filter((x) => !x.done).length;
  const put = async (slot, f) => {
    const vid = slot.kind === "video";
    if (!f || !f.type.startsWith(vid ? "video/" : "image/")) { setErr(vid ? tx("Kies een video (mp4 of webm).") : tx("Kies een afbeelding (jpg, png of webp).")); return; }
    setBusy(slot.file); setErr("");
    try {
      const fd = new FormData(); fd.append("files", f); fd.append("tags", "design");
      const r = await apiUpload("/media/upload/", fd, () => {});
      if (!r.items?.length) throw new Error((r.errors || []).join(" ") || tx("Uploaden is niet gelukt."));
      onJob(await api(`/sitecreator/${job.id}/slot/`, { method: "POST", body: { file: slot.file, media: r.items[0].id } })); if (onShow) onShow(slot.file);
    } catch (x) { setErr(errorText(x)); } finally { setBusy(""); }
  };
  const saveNo = async (slot, v) => { if ((v || "") === (slot.istock || "")) return; setErr(""); try { onJob(await api(`/sitecreator/${job.id}/slot/`, { method: "POST", body: { file: slot.file, istock: v } })); } catch (x) { setErr(errorText(x)); } };
  const search = async (e) => {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setSearching(true); setErr(""); setFound(null);
    try { setFound((await api(`/sitecreator/${job.id}/istock-search/?q=${encodeURIComponent(q.trim())}&kind=${kind}&source=${source}`)).items || []); } catch (x) { setErr(errorText(x)); } finally { setSearching(false); }
  };
  const choose = async (item) => {
    const slot = target ? slots.find((x) => x.file === target) : null;
    setBusy(slot ? slot.file : "add"); setErr("");
    try {
      if (slot) { onJob(await api(`/sitecreator/${job.id}/slot/`, { method: "POST", body: { file: slot.file, pick: item } })); setNote(`${tx("Gekozen voor")}: ${slot.alt || slot.file}`); }
      else { onJob(await api(`/sitecreator/${job.id}/slot/`, { method: "POST", body: { add: item } })); setNote(`${tx("Toegevoegd aan je lijst")}: ${srcLabel(item.source)} ${item.id}`); }
    } catch (x) { setErr(errorText(x)); } finally { setBusy(""); }
  };
  const place = async (slot) => {  // a chosen photo: the example is put in the library and the designer is asked to use it in the website
    if (!slot.done) await usePreview(slot);
    if (onAsk) await onAsk(slot.kind === "video" ? `Use the video video/${slot.file} (${slot.alt || "chosen on iStock"}) at a fitting place in the design, as a calm background or block.` : `Use the photo img/${slot.file} (${slot.alt || "chosen on iStock"}) at a fitting place in the design.`);
  };
  const usePreview = async (slot) => { setBusy(slot.file); setErr(""); try { onJob(await api(`/sitecreator/${job.id}/slot/`, { method: "POST", body: { file: slot.file, use_preview: true } })); const where = onShow ? onShow(slot.file) : ""; setNote(`${(slot.kind === "video" ? tx("Voorbeeldvideo (met watermerk) toegepast op het ontwerp") : tx("Voorbeeldfoto (met watermerk) toegepast op het ontwerp"))}${where ? `: ${tx("pagina")} ${where}` : ""}. ${tx("Vervang hem later door de gelicentieerde foto.")}`); } catch (x) { setErr(errorText(x)); } finally { setBusy(""); } };
  const hide = async (slot) => { setBusy(slot.file); try { onJob(await api(`/sitecreator/${job.id}/slot/`, { method: "POST", body: { file: slot.file, hide: true } })); } catch (x) { setErr(errorText(x)); } finally { setBusy(""); } };
  const clear = async (slot) => { setBusy(slot.file); try { onJob(await api(`/sitecreator/${job.id}/slot/`, { method: "DELETE", body: { file: slot.file } })); } catch (x) { setErr(errorText(x)); } finally { setBusy(""); } };
  return (
    <Fold shut={job.status === "running" || job.status === "stopping"} defaultOpen={open > 0} title={<><IconImage /> {tx("Foto's en video's")} <span className={open ? "badge" : "badge ok"}>{slots.length - open}/{slots.length}</span> <button type="button" className="btn sm" style={{ marginLeft: ".4rem" }} disabled={looking} onClick={(e) => { e.preventDefault(); e.stopPropagation(); look(); }} title={`${tx("Zoek passende foto's en video's op")} ${srcName}`}><IconSearch /> {looking ? tx("Bezig…") : tx("Zoeken")}</button></>}>
      <p className="muted" style={{ margin: ".4rem 0", fontSize: ".85rem" }}>{source !== "istock" ? freeTx(source, "Zoek foto's en video's op Pexels: die zijn gratis te gebruiken. Een gekozen foto komt meteen in je ontwerp.") : tx("Zoek elke foto of video op iStock, download hem zelf (daar heb je een licentie voor nodig) en zet hem hier in de plek. Tot die tijd staat er een grijs vlak.")}</p>
      {err && <div className="alert">{err}</div>}
      <form onSubmit={search} role="search" style={{ display: "flex", gap: ".35rem", flexWrap: "wrap", margin: ".2rem 0 .5rem" }}>
        <input type="search" value={q} maxLength={120} onChange={(e) => setQ(e.target.value)} placeholder={`${tx("Zoek een foto of video op")} ${srcName}…`} aria-label={`${tx("Zoek een foto of video op")} ${srcName}`} style={{ flex: "1 1 160px", minWidth: 0 }} />
        <SourceSelect value={source} onChange={(v) => { setSource(v); setFound(null); }} style={{ flex: "0 0 auto", width: "auto", maxWidth: 120 }} />
        <select value={kind} onChange={(e) => { setKind(e.target.value); setFound(null); }} aria-label={tx("Soort")} style={{ flex: "0 0 auto", width: "auto", maxWidth: 90 }}><option value="photo">{tx("Foto's")}</option><option value="video">{tx("Video's")}</option></select>
        <button className="btn sm primary" disabled={searching || q.trim().length < 2}><IconSearch /> {searching ? tx("Bezig…") : tx("Zoeken")}</button>
      </form>
      {found && (
        <div style={{ margin: "0 0 .6rem" }}>
          <label style={{ display: "flex", gap: ".4rem", alignItems: "center", fontSize: ".82rem", marginBottom: ".4rem" }}>{tx("Toevoegen aan")}
            <select value={target} onChange={(e) => setTarget(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
              <option value="">{tx("Nieuw in mijn lijst")}</option>
              {slots.filter((x) => (x.kind === "video") === (kind === "video")).map((x) => <option key={x.file} value={x.file}>{x.alt || x.file}{x.done ? ` (${tx("vervangen")})` : ""}</option>)}
            </select>
          </label>
          {!found.length && <p className="muted" style={{ fontSize: ".85rem" }}>{tx("Niets gevonden. Probeer een ander zoekwoord (Engels werkt het best).")}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: ".4rem" }}>
            {found.map((it) => (
              <div key={it.id} className="card" style={{ padding: ".3rem", display: "grid", gap: ".25rem", minWidth: 0 }}>
                <a href={it.preview || it.url} target="_blank" rel="noopener noreferrer" title={it.title} style={{ display: "block", aspectRatio: "1", borderRadius: 8, overflow: "hidden", background: "var(--line)" }}>{it.preview && <img src={it.preview} alt={it.title || ""} referrerPolicy="no-referrer" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</a>
                <small className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.title}>{srcLabel(it.source)} {it.id}</small>
                <button type="button" className="btn sm" disabled={!!busy} onClick={() => choose(it)}>{busy === "add" ? tx("Bezig…") : tx("Kies")}</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {note && !err && <p className="muted" style={{ margin: ".2rem 0 .4rem", fontSize: ".85rem" }} role="status">{note}</p>}
      <div style={{ display: "grid", gap: ".5rem", gridTemplateColumns: "minmax(0, 1fr)" }}>
        {slots.map((x) => {
          const ph = [...(job.brief?.photos || []), ...(job.brief?.videos || [])].find((p) => p.file === x.file);
          const vid = x.kind === "video";
          return (
            <div key={x.file} className="card" style={{ display: "grid", gap: ".5rem", padding: ".55rem .65rem", minWidth: 0 }}>
              <div style={{ display: "flex", gap: ".65rem", alignItems: "flex-start", minWidth: 0 }}>
                <span style={{ flex: "none", width: 72, height: 72, borderRadius: 10, overflow: "hidden", background: "var(--line)", display: "grid", placeItems: "center", color: "var(--muted)" }}>{ph ? (vid ? <video src={mediaUrl(ph.url)} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <img src={mediaUrl(ph.url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />) : x.preview ? <a href={x.preview} target="_blank" rel="noopener noreferrer" title={x.source === "pexels" || x.source === "unsplash" ? freeTx(x.source, "Foto van Pexels (gratis te gebruiken)") : tx("Voorbeeld (iStock, met watermerk)")} style={{ display: "block", width: "100%", height: "100%" }}><img src={x.preview} alt={x.title || ""} referrerPolicy="no-referrer" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></a> : <IconImage />}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: ".85rem", lineHeight: 1.3 }} title={x.alt || x.file}>{vid && <IconVideo />}{vid ? " " : ""}{x.alt || x.file}</strong>
                  <small className="muted" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={x.file}>{x.file}</small>
                  {x.istock ? (
                    <span style={{ display: "flex", alignItems: "center", gap: ".4rem", marginTop: 4, minWidth: 0 }}>
                      <span className="badge" style={{ flex: "none", fontVariantNumeric: "tabular-nums" }}>{srcLabel(x.source)} {x.istock}</span>
                      {x.title && <small className="muted" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={x.title}>{x.title}</small>}
                      <button type="button" className="btn sm" style={{ flex: "none", padding: "0 .4rem" }} onClick={() => saveNo(x, "")} aria-label={tx("Nummer wissen")} title={tx("Nummer wissen")}>×</button>
                    </span>
                  ) : (
                    <input defaultValue="" inputMode="numeric" maxLength={80} placeholder={tx("iStock-nummer")} aria-label={tx("iStock-nummer")} onBlur={(e) => saveNo(x, e.target.value.trim())} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} style={{ marginTop: 4, width: "100%", boxSizing: "border-box", padding: ".2rem .4rem", fontSize: ".8rem" }} />
                  )}
                </span>
                <button type="button" className="pb-panelx" disabled={!!busy} onClick={() => hide(x)} aria-label={tx("Uit de lijst halen")} title={tx("Uit de lijst halen")}>×</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: ".35rem" }}>
                {x.extra && <button type="button" className="btn sm primary" disabled={!!busy} onClick={() => place(x)} title={tx("Zet deze foto in het ontwerp: de AI plaatst hem op een passende plek")}>{tx("In ontwerp")}</button>}
                {(vid ? x.video : x.preview) && !x.done && !x.extra && <button type="button" className="btn sm primary" disabled={!!busy} onClick={() => usePreview(x)} title={x.source === "pexels" || x.source === "unsplash" ? freeTx(x.source, "Gebruik deze gratis foto van Pexels in het ontwerp") : tx("Download de voorbeeldfoto van iStock (met watermerk) en gebruik hem in het ontwerp")}>{busy === x.file ? tx("Bezig…") : vid ? tx("Gebruik video") : tx("Gebruik foto")}</button>}
                <a className="btn sm" href={x.download || x.url} target="_blank" rel="noopener noreferrer" title={x.download ? tx("Naar de foto op iStock om te downloaden") : tx("Zoeken op iStock")}>{x.download ? `${tx("Downloaden")} ↗` : <><IconSearch /> {tx("Zoeken")}</>}</a>
                {x.download && <a className="btn sm" href={x.url} target="_blank" rel="noopener noreferrer" title={tx("Zoeken op iStock")}><IconSearch /> {tx("Zoeken")}</a>}
                <label className="btn sm" style={{ cursor: busy ? "default" : "pointer", opacity: busy === x.file ? .6 : 1 }}>{x.done ? tx("Vervangen") : vid ? tx("Video kiezen") : tx("Foto kiezen")}<input type="file" accept={vid ? "video/mp4,video/webm" : "image/*"} style={{ display: "none" }} disabled={!!busy} onChange={(e) => { put(x, e.target.files?.[0]); e.target.value = ""; }} /></label>
                {x.done && <button type="button" className="btn sm danger" disabled={!!busy} onClick={() => clear(x)} aria-label={vid ? tx("Video verwijderen") : tx("Foto verwijderen")} title={vid ? tx("Video verwijderen") : tx("Foto verwijderen")}><IconTrash /></button>}
              </div>
            </div>
          );
        })}
      </div>
    </Fold>
  );
}

// The questions of the designer when the request was short: every question has answers to click (and a default), the customer answers all at once or lets the designer decide.
// The page layouts as small drawings (a row = a band, the blocks in it = its columns, a tinted row = a band with a soft background), in a carousel; drawn in the active colour of the design.
const LAYOUTS = [
  ["Volledige breedte", "Rustig en klassiek", [[[1]], [[1]], [[1]]]],
  ["Tekst naast afbeelding", "Beeld links en rechts afwisselend", [[[1, 1]], [[1, 1]], [[1, 1]]]],
  ["Breed met smalle zijkolom", "Tekst met een contact- of prijskaart", [[[2, 1]], [[1, 2]], [[2, 1]]]],
  ["Drie kolommen", "Diensten, voordelen of stappen", [[[1]], [[1, 1, 1]], [[1, 1, 1]]]],
  ["Vier blokken", "Feiten, cijfers of iconen", [[[1]], [[1, 1, 1, 1]], [[1]]]],
  ["Afwisselend ritme met gekleurde banden", "Brede, smalle en gekleurde banden door elkaar", [[[1]], [[1, 1], true], [[1, 1, 1]], [[2, 1], true]]],
  ["Volledig scherm opening", "De eerste band vult het hele scherm", [[[1], false, 2], [[1, 1]], [[1, 1, 1]]]],
];
const LAYOUT_DEFAULT = "Afwisselend ritme met gekleurde banden";
// A carousel with one card at a time inside the width of the side menu; the arrows (or swiping) go to the next card.
function Carousel({ accent, children, tag, active = -1, chosen = "" }) {
  const track = useRef(null);
  useEffect(() => { const t = track.current; if (t && active >= 0) t.scrollTo({ left: active * (t.clientWidth || 190), behavior: "auto" }); }, [active]);  // the chosen one is in view (also when the window is opened again)
  const go = (d) => track.current?.scrollBy({ left: d * (track.current.clientWidth || 190), behavior: "smooth" });
  const ac = accent || "var(--blue)";
  const arrow = (d) => <button type="button" onClick={() => go(d)} aria-label={d < 0 ? tx("Vorige") : tx("Volgende")} style={{ flex: "none", width: 30, height: 30, borderRadius: "50%", border: `1px solid ${ac}`, background: "var(--card)", color: ac, cursor: "pointer", display: "grid", placeItems: "center", padding: 0 }}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">{d < 0 ? <path d="M15 6l-6 6 6 6" /> : <path d="M9 6l6 6-6 6" />}</svg></button>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: ".35rem", flexWrap: "wrap" }} data-easy2edit-tag={tag}>
      {arrow(-1)}
      <div ref={track} style={{ display: "flex", gap: ".6rem", overflowX: "auto", scrollSnapType: "x mandatory", padding: ".2rem", flex: "1 1 0", width: 0, minWidth: 0, scrollbarWidth: "none" }}>{children}</div>
      {arrow(1)}
      {chosen !== null && <small role="status" style={{ flex: "0 0 100%", order: 9, textAlign: "center", color: chosen ? ac : "var(--muted)", fontWeight: chosen ? 600 : 400 }}>{chosen ? `${tx("Gekozen")}: ${chosen}` : tx("Nog niets gekozen")}</small>}
    </div>
  );
}
const tick = (ac) => <span aria-hidden="true" style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: "50%", background: ac, color: "#fff", display: "grid", placeItems: "center" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>;
const cardStyle = (on, ac) => ({ flex: "0 0 100%", boxSizing: "border-box", scrollSnapAlign: "start", scrollSnapStop: "always", display: "grid", gap: ".4rem", textAlign: "left", padding: ".5rem", borderRadius: 12, cursor: "pointer", font: "inherit", color: "inherit", border: `2px solid ${on ? ac : "var(--line)"}`, background: on ? `color-mix(in srgb, ${ac} 10%, var(--card))` : "var(--card)", boxShadow: on ? `0 4px 14px color-mix(in srgb, ${ac} 28%, transparent)` : "none", position: "relative" });

function LayoutCarousel({ value, onToggle, disabled, accent }) {
  const ac = accent || "var(--blue)";
  return (
    <Carousel accent={accent} tag="ui-layout-carousel" active={LAYOUTS.findIndex(([n]) => value.includes(n))} chosen={LAYOUTS.filter(([n]) => value.includes(n)).map(([n]) => tx(n)).join(", ")}>
      {LAYOUTS.map(([name, desc, rows]) => { const on = value.includes(name); return (
        <button key={name} type="button" disabled={disabled} aria-pressed={on} onClick={() => onToggle(name)} title={tx(desc)} style={cardStyle(on, ac)}>
          {on && tick(ac)}
          <span aria-hidden="true" style={{ display: "grid", gap: 3, padding: 5, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, height: 110, gridTemplateRows: rows.map((r) => `${r[2] || 1}fr`).join(" ") }}>
            {rows.map((r, i) => <span key={i} style={{ display: "grid", gap: 3, gridTemplateColumns: r[0].map((f) => `${f}fr`).join(" "), padding: r[1] ? 3 : 0, background: r[1] ? `color-mix(in srgb, ${ac} 16%, transparent)` : "transparent", borderRadius: 4 }}>{r[0].map((_, j) => <i key={j} style={{ display: "block", borderRadius: 3, background: ac, opacity: j % 2 && r[0].length === 2 ? .45 : .8 }} />)}</span>)}
          </span>
          <strong style={{ fontSize: ".8rem", lineHeight: 1.2 }}>{tx(name)}</strong>
          <small className="muted" style={{ lineHeight: 1.25 }}>{tx(desc)}</small>
        </button>); })}
    </Carousel>
  );
}

// The colour themes of the system (Thema's), as a carousel of small page drawings in the colours of each theme; one is chosen, the colours go to the AI with the answer.
function themeAnswer(t) { const c = t.colors || {}; return `${tx("Thema")} ${t.name} (${tx("hoofdkleur")} ${c.primary}, ${tx("tweede kleur")} ${c.secondary}, ${tx("achtergrond")} ${c.light_bg}, ${tx("kaarten")} ${c.light_card}, ${tx("tekst")} ${c.light_text})`; }
const sameTheme = (t, v) => !!v && (v === themeAnswer(t) || (String(v).includes(` ${t.name} (`) && String(v).includes(String(t.colors?.primary || "\u0000"))));  // also when the answer was made in another language
function ThemeCarousel({ themes, value, onPick, disabled, jobId, onJob, onChanged }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [list, setList] = useState(themes);
  useEffect(() => setList(themes), [themes]);
  // choosing: the theme is installed when it is not yet, the colours of the design change at once, and the theme that an earlier choice installed is removed
  const choose = async (t, on) => {
    if (on) { onPick(""); return; }
    onPick(themeAnswer(t));
    if (!jobId) return;
    setBusy(t.key); setErr("");
    try {
      const j = await api(`/sitecreator/${jobId}/theme-apply/`, { method: "POST", body: { key: t.key } });
      onJob?.(j);
      await onChanged?.();  // the pages get the new colours at once
      const d = await api("/sitecreator/theme-library/"); setList((d.themes || []).filter((x) => x.colors?.primary));
    } catch (e) { setErr(errorText(e)); } finally { setBusy(""); }
  };
  return (
    <>
    <Carousel accent={value ? list.find((t) => sameTheme(t, value))?.colors?.primary : undefined} tag="ui-theme-carousel" active={list.findIndex((t) => sameTheme(t, value))} chosen={list.find((t) => sameTheme(t, value))?.name || ""}>
      {list.map((t) => { const c = t.colors || {}, on = sameTheme(t, value), ac = c.primary; return (
        <button key={t.key} type="button" disabled={disabled || !!busy} aria-pressed={on} onClick={() => choose(t, on)} title={t.description} style={cardStyle(on, ac)}>
          {on && tick(ac)}
          <span aria-hidden="true" style={{ display: "grid", gap: 4, padding: 6, background: c.light_bg, border: "1px solid var(--line)", borderRadius: 8, height: 110, gridTemplateRows: "auto 1fr auto", boxSizing: "border-box" }}>
            <span style={{ display: "flex", gap: 4, alignItems: "center" }}><i style={{ width: 22, height: 6, borderRadius: 3, background: c.light_text, opacity: .8 }} /><i style={{ marginLeft: "auto", width: 26, height: 10, borderRadius: 5, background: c.primary }} /></span>
            <span style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <i style={{ borderRadius: 5, background: c.light_card, border: `1px solid color-mix(in srgb, ${c.light_text} 14%, transparent)` }} />
              <i style={{ borderRadius: 5, background: c.primary, opacity: .9 }} />
            </span>
            <span style={{ display: "flex", gap: 4, alignItems: "center" }}><i style={{ width: 16, height: 6, borderRadius: 3, background: c.secondary }} /><i style={{ width: 34, height: 5, borderRadius: 3, background: c.light_text, opacity: .35 }} /><i style={{ marginLeft: "auto", width: 12, height: 12, borderRadius: "50%", background: c.dark_bg }} /></span>
          </span>
          <strong style={{ fontSize: ".8rem", lineHeight: 1.2 }}>{t.name}{busy === t.key && <small className="muted"> · {tx("Installeren…")}</small>}</strong>
          <small className="muted" style={{ lineHeight: 1.25 }}>{t.description}{!t.installed && !on ? ` · ${tx("wordt geïnstalleerd als je hem kiest")}` : ""}</small>
        </button>); })}
    </Carousel>
    {err && <div className="alert">{err}</div>}
    </>
  );
}

// A drop zone (drag and drop, or click to choose) for the customer's own logo, photos or videos: the files go to the media library and into the project; the designer uses them.
function DropZone({ jobId, onJob, role, accept, multiple, label, hint, disabled, onText }) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState([]);  // [{file, url, video}]
  const [err, setErr] = useState("");
  const input = useRef(null);
  const take = async (list) => {
    const files = [...list].filter((f) => (role === "logo" ? f.type.startsWith("image/") : f.type.startsWith("image/") || f.type.startsWith("video/")));
    if (!files.length) { setErr(role === "logo" ? tx("Kies een afbeelding (png, jpg, webp of svg).") : tx("Kies foto's (jpg, png, webp) of video's (mp4, webm).")); return; }
    setBusy(true); setErr("");
    try {
      let next = role === "logo" ? [] : [...done];
      for (const f of (role === "logo" ? files.slice(0, 1) : files)) {
        const fd = new FormData(); fd.append("files", f); fd.append("tags", "design");
        const r = await apiUpload("/media/upload/", fd, () => {});
        if (!r.items?.length) throw new Error((r.errors || []).join(" ") || tx("Uploaden is niet gelukt."));
        const j = await api(`/sitecreator/${jobId}/own-media/`, { method: "POST", body: { media: r.items[0].id, role } });
        onJob?.(j);
        const all = [...(j.brief?.photos || []), ...(j.brief?.videos || [])];
        const it = all.find((p) => p.id === r.items[0].id);
        if (it) next = [...next.filter((x) => x.file !== it.file), { file: it.file, url: it.url, video: f.type.startsWith("video/") }];
      }
      setDone(next);
      onText?.(next.length ? `${role === "logo" ? tx("Mijn logo is geüpload") : tx("Eigen bestanden geüpload")} (${tx("in het project gezet")}): ${next.map((x) => x.file).join(", ")}.` : "");
    } catch (x) { setErr(errorText(x)); } finally { setBusy(false); }
  };
  const drop = (e) => { e.preventDefault(); setOver(false); if (!disabled && !busy) take(e.dataTransfer.files); };
  const remove = async (x) => { try { onJob?.(await api(`/sitecreator/${jobId}/own-media/`, { method: "DELETE", body: { file: x.file } })); const next = done.filter((y) => y.file !== x.file); setDone(next); onText?.(next.length ? `${tx("Eigen bestanden geüpload")}: ${next.map((y) => y.file).join(", ")}.` : ""); } catch (e) { setErr(errorText(e)); } };
  return (
    <div style={{ display: "grid", gap: ".4rem" }} data-easy2edit-tag="ui-dropzone">
      <div role="button" tabIndex={0} aria-label={label} onClick={() => !disabled && !busy && input.current?.click()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}
        style={{ display: "grid", justifyItems: "center", gap: ".25rem", padding: "1rem .8rem", textAlign: "center", borderRadius: 12, cursor: disabled || busy ? "default" : "pointer", border: `2px dashed ${over ? "var(--blue)" : "var(--line)"}`, background: over ? "color-mix(in srgb, var(--blue) 10%, var(--card))" : "var(--bg)", transition: "all .15s" }}>
        <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: over ? "var(--blue)" : "var(--muted)" }}><path d="M12 16V5" /><path d="M7.5 9.5L12 5l4.5 4.5" /><path d="M5 19h14" /></svg>
        <strong style={{ fontSize: ".85rem" }}>{busy ? tx("Bezig met uploaden…") : label}</strong>
        <small className="muted">{hint}</small>
        <input ref={input} type="file" accept={accept} multiple={!!multiple} style={{ display: "none" }} onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
      </div>
      {err && <div className="alert">{err}</div>}
      {done.length > 0 && <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>{done.map((x) => (
        <span key={x.file} style={{ position: "relative" }}>
          <span style={{ display: "grid", placeItems: "center", width: role === "logo" ? 96 : 58, height: 58, borderRadius: 8, overflow: "hidden", background: "var(--line)", border: "1px solid var(--line)" }}>{x.video ? <video src={mediaUrl(x.url)} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <img src={mediaUrl(x.url)} alt={x.file} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: role === "logo" ? "contain" : "cover" }} />}</span>
          <button type="button" className="pb-panelx" onClick={() => remove(x)} aria-label={tx("Weghalen")} style={{ position: "absolute", top: -6, right: -6 }}>×</button>
        </span>))}</div>}
    </div>
  );
}

// The question about photos and videos: search them on iStock and choose; a chosen one goes into the project at once (the list of photos and videos) and into the answer, so the designer uses it.
function MediaPicker({ jobId, onJob, defaultQuery, disabled, onAnswer, topic, picked, onAsk }) {
  const memo = (() => { try { return JSON.parse(localStorage.getItem(`siPick:${jobId}`) || "null") || {}; } catch { return {}; } })();  // the last search is kept per design (only a convenience of this browser)
  const [q, setQ] = useState(memo.q || defaultQuery || "");
  const [kind, setKind] = useState(memo.kind || "photo");
  const [source, setSource, srcName] = useSource();
  const [found, setFound] = useState(Array.isArray(memo.found) ? memo.found : null);
  useEffect(() => { try { localStorage.setItem(`siPick:${jobId}`, JSON.stringify({ q, kind, found: (found || []).slice(0, 40) })); } catch {} }, [q, kind, found, jobId]);
  const [searching, setSearching] = useState(false);
  const pickedList = Object.entries(picked || {}).filter(([, it]) => it && it.id);  // what is in the list of the design (kept on the server): the source of the selection
  const chosen = pickedList.map(([, it]) => ({ id: it.id, src: srcLabel(it.source), title: String(it.title || "").slice(0, 80), kind: it.video ? "video" : "photo" }));
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const run = async (query, k) => {
    if ((query || "").trim().length < 2) return;
    setSearching(true); setErr(""); setFound(null);
    try { setFound((await api(`/sitecreator/${jobId}/istock-search/?q=${encodeURIComponent(query.trim())}&kind=${k}&source=${source}`)).items || []); } catch (x) { setErr(errorText(x)); } finally { setSearching(false); }
  };
  useEffect(() => { onAnswer(text(chosen)); }, [chosen.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if ((defaultQuery || "").trim().length >= 2) run(defaultQuery, "photo"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // what the customer filled in about the company: the AI suggests search words for fitting pictures; the first one is filled in and searched, the others are buttons
  const [terms, setTerms] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const typed = useRef(false);
  useEffect(() => {  // the customer left the field about the company and said yes: the AI suggests words and the search starts
    if (!topic?.go) return;
    let alive = true;
    (async () => {
      setSuggesting(true);
      try {
        const r = await api(`/sitecreator/${jobId}/search-terms/`, { method: "POST", body: { name: topic.name || "", what: topic.what || "", kind, source } });
        const list = r.terms || []; if (!alive) return; setTerms(list);
        if (list.length && !typed.current) { setQ(list[0]); run(list[0], kind); }
      } catch { /* quiet: the search field simply stays as it is */ } finally { if (alive) setSuggesting(false); }
    })();
    return () => { alive = false; };
  }, [topic?.go]); // eslint-disable-line react-hooks/exhaustive-deps
  const text = (list) => list.length ? `${tx("Gekozen")} (${tx("in mijn lijst gezet")}): ` + list.map((c) => `${c.src} ${c.id}${c.title ? ` "${c.title}"` : ""}${c.kind === "video" ? ` (${tx("video")})` : ""}`).join(", ") : "";
  const unpick = async (file) => { setBusy(file); setErr(""); try { onJob?.(await api(`/sitecreator/${jobId}/slot/`, { method: "DELETE", body: { file } })); } catch (x) { setErr(errorText(x)); } finally { setBusy(""); } };
  // pictures were found: "Alles selecteren?" (once per search); yes puts every picture that is not chosen yet in the list, one after the other
  const [askAll, setAskAll] = useState(true);
  useEffect(() => { setAskAll(true); }, [found]);
  const left = (found || []).filter((it) => !chosen.some((c) => c.id === it.id && c.src === srcLabel(it.source)));
  const chooseAll = async () => {
    setAskAll(false); setErr("");
    for (const it of left) {
      setBusy(it.id);
      try { onJob?.(await api(`/sitecreator/${jobId}/slot/`, { method: "POST", body: { add: it } })); } catch (x) { setErr(errorText(x)); break; }
    }
    setBusy("");
  };
  const choose = async (it) => {
    if (chosen.some((c) => c.id === it.id && c.src === (srcLabel(it.source)))) return;
    setBusy(it.id); setErr("");
    try {
      onJob?.(await api(`/sitecreator/${jobId}/slot/`, { method: "POST", body: { add: it } }));

    } catch (x) { setErr(errorText(x)); } finally { setBusy(""); }
  };
  return (
    <div style={{ display: "grid", gap: ".5rem" }} data-easy2edit-tag="ui-media-picker">
      <form onSubmit={(e) => { e.preventDefault(); run(q, kind); }} role="search" style={{ display: "grid", gap: ".35rem" }}>
        <div style={{ display: "flex", gap: ".35rem", alignItems: "center" }}>
        <input type="search" value={q} maxLength={120} disabled={disabled} onChange={(e) => { typed.current = true; setQ(e.target.value); }} placeholder={`${tx("Zoek foto's of video's op")} ${srcName}…`} aria-label={`${tx("Zoek een foto of video op")} ${srcName}`} style={{ flex: "1 1 0", minWidth: 0, width: 0 }} />
        {q.trim().length < 2 && onAsk
          ? <button type="button" className="btn sm primary" disabled={disabled || suggesting} onClick={async () => { setErr(""); if ((await onAsk()) === false) setErr(tx("Vul eerst de omschrijving van je bedrijf in.")); }}><IconSearch /> {suggesting ? tx("Bezig…") : tx("Zoeken")}</button>
          : <button className="btn sm primary" disabled={disabled || searching || q.trim().length < 2}><IconSearch /> {searching ? tx("Bezig…") : tx("Zoeken")}</button>}
        </div>
        <div style={{ display: "flex", gap: ".35rem" }}>
          <SourceSelect value={source} onChange={(v) => { setSource(v); setFound(null); }} style={{ flex: 1, minWidth: 0 }} />
          <select value={kind} onChange={(e) => { setKind(e.target.value); setFound(null); }} aria-label={tx("Soort")} style={{ flex: 1, minWidth: 0 }}><option value="photo">{tx("Foto's")}</option><option value="video">{tx("Video's")}</option></select>
        </div>
      </form>
      {!found && !searching && !suggesting && !terms.length && !pickedList.length && onAsk && (
        <button type="button" disabled={disabled} onClick={async () => { setErr(""); if ((await onAsk()) === false) setErr(tx("Vul eerst de omschrijving van je bedrijf in.")); }}
          style={{ display: "grid", justifyItems: "center", gap: ".35rem", padding: "1rem .6rem", borderRadius: 10, border: "1px dashed var(--line)", background: "var(--card)", color: "inherit", cursor: "pointer", font: "inherit" }}>
          <span style={{ width: 34, height: 34, display: "grid", placeItems: "center", color: "var(--blue)" }}><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg></span>
          <small className="muted">{tx("Nog geen foto's. Klik om passende foto's en video's te zoeken bij je bedrijf.")}</small>
        </button>
      )}
      {(terms.length > 0 || suggesting) && <div style={{ display: "flex", gap: ".3rem", flexWrap: "wrap", alignItems: "center" }}>
        <small className="muted">{suggesting ? tx("De AI bedenkt zoekwoorden…") : tx("Voorstel van de AI")}:</small>
        {terms.map((t) => <button key={t} type="button" disabled={disabled} onClick={() => { typed.current = true; setQ(t); run(t, kind); }} style={{ padding: ".15rem .6rem", borderRadius: 999, border: `1px solid ${q === t ? "var(--blue)" : "var(--line)"}`, background: q === t ? "color-mix(in srgb, var(--blue) 14%, var(--card))" : "var(--card)", color: "inherit", cursor: "pointer", font: "inherit", fontSize: ".8rem" }}>{t}</button>)}
      </div>}
      {err && <div className="alert">{err}</div>}
      {found && !found.length && <small className="muted">{tx("Niets gevonden. Probeer een ander zoekwoord (Engels werkt het best).")}</small>}
      {found && left.length > 1 && askAll && !disabled && (
        <div className="row" style={{ gap: ".5rem", flexWrap: "wrap", alignItems: "center" }} role="group" aria-label={tx("Alles selecteren?")}>
          <strong>{tx("Alles selecteren?")}</strong> <small className="muted">{left.length} {tx("gevonden")}</small>
          <button type="button" className="btn sm primary" disabled={!!busy} onClick={chooseAll}>{tx("Ja, alles selecteren")}</button>
          <button type="button" className="btn sm" disabled={!!busy} onClick={() => setAskAll(false)}>{tx("Nee, ik kies zelf")}</button>
        </div>
      )}
      {found && found.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: ".4rem" }}>
          {found.map((it) => { const on = chosen.some((c) => c.id === it.id && c.src === (srcLabel(it.source))); return (
            <button key={it.id} type="button" disabled={disabled || !!busy || on} aria-pressed={on} onClick={() => choose(it)} title={it.title} style={{ position: "relative", padding: 0, borderRadius: 10, overflow: "hidden", aspectRatio: "1", cursor: on ? "default" : "pointer", background: "var(--line)", border: `2px solid ${on ? "var(--blue)" : "var(--line)"}` }}>
              {it.preview && <img src={it.preview} alt={it.title || ""} referrerPolicy="no-referrer" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: busy === it.id ? .5 : 1 }} />}
              {on && tick("var(--blue)")}
              <small style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "1px 4px", background: "rgba(0,0,0,.55)", color: "#fff", fontSize: ".66rem", textAlign: "left" }}>{busy === it.id ? tx("Bezig…") : `${srcLabel(it.source)} ${it.id}`}</small>
            </button>); })}
        </div>
      )}
      {pickedList.length > 0 && <div style={{ display: "flex", gap: ".35rem", flexWrap: "wrap" }} data-easy2edit-tag="ui-media-picked" aria-label={tx("Gekozen")}>
        {pickedList.map(([file, it]) => (
          <span key={file} style={{ position: "relative", width: 52, height: 52, borderRadius: 8, overflow: "hidden", background: "var(--line)", border: "2px solid var(--blue)", opacity: busy === file ? .5 : 1 }} title={it.title || `${srcLabel(it.source)} ${it.id}`}>
            {(it.preview || it.video) && <img src={it.preview || it.video} alt={it.title || ""} referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            <button type="button" disabled={disabled || !!busy} onClick={() => unpick(file)} className="pb-panelx" aria-label={tx("Weghalen")} style={{ position: "absolute", top: 1, right: 1, width: 16, height: 16, minWidth: 0, fontSize: ".7rem", lineHeight: 1, padding: 0 }}>×</button>
          </span>))}
      </div>}
      {chosen.length > 0 && <small className="muted" role="status">{chosen.length} {tx("gekozen: ze staan in je lijst Foto's en video's en gaan mee met je antwoord.")}</small>}
    </div>
  );
}

function QuestionForm({ questions: first, onSend, disabled, accent, jobId, onJob, onChanged, queryHint, firstRound, saved, onSave, picked, colors, mode }) {
  // the first questionnaire always has a question for the logo and one for photos and videos (own files and iStock), also when the AI did not think of them: two separate drop zones
  const given = [...first];
  const isName = (q) => /^(name|naam|company_?name|business_?name|bedrijfs_?naam|brand)$/i.test(q.id || "");
  const isUrl = (q) => /^(url|website|site_?url|website_?url|web_?address|adres|domain|domein)$/i.test(q.id || "");
  if (jobId && firstRound && first.length >= 3) {  // a questionnaire always starts with the company name and the address of the current website
    if (!given.some(isName)) given.unshift({ id: "name", q: tx("Wat is de naam van het bedrijf of de organisatie?"), type: "text", options: [] });
    if (!given.some(isUrl)) given.splice(1, 0, { id: "url", q: tx("Wat is het adres (url) van je huidige website? Laat leeg als je die nog niet hebt."), type: "text", options: [] });
  }
  const hasColors = (q) => /colou?r|kleur|palet|theme|thema/i.test(q.id || "") && !/mode|scheme|light|dark|licht|donker|modus|display|weergave/i.test(q.id || "");
  if (jobId && firstRound && given.length >= 3 && !given.some(hasColors)) {  // the choice of the colour theme is always asked, also when the AI did not think of it
    const at = given.findIndex((q) => /layout|indeling/i.test(q.id || ""));
    const cq = { id: "colors", q: tx("Welke kleuren passen bij je bedrijf?"), type: "text", options: [] };
    if (at >= 0) given.splice(at, 0, cq); else given.push(cq);
  }
  given.sort((x, y) => (isName(y) ? 1 : 0) - (isName(x) ? 1 : 0) || (isUrl(y) ? 1 : 0) - (isUrl(x) ? 1 : 0));  // name first, then the url
  if (jobId && firstRound && given.length >= 3) {
    if (!given.some((q) => /logo/i.test(q.id || ""))) given.push({ id: "logo", q: tx("Heb je een logo dat ik moet gebruiken?"), type: "text", options: [] });
    if (!given.some((q) => /media|photo|foto|image|afbeeld|video|istock|beeld/i.test(q.id || "") && !/logo/i.test(q.id || ""))) given.push({ id: "media", q: tx("Wil je foto's of video's gebruiken? Zoek ze op iStock of sleep je eigen bestanden erin."), type: "text", options: [] });
  }
  const isMedia = (q) => /media|photo|foto|image|afbeeld|video|istock|beeld/i.test(q.id || "") && !!jobId;  // photos and videos are searched and chosen on iStock
  const rank = (q) => (/layout|indeling/i.test(q.id || "") ? 1 : 0);
  const questions = [...given].sort((x, y) => (/width|breedte/i.test(y.id || "") && rank(x) ? 1 : 0) - (/width|breedte/i.test(x.id || "") && rank(y) ? 1 : 0));  // the maximum width always comes before the page layout
  const isLayout = (q) => /layout|indeling/i.test(q.id || "");  // the question about the page layout is answered in the carousel of pictures
  const init = () => Object.fromEntries(questions.map((q) => [q.id, isLayout(q) ? [LAYOUT_DEFAULT] : q.type === "multi" ? (Array.isArray(q.default) ? q.default : []) : (typeof q.default === "string" ? q.default : "")]));
  const [ans, setAns] = useState(() => { const d = init(); const sv = saved?.ans || {}; if (typeof sv.page_bg === "string") d.page_bg = sv.page_bg; if (typeof sv.front_bg === "string") d.front_bg = sv.front_bg; Object.keys(d).forEach((k) => { if (sv[k] !== undefined && sv[k] !== null && (Array.isArray(sv[k]) === Array.isArray(d[k]))) d[k] = sv[k]; }); return d; });
  const [own, setOwn] = useState(saved?.own || {});
  const saveT = useRef(null);
  const bgT = useRef(null);
  const first1 = useRef(true);
  const pend = useRef(null);  // the last change that is not sent to the server yet
  const saveFn = useRef(onSave);
  saveFn.current = onSave;
  useEffect(() => { if (first1.current) { first1.current = false; return undefined; } pend.current = [ans, own]; clearTimeout(saveT.current); saveT.current = setTimeout(() => { const v = pend.current; pend.current = null; if (v) saveFn.current?.(v[0], v[1]); }, 500); return undefined; }, [ans, own]);
  useEffect(() => () => { clearTimeout(saveT.current); const v = pend.current; pend.current = null; if (v) saveFn.current?.(v[0], v[1]); }, []);  // the window is closed (or the form goes away) before the pause was over: save what was filled in now  // what the customer dropped in a drop zone, per question: goes with the answer
  const isLogo = (q) => /logo/i.test(q.id || "") && !!jobId;
  const looksColors = (q) => /colou?r|kleur|palet|theme|thema/i.test(q.id || "") && !/mode|scheme|light|dark|licht|donker|modus|display|weergave/i.test(q.id || "");  // not "color_mode" (light or dark)
  const colorQ = [...questions].reverse().find(looksColors);  // only ONE carousel of colour themes: at the last colour question
  const isColors = (q) => q === colorQ;
  const [themes, setThemes] = useState([]);
  useEffect(() => { if (questions.some(isColors)) api("/sitecreator/theme-library/").then((d) => setThemes((d.themes || []).filter((t) => t.colors?.primary))).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (id, v) => setAns((a) => ({ ...a, [id]: v }));
  const ONE = "One pager (alles op één pagina)";
  const isPages = (q) => /page|pagina/i.test(q.id || "") && !/layout|indeling/i.test(q.id || "") && q.type === "multi";
  const optsOf = (q) => (isPages(q) && !q.options.some((o) => /one.?pager|één pagina|een pagina/i.test(o)) ? [ONE, ...q.options] : q.options);  // the pages question always offers a one pager
  const toggle = (q, o) => {
    const one = (x) => /one.?pager/i.test(x);
    const cur = ans[q.id];
    if (!isPages(q)) return set(q.id, cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]);
    if (one(o)) return set(q.id, cur.includes(o) ? [] : [o]);  // a one pager excludes the other pages
    set(q.id, cur.includes(o) ? cur.filter((x) => x !== o) : [...cur.filter((x) => !one(x)), o]);
  };
  const nameQ = questions.find(isName);
  const [go, setGo] = useState({ n: 0, name: "", what: "" });  // started when the customer leaves the field about the company and wants the photo search
  const asked = useRef("");
  const bizQ = questions.find((q) => q.type === "text" && !isName(q) && !isUrl(q) && !/logo|media|photo|foto|video|istock|extra|other|overig|opmerking|contact|goal|doel/i.test(q.id || "")) || null;  // "what kind of company is it and what do you offer": the first free text question
  const needName = !!nameQ && !String(ans[nameQ.id] || "").trim();
  const needColors = !!colorQ && themes.length > 0 && !String(ans[colorQ.id] || "").trim();  // the colour theme is needed too  // the name is the one thing that is needed
  const [, setSource] = useSource();
  const askPhotos = async (given) => {  // the same question as after the description of the company: shall the AI think of search words and search? The customer chooses where. (false = there is no description yet)
    const what = String(given || (bizQ ? ans[bizQ.id] : "") || "").trim();
    if (what.length < 8) return false;
    await loadFree();  // which free sources are active: never offer one that is not linked
    const now = sourceNow(), opts = [...freeList().map((k) => ({ value: k, label: srcLabel(k), hint: k === "unsplash" ? freeTx(k, "Foto van Pexels (gratis te gebruiken)") : tx("Gratis foto's en video's, direct te gebruiken") })), { value: "istock", label: "iStock", hint: tx("Betaald, je downloadt zelf met een licentie") }];
    const where = await confirmDialog(tx("Zal ik alvast foto's en video's zoeken die bij je bedrijf passen? De AI bedenkt zoekwoorden en je ziet de resultaten bij de vraag over foto's en video's. Kies waar ik zoek."), { title: tx("Foto's alvast zoeken"), okLabel: tx("Ja, zoek maar"), choices: [...opts].sort((a, b) => (a.value === now ? -1 : b.value === now ? 1 : 0)) });
    if (where) { setSource(where); setGo((g) => ({ n: g.n + 1, name: nameQ ? String(ans[nameQ.id] || "") : "", what })); }
    return true;
  };
  const [filling, setFilling] = useState("");
  const [fakeErr, setFakeErr] = useState("");
  const fake = async (q) => {  // "@" and Enter in a field: the AI invents fictional data for this question
    if (!jobId || filling) return;
    setFilling(q.id); setFakeErr("");
    try {
      const r = await api(`/sitecreator/${jobId}/fictional/`, { method: "POST", body: { question: q.q, name: nameQ ? String(ans[nameQ.id] || "") : "", what: bizQ ? String(ans[bizQ.id] || "") : "", lang: getLanguage() } });
      set(q.id, r.text || "");
    } catch (e) { setFakeErr(errorText(e)); } finally { setFilling(""); }
  };
  const atEnter = (q) => (e) => { if (e.key === "Enter" && String(e.currentTarget.value || "").trim() === "@") { e.preventDefault(); fake(q); } };
  const [bgOpen, setBgOpen] = useState("");  // "page" | "front" | "": which colour the popup chooses
  const modeDark = (mode || "light") === "dark";
  const lum = (h) => { const c = String(h || "#fff").replace("#", ""); const f = c.length === 3 ? c.replace(/./g, "$&$&") : c; const n = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255).map((v) => (v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)); return .2126 * n[0] + .7152 * n[1] + .0722 * n[2]; };
  const ink = (v) => (lum(v) < .4 ? "#f4f6fa" : "#1f2937");
  // two colours: the BACKGROUND (the page behind everything) and the FRONTEND (the background of the heroes, blocks and content). Rule: in the light mode the background is a dark colour of the theme and the frontend a light one; in the dark mode the other way round.
  const KEY = { page: modeDark ? "dpage" : "page", front: modeDark ? "dbg" : "bg" };
  const shown = { page: colors?.[KEY.page] || colors?.[modeDark ? "dbg" : "bg"] || "#ffffff", front: colors?.[KEY.front] || "#ffffff" };
  const patchOf = (target, v) => (target === "page" ? { [KEY.page]: v } : { [KEY.front]: v, [modeDark ? "dtext" : "text"]: ink(v) });  // the text colour follows the frontend colour so it stays readable
  const sendColors = (patch) => { if (jobId) api(`/sitecreator/${jobId}/`, { method: "PATCH", body: { colors: { ...(colors || {}), ...patch } } }).then(() => onChanged?.()).catch(() => {}); };
  const pickColor = (target, v, close = true) => { set(target === "page" ? "page_bg" : "front_bg", v); if (close) setBgOpen(""); sendColors(patchOf(target, v)); };
  const chosenTheme = themes.find((t) => sameTheme(t, ans[colorQ?.id])) || null;
  const choicesFor = (target) => {  // the colours of the chosen theme: for the background the opposite of the mode first, for the frontend the colour of the mode first
    const c = chosenTheme?.colors || {};
    const light = [[c.light_bg, "Licht"], [c.light_card, "Kaart (licht)"]], dark = [[c.dark_bg, "Donker"], [c.dark_card, "Kaart (donker)"], [c.dark_text, "Tekst (licht)"]];
    const brand = [[c.primary, "hoofdkleur"], [c.secondary, "tweede kleur"]];
    const wantDark = target === "page" ? !modeDark : modeDark;
    return (wantDark ? [...dark, ...light, ...brand] : [...light, ...dark, ...brand]).filter(([v]) => /^#[0-9a-f]{3,8}$/i.test(String(v || "")));
  };
  const bgDone = useRef(new Set());  // themes whose default colours were already put on the design
  useEffect(() => {  // a theme is chosen (its colours are on the design now): the default background and frontend colour of that theme are put on the design
    const t = chosenTheme;
    if (!t || ans.page_bg || ans.front_bg || bgDone.current.has(t.key) || !colors?.primary || String(colors.primary).toLowerCase() !== String(t.colors?.primary || "").toLowerCase()) return;
    const pc = choicesFor("page")[0]?.[0], fc = choicesFor("front")[0]?.[0];
    if (!pc || !fc) return;
    bgDone.current.add(t.key);
    set("page_bg", pc); set("front_bg", fc);
    sendColors({ ...patchOf("page", pc), ...patchOf("front", fc) });
  }, [chosenTheme?.key, colors?.primary]); // eslint-disable-line react-hooks/exhaustive-deps
  const compose = () => questions.map((q) => { const a = ans[q.id]; const o = own[q.id] ? ` ${own[q.id]}` : ""; const v = Array.isArray(a) ? (a.length ? a.join(", ") : tx("geen")) : (a || (o ? "" : tx("beslis zelf"))); return `${q.q} ${v}${o}`; }).join("\n") + (ans.page_bg ? `\n${tx("Achtergrondkleur van de pagina")}: ${ans.page_bg}` : "") + (ans.front_bg ? `\n${tx("Frontendkleur (hero, blokken en inhoud)")}: ${ans.front_bg}` : "");
  const chip = (on) => ({ padding: ".25rem .7rem", borderRadius: 999, border: `1px solid ${on ? "var(--blue)" : "var(--line)"}`, background: on ? "color-mix(in srgb, var(--blue) 16%, var(--card))" : "var(--card)", color: "inherit", cursor: "pointer", font: "inherit", fontSize: ".85rem" });
  return (
    <div style={{ display: "grid", gap: ".7rem", marginTop: ".7rem", paddingTop: ".6rem", borderTop: "1px dashed var(--line)", whiteSpace: "normal" }}>
      {questions.map((q) => (
        <div key={q.id} style={{ display: "grid", gap: ".3rem" }}>
          <strong style={{ fontSize: ".88rem" }}>{q.q}</strong>
          {isLogo(q) ? <><DropZone jobId={jobId} onJob={onJob} role="logo" accept="image/*" label={tx("Sleep je logo hierheen")} hint={tx("of klik om een bestand te kiezen (png, jpg, webp of svg)")} disabled={disabled} onText={(t) => setOwn((o) => ({ ...o, [q.id]: t }))} />
            <input value={ans[q.id]} maxLength={300} disabled={disabled || filling === q.id} onKeyDown={atEnter(q)} onChange={(e) => set(q.id, e.target.value)} placeholder={filling === q.id ? tx("Bezig…") : tx("Of typ de bedrijfsnaam zoals die in de header moet staan")} /></>
          : isMedia(q) ? <><MediaPicker jobId={jobId} picked={picked} onAsk={() => askPhotos()} onJob={onJob} disabled={disabled} defaultQuery={queryHint} topic={{ name: go.name, what: go.what, go: go.n }} onAnswer={(t) => set(q.id, t)} />
            <DropZone jobId={jobId} onJob={onJob} role="media" multiple accept="image/*,video/mp4,video/webm" label={tx("Sleep je eigen foto's of video's hierheen")} hint={tx("of klik om bestanden te kiezen (jpg, png, webp, mp4, webm)")} disabled={disabled} onText={(t) => setOwn((o) => ({ ...o, [q.id]: t }))} /></>
          : isColors(q) && themes.length ? <><ThemeCarousel themes={themes} value={ans[q.id] || ""} disabled={disabled} jobId={jobId} onJob={onJob} onChanged={onChanged} onPick={(v) => { set(q.id, v); set("page_bg", ""); }} />
              {[["page", "Achtergrondkleur van de pagina"], ["front", "Frontendkleur (hero, blokken en inhoud)"]].map(([t, l]) => (
                <button key={t} type="button" disabled={disabled} onClick={() => setBgOpen(t)} data-easy2edit-tag="ui-page-bg" title={tx(l)}
                  style={{ display: "flex", alignItems: "center", gap: ".7rem", width: "100%", boxSizing: "border-box", padding: ".5rem .7rem", marginTop: ".2rem", borderRadius: 10, border: "1px solid var(--line)", background: "var(--card)", color: "inherit", cursor: "pointer", font: "inherit", textAlign: "left" }}>
                  <i style={{ width: 44, height: 28, borderRadius: 6, border: "1px solid var(--line)", background: ans[t === "page" ? "page_bg" : "front_bg"] || shown[t], flex: "none" }} />
                  <span style={{ flex: 1, minWidth: 0 }}>{tx(l)}: <b>{ans[t === "page" ? "page_bg" : "front_bg"] || shown[t]}</b></span>
                  <small className="muted">{tx("Kiezen")}</small>
                </button>))}</>
          : isLayout(q) ? <LayoutCarousel value={ans[q.id]} disabled={disabled} accent={accent} onToggle={(n) => set(q.id, ans[q.id].includes(n) ? ans[q.id].filter((x) => x !== n) : [...ans[q.id], n])} />
          : q.type === "text"
            ? <input value={ans[q.id]} maxLength={300} disabled={disabled || filling === q.id} onKeyDown={atEnter(q)} onChange={(e) => set(q.id, e.target.value)} placeholder={filling === q.id ? tx("De AI bedenkt gegevens…") : tx("Jouw antwoord (of laat leeg)")}
              onBlur={bizQ && q.id === bizQ.id && jobId ? () => { const what = String(ans[q.id] || "").trim(); if (what.length >= 8 && asked.current !== what && questions.some(isMedia)) { asked.current = what; askPhotos(what); } } : undefined} />
            : <div style={{ display: "flex", flexWrap: "wrap", gap: ".35rem" }}>{optsOf(q).map((o) => { const on = q.type === "multi" ? ans[q.id].includes(o) : ans[q.id] === o; return <button key={o} type="button" disabled={disabled} aria-pressed={on} onClick={() => (q.type === "multi" ? toggle(q, o) : set(q.id, on ? "" : o))} style={chip(on)}>{o}</button>; })}</div>}
        </div>
      ))}
      {bgOpen && createPortal(
        <div className="pb-objback" style={{ zIndex: 1400 }} onMouseDown={(e) => { if (e.target === e.currentTarget) setBgOpen(""); }}>
          <div className="pb-objpop" role="dialog" aria-label={tx(bgOpen === "page" ? "Achtergrondkleur van de pagina" : "Frontendkleur (hero, blokken en inhoud)")} style={{ width: "min(460px, 94vw)" }}>
            <div className="pb-objhead"><strong>{tx(bgOpen === "page" ? "Achtergrondkleur van de pagina" : "Frontendkleur (hero, blokken en inhoud)")}</strong><span style={{ flex: 1 }} /><button type="button" className="pb-panelx" onClick={() => setBgOpen("")} aria-label={tx("Sluiten")}>×</button></div>
            <div style={{ padding: "1rem", display: "grid", gap: ".8rem" }}>
              <small className="muted">{bgOpen === "page" ? (modeDark ? tx("Donkere modus: de achtergrond is een lichte kleur van het thema.") : tx("Lichte modus: de achtergrond is een donkere kleur van het thema.")) : (modeDark ? tx("Donkere modus: de frontend is een donkere kleur van het thema.") : tx("Lichte modus: de frontend is een lichte kleur van het thema."))}{chosenTheme ? ` (${chosenTheme.name})` : ""}</small>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: ".5rem" }}>
                {choicesFor(bgOpen).map(([v, l]) => (
                  <button key={v + l} type="button" onClick={() => pickColor(bgOpen, v)} style={{ display: "grid", gap: ".3rem", padding: ".4rem", borderRadius: 10, border: `2px solid ${(ans[bgOpen === "page" ? "page_bg" : "front_bg"] || shown[bgOpen]).toLowerCase() === String(v).toLowerCase() ? "var(--blue)" : "var(--line)"}`, background: "var(--card)", color: "inherit", cursor: "pointer", font: "inherit", textAlign: "left" }}>
                    <i style={{ height: 38, borderRadius: 6, border: "1px solid var(--line)", background: v }} />
                    <small>{tx(l)} <b>{v}</b></small>
                  </button>))}
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: ".6rem", fontSize: ".85rem" }}>
                <input type="color" value={ans[bgOpen === "page" ? "page_bg" : "front_bg"] || shown[bgOpen]} onChange={(e) => pickColor(bgOpen, e.target.value, false)} aria-label={tx("Eigen kleur")} style={{ width: 44, height: 32, padding: 0, border: "1px solid var(--line)", borderRadius: 6, background: "none", cursor: "pointer" }} />
                <span>{tx("Eigen kleur")}</span>
                <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={() => { const t = bgOpen; const v = choicesFor(t)[0]?.[0]; setBgOpen(""); if (v) pickColor(t, v, false); }}>{tx("Standaard")}</button>
              </label>
            </div>
          </div>
        </div>, document.body)}
      {fakeErr && <div className="alert">{fakeErr}</div>}
      <small className="muted">{tx("Tip: typ @ in een veld en druk op Enter, dan bedenkt de AI fictieve gegevens.")}</small>
      <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
        <button type="button" className="btn primary" disabled={disabled || needName || needColors} onClick={() => { pend.current = null; onSave?.(ans, own); onSend(compose()); }} title={needName ? tx("Vul eerst de naam in") : needColors ? tx("Kies eerst een kleurthema") : undefined}>{tx("Verstuur mijn antwoorden")}</button>
        <button type="button" className="btn" disabled={disabled} onClick={() => onSend(tx("Beslis zelf wat er niet is ingevuld en ga aan de slag."))}>{tx("Beslis zelf")}</button>
      </div>
    </div>
  );
}

// The theme of the design: colours, font, corners and light/dark. The system writes it as the theme on :root of the pages, so the pages follow at once without asking the AI again, and it is the same theme that the website gets when it is made.
function ThemeBlock({ job, onChanged }) {
  const b = job.brief || {};
  const [vals, setVals] = useState({ colors: { ...DEFAULT_COLORS, ...DEFAULT_DARK, ...(b.colors || {}) }, font: b.font || "sans", radius: b.radius ?? 14, max_width: b.max_width ?? 1100, color_mode: b.color_mode || "light" });
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  const push = (next) => {
    setVals(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => { setBusy(true); try { await api(`/sitecreator/${job.id}/`, { method: "PATCH", body: { colors: next.colors, font: next.font, radius: next.radius, max_width: next.max_width, color_mode: next.color_mode } }); await onChanged(); } catch {} finally { setBusy(false); } }, 450);
  };
  const setColor = (k, v) => push({ ...vals, colors: { ...vals.colors, [k]: v } });
  const roles = [...COLOR_ROLES, ...(vals.color_mode !== "light" ? DARK_ROLES : [])];
  return (
    <Fold shut={job.status === "running" || job.status === "stopping"} title={<>
        <IconPalette /> {tx("Kleuren")}
        <span aria-hidden="true" style={{ display: "inline-flex", gap: 3, marginLeft: ".2rem" }}>{["primary", "secondary", "bg", "text"].map((k) => <i key={k} style={{ width: 14, height: 14, borderRadius: "50%", background: vals.colors[k], border: "1px solid var(--line)" }} />)}</span>
        {busy && <small style={{ opacity: .85 }}>· {tx("Bezig…")}</small>}
      </>}>
      <div style={{ display: "grid", gap: ".6rem", marginTop: ".5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".45rem .8rem" }}>
          {roles.map(([k, l]) => (
            <div key={k} style={{ display: "grid", gap: ".25rem", fontSize: ".85rem", minWidth: 0 }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx(l)}</span>
              <span style={{ display: "flex", alignItems: "center", gap: ".4rem", minWidth: 0 }}>
                <input type="color" value={vals.colors[k] || "#000000"} onChange={(e) => setColor(k, e.target.value)} aria-label={tx(l)} style={{ flex: "none", width: 34, height: 28, padding: 0, border: "1px solid var(--line)", borderRadius: 6, background: "none", cursor: "pointer" }} />
                <HexField value={vals.colors[k] || ""} onChange={(v) => setColor(k, v)} label={`${tx(l)} (${tx("hex-code")})`} />
              </span>
            </div>
          ))}
        </div>
        <label style={{ display: "grid", gap: ".2rem", fontSize: ".85rem" }}>{tx("Weergave")}
          <select value={vals.color_mode} onChange={(e) => push({ ...vals, color_mode: e.target.value })}>{MODES.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select>
        </label>
        <label style={{ display: "grid", gap: ".2rem", fontSize: ".85rem" }}>{tx("Lettertype")}
          <select value={vals.font} onChange={(e) => push({ ...vals, font: e.target.value })}>{FONT_NAMES.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select>
        </label>
        <label style={{ display: "grid", gap: ".2rem", fontSize: ".85rem" }}>{tx("Maximale breedte van het ontwerp")}
          <select value={vals.max_width} onChange={(e) => push({ ...vals, max_width: Number(e.target.value) })}>{[[960, "Smal (960 px)"], [1100, "Standaard (1100 px)"], [1280, "Breed (1280 px)"], [1440, "Extra breed (1440 px)"], [0, "Hele schermbreedte"]].map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select>
        </label>
        <label style={{ display: "grid", gap: ".2rem", fontSize: ".85rem" }}>{tx("Hoeken")}: {vals.radius}px
          <input type="range" min="0" max="24" value={vals.radius} onChange={(e) => push({ ...vals, radius: Number(e.target.value) })} />
        </label>
        <small className="muted">{tx("De pagina's passen direct aan, zonder de AI. Dit is het thema dat je website krijgt.")}</small>
      </div>
    </Fold>
  );
}

// The workspace: the step plan while it is a draft; when the website has been made: the chat on the left, the website on the right (per page, on a computer, iPad or phone). When it is good: import it.
export function AiCreatorPopup({ jobId, onClose, onImport, onApply }) {
  const [job, setJob] = useState(null);
  useEffect(() => { setActiveDesign(jobId ? { id: jobId, name: "" } : null); return () => setActiveDesign(null); }, [jobId]);  // the cost window shows the costs of this design
  useEffect(() => { if (jobId && job?.name) setActiveDesign({ id: jobId, name: job.name }); }, [jobId, job?.name]);
  const [err, setErr] = useState("");
  const [moreOff, setMoreOff] = useState("");  // "not now" for the question about more pictures (per number of missing pictures)
  const [reopen, setReopen] = useState(-1);  // an earlier questionnaire that is opened again with the answers of the customer
  const [page, setPage] = useState("index.html");
  const [dev, setDev] = useState("web");
  const [prevMode, setPrevMode] = useState("light");  // the preview in the light or the dark mode (only when the design has both)
  const [view, setView] = useState("creator");  // the two tabs of a finished design: "creator" (the design) and "live" (the page on the website)
  const [liveKey, setLiveKey] = useState(0);
  // the chat column: drag the bar to make it wider or narrower, or fold it away completely (an icon brings it back) to look at the website
  const [side, setSide] = useState(() => { try { return { w: Math.max(260, Number(localStorage.getItem("siChatW")) || 380), shut: false }; } catch { return { w: 380, shut: false }; } });  // the chat is open every time the creator is opened (a chat that was folded away once stayed hidden and was not found again); only the width is remembered
  const gridEl = useRef(null);
  const saveSide = (n) => { setSide(n); try { localStorage.setItem("siChatW", String(n.w)); localStorage.removeItem("siChatShut"); } catch {} };
  const dragSide = (e) => {
    e.preventDefault();
    const el = gridEl.current; if (!el) return;
    const box = el.getBoundingClientRect(), max = Math.min(900, box.width * 0.75);
    const move = (ev) => setSide((o) => ({ ...o, w: Math.round(Math.max(260, Math.min(max, ev.clientX - box.left))) }));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); setSide((o) => { try { localStorage.setItem("siChatW", String(o.w)); } catch {} return o; }); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const frame = useRef(null);
  const liveFrame = useRef(null);  // the live page (tab Live): the screenshot button takes the whole page of that one
  const [kit, setKit] = useState(null);  // the component set: the preview draws the components like the website does
  useEffect(() => { loadKit(job?.brief?.component_set || "").then(setKit).catch(() => setKit(null)); }, [job?.brief?.component_set]);
  const [shots, setShots] = useState([]);  // screenshots of the preview that go along with the next message to the designer
  const [shooting, setShooting] = useState(false);
  const shoot = async () => {
    setShooting(true); setErr("");
    try {
      const live = view === "live" && !!job?.applied && !!liveFrame.current;  // tab Live: the page as it is on the website (its css is in files)
      const d = await captureFrame(live ? liveFrame.current : frame.current, 1400, { full: true, ...(live ? { styles: true } : {}) });  // the whole page, with its pictures
      setShooting(false);
      const full = shots.length >= 3;
      const what = await confirmDialog(tx("Wat wil je met deze screenshot doen?"), {
        title: tx("Screenshot"), okLabel: tx("Doorgaan"), cancelLabel: tx("Annuleren"),
        choices: [...(full ? [] : [{ value: "chat", label: tx("Gebruiken in de chat"), hint: tx("De screenshot gaat mee met je volgende bericht aan de ontwerper.") }]), { value: "copy", label: tx("Kopiëren naar het klembord"), hint: tx("Daarna kun je hem overal plakken (Ctrl+V of Cmd+V).") },
          { value: "pdf", label: tx("Opslaan als PDF"), hint: tx("Een PDF van de hele pagina, in één stuk.") }, { value: "jpg", label: tx("Opslaan als JPG"), hint: tx("Een afbeelding van de hele pagina.") }],
      });
      if (what === "chat") setShots((s) => [...s, d]);
      else if (what === "pdf" || what === "jpg") {
        try { await (what === "pdf" ? saveAsPdf : saveAsJpg)(d, job?.name || "ontwerp"); } catch (x) { setErr(errorText(x)); }
      }
      else if (what === "copy") {
        try {
          let blob = await (await fetch(d)).blob();
          if (blob.type !== "image/png") {  // a large page is a jpeg: the clipboard takes png
            const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = d; });
            const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; c.getContext("2d").drawImage(im, 0, 0);
            blob = await new Promise((ok) => c.toBlob(ok, "image/png"));
          }
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        } catch { setErr(tx("Kopiëren naar het klembord is niet gelukt (je browser staat dat hier niet toe).")); }
      }
    } catch (x) { setErr(errorText(x)); } finally { setShooting(false); }
  };
  const [zoom, setZoom] = useState(1);  // like the zoom of a browser (+ and -): the whole page gets bigger or smaller, fonts too, and the page lays itself out for the new width
  useEffect(() => { try { const z = Number(localStorage.getItem("aiPreviewZoom")); if (z >= .5 && z <= 2) setZoom(z); } catch {} }, []);
  const zoomTo = (z) => { const v = Math.min(2, Math.max(.5, Math.round(z * 100) / 100)); setZoom(v); try { localStorage.setItem("aiPreviewZoom", String(v)); } catch {} };
  const ZOOMS = [.5, .67, .75, .8, .9, 1, 1.1, 1.25, 1.5, 1.75, 2];
  const zoomStep = (dir) => zoomTo(dir > 0 ? ZOOMS.find((z) => z > zoom + .001) || 2 : [...ZOOMS].reverse().find((z) => z < zoom - .001) || .5);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [again, setAgain] = useState(false); // back to the step plan of a finished design
  const [improveOpen, setImproveOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [back, setBack] = useState(false); // back to the steps as soon as the work has stopped
  const chat = useRef(null);

  // The files of a design (html with css) can be several MB: only the full load asks for them; the answers of saving and polling are light and keep the files that are already here.
  const sig = useRef(""); // the version of the files that is on the screen (files_sig of the server)
  const merge = useCallback((r) => { if (r.files && Object.keys(r.files).length && r.files_sig) sig.current = r.files_sig; setJob((prev) => ({ ...r, files: r.files && Object.keys(r.files).length ? r.files : prev?.files || {} })); }, []);
  const reload = useCallback(async (full = true) => { try { const r = await api(`/sitecreator/${jobId}/${full ? "?files=1" : ""}`); merge(r); if (full) sig.current = r.files_sig || ""; else if (r.files_sig && r.files_sig !== sig.current) { const f = await api(`/sitecreator/${jobId}/?files=1`); sig.current = f.files_sig || ""; merge(f); } } catch (e) { setErr(errorText(e)); } }, [jobId, merge]); // while the AI works: as soon as a page is ready (the files changed) the preview is updated
  const was = useRef("");
  useEffect(() => { reload(true); }, [reload]);
  useEffect(() => { const t = setTimeout(() => reload(false), 1500); return () => clearTimeout(t); }, [reload]);  // once more a moment after opening: a message that was sent while the window opened is shown too
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
  useEffect(() => { // new messages: to the bottom; but a questionnaire opens at its top, so the first question is the first thing to see
    const box = chat.current; if (!box) return;
    const q = box.querySelector("[data-questionnaire]");
    if (q && !job?.status?.match(/running|stopping/)) box.scrollTo({ top: Math.max(0, box.scrollTop + q.getBoundingClientRect().top - box.getBoundingClientRect().top - 8) });
    else box.scrollTo({ top: 1e6 });
  }, [job?.messages?.length, job?.status]);

  const sendWith = async (t, imgs = []) => {
    if (!t.trim() || sending || job?.status === "running" || job?.status === "stopping") return;
    setSending(true); setErr("");
    try { merge(await api(`/sitecreator/${jobId}/${chatMode ? "chat" : "revise"}/`, { method: "POST", body: { text: t, page, images: imgs, lang: getLanguage() } })); setText(""); setShots([]); liveRev.current = !!job?.applied && !!onApply; }
    catch (x) { setErr(errorText(x)); }
    finally { setSending(false); }
  };
  const send = (e) => { e?.preventDefault(); return sendWith(text, shots); };
  const filesRef = useRef({});
  filesRef.current = job?.files || {};
  // A link inside the preview never leaves it (a click on "index.html" used to load the whole back office in the frame and it hung on "Laden…"): a link to a page of the design opens that page, "#place" scrolls, everything else does nothing.
  const keepInPreview = (e) => {
    try {
      const doc = e.currentTarget.contentDocument;
      if (!doc || doc.__keep) return;
      doc.__keep = true;
      doc.addEventListener("click", (ev) => {
        const a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
        if (!a) return;
        const href = String(a.getAttribute("href") || "");
        ev.preventDefault();
        if (href.startsWith("#")) { const el = href.length > 1 ? doc.getElementById(href.slice(1)) : null; if (el) el.scrollIntoView({ behavior: "smooth" }); return; }
        const m = href.split("#")[0].split("?")[0].split("/").pop();
        if (m && filesRef.current[m] && /\.html?$/i.test(m)) setPage(m);
      });
      doc.addEventListener("submit", (ev) => ev.preventDefault());
    } catch { /* the frame is not reachable: nothing to do */ }
  };
  // A click on a message of the check ("Toon in voorbeeld"): close the window, open that page of the design in the preview and show the place (scrolled into view, with a frame around it for a moment).
  const [find, setFind] = useState(null);
  const locate = (file, pad) => { setCreateOpen(false); setView("creator"); if (file && filesRef.current[file]) setPage(file); setFind({ file, pad, n: Date.now() }); };
  const showFind = () => {
    try {
      const doc = frame.current?.contentDocument;
      if (!find || !doc || !doc.body || find.done) return;
      if (find.file && find.file !== cur) return;  // the right page is not shown yet: it is tried again when it has loaded
      find.done = true;
      const el = elementOfPath(doc, find.pad);
      if (!el) return;
      doc.querySelectorAll("[data-found]").forEach((x) => { x.style.outline = ""; x.style.outlineOffset = ""; x.removeAttribute("data-found"); });
      el.setAttribute("data-found", "1");
      el.style.outline = "4px solid #e8833a"; el.style.outlineOffset = "-4px";
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => { try { el.style.outline = ""; el.style.outlineOffset = ""; el.removeAttribute("data-found"); } catch {} }, 5000);
    } catch { /* the frame is not reachable: nothing to show */ }
  };
  useEffect(() => { if (find && !find.done) { const t = setTimeout(showFind, 150); return () => clearTimeout(t); } return undefined; }); // eslint-disable-line react-hooks/exhaustive-deps
  const running = job?.status === "running" || job?.status === "stopping";
  useBusy("design", running); // a design is being made: the idle logout never logs out now, it asks first
  const act = async (what, path, body) => { setBusy(what); setErr(""); try { merge(await api(`/sitecreator/${jobId}/${path}/`, { method: "POST", body: body || {} })); return true; } catch (x) { setErr(errorText(x)); return false; } finally { setBusy(""); } };
  const stop = () => act("stop", "stop");
  const toSteps = async () => { if (running) { setBack(true); await stop(); } else setAgain(true); };
  useEffect(() => { if (back && job && job.status !== "running" && job.status !== "stopping") { setBack(false); setAgain(true); } }, [back, job]);
  const restore = () => act("restore", "restore").then((ok) => ok && reload(true));
  const improve = async (focus) => { if (await act("improve", "generate", { improve: true, focus })) setImproveOpen(false); };
  const chatMode = !!(job?.chat || job?.brief?.chat); // AI chat build: always the chat, never the steps
  const wizard = job && !chatMode && (job.status === "draft" || job.status === "error" || again);
  // Closing a design that is still a concept (in the steps): save it for later or throw it away. Escape or "Doorgaan" keeps the window open.
  const baseline = useRef(null);  // the state of the design when the creator was opened: to see what changed and to put it back
  useEffect(() => { baseline.current = null; if (jobId) api(`/sitecreator/${jobId}/version/`).then((d) => { if (!baseline.current) baseline.current = d; }).catch(() => {}); }, [jobId]);
  const requestClose = async () => {
    if (job && chatMode && !running && baseline.current && Object.keys(baseline.current.files || {}).length > 0) {  // a design that was already finished when it was opened: when something changed, ask what to do with it (a design that was made in this very session is just kept)
      try {
        const now = await api(`/sitecreator/${job.id}/version/`);
        if (JSON.stringify(now) !== JSON.stringify(baseline.current)) {
          const what = await confirmDialog(tx("Je hebt dit ontwerp aangepast. Wat wil je doen met de wijzigingen?"), {
            title: tx("Ontwerp sluiten"), okLabel: tx("Sluiten"), cancelLabel: tx("Doorgaan met ontwerpen"),
            choices: [{ value: "save", label: tx("Opslaan"), hint: tx("De wijzigingen blijven in dit ontwerp.") },
              { value: "new", label: tx("Als nieuwe versie opslaan"), hint: tx("De wijzigingen worden een nieuw ontwerp (naam + 1); dit ontwerp blijft zoals het was.") },
              { value: "discard", label: tx("Niet opslaan"), hint: tx("De wijzigingen worden weggegooid; het ontwerp gaat terug naar hoe het was toen je het opende.") }],
          });
          if (!what) return;
          if (what === "new" || what === "discard") {
            try { await api(`/sitecreator/${job.id}/version/`, { method: "POST", body: { action: what, snapshot: baseline.current } }); } catch (e) { setErr(errorText(e)); return; }
          }
        }
      } catch { /* the check failed: just close */ }
      onClose();
      return;
    }
    if (job && chatMode && !running && baseline.current && Object.keys(baseline.current.files || {}).length === 0 && Object.keys(job.files || {}).length > 0) {  // a design that was made in this session: keep it or throw it away (a new version makes no sense: there was no earlier one)
      const what = await confirmDialog(tx("Dit ontwerp is nieuw gemaakt. Wil je het bewaren of weggooien?"), {
        title: tx("Ontwerp sluiten"), okLabel: tx("Sluiten"), cancelLabel: tx("Doorgaan met ontwerpen"),
        choices: [{ value: "save", label: tx("Opslaan"), hint: tx("Je vindt het ontwerp terug bij Mijn ontwerpen.") }, { value: "discard", label: tx("Niet opslaan"), hint: tx("De wijzigingen worden weggegooid; het ontwerp gaat terug naar hoe het was toen je het opende.") }],
      });
      if (!what) return;
      // "Niet opslaan" never deletes the design itself (name, answers, photos): it only puts it back to how it was when it was opened
      if (what === "discard") { try { await api(`/sitecreator/${job.id}/version/`, { method: "POST", body: { action: "discard", snapshot: baseline.current } }); } catch (e) { setErr(errorText(e)); return; } }
      onClose();
      return;
    }
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
  const mainHtml = ready ? String(job.files?.["index.html"] || "") : "";
  const thinSections = ready && (job.pages || []).length === 1 ? (mainHtml.match(/<div id="[^"]+">/g) || []).length : 99;  // a one pager with only a few sections lacks content
  const [thinOff, setThinOff] = useState("");
  const designLangCode = (() => { const l = String(job?.brief?.lang || ""); const m = l.match(/\(([a-z]{2,3})\)/i); if (m) return m[1].toLowerCase(); const n = l.toLowerCase(); return { dutch: "nl", nederlands: "nl", english: "en", engels: "en", german: "de", duits: "de", french: "fr", frans: "fr", spanish: "es", spaans: "es" }[n.split(/[\s(]/)[0]] || ""; })();  // the language of the design: the live page is shown in it, so it can be compared 1 to 1
  const missingPics = ready ? (job.photo_slots || []).filter((x) => x.kind !== "video" && !x.done && !/logo/i.test(x.file)).length : 0;  // places where a page asks for a picture and there is none yet
  // the blocks Colours and Photos and videos wait until the questionnaire round has been: while the customer is asked the questions (or the first answer of the AI is still to come) they are hidden
  const lastMsg = (job?.messages || []).slice(-1)[0];
  const asking = !!lastMsg?.questions?.length || (!ready && (!lastMsg || lastMsg.role === "user"));
  const blocksOpen = !asking;
  const cur = job?.files?.[page] ? page : pages.find((p) => job?.files?.[p.file])?.file || "index.html";

  return createPortal(
    <div className="pb-objback">
      <div className="pb-objpop" role="dialog" aria-label={tx("Website ontwerpen")} style={{ width: "min(96vw, 1700px)", maxWidth: "none", height: "94vh", maxHeight: "94vh", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        <div className="pb-objhead"><strong>{tx("Website ontwerpen")}{job?.name ? `: ${job.name}` : ""}</strong>
          {!wizard && job && !chatMode && <button type="button" className="btn sm" style={{ marginLeft: ".8rem" }} disabled={back} onClick={toSteps}>← {back ? tx("Bezig met stoppen…") : tx("Terug naar de stappen")}</button>}<span style={{ flex: 1 }} />
          {!wizard && job?.applied && <span className={job.live ? "badge ok" : "badge off"} style={{ marginRight: ".6rem" }} title={tx("Elke aanpassing aan dit concept wordt direct op de live pagina's toegepast.")}>{busy === "live" ? tx("Live bijwerken…") : job.live ? tx("Live") : tx("Concept")}</span>}
          {!wizard && job?.applied && !job.live && ready && !running && <button type="button" className="btn sm" style={{ marginRight: ".4rem" }} disabled={!!busy} onClick={applyLive}>{tx("Live bijwerken")}</button>}
          {!wizard && ready && <span className="pb-seg" style={{ marginRight: ".6rem" }}>{DEVICES.map(([k, l]) => <button type="button" key={k} className={dev === k ? "on" : ""} onClick={() => setDev(k)}>{tx(l)}</button>)}</span>}
          {!wizard && ready && <span className="pb-seg" style={{ marginRight: ".6rem" }} role="group" aria-label={tx("Zoomen")}>
            <button type="button" onClick={() => zoomStep(-1)} disabled={zoom <= .5} aria-label={tx("Verkleinen")} title={tx("Verkleinen")}>−</button>
            <button type="button" onClick={() => zoomTo(1)} title={tx("Terug naar 100%")} style={{ minWidth: "3.4em", fontVariantNumeric: "tabular-nums" }}>{Math.round(zoom * 100)}%</button>
            <button type="button" onClick={() => zoomStep(1)} disabled={zoom >= 2} aria-label={tx("Vergroten")} title={tx("Vergroten")}>+</button>
          </span>}
          {!wizard && ready && <button type="button" className="btn sm" style={{ marginRight: ".6rem" }} onClick={shoot} disabled={shooting} aria-label={tx("Screenshot maken")} title={tx("Maak een screenshot van wat je nu ziet en stuur hem mee met je volgende bericht")}><IconCamera /></button>}
          {!wizard && ready && !running && <button type="button" className="btn sm" style={{ marginRight: ".4rem" }} onClick={() => setImproveOpen(true)}><IconBolt /> {tx("Verbeteren")}</button>}
          {!wizard && ready && !running && (onApply
            ? <button type="button" className="btn primary sm" style={{ marginRight: ".6rem" }} onClick={() => setCreateOpen(true)}><IconCheck /> {tx("Alles aanmaken")}</button>
            : <button type="button" className="btn primary sm" style={{ marginRight: ".6rem" }} onClick={() => onImport(job)}>{tx("Importeren in easy2edit")}</button>)}
          <button type="button" className="pb-panelx" onClick={requestClose} aria-label={tx("Sluiten")}>×</button></div>
        {improveOpen && <ImprovePopup onClose={() => setImproveOpen(false)} onStart={improve} busy={busy === "improve"} />}
        {createOpen && job && <CreatePopup job={job} onDesign={merge} onLocate={locate} onClose={() => setCreateOpen(false)} onReview={() => { setCreateOpen(false); onImport(job); }} onCreate={(o) => { setCreateOpen(false); onApply(job, { ...o, off: job.modules_off_effective || job.brief?.modules_off || [] }); }} />}
        {!job && <p className="muted" style={{ padding: "1rem" }}>{err || <Loading />}</p>}
        {wizard && <Wizard key={job.id + (again ? "a" : "")} job={job} onJob={merge} onReload={() => reload(true)} onApply={onApply ? (o) => onApply(job, o) : undefined} onImprove={() => setImproveOpen(true)} onWorkspace={ready && job.status !== "draft" ? () => setAgain(false) : undefined} onGenerate={(j) => { setAgain(false); merge(j); }} />}
        {job && !wizard && (
          <div ref={gridEl} style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: side.shut ? "0px 0px minmax(0, 1fr)" : `${side.w}px 10px minmax(0, 1fr)` }}>
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, overflow: "hidden", visibility: side.shut ? "hidden" : "visible" }}>
              <div ref={chat} style={{ flex: 1, overflowY: "auto", padding: ".9rem", display: "flex", flexDirection: "column", gap: ".6rem" }}>
                {chatMode && !(job.messages || []).length && <div style={{ alignSelf: "flex-start", maxWidth: "92%", padding: ".55rem .8rem", borderRadius: 12, background: "var(--card)", border: "1px solid var(--line)" }}>{tx("Hoi! Vertel in je eigen woorden wat voor website je wilt: waar is hij voor en voor wie? Ik ontwerp hem met de componenten en modules van easy2edit en je ziet het resultaat rechts. Foto's zoek je zelf op iStock; ik laat zien welke ik nodig heb.")}</div>}
                {(job.messages || []).map((m, i) => (
                  <div key={i} {...(m.questions?.length > 0 && i === (job.messages || []).length - 1 ? { "data-questionnaire": "1" } : {})} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "92%", ...(m.questions?.length ? { width: "92%", boxSizing: "border-box", minWidth: 0 } : {}), padding: ".55rem .8rem", borderRadius: 12, background: m.role === "user" ? "color-mix(in srgb, var(--blue) 18%, var(--card))" : "var(--card)", border: "1px solid var(--line)", whiteSpace: "pre-wrap" }}>{(m.img || []).map((u, k) => <a key={k} href={u} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginBottom: ".4rem" }}><img src={u} alt={tx("Screenshot")} style={{ display: "block", maxWidth: "100%", borderRadius: 8, border: "1px solid var(--line)" }} /></a>)}{m.text}{m.questions?.length > 0 && (i === (job.messages || []).length - 1 || reopen === i) && <QuestionForm key={i} picked={job.brief?.picked} colors={job.brief?.colors} mode={job.brief?.color_mode} saved={m.answers} onSave={(a, o) => api(`/sitecreator/${jobId}/answers/`, { method: "POST", body: { index: i, ans: a, own: o } }).catch(() => {})} questions={m.questions} disabled={running || sending} onSend={(t) => sendWith(t)} accent={job.brief?.colors?.primary} jobId={jobId} onJob={merge} onChanged={() => reload(true)} queryHint={job.brief?.name || ""} firstRound={(job.messages || []).filter((x) => x.questions?.length).length === 1} />}{m.questions?.length > 0 && i !== (job.messages || []).length - 1 && <button type="button" className="btn sm" style={{ marginTop: ".5rem" }} onClick={() => setReopen(reopen === i ? -1 : i)}>{reopen === i ? tx("Vragen verbergen") : tx("Vragen opnieuw openen met mijn antwoorden")}</button>}</div>
                ))}
                {(() => { // the first request: may the designer fill in the first questions with assumptions (AI)? Two buttons; the answer is kept
                  const last = (job.messages || [])[(job.messages || []).length - 1];
                  if (running || !last || last.ask !== "prefill" || last.answered) return null;
                  const answer = async (yes) => { setErr(""); try { merge(await api(`/sitecreator/${jobId}/prefill/`, { method: "POST", body: { yes } })); } catch (x) { setErr(errorText(x)); } };
                  return (
                    <div className="row" style={{ gap: ".5rem", flexWrap: "wrap" }}>
                      <button type="button" className="btn sm primary" disabled={!!busy} onClick={() => answer(true)}>{tx("Ja, vul de vragen in")}</button>
                      <button type="button" className="btn sm" disabled={!!busy} onClick={() => answer(false)}>{tx("Nee, ik vul ze zelf in")}</button>
                    </div>
                  );
                })()}
                {!running && ready && thinSections < 5 && thinOff !== jobId && (
                  <div className="card" data-easy2edit-tag="ui-notice" style={{ padding: ".7rem .9rem", display: "grid", gap: ".5rem" }}>
                    <span>{tx("Deze onepager heeft maar {0} secties, dus er mist content. Zal ik de pagina aanvullen (over ons, diensten, voordelen, reviews, FAQ en contact) en het menu naar die secties laten linken?", String(thinSections))}</span>
                    <span style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
                      <button type="button" className="btn sm primary" disabled={!!busy} onClick={async () => { setErr(""); setThinOff(jobId); try { merge(await api(`/sitecreator/${jobId}/chat/`, { method: "POST", body: { text: tx("Deze onepager mist content. Vul de pagina aan met de ontbrekende secties (over ons, diensten, voordelen, reviews, FAQ en contact), elk met een eigen id, in dezelfde stijl. Laat het menu in de navigatiebalk en de voettekst linken naar die secties."), lang: getLanguage() } })); } catch (x) { setErr(errorText(x)); } }}>{tx("Ja, vul de pagina aan")}</button>
                      <button type="button" className="btn sm" onClick={() => setThinOff(jobId)}>{tx("Niet nu")}</button>
                    </span>
                  </div>
                )}
                {!running && ready && missingPics > 0 && moreOff !== `${jobId}:${missingPics}` && (
                  <div className="card" data-easy2edit-tag="ui-notice" style={{ padding: ".7rem .9rem", display: "grid", gap: ".5rem" }}>
                    <span>{tx("Er staan nog {0} lege afbeeldingen op de pagina's. Zal ik ze invullen met de foto's die je hebt gekozen (en alleen als dat niet genoeg is, meer zoeken op iStock)?", String(missingPics))}</span>
                    <span style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
                      <button type="button" className="btn sm primary" disabled={!!busy} onClick={async () => { setErr(""); try { merge(await api(`/sitecreator/${jobId}/more-photos/`, { method: "POST", body: {} })); } catch (x) { setErr(errorText(x)); } }}><IconSearch /> {tx("Ja, vul de afbeeldingen in")}</button>
                      <button type="button" className="btn sm" onClick={() => setMoreOff(`${jobId}:${missingPics}`)}>{tx("Niet nu")}</button>
                    </span>
                  </div>
                )}
                {running && (
                  <div className="card" style={{ padding: ".7rem .9rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: ".5rem" }}><span>{tx(job.step || "Bezig…")}</span><strong>{Math.round(job.progress || 0)} %</strong></div>
                    <div style={{ height: 8, borderRadius: 999, background: "var(--line)", overflow: "hidden", marginTop: ".5rem" }}><div style={{ width: `${Math.max(3, Math.min(100, job.progress || 0))}%`, height: "100%", background: "var(--blue)", transition: "width .4s" }} /></div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: ".6rem", marginTop: ".6rem", flexWrap: "wrap" }}>
                      {job.stalled
                        ? <small style={{ flex: "1 1 100%", color: "var(--danger, #dc2626)" }} role="alert">{tx("Het ontwerpen lijkt vast te staan: er werkt niets meer aan (de server is waarschijnlijk herstart). Wil je doorgaan waar het gebleven was?")}</small>
                        : <small className="muted" style={{ flex: 1, minWidth: 180 }}>{tx("Je kunt dit venster sluiten: het ontwerp wordt doorgemaakt en staat daarna onder Mijn ontwerpen.")}</small>}
                      {job.stalled && <button type="button" className="btn sm primary" disabled={!!busy} onClick={async () => { setErr(""); try { merge(await api(`/sitecreator/${jobId}/resume/`, { method: "POST", body: {} })); } catch (x) { setErr(errorText(x)); } }}>{tx("Doorgaan")}</button>}
                      <button type="button" className="btn sm danger" disabled={job.status === "stopping" || busy === "stop"} onClick={stop}>{job.status === "stopping" ? tx("Bezig met stoppen…") : tx("Stoppen")}</button>
                    </div>
                  </div>
                )}
                {err && <div className="alert">{err}</div>}
                {!running && job.can_restore && <button type="button" className="btn sm" style={{ alignSelf: "flex-start" }} disabled={!!busy} onClick={restore}>{busy === "restore" ? tx("Bezig…") : tx("Vorige versie terugzetten")}</button>}
              </div>
              {blocksOpen && (ready || chatMode) && <ThemeBlock key={job.id + (job.brief?.theme_name || "")} job={job} onChanged={() => reload(true)} />}
              {blocksOpen && chatMode && <PhotoSlots job={job} onJob={merge} onAsk={async (t) => { try { merge(await api(`/sitecreator/${jobId}/chat/`, { method: "POST", body: { text: t, page, lang: getLanguage() } })); } catch (x) { setErr(errorText(x)); } }} onShow={(file) => { const p = pages.find((q) => String(job.files?.[q.file] || "").toLowerCase().includes(file)); if (p) setPage(p.file); return p?.title || ""; }} />}
              {shots.length > 0 && <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap", padding: ".5rem .7rem 0", borderTop: "1px solid var(--line)" }} aria-label={tx("Screenshots bij je bericht")}>{shots.map((u, k) => <span key={k} style={{ position: "relative" }}><img src={u} alt={tx("Screenshot")} style={{ display: "block", height: 54, borderRadius: 8, border: "1px solid var(--line)" }} /><button type="button" className="pb-panelx" onClick={() => setShots((s) => s.filter((_, i) => i !== k))} aria-label={tx("Screenshot weghalen")} style={{ position: "absolute", top: -6, right: -6 }}>×</button></span>)}<small className="muted" style={{ alignSelf: "center" }}>{tx("gaat mee met je volgende bericht")}</small></div>}
              <form onSubmit={send} style={{ padding: ".7rem", borderTop: shots.length ? 0 : "1px solid var(--line)", display: "flex", gap: ".5rem", alignItems: "flex-end" }}>
                <textarea rows={3} style={{ flex: 1 }} value={text} maxLength={2000} disabled={running} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(e); }} placeholder={tx("Wat moet er anders? bv. maak de kop rustiger, voeg een prijzenblok toe")} />
                <button className="btn primary" disabled={running || sending || !text.trim()} aria-label={tx("Aanpassen")}><IconSend /></button>
              </form>
            </div>
            <div role="separator" aria-orientation="vertical" aria-label={tx("Breedte van de chat aanpassen")} title={tx("Sleep om de chat breder of smaller te maken (dubbelklik: standaard)")} onPointerDown={side.shut ? undefined : dragSide} onDoubleClick={() => saveSide({ ...side, w: 380 })}
              style={{ position: "relative", cursor: side.shut ? "default" : "col-resize", background: "var(--line)", width: side.shut ? 0 : 10, touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center", userSelect: "none" }}>
              {!side.shut && <>
                <i aria-hidden="true" style={{ width: 2, height: 38, borderRadius: 2, background: "var(--muted, #94a3b8)", opacity: .7 }} />
                <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => saveSide({ ...side, shut: true })} aria-label={tx("Chat wegklappen")} title={tx("Chat wegklappen")}
                  style={{ position: "absolute", top: 8, left: -10, width: 24, height: 24, padding: 0, borderRadius: "50%", border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", cursor: "pointer", display: "grid", placeItems: "center", zIndex: 3 }}>
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
                </button></>}
            </div>
            <div style={{ position: "relative", display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
              {side.shut && <button type="button" onClick={() => saveSide({ ...side, shut: false })} aria-label={tx("Chat tonen")} title={tx("Chat tonen")}
                style={{ position: "absolute", top: 10, left: 10, zIndex: 6, display: "inline-flex", alignItems: "center", gap: ".35rem", padding: ".4rem .7rem", borderRadius: 999, border: 0, background: "var(--blue)", color: "#fff", cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,.3)", font: "inherit", fontSize: ".82rem" }}><IconChat /> {tx("Chat")}</button>}
              {ready && <div style={{ padding: ".5rem .8rem 0", display: "flex", alignItems: "flex-end", gap: ".8rem", flexWrap: "wrap", ...(side.shut ? { paddingLeft: "5.6rem" } : {}) }}>
                <Tabs value={view} onChange={(v) => { setView(v); if (v === "live") setLiveKey((n) => n + 1); }} tabs={job.applied ? [["creator", tx("Creator")], ["live", tx("Live")]] : [["creator", tx("Creator")]]} />
                {view === "creator" && <div style={{ marginLeft: "auto", minWidth: 0 }}><Tabs value={cur} onChange={setPage} tabs={pages.filter((p) => job.files[p.file]).map((p) => [p.file, p.title])} /></div>}  {/* the tabs of the design (Creator, Live) stay on the left, the pages of the design go to the right */}
                {view === "creator" && job.brief?.color_mode === "both" && (
                  <span role="group" aria-label={tx("Weergave")} data-easy2edit-tag="ui-mode-switch" style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 999, overflow: "hidden", marginBottom: ".3rem" }}>
                    {[["light", "Licht"], ["dark", "Donker"]].map(([k, l]) => <button key={k} type="button" aria-pressed={prevMode === k} onClick={() => setPrevMode(k)} style={{ border: 0, padding: ".25rem .8rem", cursor: "pointer", font: "inherit", fontSize: ".82rem", background: prevMode === k ? "var(--blue)" : "var(--card)", color: prevMode === k ? "#fff" : "inherit" }}>{tx(l)}</button>)}
                  </span>
                )}
              </div>}
              <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", justifyContent: "center", background: "var(--bg)", padding: ".6rem" }}>
                {ready && view === "live" && job.applied ? (
                  <div style={{ width, maxWidth: "100%", height: "100%", boxSizing: "border-box", background: "#fff", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", ...(dev === "web" ? {} : { border: `${dev === "phone" || dev === "mobile" ? 10 : 12}px solid #1e293b`, borderRadius: dev === "phone" || dev === "mobile" ? 34 : 24 }) }}>
                    {job.applied
                      ? <iframe key={liveKey} ref={liveFrame} title={tx("Live pagina")} src={`${cur === "index.html" ? "/" : `/${cur.replace(/\.html?$/i, "")}`}${designLangCode ? `?lang=${designLangCode}` : ""}`} style={{ display: "block", width: "100%", height: "100%", border: 0, background: "#fff" }} />
                      : <p className="muted" style={{ maxWidth: 360, textAlign: "center", padding: "1rem" }}>{tx("Dit ontwerp staat nog niet op de website. Zet het eerst live met de knop rechtsboven.")}</p>}
                  </div>
                ) : ready ? (
                  <div style={{ width, maxWidth: "100%", height: "100%", boxSizing: "border-box", background: "#fff", overflow: "hidden", ...(dev === "web" ? {} : { border: `${dev === "phone" || dev === "mobile" ? 10 : 12}px solid #1e293b`, borderRadius: dev === "phone" || dev === "mobile" ? 34 : 24, boxShadow: "0 12px 40px rgba(0,0,0,.35)" }), opacity: running ? .6 : 1, transition: "opacity .3s" }}>
                    <div style={{ width: `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})`, transformOrigin: "0 0" }}>
                      <iframe ref={frame} title={tx("Voorbeeld")} sandbox="allow-same-origin" srcDoc={previewHtml(job.files, cur, [...(job.brief?.photos || []), ...(job.brief?.videos || [])], job.brief?.color_mode === "both" ? prevMode : "", chatMode, kit)} onLoad={(e) => { keepInPreview(e); setTimeout(showFind, 100); }} style={{ display: "block", width: "100%", height: "100%", border: 0, background: "#fff" }} />
                    </div>
                  </div>
                ) : <p className="muted" style={{ alignSelf: "center", textAlign: "center", maxWidth: 360 }}>{running ? "" : chatMode ? tx("Hier verschijnt het voorbeeld van je website zodra het ontwerp klaar is.") : ""}</p>}
                {running && (
                  <div role="status" aria-live="polite" data-easy2edit-tag="ui-work-overlay" style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: ".7rem", background: "color-mix(in srgb, var(--blue) 55%, transparent)", backdropFilter: "blur(1px)", color: "#fff", textAlign: "center", padding: "1rem", pointerEvents: "auto" }}>
                    <svg aria-hidden="true" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinecap="round" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.2))" }}>
                      <circle cx="32" cy="32" r="26" strokeWidth="4" opacity=".25" />
                      <path d="M32 6a26 26 0 0 1 26 26" strokeWidth="4"><animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="1.1s" repeatCount="indefinite" /></path>
                      <path d="M32 14a18 18 0 0 0-18 18" strokeWidth="3" opacity=".7"><animateTransform attributeName="transform" type="rotate" from="360 32 32" to="0 32 32" dur="1.8s" repeatCount="indefinite" /></path>
                      <g fill="currentColor" stroke="none"><rect x="26" y="26" width="12" height="12" rx="3"><animate attributeName="opacity" values="1;.25;1" dur="1.4s" repeatCount="indefinite" /><animateTransform attributeName="transform" type="rotate" values="0 32 32;90 32 32;90 32 32" keyTimes="0;.5;1" dur="1.4s" repeatCount="indefinite" /></rect></g>
                    </svg>
                    <strong style={{ fontSize: "1.5rem", letterSpacing: ".02em" }}>{tx("Work in progress")}</strong>
                    <span style={{ fontSize: "2.4rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{Math.round(job.progress || 0)}%</span>
                    <div style={{ width: "min(320px, 70%)", height: 8, borderRadius: 999, background: "rgba(255,255,255,.3)", overflow: "hidden" }}><div style={{ width: `${Math.max(3, Math.min(100, job.progress || 0))}%`, height: "100%", background: "#fff", transition: "width .4s" }} /></div>
                    {job.step && <small style={{ opacity: .9 }}>{tx(job.step)}</small>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>, document.body);
}
