"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";
import { IconImage, IconSettings } from "./Icons";
import Tabs from "./Tabs";

// The logos, favicon and so on that belong to a theme package (the same pieces as Admin -> Logo's & beeld)
const SLOTS = [
  ["logo", "Logo", "Voor lichte achtergrond. PNG/WebP met transparante achtergrond."],
  ["logo_dark", "Logo (donkere modus)", "Optioneel: logo voor donkere achtergrond."],
  ["favicon", "Favicon", "Icoon in het browsertabblad. Vierkant, 64×64 of groter."],
  ["icon", "App-icoon", "Voor het startscherm van iPhone/Android. Vierkant, 512×512."],
  ["og_image", "Deelafbeelding", "Getoond bij delen op social media. 1200×630."],
];

function Pick({ onFile, children, ...rest }) {
  const ref = useRef(null);
  return (
    <>
      <button type="button" className="btn sm" onClick={() => ref.current.click()} {...rest}>{children}</button>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon,.ico" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) onFile(f); }} />
    </>
  );
}

export default function ThemePackEdit({ pack, onClose, onChanged }) {
  const [tab, setTab] = useState("info");
  const [meta, setMeta] = useState({ name: pack.name, description: pack.description, version: pack.version, mode: pack.mode || "" });
  const [files, setFiles] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const base = `/theme/packs/${pack.key}`;
  const load = useCallback(() => api(`${base}/assets/`).then(setFiles).catch((e) => setMsg({ ok: false, text: errorText(e) })), [base]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); if (r?.packs) onChanged(r.packs); await load(); if (ok) setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const upload = (url, f, extra = {}) => { const fd = new FormData(); fd.append("image", f); Object.entries(extra).forEach(([k, v]) => fd.append(k, v)); return api(url, { method: url.includes("/slot/") ? "PUT" : "POST", body: fd }); };
  const saveMeta = () => run(() => api(`${base}/`, { method: "PATCH", body: { ...meta, home: files?.home?.map((h) => ({ caption: h.caption })) } }), tx("Opgeslagen."));
  const capture = async () => {
    if (!(await confirmDialog(tx("De vormgeving, logo's, favicon en homepagefoto's van de website zoals ze nu zijn worden in dit pakket gezet. De huidige inhoud van het pakket wordt vervangen."), { title: tx("Huidige website in dit pakket zetten"), okLabel: tx("In pakket zetten") }))) return;
    run(() => api(`${base}/capture/`, { method: "POST" }), tx("De website is in dit pakket gezet."));
  };
  const setCaption = (i, caption) => setFiles((f) => ({ ...f, home: f.home.map((h, n) => (n === i ? { ...h, caption } : h)) }));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal form" style={{ maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
        <h2>{tx("Themapakket bewerken")}: {pack.name}</h2>
        <Tabs value={tab} onChange={setTab} tabs={[["info", "Gegevens", <IconSettings key="i" />], ["brand", "Logo's & beeld", <IconImage key="b" />], ["home", "Homepagefoto's", <IconImage key="h" />, files?.home?.length || undefined]]} />
        {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}

        {tab === "info" && (
          <>
            <div className="grid2">
              <label>{tx("Naam")}<input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} maxLength={60} /></label>
              <label>{tx("Versie")}<input value={meta.version} onChange={(e) => setMeta({ ...meta, version: e.target.value })} placeholder="1.0.0" /></label>
            </div>
            <label>{tx("Omschrijving")}<input value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} maxLength={300} /></label>
            <label>{tx("Standaard weergave")}
              <select value={meta.mode} onChange={(e) => setMeta({ ...meta, mode: e.target.value })}>
                <option value="">{tx("Geen voorkeur")}</option><option value="light">{tx("Licht")}</option><option value="dark">{tx("Donker")}</option>
              </select>
            </label>
            <div className="row" style={{ justifyContent: "flex-start" }}>
              <button type="button" className="btn primary" disabled={busy} onClick={saveMeta}>{tx("Opslaan")}</button>
              <button type="button" className="btn" disabled={busy} onClick={capture}>{tx("Huidige website in dit pakket zetten")}</button>
            </div>
            <small className="muted">{tx("De kleuren, lettertypen en vormen van een pakket pas je aan bij Vormgeving. Zet daarna met de knop hierboven de huidige website (met logo's en homepagefoto's) in dit pakket.")}</small>
          </>
        )}

        {tab === "brand" && (
          <div className="stack-sm">
            {SLOTS.map(([slot, label, hint]) => {
              const f = files?.slots?.[slot];
              return (
                <div key={slot} className="card row" style={{ justifyContent: "space-between", flexWrap: "nowrap", gap: "1rem" }}>
                  <span className="row" style={{ flexWrap: "nowrap", gap: "1rem", minWidth: 0 }}>
                    <span style={{ width: 96, height: 64, display: "grid", placeItems: "center", background: "var(--bg)", borderRadius: 8, flex: "none" }}>
                      {f ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={f.url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <small className="muted">{tx("Geen")}</small>}
                    </span>
                    <span style={{ minWidth: 0 }}><strong>{tx(label)}</strong><br /><small className="muted">{tx(hint)}</small></span>
                  </span>
                  <span className="row" style={{ gap: ".4rem", flexWrap: "nowrap" }}>
                    <Pick disabled={busy} onFile={(file) => run(() => upload(`${base}/slot/${slot}/`, file))}>{f ? tx("Vervangen") : tx("Uploaden")}</Pick>
                    {f && <button type="button" className="btn sm danger" disabled={busy} onClick={() => run(() => api(`${base}/slot/${slot}/`, { method: "DELETE" }))}>{tx("Verwijder")}</button>}
                  </span>
                </div>
              );
            })}
            <small className="muted">{tx("Een pakket zonder logo laat het logo van de website zoals het is. Kies je dit thema bij Vormgeving, dan kun je de logo's van het pakket meteen instellen.")}</small>
          </div>
        )}

        {tab === "home" && (
          <>
            <div className="photo-admin">
              {(files?.home || []).map((h, i) => (
                <div className="photo-item" key={h.file}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={h.url} alt="" />
                  <input value={h.caption} placeholder={tx("Bijschrift")} onChange={(e) => setCaption(i, e.target.value)} onBlur={saveMeta} maxLength={255} />
                  <button type="button" className="btn sm danger" disabled={busy} onClick={() => run(() => api(`${base}/home/${i}/`, { method: "DELETE" }))}>{tx("Verwijder")}</button>
                </div>
              ))}
            </div>
            {!files?.home?.length && <p className="muted">{tx("Nog geen homepagefoto's in dit pakket.")}</p>}
            {(files?.home?.length || 0) < 12 && <div><Pick disabled={busy} onFile={(file) => run(() => upload(`${base}/home/`, file))}>{tx("+ Foto toevoegen")}</Pick></div>}
          </>
        )}

        <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn" onClick={onClose}>{tx("Sluiten")}</button></div>
      </div>
    </div>
  );
}
