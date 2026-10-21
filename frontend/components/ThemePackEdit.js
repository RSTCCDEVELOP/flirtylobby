"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";
import { IconGrid, IconImage, IconPalette, IconSettings } from "./Icons";
const IconAi = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>;
import { useAutoSave } from "../lib/autosave";
import { scopedCss } from "../lib/themescope";
import SaveStatus from "./SaveStatus";
import ThemeLayout from "./ThemeLayout";
import { Field } from "./ThemeLook";
import MediaField from "./MediaField";
import Tabs from "./Tabs";

// The logos, favicon and so on that belong to a theme package (the same pieces as Admin -> Logo's & beeld)
const SLOTS = [
  ["logo", "Logo", "Voor lichte achtergrond. PNG/WebP met transparante achtergrond."],
  ["logo_dark", "Logo (donkere modus)", "Optioneel: logo voor donkere achtergrond."],
  ["favicon", "Favicon", "Icoon in het browsertabblad. Vierkant, 64×64 of groter."],
  ["icon", "App-icoon", "Voor het startscherm van iPhone/Android. Vierkant, 512×512."],
  ["og_image", "Deelafbeelding", "Getoond bij delen op social media. 1200×630."],
];

export default function ThemePackEdit({ pack, onClose, onChanged }) {
  const [tab, setTab] = useState("info");
  const [meta, setMeta] = useState({ name: pack.name, description: pack.description, version: pack.version, mode: pack.mode || "" });
  const [files, setFiles] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [schema, setSchema] = useState([]);
  const [vals, setVals] = useState(null); // all settings of the theme (colours, fonts, shapes, page templates …), saved by itself
  const [css, setCss] = useState("");
  const [dark, setDark] = useState(false);
  const [show, setShow] = useState("pages");
  const [sub, setSub] = useState("page_layout"); // the group of settings that is open
  const [ai, setAi] = useState(false); // Claude linked?
  const [ask, setAsk] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [refUrl, setRefUrl] = useState(""); // a page on the web whose colours Claude uses for this theme
  const [undoStack, setUndoStack] = useState([]); // values before each change by Claude
  const [note, setNote] = useState("");
  const base = `/theme/packs/${pack.key}`;
  const load = useCallback(() => api(`${base}/assets/`).then(setFiles).catch((e) => setMsg({ ok: false, text: errorText(e) })), [base]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api("/theme/").then((d) => setSchema(d.schema)).catch(() => {}); api("/theme/packs/").then((d) => setAi(!!d.ai)).catch(() => {}); }, []);
  async function improve() {
    setAiBusy(true); setMsg(null); setNote("");
    try {
      const before = vals;
      const r = await api(`${base}/refine/`, { method: "POST", body: { prompt: ask, url: refUrl } });
      setUndoStack((u) => [...u.slice(-4), before]); setVals(r.values); onChanged(r.packs); setNote(r.summary); setAsk(""); setRefUrl("");
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setAiBusy(false);
  }
  function undo() { const prev = undoStack[undoStack.length - 1]; if (!prev) return; setUndoStack((u) => u.slice(0, -1)); setVals(prev); setNote(tx("De vorige versie is teruggezet.")); }
  useEffect(() => { if (files?.values && !vals) setVals(files.values); }, [files, vals]);
  const auto = useAutoSave(vals, async (v) => { try { const r = await api(`${base}/`, { method: "PATCH", body: { values: v } }); onChanged(r.packs); } catch (e) { setMsg({ ok: false, text: errorText(e) }); return false; } }, { ready: !!vals, delay: 900 });
  useEffect(() => { if (tab !== "preview" || !vals) return undefined; const t = setTimeout(() => scopedCss(vals).then(setCss).catch(() => {}), 300); return () => clearTimeout(t); }, [tab, vals]);

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
  const resetBuiltin = async () => {
    if (!(await confirmDialog(tx("Dit ingebouwde thema weer terugzetten naar de standaard van het systeem? Je aanpassingen (waarden, logo's en foto's) worden gewist."), { title: tx("Standaard herstellen"), okLabel: tx("Herstellen"), danger: true }))) return;
    run(async () => { const r = await api(`/theme/packs/${pack.key}/reset/`, { method: "POST" }); setMeta({ name: r.packs.find((x) => x.key === pack.key).name, description: r.packs.find((x) => x.key === pack.key).description, version: r.packs.find((x) => x.key === pack.key).version, mode: "" }); return r; }, tx("Hersteld naar de standaard."));
  };
  const setCaption = (i, caption) => setFiles((f) => ({ ...f, home: f.home.map((h, n) => (n === i ? { ...h, caption } : h)) }));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal form" style={{ maxWidth: 980 }} onClick={(e) => e.stopPropagation()}>
        <h2>{tx("Themapakket bewerken")}: {pack.name}</h2>
        <Tabs value={tab} onChange={setTab} tabs={[["info", "Gegevens", <IconSettings key="i" />], ["layout", "Layout", <IconGrid key="l" />], ["style", "Instellingen", <IconPalette key="s" />], ["ai", "AI", <IconAi key="ai" />], ["preview", "Voorbeelden", <IconGrid key="v" />], ["brand", "Logo's & beeld", <IconImage key="b" />], ["home", "Homepagefoto's", <IconImage key="h" />, files?.home?.length || undefined]]} />
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
              {pack.builtin && pack.customized && <button type="button" className="btn danger" disabled={busy} onClick={resetBuiltin}>{tx("Standaard herstellen")}</button>}
            </div>
            <small className="muted">{pack.builtin ? tx("Dit thema hoort bij het systeem. Je aanpassingen worden naast de standaard bewaard; met Standaard herstellen zet je de oorspronkelijke waarden terug. ") : ""}{tx("De kleuren, lettertypen en vormen van een pakket pas je aan bij Vormgeving. Zet daarna met de knop hierboven de huidige website (met logo's en homepagefoto's) in dit pakket.")}</small>
          </>
        )}

        {tab === "layout" && vals && (
          <div className="packlay">
            <div className="packlay-head">
              <small className="muted">{tx("De basisindeling van dit thema. Een pagina kan dit voor zichzelf anders instellen (Pagina-instellingen → Pagina-opzet).")}</small>
              <SaveStatus auto={auto} />
            </div>
            <div className="packlay-card">
              {[["page_header", "Header", "De kopbalk met logo en menu"], ["page_footer", "Footer", "De voetbalk onderaan de pagina"]].map(([k, l, h]) => (
                <label key={k} className="packlay-row">
                  <span className="switch"><input type="checkbox" checked={(vals[k] || "show") !== "hide"} onChange={(e) => setVals((x) => ({ ...x, [k]: e.target.checked ? "show" : "hide" }))} /><span /></span>
                  <span className="packlay-text"><strong>{tx(l)}</strong><small className="muted">{tx(h)}</small></span>
                  <span className="packlay-state muted">{(vals[k] || "show") !== "hide" ? tx("Aan") : tx("Uit")}</span>
                </label>
              ))}
            </div>
            <div className="packlay-card">
              <strong>{tx("Weergave")}</strong>
              <div className="pb-seg">
                {[["system", "Automatisch", "volgt het apparaat van de bezoeker"], ["light", "Licht", ""], ["dark", "Donker", ""]].map(([k, l, h]) => (
                  <button type="button" key={k} className={(vals.default_mode || "system") === k ? "on" : ""} title={tx(h)} onClick={() => setVals((x) => ({ ...x, default_mode: k }))}>{tx(l)}</button>
                ))}
              </div>
              <small className="muted">{tx("Waarmee een bezoeker begint die zelf nog niets heeft gekozen. De zon- en maanknop blijft werken.")}</small>
            </div>
            <small className="muted">{tx("Meer over header, menu, footer en blokken staat bij Instellingen → Pagina-indeling.")}</small>
          </div>
        )}

        {tab === "style" && vals && (
          <div className="stack-sm">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <small className="muted">{tx("Alle instellingen van dit thema: kleuren, lettertypen, vormen, popups, tabbladen en de pagina-indeling (header, menu, footer en blokken). Wijzigingen worden vanzelf opgeslagen.")}</small>
              <SaveStatus auto={auto} />
            </div>
            {(() => {
              const groups = schema.filter((g) => !["defaults", "devices", "chat_look", "logo"].includes(g.key));
              const cur = groups.find((g) => g.key === sub) || groups[0];
              if (!cur) return null;
              return (
                <>
                  <Tabs value={cur.key} onChange={setSub} tabs={groups.map((g) => [g.key, g.label])} />
                  <div className="theme-grid">{cur.fields.map((f) => <Field key={f.key} f={{ ...f, label: tx(f.label), choices: f.choices?.map((c) => ({ ...c, label: tx(c.label) })) }} value={vals[f.key]} onChange={(v) => setVals((x) => ({ ...x, [f.key]: v }))} />)}</div>
                </>
              );
            })()}
          </div>
        )}

        {tab === "ai" && (
          <div className="stack-sm">
            <strong>{tx("Verbeter layout en kleuren met AI")}</strong>
            {ai ? (
              <>
                <p className="muted" style={{ margin: 0 }}>{tx("Schrijf wat er anders moet; Claude past de instellingen van dit thema aan (kleuren, vormen, popups en de pagina-indeling). Bekijk het resultaat bij Voorbeelden.")}</p>
                <label>{tx("Wat moet er anders?")}
                  <textarea rows={3} value={ask} maxLength={800} disabled={aiBusy} onChange={(e) => setAsk(e.target.value)} placeholder={tx("Bijvoorbeeld: maak de kleuren warmer, de hoeken rond en de popups rustiger.")} />
                </label>
                <label>{tx("Link naar een pagina met kleuren om te gebruiken (optioneel)")}
                  <input type="url" value={refUrl} maxLength={500} disabled={aiBusy} onChange={(e) => setRefUrl(e.target.value)} placeholder="https://voorbeeld.nl" />
                  <small className="muted">{tx("Claude leest de kleuren en lettertypen van die pagina en gebruikt ze voor dit thema, samen met wat je hierboven schrijft.")}</small>
                </label>
                <div className="row" style={{ justifyContent: "flex-start" }}>
                  {["Warmere kleuren", "Meer contrast", "Rondere vormen", "Strakker en zakelijker", "Rustiger popups", "Donkerder thema", "Andere header en footer"].map((x) => <button key={x} type="button" className="chip" disabled={aiBusy} onClick={() => setAsk(tx(x))}>{tx(x)}</button>)}
                </div>
                {aiBusy && <div className="imp-bar imp-wait" role="progressbar"><span /></div>}
                <div className="row" style={{ justifyContent: "flex-start" }}>
                  <button type="button" className="btn primary" disabled={aiBusy || (ask.trim().length < 3 && !refUrl.trim()) || !vals} onClick={improve}>{aiBusy ? tx("Claude past het thema aan…") : tx("Verbeter met AI")}</button>
                  {undoStack.length > 0 && <button type="button" className="btn" disabled={aiBusy} onClick={undo}>{tx("Ongedaan maken")}</button>}
                </div>
                {note && <div className="alert ok">{note}</div>}
              </>
            ) : <small className="muted">{tx("Koppel Claude bij Admin → API keys om het thema met AI te laten verbeteren.")}</small>}
          </div>
        )}

        {tab === "preview" && vals && (
          <div className="stack-sm">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="row" style={{ gap: ".4rem" }}>
                <button type="button" className={`btn sm ${show === "pages" ? "primary" : ""}`} onClick={() => setShow("pages")}>{tx("Pagina's")}</button>
                <button type="button" className={`btn sm ${show === "popups" ? "primary" : ""}`} onClick={() => setShow("popups")}>{tx("Popups")}</button>
              </span>
              <span className="row" style={{ gap: ".4rem" }}>
                <button type="button" className={`btn sm ${!dark ? "primary" : ""}`} onClick={() => setDark(false)}>{tx("Licht")}</button>
                <button type="button" className={`btn sm ${dark ? "primary" : ""}`} onClick={() => setDark(true)}>{tx("Donker")}</button>
              </span>
            </div>
            <style>{css}</style>
            <div className={`draft-scope ${dark ? "dark" : ""}`} style={{ maxHeight: "52vh", overflow: "auto" }}>
              <ThemeLayout draft={{ logo: files?.slots?.logo?.url || null, show, values: vals }} />
            </div>
          </div>
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
                  <span className="col-actions" style={{ display: "grid", gridTemplateColumns: "96px 110px", gap: ".4rem", alignItems: "center", justifyItems: "stretch", flex: "none" }}>
                    <span style={{ display: "grid" }}><MediaField disabled={busy} onFiles={(fs) => run(() => upload(`${base}/slot/${slot}/`, fs[0]))} /></span>
                    {f ? <button type="button" className="btn sm danger" disabled={busy} onClick={() => run(() => api(`${base}/slot/${slot}/`, { method: "DELETE" }))}>{tx("Verwijder")}</button> : <span />}
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
            {(files?.home?.length || 0) < 12 && <MediaField disabled={busy} onFiles={async (fs) => { for (const f of fs) await run(() => upload(`${base}/home/`, f)); }} />}
          </>
        )}

        <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn" onClick={onClose}>{tx("Sluiten")}</button></div>
      </div>
    </div>
  );
}
