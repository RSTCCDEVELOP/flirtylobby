// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { ResourceButtons } from "./ResourceLibrary";
import { Busy } from "./PageLoader";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import Collapsible from "./Collapsible";
import ThemeImport from "./ThemeImport";
import ThemePackEdit from "./ThemePackEdit";
import { api, apiBase, errorText, getToken } from "../lib/api";
import { alertDialog, confirmDialog } from "../lib/dialog";
import { lvl } from "../lib/perms";
import { tx } from "../lib/t";

// Theme packages: every theme besides the two house styles (RSTCC, Studio2) is a package in the themes folder; switched on = it shows in Vormgeving -> Thema's.
export default function ThemePacksAdmin() {
  const router = useRouter();
  const { user } = useAuth();
  const L = lvl(user, "theme");
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const [chooser, setChooser] = useState(false); // "new theme package": empty, from this website, or from a website address
  const [importing, setImporting] = useState(false);
  const [name, setName] = useState("");
  const input = useRef(null);
  const load = useCallback(() => api("/theme/packs/").then(setD).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);
  const set = (r) => setD((x) => ({ ...x, packs: r.packs }));

  async function toggle(p, on) {
    setMsg(null);
    try { set(await api(`/theme/packs/${p.key}/`, { method: "PATCH", body: { enabled: on } })); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }
  async function remove(p) {
    if (!(await confirmDialog(tx("Themapakket {0} verwijderen? De map met het thema wordt gewist.", p.name), { title: tx("Themapakket verwijderen"), okLabel: tx("Verwijderen"), danger: true }))) return;
    try { set(await api(`/theme/packs/${p.key}/`, { method: "DELETE" })); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }
  async function use(p) {
    const files = p.assets.length > 0 || p.home_count > 0;
    const withFiles = files && (await confirmDialog(tx("Het thema {0} heeft eigen logo's en afbeeldingen. Die worden nu ook ingesteld en vervangen de huidige logo's, favicon en homepagefoto's. Kies Annuleren om alleen de kleuren en vormen over te nemen.", p.name), { title: tx("Thema met logo's"), okLabel: tx("Logo's ook instellen") }));
    try { set(await api(`/theme/packs/${p.key}/use/`, { method: "POST", body: { files: withFiles } })); setMsg({ ok: true, text: tx("Het thema {0} is nu de vormgeving van de website.", p.name) }); router.refresh(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }
  async function download(p) {
    const res = await fetch(`${apiBase()}/api/theme/packs/${p.key}/download/`, { headers: { Authorization: `Token ${getToken()}` } });
    if (!res.ok) return setMsg({ ok: false, text: tx("Het pakket kon niet worden opgehaald.") });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await res.blob()); a.download = `theme-${p.key}.zip`; a.click();
  }
  async function downloadAll() {
    const res = await fetch(`${apiBase()}/api/theme/packs/download-all/`, { headers: { Authorization: `Token ${getToken()}` } });
    if (!res.ok) return setMsg({ ok: false, text: tx("Het pakket kon niet worden opgehaald.") });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await res.blob()); a.download = "themes-all.zip"; a.click();
  }
  async function buildDist() {
    setBusy(true); setMsg(null);
    try {
      const r = await api("/theme/packs/dist/", { method: "POST", body: {} });
      const text = tx("{0} zips staan in {1}.", r.files.length, r.folder);
      setMsg({ ok: true, text });
      await alertDialog(`${tx("Export klaar")}\n${text}`);
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); await alertDialog(errorText(e)); }
    setBusy(false);
  }
  async function upload(file) {
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await api("/theme/packs/upload/", { method: "POST", body: fd });
      set(r);
      setMsg({ ok: true, text: (r.installed || []).length > 1 ? tx("{0} themapakketten geïnstalleerd. Zet aan wat je wilt gebruiken.", r.installed.length) : tx("Themapakket geïnstalleerd. Zet het aan als je het wilt gebruiken.") });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  }
  async function create(from_current) {
    if (!name.trim()) return setMsg({ ok: false, text: tx("Geef het thema een naam.") });
    try { const r = await api("/theme/packs/create/", { method: "POST", body: { name, from_current } }); set(r); setChooser(false); setName(""); setEdit(r.key); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }
  async function scan() { setBusy(true); await load(); setBusy(false); setMsg({ ok: true, text: tx("Map gescand.") }); }

  if (!d) return msg ? <div className="alert">{msg.text}</div> : <Busy />;
  const packs = d.packs.filter((p) => !q || `${p.name} ${p.description}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <p className="muted" style={{ margin: "0 0 1rem" }}>{tx("Het systeem heeft zelf alleen RSTCC en Studio2. Alle andere thema's zijn pakketten in de themamap. Een pakket dat aan staat, kun je hier gebruiken voor de website; de logo's, het e-mailuiterlijk en de fijne instellingen pas je aan in de andere tabs.")}</p>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      {(
        <div>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
            <input type="search" style={{ maxWidth: 300 }} placeholder={tx("Zoek een thema…")} value={q} onChange={(e) => setQ(e.target.value)} />
            {L >= 2 && <button className="btn primary" onClick={() => setChooser(true)}>{tx("+ Nieuw themapakket")}</button>}
          </div>
          <div className="preset-grid pack-grid">
            {packs.map((p) => (
              <div key={p.key} className={`preset pack ${p.active ? "active" : ""}`}>
                <span className="swatches">
                  <i style={{ background: p.colors.light_bg }} /><i style={{ background: p.colors.light_card, borderColor: p.colors.light_text }} />
                  <i style={{ background: p.colors.primary }} /><i style={{ background: p.colors.secondary }} />
                  <i style={{ background: p.colors.dark_card }} /><i style={{ background: p.colors.dark_bg }} />
                </span>
                <div className="pack-head">
                  <strong title={p.name}>{p.name}</strong>
                  {!p.builtin && (
                    <label className="pack-switch" title={p.enabled ? tx("Aan: te gebruiken") : tx("Uit")}>
                      <span className="switch"><input type="checkbox" checked={p.enabled} disabled={L < 2} onChange={(e) => toggle(p, e.target.checked)} /><span /></span>
                      <small>{p.enabled ? tx("Aan") : tx("Uit")}</small>
                    </label>
                  )}
                </div>
                <div className="pack-badges">
                  {p.builtin && <span className="badge ok">{tx("Ingebouwd")}</span>}
                  {p.customized && <span className="badge">{tx("Aangepast")}</span>}
                  {p.active && <span className="badge ok">{tx("In gebruik")}</span>}
                </div>
                <small className="pack-desc">{p.description || "—"}</small>
                <small className="muted pack-meta">
                  {p.fonts[0]}{p.fonts[1] !== p.fonts[0] ? ` / ${p.fonts[1]}` : ""} · v{p.version}{["outdated", "incompatible", "newer"].includes(p.compat) ? ` · ⚠ ${tx("voor systeem")} ${p.built_for}` : ""}
                  <br />{p.assets.length || p.home_count ? tx("Met logo's en afbeeldingen: {0}", [...p.assets.map((a) => a.replace("_", " ")), p.home_count ? tx("{0} homepagefoto's", p.home_count) : null].filter(Boolean).join(", ")) : tx("Zonder logo's en afbeeldingen")}
                </small>
                <div className="pack-foot">
                  <div className="pack-btns">
                    <button className={`btn sm ${p.active ? "" : "primary"}`} disabled={p.active || L < 2} onClick={() => use(p)}>{p.active ? tx("In gebruik") : tx("Gebruiken")}</button>
                    <button className="btn sm" disabled={L < 2} onClick={() => setEdit(p.key)}>{tx("Bewerken")}</button>
                    <button className="btn sm" onClick={() => download(p)}>{tx("Download")}</button>
                    {!p.builtin && L >= 3 ? <button className="btn sm danger" onClick={() => remove(p)}>{tx("Verwijder")}</button> : <span />}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {!packs.length && <p className="muted">{tx("Geen thema's gevonden.")}</p>}
        </div>
      )}

      <Collapsible id="theme-pack-all" title={tx("Alle thema's (exporteren)")}>
        <div style={{ display: "grid", gap: ".6rem" }}>
          <p className="muted" style={{ margin: 0 }}>{tx("Alle thema's in één zipbestand, met hun logo's en afbeeldingen. Importeer het in een andere website met Pakket uploaden hieronder. Ook van elk thema los staat een zip in de map {0}; die map hoort niet bij de repository.", d.dist)}</p>
          <div className="row">
            <button type="button" className="btn primary" style={{ whiteSpace: "nowrap" }} onClick={downloadAll}>{tx("Alle thema's downloaden (zip)")}</button>
            {user?.is_staff && L >= 2 && <button type="button" className="btn" style={{ whiteSpace: "nowrap" }} disabled={busy} onClick={buildDist}>{tx("Exporteer alle thema's (resource/themas)")}</button>}
          </div>
        </div>
      </Collapsible>

      <Collapsible id="theme-pack-library" title={tx("Thema toevoegen of updaten uit de bibliotheek")}>
        <div className="row" style={{ justifyContent: "flex-start", gap: ".6rem", flexWrap: "wrap" }}>
          <ResourceButtons kind="themas" onChanged={() => window.location.reload()} />
        </div>
        <p className="muted" style={{ margin: ".5rem 0 0" }}>{tx("De map resource/themas van het product bevat de thema's (alleen de nieuwste versie): je hoeft niets te uploaden.")}</p>
      </Collapsible>

      <Collapsible id="theme-pack-upload" title={tx("Pakket uploaden")}>
        <div>
          <p className="muted">{tx("Een themapakket is een zipbestand met één bestand: theme.json. Een zip met alle thema's (één map per thema) wordt ook geïmporteerd. Download een bestaand pakket als voorbeeld.")}</p>
          {L >= 2 ? (
            <div className={`dropzone ${over ? "over" : ""}`} role="button" tabIndex={0} onClick={() => input.current.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current.click()}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files[0]); }}>
              <span>{busy ? tx("Bezig…") : tx("Sleep een themapakket (.zip) hierheen of klik om te kiezen")}</span>
              <input ref={input} type="file" accept=".zip,application/zip" hidden onChange={(e) => { upload(e.target.files[0]); e.target.value = ""; }} />
            </div>
          ) : <p className="muted">{tx("Je hebt geen rechten om pakketten te uploaden.")}</p>}
        </div>
      </Collapsible>

      <Collapsible id="theme-pack-folder" title={tx("Themamap")}>
        <div className="stack-sm">
          <p>{tx("De themamap:")} <code>{d.folder}</code></p>
          <p className="muted">{tx("Elk thema is een map met een bestand theme.json (naam, omschrijving, versie en de instellingen van Vormgeving die het thema wijzigt). Zet een nieuwe map in de themamap en kies Map scannen.")}</p>
          <div><button className="btn" disabled={busy} onClick={scan}>{tx("Map scannen")}</button></div>
        </div>
      </Collapsible>
      {chooser && (
        <div className="overlay" onClick={() => setChooser(false)}>
          <div className="card modal form" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <h2>{tx("Nieuw themapakket")}</h2>
            <label>{tx("Naam van het thema")}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus /></label>
            <div className="stack-sm">
              <button type="button" className="btn" onClick={() => create(false)}>{tx("Leeg pakket")}</button>
              <small className="muted" style={{ marginTop: "-.5rem" }}>{tx("Begin met een leeg pakket en vul het zelf met logo's en afbeeldingen.")}</small>
              <button type="button" className="btn" onClick={() => create(true)}>{tx("Van deze website")}</button>
              <small className="muted" style={{ marginTop: "-.5rem" }}>{tx("Neem de vormgeving, logo's, favicon en homepagefoto's van deze website over.")}</small>
              <button type="button" className="btn primary" onClick={() => { setChooser(false); setImporting(true); }}>{tx("Importeren van een website…")}</button>
              <small className="muted" style={{ marginTop: "-.5rem" }}>{d.ai ? tx("Claude maakt een compleet thema van het webadres. Je controleert het eerst.") : tx("Een thema afleiden uit het webadres. Je controleert het eerst.")}</small>
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn" onClick={() => setChooser(false)}>{tx("Annuleren")}</button></div>
          </div>
        </div>
      )}
      {importing && <ThemeImport ai={d.ai} onClose={() => setImporting(false)} onSaved={(packs, key, photos) => { setD((x) => ({ ...x, packs })); setImporting(false); setMsg({ ok: true, text: tx("Het thema is opgeslagen als themapakket. Zet het aan en kies Gebruiken om het toe te passen.") + (photos ? ` ${tx("{0} foto's staan in de mediabibliotheek.", photos)}` : "") }); setEdit(null); }} />}
      {edit && d.packs.find((p) => p.key === edit) && <ThemePackEdit pack={d.packs.find((p) => p.key === edit)} onClose={() => setEdit(null)} onChanged={(packs) => setD((x) => ({ ...x, packs }))} />}
    </>
  );
}
