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
    if (key === "header_sticky_unit" && typeof document !== "undefined") { document.documentElement.dataset.hstickyunit = v; document.documentElement.dataset.hstickyat = String(values[v === "px" ? "header_sticky_px" : "header_sticky_pct"] ?? (v === "px" ? 200 : 25)); }  // the other unit has its own amount
    const a = LOOK_ATTR[key];
    if (a && typeof document !== "undefined") document.documentElement.dataset[a[0]] = key === "mode_switch" ? (v === "hide" ? "hide" : "show") : (v || a[1]);  // the switch light/dark shows or hides at once
    save(values);
  };
  // the logo follows the slider at once; it is saved a moment after the last move
  const setStickyAt = (key, n) => {  // the slider of "stays after": the page follows at once, saved a moment after the last move
    const values = { ...theme.values, [key]: n };
    setTheme({ ...theme, values });
    document.documentElement.dataset.hstickyat = String(n);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(values), 400);
  };
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
            <Tabs value={tab} onChange={setTab} tabs={[["look", "Uiterlijk"], ["position", "Positie"], ["logo", "Logo"], ["menu", "Menu"]]} />
            {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
            {tab === "look" && (!theme ? <p className="muted"><Loading /></p> : (
              <div className="hed">
                {(() => {
                  const fld = (k) => fields.find((x) => x.key === k);
                  const sel = (k, l) => { const f = fld(k); return f ? <label key={k}>{tx(l)}<select value={theme.values[k]} onChange={(e) => setLook(k, e.target.value)}>{f.choices.map((c) => <option key={c.value} value={c.value}>{tx(c.label)}</option>)}</select></label> : null; };
                  const sw = (k, l, hint, on, off) => <label key={k} className="hed-sw"><span className="switch"><input type="checkbox" checked={(theme.values[k] || on) === on} onChange={(e) => setLook(k, e.target.checked ? on : off)} /><span /></span><span className="hed-swt"><strong>{tx(l)}</strong>{hint && <small className="muted">{tx(hint)}</small>}</span></label>;
                  const w = fld("header_width");
                  return (<>
                    <section className="hed-card">
                      <h4>{tx("Zichtbaarheid")}</h4>
                      <label className="hed-sw"><span className="switch"><input type="checkbox" checked={(theme.values.page_header || "show") !== "hide"} onChange={(e) => setLook("page_header", e.target.checked ? "show" : "hide")} /><span /></span><span className="hed-swt"><strong>{tx("Header standaard tonen")}</strong><small className="muted">{tx("Een pagina kan dit zelf anders instellen (Pagina-instellingen).")}</small></span></label>
                      {fld("mode_switch") && sw("mode_switch", "Schakelaar licht/donker", "Laat bezoekers wisselen tussen een lichte en donkere weergave.", "show", "hide")}
                    </section>
                    <section className="hed-card">
                      <h4>{tx("Indeling en stijl")}</h4>
                      {sel("header_layout", "Indeling")}
                      {sel("header_style", "Uiterlijk")}
                      {sel("menu_style", "Uiterlijk van het menu")}
                    </section>
                    <section className="hed-card">
                      <h4>{tx("Afmetingen")}</h4>
                      {w && <div className="hed-field"><span className="hed-lbl">{tx("Breedte van de header")}</span>
                        <div className="hed-seg" role="group" aria-label={tx("Breedte van de header")}>{w.choices.map((c) => <button type="button" key={c.value} className={(theme.values.header_width || "content") === c.value ? "on" : ""} aria-pressed={(theme.values.header_width || "content") === c.value} onClick={() => setLook("header_width", c.value)}>{tx(c.value === "full" ? "Hele breedte" : "Breedte van de inhoud")}</button>)}</div></div>}
                      {heightField && <div className="hed-field"><span className="hed-lbl">{tx("Hoogte van de header")}<b className="hed-val">{Number(theme.values.site_header_h) || 72} px</b></span>
                        <input type="range" min={heightField.min} max={heightField.max} step={2} value={Number(theme.values.site_header_h) || 72} onChange={(e) => setHeight(Number(e.target.value))} /></div>}
                    </section>
                  </>);
                })()}
                <small className="muted">{tx("Zien hoe de varianten eruitzien kan bij Admin → Thema → Layout → Header.")}</small>
              </div>
            ))}
            {tab === "position" && (!theme ? <p className="muted"><Loading /></p> : (() => {
              const f = fields.find((x) => x.key === "header_sticky");
              if (!f) return null;
              const mode = theme.values.header_sticky || "yes", unit = theme.values.header_sticky_unit || "pct";
              const amountKey = unit === "px" ? "header_sticky_px" : "header_sticky_pct";
              const af = fields.find((x) => x.key === amountKey);
              const amount = Number(theme.values[amountKey] ?? (unit === "px" ? 200 : 25));
              const SEG = (items, cur, on) => <div className="hed-seg" role="group">{items.map(([k, l]) => <button type="button" key={k} className={cur === k ? "on" : ""} aria-pressed={cur === k} onClick={() => on(k)}>{l}</button>)}</div>;
              return (
                <div className="hed">
                  <section className="hed-card">
                    <h4>{tx("Plakken bij scrollen")}</h4>
                    <div className="hed-field"><span className="hed-lbl">{tx("De header blijft bovenaan staan")}</span>
                      {SEG([["yes", tx("Altijd")], ["after", tx("Blijft staan na")], ["start", tx("Verschijnt na")], ["no", tx("Nooit")]], mode, (k) => setLook("header_sticky", k))}
                    </div>
                    {(mode === "after" || mode === "start") && (<>
                      <div className="hed-field"><span className="hed-lbl">{tx("Eenheid")}</span>
                        {SEG([["pct", tx("Procent (%)")], ["px", tx("Pixels (px)")]], unit, (k) => setLook("header_sticky_unit", k))}
                      </div>
                      <div className="hed-field"><span className="hed-lbl">{tx(mode === "start" ? "Verschijnt na" : "Blijft staan na")}<b className="hed-val">{amount} {unit === "px" ? "px" : "%"}</b></span>
                        <input type="range" min={af?.min ?? 0} max={af?.max ?? (unit === "px" ? 1500 : 200)} step={af?.step ?? (unit === "px" ? 10 : 5)} value={amount} onChange={(e) => setStickyAt(amountKey, Number(e.target.value))} aria-label={tx("Blijft staan na")} />
                        <small className="muted">{mode === "start" ? tx("De header is eerst verborgen en verschijnt zodra de bezoeker zoveel heeft gescrold. Je kunt kiezen tussen Blijft staan na en Verschijnt na: er is er één actief.") : unit === "px" ? tx("Een aantal pixels: de header blijft staan zodra de bezoeker zoveel heeft gescrold.") : tx("Een percentage van de schermhoogte: bij 100% blijft de header staan als de bezoeker een heel scherm heeft gescrold.")}</small>
                      </div>
                    </>)}
                    <small className="muted">{tx("Kies wanneer de header blijft staan: altijd, nooit, of nadat de bezoeker een deel van het scherm heeft gescrold.")}</small>
                  </section>
                </div>
              );
            })())}
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
