// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { IconEdit } from "./Icons";
import { useSession } from "./Session";
import Tabs from "./Tabs";

const LOOK = [["footer_layout", "Indeling"], ["footer_tone", "Kleur"], ["footer_brand", "Logo en naam"], ["footer_social", "Sociale media"], ["footer_meta", "Bedrijfsgegevens"], ["footer_size", "Ruimte"]];
const SOCIAL = [["facebook", "Facebook"], ["instagram", "Instagram"], ["x", "X"], ["linkedin", "LinkedIn"], ["youtube", "YouTube"], ["tiktok", "TikTok"]];

// The Edit button of the footer (edit mode): its look (theme) and its texts (basic data) in one popup.
export default function FooterEdit() {
  const { editing } = useSession();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("look");
  const [theme, setTheme] = useState(null); // {values, schema}
  const [sys, setSys] = useState(null);
  const [msg, setMsg] = useState(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!open) return;
    api("/theme/").then(setTheme).catch((e) => setMsg({ ok: false, text: errorText(e) }));
    api("/system/").then(setSys).catch(() => setSys(false)); // no right for the basic data: only the look
  }, [open]);
  if (!editing) return null;
  const fields = theme ? theme.schema.flatMap((g) => g.fields) : [];
  const setLook = async (key, v) => {
    const values = { ...theme.values, [key]: v };
    setTheme({ ...theme, values }); setDirty(true);
    try { await api("/theme/", { method: "PUT", body: { values } }); setMsg(null); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  const saveSys = async () => {
    try { setSys(await api("/system/", { method: "PUT", body: sys })); setDirty(true); setMsg({ ok: true, text: tx("Opgeslagen.") }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  const close = () => { setOpen(false); if (dirty) { setDirty(false); window.location.reload(); } };
  return (
    <>
      <button type="button" className="btn sm footer-edit" onClick={() => setOpen(true)} title={tx("De footer bewerken")} aria-label={tx("De footer bewerken")}><IconEdit width={13} height={13} /></button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="pb-objback" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="pb-objpop" role="dialog" aria-label={tx("Footer bewerken")} style={{ width: "min(720px, 100%)" }}>
            <div className="pb-objhead"><strong>{tx("Footer bewerken")}</strong><span style={{ flex: 1 }} /><button type="button" className="pb-panelx" onClick={close} aria-label={tx("Sluiten")}>×</button></div>
            <Tabs value={tab} onChange={setTab} tabs={[["look", "Uiterlijk"], ...(sys ? [["logo", "Logo"], ["text", "Teksten en links"]] : [])]} />
            {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
            {tab === "look" && (!theme ? <p className="muted">{tx("Laden…")}</p> : (
              <div className="stack-sm">
                <label className="packlay-row"><span className="switch"><input type="checkbox" checked={(theme.values.page_footer || "show") !== "hide"} onChange={(e) => setLook("page_footer", e.target.checked ? "show" : "hide")} /><span /></span><span className="packlay-text"><strong>{tx("Footer standaard tonen")}</strong><small className="muted">{tx("Een pagina kan dit zelf anders instellen (Pagina-instellingen).")}</small></span></label>
                <div className="grid2">
                  {LOOK.map(([k, l]) => { const f = fields.find((x) => x.key === k); return f ? (
                    <label key={k}>{tx(l)}<select value={theme.values[k]} onChange={(e) => setLook(k, e.target.value)}>{f.choices.map((c) => <option key={c.value} value={c.value}>{tx(c.label)}</option>)}</select></label>
                  ) : null; })}
                </div>
                <small className="muted">{tx("Zien hoe de varianten eruitzien kan bij Admin → Thema → Layout → Footer.")}</small>
              </div>
            ))}
            {tab === "logo" && sys && (
              <div className="stack-sm">
                <label>{tx("Hoogte van het logo")}: <strong>{Number(sys.footer_logo_height) || 36} px</strong>{!Number(sys.footer_logo_height) && <small className="muted"> ({tx("standaard")})</small>}
                  <input type="range" min={16} max={200} step={2} value={Number(sys.footer_logo_height) || 36} onChange={(e) => setSys({ ...sys, footer_logo_height: String(e.target.value) })} /></label>
                <label>{tx("Link van het logo (leeg = geen link)")}<input value={sys.footer_logo_link || ""} maxLength={200} onChange={(e) => setSys({ ...sys, footer_logo_link: e.target.value })} placeholder={tx("https://… of /pagina")} /></label>
                <small className="muted">{tx("Het logo zelf kies je bij Admin → Thema. Het logo staat alleen in de footer als de indeling het toont (tabblad Uiterlijk: Logo en naam).")}</small>
                <div className="row"><button type="button" className="btn primary" onClick={saveSys}>{tx("Opslaan")}</button> {Number(sys.footer_logo_height) > 0 && <button type="button" className="btn" onClick={() => setSys({ ...sys, footer_logo_height: "0" })}>{tx("Standaardgrootte")}</button>}</div>
              </div>
            )}
            {tab === "text" && sys && (
              <div className="stack-sm">
                <label>{tx("Tekst in de voettekst")}<input value={sys.footer_text || ""} maxLength={500} onChange={(e) => setSys({ ...sys, footer_text: e.target.value })} /></label>
                <div className="grid2">{SOCIAL.map(([k, l]) => <label key={k}>{l}<input value={sys[`social_${k}`] || ""} onChange={(e) => setSys({ ...sys, [`social_${k}`]: e.target.value })} placeholder="https://" /></label>)}</div>
                <div className="row"><button type="button" className="btn primary" onClick={saveSys}>{tx("Opslaan")}</button></div>
              </div>
            )}
          </div>
        </div>, document.body)}
    </>
  );
}
