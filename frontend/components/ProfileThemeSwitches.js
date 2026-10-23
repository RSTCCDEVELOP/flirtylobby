// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { Busy } from "./PageLoader";
import { useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { alertDialog, confirmDialog, promptDialog } from "../lib/dialog";
import { FIELD_TYPES, FIELD_VISIBILITY } from "./ProfileFields";
import { tx } from "../lib/t";
import Tabs from "./Tabs";

const BUILTIN = [["headline", "Kopregel"], ["bio", "Over mij"], ["gender", "Geslacht"], ["birth_date", "Leeftijd / geboortedatum"], ["city", "Plaats en land"], ["interests", "Interesses (tags)"], ["aim", "Wat zoek ik"]];
const FILTERS = [["q", "Zoekwoord"], ["gender", "Geslacht"], ["age", "Leeftijd"], ["city", "Plaats"], ["country", "Land"], ["interest", "Interesse"], ["distance", "Afstand"], ["aim", "Wat zoek ik"], ["sort", "Sorteren"], ["online", "Online"], ["photo", "Met foto"]];
const slug = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28);
const fslug = (t) => { const s = t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 28); return /^[a-z]/.test(s) ? s : `veld_${s}`; };
const LAYOUTS = [
  ["default", "Eigen opmaak van het thema", "Zoals het thema zelf is ontworpen (dating, sport, business of webshop)."],
  ["cover", "Omslag en avatar", "Een brede omslagfoto met avatar, naam en de belangrijkste gegevens als labels."],
  ["tiles", "Tegels", "Kerngegevens als tegels bovenaan, daaronder de rest van het profiel."],
  ["single", "Eén kolom", "Foto, naam en gegevens onder elkaar. Rustig en goed leesbaar op de telefoon."],
  ["split", "Foto naast tekst", "Grote foto links, gegevens en over mij rechts."],
];
// a small wireframe of each layout
function Wire({ k }) {
  const b = (st) => <i style={{ display: "block", background: "var(--line, #2a3550)", borderRadius: 4, ...st }} />;
  const a = { background: "var(--blue, #3b82f6)", opacity: 0.7 };
  return (
    <div style={{ height: 96, border: "1px solid var(--line, #2a3550)", borderRadius: 8, padding: 8, display: "grid", gap: 5, alignContent: "start", overflow: "hidden" }}>
      {k === "cover" && <>{b({ height: 30, ...a })}{b({ height: 14, width: 14, borderRadius: 7, marginTop: -12, marginLeft: 8 })}{b({ height: 6, width: "50%" })}{b({ height: 6, width: "80%" })}</>}
      {k === "tiles" && <><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>{[0, 1, 2, 3].map((n) => <span key={n}>{b({ height: 22, ...a })}</span>)}</div>{b({ height: 6, width: "70%" })}{b({ height: 6 })}{b({ height: 6, width: "50%" })}</>}
      {k === "single" && <>{b({ height: 28, ...a })}{b({ height: 6, width: "40%" })}{b({ height: 6 })}{b({ height: 6, width: "70%" })}</>}
      {k === "split" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 6 }}>{b({ height: 76, ...a })}<div style={{ display: "grid", gap: 5, alignContent: "start" }}>{b({ height: 8, width: "60%" })}{b({ height: 6 })}{b({ height: 6 })}{b({ height: 6, width: "70%" })}</div></div>}
      {k === "default" && <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 6 }}><div style={{ display: "grid", gap: 5, alignContent: "start" }}>{b({ height: 8, width: "50%" })}{b({ height: 6 })}{b({ height: 6, width: "80%" })}{b({ height: 22 })}</div>{b({ height: 76, ...a })}</div>}
    </div>
  );
}

const EMPTY = { key: "", label: "", desc: "", version: "1.0.0", builtin: { headline: true, bio: true, gender: true, birth_date: true, city: true, interests: true, aim: false }, fields: [], search: { title: "", filters: ["q", "gender", "age", "city", "country", "interest", "distance", "sort", "online", "photo"], swipe: false }, layout: "default" };

