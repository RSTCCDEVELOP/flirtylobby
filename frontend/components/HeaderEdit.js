// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { IconEdit } from "./Icons";
import { useSession } from "./Session";
import Tabs from "./Tabs";

import Loading from "./Loading";
const LOOK = [["header_layout", "Indeling"], ["header_style", "Uiterlijk"], ["header_sticky", "Blijft bovenaan bij scrollen"], ["header_width", "Breedte van de header"], ["menu_style", "Uiterlijk van het menu"], ["mode_switch", "Schakelaar licht/donker"]];

// The Edit button of the header (edit mode), like the one of the footer: its look and the size of its logo in one popup.
export default function HeaderEdit() {
  const { editing } = useSession();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("look");
  const [theme, setTheme] = useState(null); // {values, schema}
  const [msg, setMsg] = useState(null);
  const [dirty, setDirty] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    if (!open) return;
    api("/theme/").then(setTheme).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  }, [open]);
  useEffect(() => {  // in the editor with a panel: a click on the header shows its settings in the panel
    if (!editing) return undefined;
    const on = () => { window.dispatchEvent(new Event("pb-show-settings")); setTimeout(() => setOpen(true), 60); };
    const head = document.querySelector(".site-header");
    const click = (e) => { if (document.documentElement.dataset.pbbar === "1" && !e.target.closest("a, button, select, input")) on(); };
    head?.addEventListener("click", click);
    return () => head?.removeEventListener("click", click);
  }, [editing]);
  useEffect(() => {  // the tabs "Header bewerken" / "Footer bewerken" in the settings of the editor open and close this editor
    if (!editing) return undefined;
    const on = () => { window.dispatchEvent(new Event("pb-show-settings")); setTimeout(() => setOpen(true), 60); };
    const off = () => setOpen(false);
    window.addEventListener("pb-open-header", on); window.addEventListener("pb-close-hf", off);
    return () => { window.removeEventListener("pb-open-header", on); window.removeEventListener("pb-close-hf", off); };
  }, [editing]);
  useEffect(() => { if (editing) window.dispatchEvent(new CustomEvent("pb-hf-state", { detail: open ? "header" : "" })); }, [open, editing]);
  if (!editing) return null;
  const host = typeof document !== "undefined" && document.documentElement.dataset.pbbar === "1" ? document.querySelector(".pb-sb-settings") : null;  // the panel of the editor
  const fields = theme ? theme.schema.flatMap((g) => g.fields) : [];
  const save = async (values) => { try { await api("/theme/", { method: "PUT", body: { values } }); setMsg(null); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } };
  // The header reads these choices from attributes on <html> that the server sets when the page loads (layout.js): without this the header only changed after closing the panel (a reload). They are put there at once, with the same defaults as the server.
  const LOOK_ATTR = { header_layout: ["hl", "classic"], header_style: ["hstyle", "solid"], header_sticky: ["hsticky", "yes"], header_width: ["hwidth", "content"], menu_style: ["menu", "text"], mode_switch: ["modesw", "show"] };
  const setLook = (key, v) => {
    const values = { ...theme.values, [key]: v };
    setTheme({ ...theme, values });
    setDirty(true);
    const a = LOOK_ATTR[key];
    if (a && typeof document !== "undefined") document.documentElement.dataset[a[0]] = key === "mode_switch" ? (v === "hide" ? "hide" : "show") : (v || a[1]);  // the switch light/dark shows or hides at once
    save(values);
  };
  // the logo follows the slider at once; it is saved a moment after the last move
  const setLogo = (px) => {
    const values = { ...theme.values, site_logo_h: px };
    setTheme({ ...theme, values });
    document.documentElement.style.setProperty("--site-logo-h", `${px}px`);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(values), 400);
  };
  const setHeight = (px) => {
    const values = { ...theme.values, site_header_h: px };
    setTheme({ ...theme, values });
    document.documentElement.style.setProperty("--site-header-h", `${px}px`);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(values), 400);
  };
  const close = () => { setOpen(false); if (dirty) { setDirty(false); window.location.reload(); } };
  const logoField = fields.find((f) => f.key === "site_logo_h");
  const heightField = fields.find((f) => f.key === "site_header_h");
  return (
    <>
      <button type="button" className="btn sm footer-edit header-edit" onClick={() => { window.dispatchEvent(new Event("pb-show-settings")); setTimeout(() => setOpen(true), 60); }} title={tx("De header bewerken")} aria-label={tx("De header bewerken")}><IconEdit width={13} height={13} /></button>
      {open && typeof document !== "undefined" && createPortal(
        <div className={host ? "pb-hdock" : "pb-objback"} onMouseDown={(e) => { if (!host && e.target === e.currentTarget) close(); }}>
          <div className={host ? "pb-hdock-in" : "pb-objpop"} role="dialog" aria-label={tx("Header bewerken")} style={host ? undefined : { width: "min(720px, 100%)" }}>
            <div className="pb-objhead"><strong>{tx("Header bewerken")}</strong><span style={{ flex: 1 }} /><button type="button" className="pb-panelx" onClick={close} aria-label={tx("Sluiten")}>×</button></div>
            <Tabs value={tab} onChange={setTab} tabs={[["look", "Uiterlijk"], ["logo", "Logo"], ["menu", "Menu"]]} />
            {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
            {tab === "look" && (!theme ? <p className="muted"><Loading /></p> : (
              <div className="stack-sm">
                <label className="packlay-row"><span className="switch"><input type="checkbox" checked={(theme.values.page_header || "show") !== "hide"} onChange={(e) => setLook("page_header", e.target.checked ? "show" : "hide")} /><span /></span><span><strong>{tx("Header standaard tonen")}</strong><br /><small className="muted">{tx("Een pagina kan dit zelf anders instellen (Pagina-instellingen).")}</small></span></label>
                <div className="grid2">
                  {LOOK.map(([k, l]) => { const f = fields.find((x) => x.key === k); return f ? (
                    <label key={k}>{tx(l)}<select value={theme.values[k]} onChange={(e) => setLook(k, e.target.value)}>{f.choices.map((c) => <option key={c.value} value={c.value}>{tx(c.label)}</option>)}</select></label>
                  ) : null; })}
                </div>
                {heightField && <label>{tx("Hoogte van de header")}: <strong>{Number(theme.values.site_header_h) || 72} px</strong>
                  <input type="range" min={heightField.min} max={heightField.max} step={2} value={Number(theme.values.site_header_h) || 72} onChange={(e) => setHeight(Number(e.target.value))} /></label>}
                <small className="muted">{tx("Zien hoe de varianten eruitzien kan bij Admin → Thema → Layout → Header.")}</small>
              </div>
            ))}
            {tab === "logo" && (!theme || !logoField ? <p className="muted"><Loading /></p> : (
              <div className="stack-sm">
                <label>{tx("Hoogte van het logo")}: <strong>{Number(theme.values.site_logo_h) || 52} px</strong>
                  <input type="range" min={logoField.min} max={logoField.max} step={2} value={Number(theme.values.site_logo_h) || 52} onChange={(e) => setLogo(Number(e.target.value))} /></label>
                <small className="muted">{tx("Het logo zelf wijzig je met de knop Wijzig naast het logo in de header.")}</small>
              </div>
            ))}
            {tab === "menu" && (
              <div className="stack-sm">
                <p className="muted" style={{ margin: 0 }}>{tx("De onderdelen van het menu, hun volgorde en wie ze ziet, beheer je bij Pagina's.")}</p>
                <div className="row"><Link className="btn primary" href="/dashboard/admin/pages" onClick={() => setOpen(false)}>{tx("Menu en pagina's beheren")}</Link></div>
              </div>
            )}
          </div>
        </div>, host || document.body)}
    </>
  );
}
