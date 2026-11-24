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
import ColorInput, { tokenVar } from "./ColorInput";

import Loading from "./Loading";
const LOOK = [["header_layout", "Indeling"], ["header_style", "Uiterlijk"], ["header_sticky", "Blijft bovenaan bij scrollen"], ["header_width", "Breedte van de header"], ["menu_style", "Uiterlijk van het menu"], ["mode_switch", "Schakelaar licht/donker"]];

// The Edit button of the header (edit mode), like the one of the footer: its look and the size of its logo in one popup.
export default function HeaderEdit() {
  const { editing } = useSession();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("look");
  const [sideTab, setSideTab] = useState("behaviour");
  const [designTab, setDesignTab] = useState("shape");  // inside Design: Vorm, Lijnen, Kleur  // the tab Zijmenu has its own tabs: Gedrag, Positie, Uiterlijk
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
  useEffect(() => {  // the tab Zijmenu is open: the side menu is shown on the page (open), so every change can be seen at once
    const root = document.documentElement;
    if (editing && open && tab === "side") root.dataset.hsidepreview = "1"; else delete root.dataset.hsidepreview;
    return () => { delete root.dataset.hsidepreview; };
  }, [editing, open, tab]);
  if (!editing) return null;
  const host = typeof document !== "undefined" && document.documentElement.dataset.pbbar === "1" ? document.querySelector(".pb-sb-settings") : null;  // the panel of the editor
  const fields = theme ? theme.schema.flatMap((g) => g.fields) : [];
  const save = async (values) => { try { await api("/theme/", { method: "PUT", body: { values } }); setMsg(null); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } };
  // The header reads these choices from attributes on <html> that the server sets when the page loads (layout.js): without this the header only changed after closing the panel (a reload). They are put there at once, with the same defaults as the server.
  const LOOK_ATTR = { header_layout: ["hl", "classic"], header_style: ["hstyle", "solid"], header_sticky: ["hsticky", "yes"], header_side: ["hside", "off"], header_side_v: ["hsidev", "top"], header_side_anchor: ["hsideanchor", "browser"], header_side_div: ["hsidediv", "no"], header_width: ["hwidth", "content"], menu_style: ["menu", "text"], mode_switch: ["modesw", "show"] };
  const setLook = (key, v) => {
    const values = { ...theme.values, [key]: v };
    setTheme({ ...theme, values });
    setDirty(true);
    if (key === "header_side_unit" && typeof document !== "undefined") { document.documentElement.dataset.hsideunit = v; document.documentElement.dataset.hsideat = String(values[v === "px" ? "header_side_px" : "header_side_pct"] ?? (v === "px" ? 300 : 15)); }
    if (key === "header_sticky_unit" && typeof document !== "undefined") { document.documentElement.dataset.hstickyunit = v; document.documentElement.dataset.hstickyat = String(values[v === "px" ? "header_sticky_px" : "header_sticky_pct"] ?? (v === "px" ? 200 : 25)); }  // the other unit has its own amount
    const a = LOOK_ATTR[key];
    if (a && typeof document !== "undefined") document.documentElement.dataset[a[0]] = key === "mode_switch" ? (v === "hide" ? "hide" : "show") : (v || a[1]);  // the switch light/dark shows or hides at once
    save(values);
  };
  // the logo follows the slider at once; it is saved a moment after the last move
  const setStickyAt = (key, n, attr = "hstickyat") => {  // the slider of "stays after" (and of the side menu): the page follows at once, saved a moment after the last move
    const values = { ...theme.values, [key]: n };
    setTheme({ ...theme, values });
    document.documentElement.dataset[attr] = String(n);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(values), 400);
  };
  const COLOR_VAR = { side_menu_bg: "--side-menu-bg", side_menu_fg: "--side-menu-fg", side_menu_accent: "--side-menu-accent", side_menu_linec: "--side-menu-linec", side_button_bg: "--side-btn-bg", side_button_fg: "--side-btn-fg" };
  const setColor = (key, v) => {  // a colour of the side menu: a colour of the theme (kept by its name), an own colour, or "" (like the theme); the page follows at once
    const values = { ...theme.values, [key]: v };
    setTheme({ ...theme, values });
    const root = document.documentElement;
    if (!v) root.style.removeProperty(COLOR_VAR[key]); else root.style.setProperty(COLOR_VAR[key], tokenVar(v) || v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(values), 400);
  };
  const setStart = (key, n) => {  // where the page and the hero begin under the menu: follows the slider at once
    const values = { ...theme.values, [key]: n };
    setTheme({ ...theme, values });
    const VAR = { page_start: ["--page-start", "px"], hero_start: ["--hero-start", "px"], side_button_y: ["--side-btn-y", ""], side_menu_y: ["--side-menu-y", ""], side_menu_w: ["--side-menu-w", "px"], side_menu_h: ["--side-menu-h", ""], side_menu_radius: ["--side-menu-r", ""], side_menu_float: ["--side-menu-float", ""], side_menu_line: ["--side-menu-line", ""], side_menu_shadow: ["--side-menu-shadow", ""], side_menu_igap: ["--side-menu-igap", ""], side_menu_size: ["--side-menu-size", ""], side_menu_opacity: ["--side-menu-op", ""] }[key];
    if (VAR) document.documentElement.style.setProperty(VAR[0], `${n}${VAR[1]}`);
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
            <Tabs value={tab} onChange={setTab} tabs={[["look", "Uiterlijk"], ["position", "Positie"], ["side", "Zijmenu"], ["logo", "Logo"], ["menu", "Menu"]]} />
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
              const SEG = (items, cur, on) => <div className="hed-seg lg" role="group">{items.map(([k, l]) => <button type="button" key={k} className={cur === k ? "on" : ""} aria-pressed={cur === k} onClick={() => on(k)}>{l}</button>)}</div>;
              return (
                <div className="hed">
                  <section className="hed-card">
                    <h4>{tx("Plakken bij scrollen")}</h4>
                    <div className="hed-field"><span className="hed-lbl">{tx("De header blijft bovenaan staan")}</span>
                      <div className="hed-cards" role="radiogroup" aria-label={tx("De header blijft bovenaan staan")}>
                        {[["yes", "Altijd", "De header blijft altijd bovenaan staan."], ["after", "Blijft staan na", "Scrolt eerst mee met de pagina en blijft daarna bovenaan staan."], ["start", "Verschijnt na", "Is eerst verborgen en schuift in beeld na het scrollen."], ["no", "Nooit", "De header scrolt weg met de pagina."]].map(([k, l, d]) => (
                          <button type="button" key={k} role="radio" aria-checked={mode === k} className={`hed-opt${mode === k ? " on" : ""}`} onClick={() => setLook("header_sticky", k)}>
                            <span className="hed-dot" aria-hidden="true" /><span><strong>{tx(l)}</strong><small>{tx(d)}</small></span>
                          </button>
                        ))}
                      </div>
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
                  <section className="hed-card">
                    <h4>{tx("Start onder het menu")}</h4>
                    {[["page_start", "Pagina start", "Hoeveel ruimte er tussen het menu en het begin van de pagina zit."], ["hero_start", "Hero start", "Waar de eerste hero of het eerste blok begint; een negatieve waarde schuift hem omhoog, onder een doorzichtige header."]].map(([k, l, d]) => {
                      const f = fields.find((x) => x.key === k); if (!f) return null;
                      const n = Number(theme.values[k] ?? 0);
                      return (
                        <div className="hed-field" key={k}><span className="hed-lbl">{tx(l)}<b className="hed-val">{n} px</b></span>
                          <input type="range" min={f.min} max={f.max} step={f.step || 4} value={n} onChange={(e) => setStart(k, Number(e.target.value))} aria-label={tx(l)} />
                          <small className="muted">{tx(d)}</small>
                        </div>
                      );
                    })}
                    <button type="button" className="btn sm" onClick={() => { setStart("page_start", 0); setTimeout(() => setStart("hero_start", 0), 0); }}>{tx("Terug naar standaard")}</button>
                  </section>
                </div>
              );
            })())}
            {tab === "side" && (!theme ? <p className="muted"><Loading /></p> : (() => {
              const f = fields.find((x) => x.key === "header_side");
              if (!f) return null;
              const mode = theme.values.header_side || "off", unit = theme.values.header_side_unit || "pct";
              const amountKey = unit === "px" ? "header_side_px" : "header_side_pct";
              const af = fields.find((x) => x.key === amountKey);
              const amount = Number(theme.values[amountKey] ?? (unit === "px" ? 300 : 15));
              return (
                <div className="hed">
                  {mode !== "off" && <Tabs value={sideTab} onChange={setSideTab} tabs={[["behaviour", "Gedrag"], ["position", "Positie"], ["look", "Uiterlijk"], ["design", "Design"]]} className="tabs-one-row" />}
                  {(mode === "off" || sideTab === "behaviour") && (
                  <section className="hed-card">
                    <h4>{tx("Zijmenu bij scrollen")}</h4>
                    <div className="hed-cards" role="radiogroup" aria-label={tx("Zijmenu")}>
                      {[["off", "Uit", "De header blijft de header; er komt geen zijmenu."], ["left", "Zijmenu links", "Bij het scrollen verdwijnt de header en komt het menu links aan de zijkant."], ["right", "Zijmenu rechts", "Bij het scrollen verdwijnt de header en komt het menu rechts aan de zijkant."]].map(([k, l, d]) => (
                        <button type="button" key={k} role="radio" aria-checked={mode === k} className={`hed-opt${mode === k ? " on" : ""}`} onClick={() => setLook("header_side", k)}>
                          <span className="hed-dot" aria-hidden="true" /><span><strong>{tx(l)}</strong><small>{tx(d)}</small></span>
                        </button>
                      ))}
                    </div>
                    {mode !== "off" && (<>
                      <div className="hed-field"><span className="hed-lbl">{tx("Eenheid")}</span>
                        <div className="hed-seg lg" role="group">{[["pct", tx("Procent (%)")], ["px", tx("Pixels (px)")]].map(([k, l]) => <button type="button" key={k} className={unit === k ? "on" : ""} aria-pressed={unit === k} onClick={() => setLook("header_side_unit", k)}>{l}</button>)}</div>
                      </div>
                      <div className="hed-field"><span className="hed-lbl">{tx("Het zijmenu komt na")}<b className="hed-val">{amount} {unit === "px" ? "px" : "%"}</b></span>
                        <input type="range" min={af?.min ?? 0} max={af?.max ?? (unit === "px" ? 1500 : 200)} step={af?.step ?? (unit === "px" ? 10 : 5)} value={amount} onChange={(e) => setStickyAt(amountKey, Number(e.target.value), "hsideat")} aria-label={tx("Het zijmenu komt na")} />
                        <small className="muted">{tx("Zo ver moet de bezoeker scrollen voordat de header een zijmenu wordt. Met de pijl aan de rand open en sluit je het menu. In de bewerkmodus blijft de header staan.")}</small>
                      </div>
                    </>)}
                  </section>
                  )}
                  {mode !== "off" && sideTab === "look" && (
                  <section className="hed-card">
                    <h4>{tx("Grootte en transparantie")}</h4>
                    {[["side_menu_w", "Breedte van het menu", "px", "Hoe breed het zijmenu is. Smaller kan, maar nooit smaller dan de menu-items; het logo schaalt dan mee."], ["side_menu_h", "Hoogte van het menu", "%", "De minimale hoogte als percentage van het scherm. Het menu is nooit kleiner dan zijn eigen inhoud: past er meer in, dan wordt het hoger."], ["side_menu_size", "Tekstgrootte van het menu", "%", "De grootte van de letters in het zijmenu; 100% is normaal."], ["side_menu_opacity", "Transparantie", "%", "Hoe dekkend het menu is: 100% is helemaal dicht, lager laat de pagina erdoor schemeren."]].map(([k, l, u, d]) => {
                      const f = fields.find((x) => x.key === k); if (!f) return null;
                      const n = Number(theme.values[k] ?? f.default);
                      return (
                        <div className="hed-field" key={k}><span className="hed-lbl">{tx(l)}<b className="hed-val">{n}{u === "px" ? " px" : "%"}</b></span>
                          <input type="range" min={f.min} max={f.max} step={f.step || 5} value={n} onChange={(e) => setStart(k, Number(e.target.value))} aria-label={tx(l)} />
                          <small className="muted">{tx(d)}</small>
                        </div>
                      );
                    })}
                  </section>
                  )}
                  {mode !== "off" && sideTab === "design" && (<>
                    <Tabs value={designTab} onChange={setDesignTab} tabs={[["shape", "Vorm"], ["lines", "Lijnen"], ["color", "Kleur"]]} className="tabs-one-row" />
                    {designTab === "shape" && (<>
                    <section className="hed-card">
                      <h4>{tx("Hoeken")}</h4>
                      {[["side_menu_radius", "Ronde hoeken (buitenkant)", "px", "Hoe rond de hoeken aan de buitenkant van het menu zijn."]].map(([k, l, u, d]) => {
                        const f = fields.find((x) => x.key === k); if (!f) return null;
                        const n = Number(theme.values[k] ?? f.default);
                        return (
                          <div className="hed-field" key={k}><span className="hed-lbl">{tx(l)}<b className="hed-val">{n} {u}</b></span>
                            <input type="range" min={f.min} max={f.max} step={f.step || 1} value={n} onChange={(e) => setStart(k, Number(e.target.value))} aria-label={tx(l)} />
                            <small className="muted">{tx(d)}</small>
                          </div>
                        );
                      })}
                    </section>
                    <section className="hed-card">
                      <h4>{tx("Vorm en ruimte")}</h4>
                      {[["side_menu_float", "Zwevend: afstand tot de rand", "px", "Zet het menu los van de rand van het scherm; dan zijn alle hoeken rond. 0 is tegen de rand."], ["side_menu_shadow", "Schaduw", "%", "Hoe sterk de schaduw rond het geopende menu is."], ["side_menu_igap", "Ruimte tussen de menu-items", "px", "De afstand tussen de menu-items."]].map(([k, l, u, d]) => {
                        const f = fields.find((x) => x.key === k); if (!f) return null;
                        const n = Number(theme.values[k] ?? f.default);
                        return (
                          <div className="hed-field" key={k}><span className="hed-lbl">{tx(l)}<b className="hed-val">{n} {u}</b></span>
                            <input type="range" min={f.min} max={f.max} step={f.step || 1} value={n} onChange={(e) => setStart(k, Number(e.target.value))} aria-label={tx(l)} />
                            <small className="muted">{tx(d)}</small>
                          </div>
                        );
                      })}
                    </section>
                    </>)}
                    {designTab === "lines" && (<>
                    <section className="hed-card">
                      <h4>{tx("Lijnen")}</h4>
                      {[["side_menu_line", "Dikte van de lijnen", "px", "De dikte van de lijn om het menu; 0 haalt de lijn weg."]].map(([k, l, u, d]) => {
                        const f = fields.find((x) => x.key === k); if (!f) return null;
                        const n = Number(theme.values[k] ?? f.default);
                        return (
                          <div className="hed-field" key={k}><span className="hed-lbl">{tx(l)}<b className="hed-val">{n} {u}</b></span>
                            <input type="range" min={f.min} max={f.max} step={f.step || 1} value={n} onChange={(e) => setStart(k, Number(e.target.value))} aria-label={tx(l)} />
                            <small className="muted">{tx(d)}</small>
                          </div>
                        );
                      })}
                      {fields.some((x) => x.key === "header_side_div") && (
                        <label className="hed-sw"><span className="switch"><input type="checkbox" checked={(theme.values.header_side_div || "no") === "yes"} onChange={(e) => setLook("header_side_div", e.target.checked ? "yes" : "no")} /><span /></span><span className="hed-swt"><strong>{tx("Lijnen tussen de menu-items")}</strong><small>{tx("Een dunne lijn onder elk menu-item.")}</small></span></label>
                      )}
                    </section>
                    </>)}
                    {designTab === "color" && (<>
                    <section className="hed-card">
                      <h4>{tx("Kleuren")}</h4>
                      <small className="muted">{tx("Standaard volgt het zijmenu de kleuren van het thema. Kies een kleur van het thema of een eigen kleur.")}</small>
                      {[["side_menu_bg", "Achtergrond"], ["side_menu_fg", "Tekst"], ["side_menu_accent", "Accent (aanwijzen en huidige pagina)"], ["side_menu_linec", "Lijnen"], ["side_button_bg", "Knop (pijl): achtergrond"], ["side_button_fg", "Knop (pijl): pijltje"]].map(([k, l]) => {
                        if (!fields.some((x) => x.key === k)) return null;
                        const v = theme.values[k] || "";
                        return (
                          <div className="hed-field" key={k}>
                            <span className="hed-lbl">{tx(l)}<b className="hed-val">{v ? (tokenVar(v) ? tx(({ primary: "Primair", secondary: "Secundair", card: "Kaart", page: "Pagina", text: "Tekst", muted: "Gedempt", ok: "Succes", danger: "Gevaar", white: "Wit", black: "Zwart" })[v]) : v) : tx("Zoals het thema")}</b></span>
                            <span style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                              <ColorInput value={v} tokens allowNone onValue={(x) => setColor(k, x)} />
                              {v && <button type="button" className="btn sm" onClick={() => setColor(k, "")}>{tx("Zoals het thema")}</button>}
                            </span>
                          </div>
                        );
                      })}
                    </section>
                    </>)}
                  </>)}
                  {mode !== "off" && sideTab === "position" && (
                  <section className="hed-card">
                    <h4>{tx("Positie")}</h4>
                    {fields.some((x) => x.key === "header_side_anchor") && (
                      <label className="hed-sw"><span className="switch"><input type="checkbox" checked={(theme.values.header_side_anchor || "browser") === "content"} onChange={(e) => setLook("header_side_anchor", e.target.checked ? "content" : "browser")} /><span /></span><span className="hed-swt"><strong>{tx("Menu bij de start van de inhoud")}</strong><small>{tx("Uit: het menu staat tegen de rand van de browser. Aan: het staat tegen het begin van de inhoud (de maximale breedte van de pagina).")}</small></span></label>
                    )}
                    <div className="hed-field"><span className="hed-lbl">{tx("Waar staat het menu")}</span>
                      <div className="hed-seg lg" role="group" aria-label={tx("Waar staat het menu")}>{[["top", "Boven"], ["middle", "Midden"], ["bottom", "Onder"]].map(([k, l]) => <button type="button" key={k} className={(theme.values.header_side_v || "top") === k ? "on" : ""} aria-pressed={(theme.values.header_side_v || "top") === k} onClick={() => setLook("header_side_v", k)}>{tx(l)}</button>)}</div>
                    </div>
                    {[["side_button_y", "Positie van de knop", "Waar de pijl aan de rand van het scherm staat, van boven (0%) naar onder (100%)."], ["side_menu_y", "Positie van het menu", "De afstand van het menu tot de boven- of onderrand, als percentage van de schermhoogte (bij Midden niet van toepassing)."]].map(([k, l, d]) => {
                      const f = fields.find((x) => x.key === k); if (!f) return null;
                      const n = Number(theme.values[k] ?? f.default);
                      return (
                        <div className="hed-field" key={k}><span className="hed-lbl">{tx(l)}<b className="hed-val">{n}%</b></span>
                          <input type="range" min={f.min} max={f.max} step={f.step || 1} value={n} onChange={(e) => setStart(k, Number(e.target.value))} aria-label={tx(l)} />
                          <small className="muted">{tx(d)}</small>
                        </div>
                      );
                    })}
                  </section>
                  )}
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
