// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { tx } from "../lib/t";

// THE colour field of easy2edit: a small swatch that opens a popup. In that popup, always: the colours of the active theme (they follow the theme and the day/night mode), your own saved colours,
// and an own colour (the colour wheel and the code). One popup instead of rows of swatches: it saves room, in every screen. It replaces <input type="color"> everywhere:
//   <ColorInput value="#f2823f" onChange={(e) => set(e.target.value)} />      (the same call as the input: e.target.value is the colour)
//   <ColorInput value="primary" tokens allowNone onValue={(v) => set(v)} />   (the page editor: a theme colour is kept by its name, "" = like the theme)
export const THEME = [["primary", "Primair", "var(--blue)"], ["secondary", "Secundair", "var(--orange)"], ["card", "Kaart", "var(--card)"], ["page", "Pagina", "var(--page, var(--bg))"], ["text", "Tekst", "var(--text)"],
  ["muted", "Gedempt", "var(--muted)"], ["ok", "Succes", "var(--ok)"], ["danger", "Gevaar", "var(--danger)"], ["white", "Wit", "#ffffff"], ["black", "Zwart", "#000000"]];
export const tokenVar = (k) => (THEME.find((t) => t[0] === k) || [])[2] || "";
const HEX = /^#[0-9a-f]{6}$/i;

// your own colours: saved per person (also on other computers) and the same in every colour popup
export const readSaved = () => { try { const v = JSON.parse(localStorage.getItem("savedColors") || "[]"); return Array.isArray(v) ? v.filter((x) => HEX.test(x)).slice(0, 16) : []; } catch { return []; } };
const storeSaved = (list) => { try { localStorage.setItem("savedColors", JSON.stringify(list)); } catch { /* ok */ } window.dispatchEvent(new Event("saved-colors")); };

// a CSS colour (also a var()) as #rrggbb: the colour of the theme as it is now
function toHex(css) {
  try {
    const el = document.createElement("span"); el.style.color = css; el.style.display = "none"; document.body.appendChild(el);
    const c = getComputedStyle(el).color; document.body.removeChild(el);
    const m = c.match(/\d+(\.\d+)?/g); if (!m || m.length < 3) return "#888888";
    return `#${m.slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, "0")).join("")}`;
  } catch { return "#888888"; }
}

