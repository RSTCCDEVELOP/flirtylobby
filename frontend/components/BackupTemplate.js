// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import { useAuth } from "./AuthContext";
import { tx } from "../lib/t";
import { captureFrame } from "../lib/screenshot";
import { IconBolt } from "./Icons";
import SmallEditor from "./SmallEditor";
import Tabs from "./Tabs";
import Loading from "./Loading";

// Superadmin: a backup saved as a template (Admin → Backups). The template is kept in resource/templates/<name>-<version>.zip and holds the settings of the system and the site (pages, menu, texts, pictures) of the backup,
// with example pictures that the template choice screen shows. A template may only hold demo data and must not have been used: no users, no data of plugins, no secrets and no files of people go in.
const slug = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

async function shoot(path, width, height) {  // a page of this website in a hidden frame, as a picture; null when the page does not exist
  try { const r = await fetch(path, { credentials: "include" }); if (!r.ok) return null; } catch { return null; }
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;border:0;visibility:hidden`;
  document.body.appendChild(frame);
  try {
    await new Promise((ok, no) => { const t = setTimeout(() => no(new Error("timeout")), 20000); frame.onload = () => { clearTimeout(t); ok(); }; frame.src = path; });
    await new Promise((r) => setTimeout(r, 2200));
    try { await frame.contentDocument?.fonts?.ready; } catch { /* no fonts api */ }
    const url = await captureFrame(frame, width, { styles: true });
    const blob = await (await fetch(url)).blob();
    if (blob.size <= 2_500_000) return blob;
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height; c.getContext("2d").drawImage(bmp, 0, 0);
    return await new Promise((ok) => c.toBlob((b) => ok(b || blob), "image/jpeg", 0.8));
  } finally { frame.remove(); }
}

export default function BackupTemplate({ backup, onClose }) {
  const [tab, setTab] = useState("data");
  const [v, setV] = useState({ name: "", key: "", description: "", author: "", version: "1.0.0" });
  const [keyTouched, setKeyTouched] = useState(false);
  const { user } = useAuth() || {};
  // the maker is the person who is logged in, unless somebody types another name
  useEffect(() => { const n = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || user?.display_name || user?.email || ""; if (n) setV((o) => (o.author ? o : { ...o, author: n.slice(0, 80) })); }, [user?.id]);  // eslint-disable-line react-hooks/exhaustive-deps
  const [demoOnly, setDemoOnly] = useState(false);
  const [pages, setPages] = useState(null);
  const [on, setOn] = useState({});
  const [mobile, setMobile] = useState(true);
  const [files, setFiles] = useState([]);  // example pictures that were chosen by hand
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [made, setMade] = useState(null);
  const done = useRef(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [note, setNote] = useState("");
  const [langs, setLangs] = useState([]);  // the languages of the website: with more than one the AI asks in which one to write
  const [aiLang, setAiLang] = useState("");
  const [askLang, setAskLang] = useState(false);
  useEffect(() => { api("/languages/").then((d) => { const l = (d.languages || []).filter((x) => x.enabled !== false); setLangs(l); setAiLang(d.default || l[0]?.code || "nl"); }).catch(() => {}); }, []);
  useEffect(() => { api(`/templates/?backup_pages=${backup.id}`).then((d) => { const l = d.pages || []; setPages(l); setOn(Object.fromEntries(l.slice(0, 3).map((p) => [p.key, true]))); }).catch((e) => { setPages([]); setErr(errorText(e)); }); }, [backup.id]);
  const set = (k, x) => setV((o) => ({ ...o, [k]: x, ...(k === "name" && !keyTouched ? { key: slug(x) } : {}) }));
  const ok = demoOnly && v.name.trim().length >= 2 && /^[a-z0-9][a-z0-9_-]{1,59}$/.test(v.key) && /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(v.version);
  const fillAi = async () => {  // the AI looks at the website (this backup was just made: it is the same) and fills in name, file name, description and version
    setAiBusy(true); setErr("");
    try {
      const d = await api("/templates/", { method: "POST", body: { action: "suggest", lang: aiLang } });
      setKeyTouched(false);
      setNote(d.source === "ai" ? tx("Bedacht door de AI op basis van je website.") : tx("Overgenomen uit je website (naam, slogan en pagina's). De AI gaf geen bruikbaar antwoord of is niet gekoppeld."));
      setV((o) => ({ ...o, name: d.name, key: d.key, description: d.description, version: d.version }));
    } catch (e) { setErr(errorText(e)); }
    setAiBusy(false);
  };
  const make = async () => {
    if (done.current) return;
    setErr("");
    try {
      const fd = new FormData();
      fd.append("action", "create_from_backup"); fd.append("backup", String(backup.id)); fd.append("demo_only", demoOnly ? "true" : "false");
      fd.append("key", v.key); fd.append("name", v.name.trim()); fd.append("description", v.description); fd.append("author", v.author.trim()); fd.append("version", v.version);
      files.forEach((f) => fd.append("previews", f, f.name));
      const chosen = (pages || []).filter((p) => on[p.key]);
      let n = 0;
      for (const p of chosen.slice(0, Math.max(0, 6 - files.length))) {
        setBusy(`${tx("Voorbeeld maken van")} ${p.title} (${++n}/${chosen.length})`);
        try { const b = await shoot(p.path, 1280, 800); if (b) fd.append("previews", b, `${p.key}.${b.type.includes("jpeg") ? "jpg" : "png"}`); } catch { /* a page that cannot be drawn: the template still gets made */ }
      }
      if (mobile && chosen.length) {
        setBusy(tx("Voorbeeld maken van de startpagina op een telefoon"));
        try { const b = await shoot(chosen[0].path, 390, 800); if (b) fd.append("previews", b, `mobile.${b.type.includes("jpeg") ? "jpg" : "png"}`); } catch { /* idem */ }
      }
      setBusy(tx("De template wordt gemaakt…"));
      done.current = true;
      const r = await api("/templates/", { method: "POST", body: fd });
      setMade(r.made);
      setBusy("");
    } catch (e) { done.current = false; setErr(errorText(e)); setBusy(""); }
  };
  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" aria-label={tx("Opslaan als template")} onClick={() => !busy && onClose()}>
      <div className="card modal form" style={{ width: "min(700px, 94vw)", maxHeight: "92vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()} data-easy2edit-tag="ui-template-create">
        <div className="row between"><h2 style={{ margin: 0 }}>{tx("Backup opslaan als template")}</h2><button type="button" className="btn sm" disabled={!!busy} onClick={onClose} aria-label={tx("Sluiten")}>×</button></div>
        {made ? (
          <div className="stack-sm" style={{ gap: ".7rem" }}>
            <div className="alert ok" role="status">{tx("De template {0} is opgeslagen in resource/templates. Je vindt hem bij Admin → Website → Templates, met de voorbeelden.", made.name)}</div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="btn primary" onClick={onClose}>{tx("Sluiten")}</button></div>
          </div>
        ) : (<>
          <div role="alert" style={{ display: "grid", gap: ".4rem", padding: ".8rem 1rem", borderRadius: 12, background: "color-mix(in srgb, #d98f2b 18%, transparent)" }}>
            <strong>{tx("Let op: een template mag alleen demo-gegevens bevatten")}</strong>
            <span>{tx("Een template kan alleen van een net gemaakte backup worden gemaakt, van een website die sindsdien niet is veranderd. Gebruik een website die niet gebruikt is: zonder echte teksten, klanten, bestellingen of persoonlijke gegevens. Gebruikers, gegevens van plugins, sleutels en bestanden van mensen komen niet in de template, maar pagina's, teksten en afbeeldingen wel.")}</span>
            <label className="e2e-switch" style={{ display: "flex", gap: ".6rem", alignItems: "center", cursor: "pointer" }}><span className="switch"><input type="checkbox" checked={demoOnly} onChange={(e) => setDemoOnly(e.target.checked)} /><span /></span><strong>{tx("Ik bevestig: deze backup bevat alleen demo-gegevens en is niet gebruikt")}</strong></label>
          </div>
          <Tabs value={tab} onChange={setTab} tabs={[["data", tx("Gegevens")], ["shots", tx("Voorbeelden")]]} />
          {err && <div className="alert">{err}</div>}
          {tab === "data" && (
            <div className="stack-sm" style={{ gap: ".7rem" }}>
              <div style={{ display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>
                <button type="button" className="btn sm" disabled={aiBusy || !!busy} onClick={() => (langs.length > 1 ? setAskLang((x) => !x) : fillAi())}><IconBolt /> {aiBusy ? tx("De AI kijkt naar je website…") : tx("Alles invullen met AI")}</button>
                <small className="muted">{tx("De AI bekijkt de pagina's, het thema, de modules en de talen en bedenkt naam, bestandsnaam, omschrijving en versie. Je kunt alles aanpassen.")}</small>
              </div>
              {note && <small className="muted" role="status">{note}</small>}
              {askLang && langs.length > 1 && (
                <div className="card" style={{ padding: ".7rem .9rem", display: "grid", gap: ".5rem" }}>
                  <strong>{tx("In welke taal moet de AI de gegevens schrijven?")}</strong>
                  <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>{langs.map((l) => <button type="button" key={l.code} aria-pressed={aiLang === l.code} onClick={() => setAiLang(l.code)} style={{ padding: ".25rem .8rem", borderRadius: 999, border: `1px solid ${aiLang === l.code ? "var(--blue)" : "var(--line)"}`, background: aiLang === l.code ? "color-mix(in srgb, var(--blue) 16%, var(--card))" : "var(--card)", cursor: "pointer", font: "inherit" }}>{l.native_name || l.name || l.code}</button>)}</div>
                  <div><button type="button" className="btn sm primary" disabled={aiBusy} onClick={() => { setAskLang(false); fillAi(); }}><IconBolt /> {tx("Bedenken")}</button></div>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: ".7rem 1rem" }}>
                <label className="field"><strong>{tx("Naam van de template")}</strong><input value={v.name} maxLength={80} onChange={(e) => set("name", e.target.value)} placeholder={tx("bv. Accountantskantoor")} autoFocus /></label>
                <label className="field"><strong>{tx("Bestandsnaam")}</strong><input value={v.key} maxLength={60} onChange={(e) => { setKeyTouched(true); setV((o) => ({ ...o, key: slug(e.target.value) })); }} /><small className="muted">resource/templates/{v.key || "…"}-{v.version}.zip</small></label>
                <label className="field"><strong>{tx("Maker")}</strong><input value={v.author} maxLength={80} onChange={(e) => set("author", e.target.value)} /></label>
                <label className="field"><strong>{tx("Versie")}</strong><input value={v.version} maxLength={14} onChange={(e) => set("version", e.target.value)} /></label>
              </div>
              <div className="field"><strong>{tx("Omschrijving")}</strong><SmallEditor value={v.description} onChange={(x) => set("description", x)} maxLength={1500} placeholder={tx("Voor wie is deze template en wat zit erin?")} /></div>
            </div>
          )}
          {tab === "shots" && (
            <div className="stack-sm" style={{ gap: ".6rem" }}>
              <p className="muted" style={{ margin: 0 }}>{tx("De voorbeeldplaatjes worden gemaakt van de website zoals hij nu is: dat is precies deze net gemaakte backup. Je kunt ook eigen afbeeldingen kiezen. De voorbeelden worden getoond bij het kiezen van een template.")}</p>
              {pages === null && <p className="muted"><Loading /></p>}
              {pages && !pages.length && <p className="muted">{tx("Deze backup heeft geen eigen pagina's. Kies eigen afbeeldingen, of er wordt een voorbeeldplaatje getekend.")}</p>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: ".4rem 1rem" }}>
                {(pages || []).map((p) => <label key={p.key} style={{ display: "flex", gap: ".5rem", alignItems: "center", cursor: "pointer" }}><span className="switch"><input type="checkbox" checked={!!on[p.key]} onChange={(e) => setOn((o) => ({ ...o, [p.key]: e.target.checked }))} /><span /></span><span>{p.title} <small className="muted">{p.path}</small></span></label>)}
              </div>
              {pages?.length > 0 && <label style={{ display: "flex", gap: ".5rem", alignItems: "center", cursor: "pointer" }}><span className="switch"><input type="checkbox" checked={mobile} onChange={(e) => setMobile(e.target.checked)} /><span /></span>{tx("Ook de eerste pagina op een telefoon")}</label>}
              <label className="field"><strong>{tx("Eigen afbeeldingen (optioneel)")}</strong><input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => setFiles([...e.target.files].filter((f) => f.size <= 3 * 1024 * 1024).slice(0, 6))} /><small className="muted">{files.length ? `${files.length} ${tx("gekozen")}` : tx("Maximaal 6, elk tot 3 MB.")}</small></label>
            </div>
          )}
          {busy && <div className="imp-bar imp-wait" role="progressbar" aria-label={busy}><span /></div>}
          {busy && <small className="muted" role="status">{busy}</small>}
          <div style={{ display: "flex", gap: ".6rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button type="button" className="btn" disabled={!!busy} onClick={onClose}>{tx("Annuleren")}</button>
            <button type="button" className="btn primary" disabled={!ok || !!busy} onClick={make} title={!demoOnly ? tx("Bevestig eerst dat de backup alleen demo-gegevens bevat") : undefined}>{busy ? tx("Bezig…") : tx("Template opslaan")}</button>
          </div>
        </>)}
      </div>
    </div>, document.body);
}
