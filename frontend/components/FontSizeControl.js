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
import { tx } from "../lib/t";

// The button "Aa": the size of the letters of the whole website (pages, admin and dashboard), for everybody, also without a login (the theme setting "font_tool").
// The size a person picks is theirs: it is kept in this browser and shows at once everywhere (the base size --fs-base, 12 to 22 px; everything in rem follows it).
// A person who may change the theme can also set it as the standard for the whole website.
const MIN = 12, MAX = 22, DEFAULT = 13, KEY = "e2e_fontsize";
const readOwn = () => { try { const v = Number(localStorage.getItem(KEY)); return v >= MIN && v <= MAX ? v : null; } catch { return null; } };
const writeOwn = (v) => { try { v == null ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, String(v)); } catch {} };

export default function FontSizeControl({ canSave = false }) {
  const [open, setOpen] = useState(false);
  const [site, setSite] = useState(null);   // the standard of the whole website (the theme), the values of the theme for a save
  const [px, setPx] = useState(null);
  const [msg, setMsg] = useState(null);
  const [pos, setPos] = useState(null);
  const [busy, setBusy] = useState(false);
  const btn = useRef(null);
  const box = useRef(null);
  useEffect(() => {
    if (!open || site) return;
    api("/theme/").then((d) => { const v = d.values || {}; setSite(v); setPx(readOwn() ?? Math.round(Number(v.font_size_base) || DEFAULT)); }).catch((e) => setMsg(errorText(e)));
  }, [open, site]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!box.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const standard = Math.round(Number(site?.font_size_base) || DEFAULT);
  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = btn.current.getBoundingClientRect();
    setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    setMsg(null);
    setOpen(true);
  };
  const apply = (v) => {  // yours: at once, everywhere
    const n = Math.min(MAX, Math.max(MIN, Math.round(v)));
    setPx(n);
    setMsg(null);
    document.documentElement.style.setProperty("--fs-base", `${n}px`);
    writeOwn(n);
  };
  const reset = () => {  // back to the standard of the website
    writeOwn(null);
    setPx(standard);
    setMsg(null);
    document.documentElement.style.setProperty("--fs-base", `${standard}px`);
  };
  const saveForAll = async () => {
    setBusy(true); setMsg(null);
    try {
      await api("/theme/", { method: "PUT", body: { values: { ...site, font_size_base: px } } });
      setSite((t) => ({ ...t, font_size_base: px }));
      writeOwn(null);  // from now on this person follows the website too
      setMsg(tx("Voor iedereen ingesteld."));
    } catch (e) { setMsg(errorText(e)); }
    setBusy(false);
  };
  const ready = px != null && site;
  const title = tx("Lettergrootte van de hele website");
  return (
    <>
      <button ref={btn} type="button" className={`icon-btn${open ? " on" : ""}`} onClick={toggle} aria-expanded={open} aria-haspopup="dialog" aria-label={title} title={title} style={{ fontWeight: 700, fontSize: "1rem", lineHeight: 1, letterSpacing: "-.02em" }}>
        <span aria-hidden="true">A<span style={{ fontSize: ".75em" }}>a</span></span>
      </button>
      {open && pos && createPortal(
        <div ref={box} role="dialog" aria-label={title} style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 3200, width: 310, maxWidth: "calc(100vw - 16px)", padding: "1rem 1.1rem", background: "var(--card)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 14, boxShadow: "0 12px 34px rgba(0,0,0,.28)", display: "grid", gap: ".7rem" }}>
          <div><strong>{title}</strong><br /><span style={{ color: "var(--muted)", fontSize: ".82rem" }}>{tx("Alleen voor jou: de lettergrootte wordt in deze browser onthouden.")}</span></div>
          {!ready ? <span style={{ color: "var(--muted)", fontSize: ".85rem" }}>{msg || tx("Laden…")}</span> : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
                <button type="button" className="btn sm" aria-label={tx("Kleiner")} title={tx("Kleiner")} disabled={px <= MIN} onClick={() => apply(px - 1)} style={{ minWidth: 38 }}>A−</button>
                <input type="range" min={MIN} max={MAX} step={1} value={px} onChange={(e) => apply(Number(e.target.value))} aria-label={tx("Lettergrootte")} style={{ flex: 1, minWidth: 0 }} />
                <button type="button" className="btn sm" aria-label={tx("Groter")} title={tx("Groter")} disabled={px >= MAX} onClick={() => apply(px + 1)} style={{ minWidth: 38 }}>A+</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".6rem" }}>
                <span style={{ fontWeight: 700 }}>{px} px <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {Math.round((px / DEFAULT) * 100)}%</span></span>
                <button type="button" className="btn sm" disabled={px === standard && readOwn() == null} onClick={reset}>{tx("Standaard")}</button>
              </div>
              {canSave && <button type="button" className="btn sm primary" disabled={busy || px === standard} onClick={saveForAll}>{tx("Instellen voor de hele website")}</button>}
              {msg && <span style={{ color: msg === tx("Voor iedereen ingesteld.") ? "var(--muted)" : "var(--danger, #c0392b)", fontSize: ".82rem" }}>{msg}</span>}
            </>
          )}
        </div>, document.body)}
    </>
  );
}
