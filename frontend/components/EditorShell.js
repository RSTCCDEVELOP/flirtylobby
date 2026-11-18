// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { tx } from "../lib/t";
import PageSettingsPanel from "./PageSettingsPanel";
import { useSession } from "./Session";

const I = (d) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const ICON = {
  plus: I(<path d="M12 5v14M5 12h14" />),
  layers: I(<><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>),
  gear: I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z" /></>),
  eye: I(<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  sliders: I(<><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>),
  expand: I(<path d="M9 5l7 7-7 7" />),
  panel: I(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>),
};

// The editor shell of the page (like a page builder): a bar at the top and a panel at the left with the elements to add, the structure of the page and the settings of
// the block or part that you picked. The page itself stays visible next to it, so every change shows at once.
export const SB_MIN = 280, SB_MAX = 640;
// the divider between the panel and the page: drag it to give the page or the panel more room (the width is remembered)
const setWidth = (w) => document.documentElement.style.setProperty("--pb-sb-w", `${Math.round(Math.min(SB_MAX, Math.max(SB_MIN, w)))}px`);
function startDrag(e) {
  e.preventDefault();
  const root = document.documentElement;
  root.classList.add("pb-resizing");
  const move = (ev) => setWidth(ev.clientX);
  const up = () => {
    root.classList.remove("pb-resizing");
    window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
    try { localStorage.setItem("pb-sb-w", String(parseInt(getComputedStyle(root).getPropertyValue("--pb-sb-w"), 10) || 340)); } catch {}
  };
  window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
}
export default function EditorShell({ open, setOpen, view, setView, title, saving, onExit, setTarget, setPageTarget, elements, structure, hasSettings, actions }) {
  const { user } = useSession();
  useEffect(() => { try { const w = parseInt(localStorage.getItem("pb-sb-w") || "", 10); if (w) setWidth(w); } catch {} }, []);
  if (typeof document === "undefined") return null;
  const views = [["elements", "Elementen", ICON.plus], ["structure", "Structuur", ICON.layers], ["page", "Pagina", ICON.sliders], ["settings", "Instellingen", ICON.gear]];
  const pick = (k) => { if (open && view === k) setOpen(false); else { setView(k); setOpen(true); } };
  return createPortal(
    <>
      <div className="pb-topbar" role="toolbar" aria-label={tx("Pagina bewerken")}>
        <div className="pb-tb-left">
          <button type="button" className={`pb-tb-btn${open ? " on" : ""}`} onClick={() => setOpen(!open)} title={open ? tx("Paneel verbergen") : tx("Paneel tonen")} aria-label={tx("Paneel")}>{ICON.panel}</button>
          {views.map(([k, l, ic]) => <button type="button" key={k} className={`pb-tb-btn${open && view === k ? " on" : ""}`} onClick={() => pick(k)} title={tx(l)} aria-label={tx(l)}>{ic}<span>{tx(l)}</span></button>)}
        </div>
        <div className="pb-tb-mid"><strong>{title || tx("Pagina")}</strong></div>
        <div className="pb-tb-right">
          <span className="pb-tb-save">{saving === "saving" ? tx("Opslaan…") : saving === "error" ? tx("Opslaan mislukt") : tx("Opgeslagen")}</span>
          <button type="button" className="pb-tb-btn primary" onClick={onExit} title={tx("Bewerken afsluiten en de pagina bekijken")}>{ICON.eye}<span>{tx("Klaar")}</span></button>
        </div>
      </div>
      {!open && (
        <div className="pb-sb-rail" aria-label={tx("Bewerkpaneel")}>
          <button type="button" className="pb-rail-btn" onClick={() => setOpen(true)} title={tx("Paneel uitklappen")} aria-label={tx("Paneel uitklappen")}>{ICON.expand}</button>
          {views.map(([k, l, ic]) => <button type="button" key={k} className="pb-rail-btn" onClick={() => { setView(k); setOpen(true); }} title={tx(l)} aria-label={tx(l)}>{ic}</button>)}
        </div>
      )}
      {open && (
        <aside className="pb-sidebar" aria-label={tx("Bewerkpaneel")}>
          <div className="pb-sb-resize" onPointerDown={startDrag} onDoubleClick={() => { setWidth(340); try { localStorage.removeItem("pb-sb-w"); } catch {} }} role="separator" aria-orientation="vertical" aria-label={tx("Breedte van het paneel: sleep om te verbreden of te versmallen")} title={tx("Sleep om de breedte aan te passen (dubbelklik: standaard)")} />
          <div className="pb-sb-head">
            <strong>{tx(views.find(([k]) => k === view)?.[1] || "Elementen")}</strong>
            <span style={{ flex: 1 }} />
            {view !== "elements" && <button type="button" className="pb-sb-add" onClick={() => setView("elements")} title={tx("Een element toevoegen aan de pagina")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>{tx("Elementen toevoegen")}</button>}
            <button type="button" className="pb-sb-x" onClick={() => setOpen(false)} aria-label={tx("Sluiten")}>×</button>
          </div>
          <div className="pb-sb-body">
            <div className="pb-sb-pane" hidden={view !== "elements"}>{elements}</div>
            <div className="pb-sb-pane" hidden={view !== "structure"}>{structure}</div>
            <div className="pb-sb-pane" hidden={view !== "page"}><div ref={setPageTarget} className="pb-sb-page" /><PageSettingsPanel /></div>
            <div className="pb-sb-pane" hidden={view !== "settings"}>
              {!hasSettings && <p className="muted pb-sb-hint">{tx("Klik op het tandwiel van een blok of onderdeel op de pagina: de instellingen staan dan hier.")}</p>}
              {actions}
              <div ref={setTarget} className="pb-sb-settings" />
            </div>
          </div>
          <div className="pb-sb-save">
            <button type="button" className="pb-sb-savebtn" onClick={() => window.dispatchEvent(new Event(user?.is_staff ? "pb-save-ask" : "pb-flush"))} disabled={saving === "saving"}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3h11l3 3v13a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" /><path d="M7 3v6h8V3M7 21v-7h10v7" /></svg>
              {saving === "saving" ? tx("Opslaan…") : tx("Opslaan")}
            </button>
            <small className="pb-sb-savestate">{saving === "saving" ? "" : saving === "error" ? tx("Opslaan mislukt") : tx("Opgeslagen")}</small>
          </div>
          <div className="pb-sb-foot" id="pb-device-host" />
        </aside>
      )}
    </>, document.body);
}