export default function ColorInput({ value, onChange, onValue, tokens = false, allowNone = false, disabled = false, className = "", style, title, onBlur, ...rest }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [saved, setSaved] = useState([]);
  const [theme, setTheme] = useState([]);
  const btn = useRef(null), pop = useRef(null);
  const set = (v) => { if (onValue) onValue(v); if (onChange) onChange({ target: { value: v } }); };
  const isToken = tokens && !!tokenVar(value);
  const shown = isToken ? tokenVar(value) : HEX.test(value || "") ? value : (value || "");
  const hex = isToken ? toHexSafe(value) : HEX.test(value || "") ? value : "#888888";
  function toHexSafe(k) { return typeof document === "undefined" ? "#888888" : toHex(tokenVar(k)); }

  useEffect(() => {
    if (!open) return undefined;
    setSaved(readSaved());
    setTheme(THEME.map(([k, l, v]) => [k, l, toHex(v)]));
    const r = btn.current.getBoundingClientRect(), W = 268, H = 380;
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - W - 8)), top: r.bottom + 6 + H > window.innerHeight ? Math.max(8, r.top - H - 6) : r.bottom + 6 });
    const down = (e) => { if (!pop.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    const sync = () => setSaved(readSaved());
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key); window.addEventListener("saved-colors", sync);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); window.removeEventListener("saved-colors", sync); };
  }, [open]);

  const pick = (v) => { set(v); };
  const isSaved = HEX.test(value || "") && saved.some((c) => c.toLowerCase() === value.toLowerCase());
  const sw = (bg, on, label, onClick, extra = {}) => <button type="button" key={label + bg} title={label} aria-label={label} aria-pressed={on} onClick={onClick} style={{ width: 28, height: 28, borderRadius: 8, border: on ? "2px solid var(--blue)" : "1px solid var(--line)", background: bg, cursor: "pointer", padding: 0, ...extra }} />;
  const popup = open && pos && typeof document !== "undefined" ? createPortal(
    <div ref={pop} role="dialog" aria-label={tx("Kleur kiezen")} onMouseDown={(e) => e.stopPropagation()} style={{ position: "fixed", left: pos.left, top: pos.top, width: 268, zIndex: 100001, background: "var(--card, #fff)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 14, boxShadow: "0 18px 50px rgba(0,0,0,.28)", padding: ".8rem", display: "grid", gap: ".7rem" }}>
      <div style={{ display: "grid", gap: ".35rem" }}>
        <strong style={{ fontSize: ".78rem", textTransform: "uppercase", letterSpacing: ".04em", opacity: .7 }}>{tx("Kleuren van het thema")}</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {allowNone && sw("repeating-linear-gradient(45deg, transparent 0 4px, var(--line) 4px 5px)", !value, tx("Zoals het thema"), () => pick(""))}
          {theme.map(([k, l, h]) => sw(h, tokens ? value === k : (value || "").toLowerCase() === h, tx(l), () => pick(tokens ? k : h)))}
        </div>
      </div>
      <div style={{ display: "grid", gap: ".35rem" }}>
        <strong style={{ fontSize: ".78rem", textTransform: "uppercase", letterSpacing: ".04em", opacity: .7 }}>{tx("Opgeslagen")}</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {saved.map((c) => sw(c, (value || "").toLowerCase() === c.toLowerCase(), c, () => pick(c)))}
          {!saved.length && <small className="muted">{tx("Nog geen eigen kleuren opgeslagen.")}</small>}
          <button type="button" className="btn sm" disabled={!HEX.test(value || "") || isSaved} title={tx("Deze eigen kleur opslaan")} aria-label={tx("Deze eigen kleur opslaan")} onClick={() => { const l = [...saved, value.toLowerCase()].slice(-16); storeSaved(l); setSaved(l); }}>+</button>
          {isSaved && <button type="button" className="btn sm danger" title={tx("Deze opgeslagen kleur verwijderen")} aria-label={tx("Deze opgeslagen kleur verwijderen")} onClick={() => { const l = saved.filter((c) => c.toLowerCase() !== value.toLowerCase()); storeSaved(l); setSaved(l); }}>×</button>}
        </div>
      </div>
      <div style={{ display: "grid", gap: ".35rem" }}>
        <strong style={{ fontSize: ".78rem", textTransform: "uppercase", letterSpacing: ".04em", opacity: .7 }}>{tx("Eigen kleur")}</strong>
        <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
          <input type="color" value={hex} onChange={(e) => pick(e.target.value)} aria-label={tx("Eigen kleur")} style={{ width: 44, height: 36, padding: 2, flex: "none" }} />
          <input type="text" value={HEX.test(value || "") ? value : isToken ? "" : (value || "")} placeholder="#rrggbb" maxLength={7} spellCheck={false} onChange={(e) => { const v = e.target.value.trim(); if (/^#[0-9a-fA-F]{0,6}$/.test(v)) { if (HEX.test(v)) pick(v.toLowerCase()); } }} style={{ flex: 1, minWidth: 0, fontFamily: "ui-monospace, Menlo, monospace" }} aria-label={tx("Kleurcode")} />
        </div>
      </div>
    </div>, document.body) : null;
  return (
    <>
      <button ref={btn} type="button" className={`colorinput ${className}`.trim()} disabled={disabled} title={title || tx("Kleur kiezen")} onClick={() => !disabled && setOpen((o) => !o)} onBlur={onBlur}
        style={{ width: 44, height: 36, padding: 0, borderRadius: 8, border: "1px solid var(--line)", cursor: disabled ? "not-allowed" : "pointer", flex: "none", background: shown || "repeating-linear-gradient(45deg, transparent 0 4px, var(--line) 4px 5px)", boxShadow: "inset 0 0 0 2px var(--card, #fff)", opacity: disabled ? .55 : 1, ...style }} aria-haspopup="dialog" aria-expanded={open} {...rest} />
      {popup}
    </>
  );
}