// Superadmin: the profile themes (plugin Profielthema's): install, make, edit, export / import, and choose which ones may be used.
export default function ProfileThemeSwitches() {
  const [list, setList] = useState(null);
  const [off, setOff] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null); // { pkg, isNew }
  const [etab, setEtab] = useState("general");
  const [ai, setAi] = useState(false);
  const [lib, setLib] = useState(null); // the library (resource/profielthemas)
  const loadLib = () => api("/profile-themes/library/").then((d) => setLib(d.library)).catch(() => {});
  useEffect(() => { loadLib(); }, []);
  const [aiAsk, setAiAsk] = useState(null); // { text, busy, err }
  const fileRef = useRef(null);
  const load = () => api("/profile-themes/").then((d) => { setList(d.themes); setAi(!!d.ai); setOff(false); }).catch((e) => { if (e?.status === 404 || e?.response?.status === 404) setOff(true); else setMsg(errorText(e)); });
  useEffect(() => { load(); }, []);

  async function enablePlugin() {
    setBusy(true);
    try {
      try { await api("/plugins/profile-themes/", { method: "PATCH", body: { enabled: true } }); }
      catch (e) {
        const m = errorText(e).match(/^Zet eerst ook aan: (.+)\.$/); // a plugin it needs is off: ask to switch that on too
        if (!m) throw e;
        if (!(await confirmDialog(tx("Profielthema's heeft ook {0} nodig. Die staat nog uit. Ook aanzetten?", m[1]), { title: tx("Plugins aanzetten"), okLabel: tx("Alles aanzetten") }))) { setBusy(false); return; }
        await api("/plugins/profile-themes/", { method: "PATCH", body: { enabled: true, with_requires: true } });
      }
      window.location.reload();
    } catch (e) { setMsg(errorText(e)); setBusy(false); }
  }
  async function act(fn) { setMsg(null); try { const d = await fn(); if (d?.themes) setList(d.themes); return d; } catch (e) { setMsg(errorText(e)); } }
  const toggle = (key, on) => {
    const next = list.map((t) => (t.key === key ? { ...t, enabled: on } : t));
    setList(next);
    act(() => api("/profile-themes/", { method: "PUT", body: { enabled: next.filter((t) => t.enabled).map((t) => t.key) } })).then((d) => { if (!d) load(); });
  };
  const install = (t) => act(() => api(`/profile-themes/${t.key}/install/`, { method: "POST" }));
  async function uninstall(t) {
    if (!(await confirmDialog(tx("Thema \"{0}\" verwijderen? Leden houden wat ze hebben ingevuld; je kunt het thema later weer installeren.", t.label), { danger: true }))) return;
    act(() => api(`/profile-themes/${t.key}/install/`, { method: "DELETE" }));
  }
  async function open(t) { const d = await act(() => api(`/profile-themes/${t.key}/`)); if (d?.theme) { setEtab("general"); setEdit({ pkg: d.theme, isNew: false, old: t.key }); }; }
  async function copyFrom(t) {
    const label = await promptDialog(tx("Naam van het nieuwe thema"), t ? `${t.label} 2` : "", { title: tx("Nieuw thema"), okLabel: tx("Maken") });
    if (!label?.trim()) return;
    let pkg = { ...EMPTY, label: label.trim(), key: slug(label), search: { ...EMPTY.search, title: label.trim() } };
    if (t) { const d = await act(() => api(`/profile-themes/${t.key}/`)); if (!d?.theme) return; pkg = { ...d.theme, label: label.trim(), key: slug(label), version: "1.0.0", search: { ...d.theme.search, title: label.trim() } }; }
    setEtab("general");
    setEdit({ pkg, isNew: true });
  }
  async function toLibrary() {
    const d = await act(() => api("/profile-themes/library/", { method: "POST", body: { export: true } }));
    if (d) { setLib(d.library); setMsg(tx("Alle thema's zijn naar de bibliotheek geschreven (resource/profielthemas). Ze nemen mee met de volgende push en kunnen daarna op elke site worden geïnstalleerd.")); }
  }
  async function fromLibrary(k) {
    const d = await act(() => api("/profile-themes/library/", { method: "POST", body: { install: k } }));
    if (d) setLib(d.library);
  }
  async function makeAi() {
    setAiAsk((a) => ({ ...a, busy: true, err: null }));
    try {
      const d = await api("/profile-themes/ai/", { method: "POST", body: { prompt: aiAsk.text } });
      setAiAsk(null); setEtab("general"); setEdit({ pkg: d.theme, isNew: true });
    } catch (e) { setAiAsk((a) => ({ ...a, busy: false, err: errorText(e) })); }
  }
  async function save() {
    const d = await act(() => (edit.isNew ? api("/profile-themes/new/", { method: "POST", body: edit.pkg }) : api(`/profile-themes/${edit.old}/`, { method: "PUT", body: edit.pkg })));
    if (d?.theme) setEdit(null);
  }
  async function exportTheme(t) {
    const d = await act(() => api(`/profile-themes/${t.key}/`));
    if (!d?.theme) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(d.theme, null, 1)], { type: "application/json" }));
    a.download = `profielthema-${t.key}.json`; a.click(); URL.revokeObjectURL(a.href);
  }
  async function importFile(e) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try { const pkg = JSON.parse(await f.text()); await act(() => api("/profile-themes/new/", { method: "POST", body: pkg })); } catch (er) { alertDialog(er instanceof SyntaxError ? tx("Dit is geen geldig themabestand (JSON).") : errorText(er)); }
  }

  if (off) return (
    <div className="form">
      <p className="muted" style={{ margin: 0 }}>{tx("De profielthema's zijn een plugin (Profielthema's, hoort bij Community). Zet de plugin aan om thema's te installeren, te maken en te kiezen. Staat de plugin uit, dan heeft de Community alleen het basisthema.")}</p>
      {msg && <div className="alert">{msg}</div>}
      <div><button type="button" className="btn primary" disabled={busy} onClick={enablePlugin}>{tx("Plugin Profielthema's aanzetten")}</button></div>
    </div>
  );
  if (!list) return msg ? <div className="alert">{msg}</div> : <Busy />;

  if (edit) {
    const p = edit.pkg, set = (patch) => setEdit({ ...edit, pkg: { ...p, ...patch } });
    const setF = (i, patch) => set({ fields: p.fields.map((f, n) => (n === i ? { ...f, ...patch } : f)) });
    const addField = async () => {
      const label = await promptDialog(tx("Naam van het nieuwe veld (bijv. Lievelingsgerecht)"), "", { title: tx("Nieuw veld"), okLabel: tx("Toevoegen") });
      if (!label?.trim()) return;
      let k = fslug(label), n = 2; const taken = new Set(p.fields.map((f) => f.key)); const b = k;
      while (taken.has(k)) k = `${b}_${n++}`;
      set({ fields: [...p.fields, { key: k, label: label.trim(), type: "text", options: [], unit: "", required: false, visibility: "members", card: false, filter: false, group: "" }] });
    };
    const lab = { display: "grid", gap: ".25rem", fontSize: ".82rem", fontWeight: 600 };
    const grid = (min) => ({ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: ".8rem" });
    const Chk = ({ checked, onChange, children }) => <label className="check" style={{ whiteSpace: "nowrap" }}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> <span>{children}</span></label>;
    return (
      <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) { setEdit(null); setMsg(null); } }}>
        <div className="card modal" role="dialog" aria-modal="true" style={{ maxWidth: "min(980px, 96vw)", width: "100%", maxHeight: "92vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.4rem .2rem" }}>
            <h3 style={{ margin: "0 0 .6rem" }}>{edit.isNew ? tx("Nieuw thema") : tx("Thema aanpassen")}{p.label ? ` · ${p.label}` : ""}</h3>
            <Tabs value={etab} onChange={setEtab} tabs={[["general", "Algemeen"], ["search", "Zoekpagina"], ["fields", "Eigen velden", null, p.fields.length], ["layout", "Layout"]]} />
          </div>
          <div style={{ padding: "1rem 1.4rem", overflowY: "auto", flex: 1, display: "grid", gap: "1rem", alignContent: "start" }}>
            {msg && <div className="alert">{msg}</div>}
            {etab === "general" && (<>
              <div style={grid(220)}>
                <label style={lab}><span>{tx("Naam")}</span><input value={p.label} onChange={(e) => set({ label: e.target.value })} /></label>
                <label style={lab}><span>{tx("Sleutel")}</span><input value={p.key} disabled={!edit.isNew} onChange={(e) => set({ key: slug(e.target.value) })} /></label>
              </div>
              <label style={lab}><span>{tx("Omschrijving")}</span><input value={p.desc} onChange={(e) => set({ desc: e.target.value })} /></label>
              <div style={{ display: "grid", gap: ".5rem" }}>
                <strong>{tx("Standaardvelden die getoond worden")}</strong>
                <div style={grid(200)}>{BUILTIN.map(([k, l]) => <Chk key={k} checked={!!p.builtin[k]} onChange={(v) => set({ builtin: { ...p.builtin, [k]: v } })}>{tx(l)}</Chk>)}</div>
              </div>
            </>)}
            {etab === "search" && (<>
              <label style={lab}><span>{tx("Titel van de zoekpagina")}</span><input value={p.search?.title || ""} onChange={(e) => set({ search: { ...p.search, title: e.target.value } })} /></label>
              <div style={{ display: "grid", gap: ".5rem" }}>
                <strong>{tx("Filters die getoond worden")}</strong>
                <div style={grid(170)}>{FILTERS.map(([k, l]) => <Chk key={k} checked={(p.search?.filters || []).includes(k)} onChange={(v) => set({ search: { ...p.search, filters: v ? [...(p.search.filters || []), k] : p.search.filters.filter((x) => x !== k) } })}>{tx(l)}</Chk>)}</div>
              </div>
              <Chk checked={!!p.search?.swipe} onChange={(v) => set({ search: { ...p.search, swipe: v } })}>{tx("Swipen (standaard aan)")}</Chk>
            </>)}
            {etab === "layout" && (<>
              <p className="muted" style={{ margin: 0 }}>{tx("Kies de layout van dit thema. De gekozen layout is de standaard voor het openbare profiel van de community; leden gebruiken hem ook bij Wijzig profiel. Velden met 'Op de kaart' komen als labels of tegels bovenaan.")}</p>
              <div style={grid(200)}>
                {LAYOUTS.map(([k, l, d]) => {
                  const on = (p.layout || "default") === k;
                  return (
                    <button key={k} type="button" onClick={() => set({ layout: k })} aria-pressed={on} style={{ textAlign: "left", display: "grid", gap: ".5rem", padding: ".7rem", borderRadius: 12, cursor: "pointer", background: "transparent", color: "inherit", border: on ? "2px solid var(--blue, #3b82f6)" : "1px solid var(--line, #2a3550)" }}>
                      <Wire k={k} />
                      <strong>{tx(l)}{on && <span className="badge ok" style={{ marginLeft: ".5rem", display: "inline-block", width: "auto", flex: "none" }}>{tx("Standaard")}</span>}</strong>
                      <small className="muted">{tx(d)}</small>
                    </button>
                  );
                })}
              </div>
            </>)}
            {etab === "fields" && (<>
              <div><button type="button" className="btn sm primary" onClick={addField}>{tx("Veld toevoegen")}</button></div>
              {p.fields.length === 0 && <p className="muted" style={{ margin: 0 }}>{tx("Dit thema heeft nog geen eigen velden.")}</p>}
              {p.fields.map((f, i) => (
                <div key={f.key} style={{ border: "1px solid var(--line, #2a3550)", borderRadius: 12, padding: ".9rem 1rem", display: "grid", gap: ".7rem" }}>
                  <div style={grid(170)}>
                    <label style={lab}><span>{tx("Naam")} <span className="muted" style={{ fontWeight: 400 }}>({f.key})</span></span><input value={f.label} onChange={(e) => setF(i, { label: e.target.value })} /></label>
                    <label style={lab}><span>{tx("Soort")}</span><select value={f.type} onChange={(e) => setF(i, { type: e.target.value })}>{FIELD_TYPES.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select></label>
                    <label style={lab}><span>{tx("Zichtbaar voor")}</span><select value={f.visibility} onChange={(e) => setF(i, { visibility: e.target.value })}>{FIELD_VISIBILITY.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select></label>
                    <label style={lab}><span>{tx("Groep")}</span><input value={f.group} onChange={(e) => setF(i, { group: e.target.value })} /></label>
                  </div>
                  {(f.type === "select" || f.type === "multiselect") && <label style={lab}><span>{tx("Keuzes (gescheiden met een komma)")}</span><input defaultValue={f.options.join(", ")} onBlur={(e) => setF(i, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></label>}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem 1.2rem", alignItems: "center" }}>
                    <Chk checked={f.card} onChange={(v) => setF(i, { card: v })}>{tx("Op de kaart")}</Chk>
                    <Chk checked={f.filter} onChange={(v) => setF(i, { filter: v })}>{tx("Zoekfilter")}</Chk>
                    <Chk checked={f.required} onChange={(v) => setF(i, { required: v })}>{tx("Verplicht")}</Chk>
                    <button type="button" className="btn sm danger" style={{ marginLeft: "auto" }} onClick={() => set({ fields: p.fields.filter((_, n) => n !== i) })}>{tx("Verwijderen")}</button>
                  </div>
                </div>
              ))}
            </>)}
          </div>
          <div style={{ padding: ".8rem 1.4rem", borderTop: "1px solid var(--line, #2a3550)", display: "flex", gap: ".6rem", justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={() => { setEdit(null); setMsg(null); }}>{tx("Annuleren")}</button>
            <button type="button" className="btn primary" onClick={save}>{tx("Opslaan")}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="form" style={{ maxWidth: "none", width: "100%" }}>
      {aiAsk && (
        <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !aiAsk.busy) setAiAsk(null); }}>
          <div className="card modal" role="dialog" aria-modal="true" style={{ maxWidth: 620, display: "grid", gap: ".8rem" }}>
            <h3 style={{ margin: 0 }}>{tx("Thema maken met AI")}</h3>
            <p className="muted" style={{ margin: 0 }}>{tx("Beschrijf hoe het profielthema eruit moet zien: voor wie het is, welke gegevens je wilt vragen en welke sfeer of layout. De AI maakt het thema; je kunt het daarna nog aanpassen voordat je het opslaat.")}</p>
            <textarea rows={6} autoFocus value={aiAsk.text} disabled={aiAsk.busy} onChange={(e) => setAiAsk({ ...aiAsk, text: e.target.value })} placeholder={tx("Bijvoorbeeld: een thema voor een wandelclub met niveau, afstand, tempo, favoriete routes en of je auto hebt voor carpoolen. Met tegels bovenaan.")} />
            {aiAsk.err && <div className="alert">{aiAsk.err}</div>}
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn" disabled={aiAsk.busy} onClick={() => setAiAsk(null)}>{tx("Annuleren")}</button>
              <button type="button" className="btn primary" disabled={aiAsk.busy || aiAsk.text.trim().length < 8} onClick={makeAi}>{aiAsk.busy ? tx("Bezig...") : tx("Thema maken")}</button>
            </div>
          </div>
        </div>
      )}
      {msg && <div className="alert">{msg}</div>}
      <p className="muted" style={{ margin: 0 }}>{tx("Installeer thema's, maak er zelf een of importeer een themabestand. Bepaal met de schakelaar welke thema's de beheerders van de community mogen kiezen (Admin → Community → Profielthema en velden). Het basisthema staat altijd aan; het thema in gebruik blijft aan.")}</p>
      <div className="row"><button type="button" className="btn primary sm" onClick={() => copyFrom(null)}>{tx("Nieuw thema")}</button><button type="button" className="btn sm" onClick={() => fileRef.current?.click()}>{tx("Importeren")}</button>{ai && <button type="button" className="btn sm" onClick={() => setAiAsk({ text: "", busy: false })}>{tx("Maken met AI")}</button>}<button type="button" className="btn sm" onClick={toLibrary}>{tx("Alles naar de bibliotheek")}</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importFile} /></div>
      <div className="plugin-items" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: ".8rem" }}>
        {list.map((t) => (
          <div key={t.key} className="plugin-item" style={{ flexDirection: "column", alignItems: "stretch", gap: ".6rem" }}>
            <span className="pi-main"><strong>{tx(t.label)}</strong>{t.active && <span className="badge ok" style={{ marginLeft: ".5rem", display: "inline-block", width: "auto", flex: "none" }}>{tx("In gebruik")}</span>}{!t.installed && <span className="badge" style={{ marginLeft: ".5rem", display: "inline-block", width: "auto", flex: "none" }}>{tx("Niet geïnstalleerd")}</span>}<span className="pi-desc">{tx(t.desc)} · {t.fields} {tx("eigen velden")}</span></span>
            <span className="pi-actions" style={{ display: "flex", flexWrap: "wrap", gap: ".4rem", alignItems: "center" }}>
              {!t.installed && <button type="button" className="btn sm primary" onClick={() => install(t)}>{tx("Installeren")}</button>}
              {t.installed && <><button type="button" className="btn sm" onClick={() => open(t)}>{tx("Aanpassen")}</button><button type="button" className="btn sm" onClick={() => copyFrom(t)}>{tx("Kopiëren")}</button><button type="button" className="btn sm" onClick={() => exportTheme(t)}>{tx("Exporteren")}</button>{!t.basic && <button type="button" className="btn sm danger" disabled={t.locked} onClick={() => uninstall(t)}>{tx("Verwijderen")}</button>}</>}
              {t.installed && <label className="check sec-toggle" title={t.locked ? tx(t.active ? "Dit thema is in gebruik" : "Het basisthema staat altijd aan") : undefined}>
                <span className="switch"><input type="checkbox" checked={t.enabled} disabled={t.locked} onChange={(e) => toggle(t.key, e.target.checked)} /><span /></span>
                <span>{t.enabled ? tx("Aan") : tx("Uit")}</span>
              </label>}
            </span>
          </div>
        ))}
      </div>
      {lib && lib.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>{tx("Bibliotheek")} ({lib.length})</summary>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: ".6rem", marginTop: ".6rem" }}>
            {lib.map((x) => (
              <div key={x.key} className="plugin-item" style={{ flexDirection: "column", alignItems: "stretch", gap: ".4rem" }}>
                <span className="pi-main"><strong>{tx(x.label)}</strong><span className="pi-desc">{x.fields} {tx("eigen velden")}{x.installed ? ` · ${tx("geïnstalleerd")}` : ""}</span></span>
                <span><button type="button" className="btn sm" onClick={() => fromLibrary(x.key)}>{x.installed ? (x.changed ? tx("Bijwerken") : tx("Opnieuw installeren")) : tx("Installeren")}</button></span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
