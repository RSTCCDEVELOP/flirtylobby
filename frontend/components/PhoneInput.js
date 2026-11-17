// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { tx, getLanguage } from "../lib/t";
import { DIAL, LANG_COUNTRY, dialOf, flag, parsePhone, regionName } from "../lib/phoneCodes";
import KitScope from "../lib/ui-kit/KitScope";

// A phone number with a country code: pick the country (flag, name and code; the country of the chosen language is selected at first) and type the number. The value is "+31 612345678".
// Components of the set: e2e-input (ui-form-fields) and the popup list of the theme.
export default function PhoneInput({ id, value, onChange, invalid, required, ...rest }) {
  const lang = getLanguage();
  const parsed = parsePhone(value);
  const [iso, setIso] = useState(parsed.iso || LANG_COUNTRY[lang] || "NL");
  const cur = parsed.iso && dialOf(parsed.iso) === dialOf(iso) ? iso : parsed.iso || iso;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const list = useRef(null);
  const names = useMemo(() => DIAL.map(([c, d]) => [c, d, regionName(c, lang)]).sort((a, b) => a[2].localeCompare(b[2], lang)), [lang]);
  const shown = names.filter(([c, d, n]) => !q.trim() || n.toLowerCase().includes(q.trim().toLowerCase()) || `+${d}`.startsWith(q.trim()) || c.toLowerCase() === q.trim().toLowerCase());
  const emit = (c, national) => {
    const n = String(national || "").replace(/[^\d\s-]/g, "").replace(/^[\s0-]+/, "");
    onChange(n.replace(/\D/g, "") ? `+${dialOf(c)} ${n.trim()}` : "");
  };
  useEffect(() => { // a number without a code (an older entry): it gets the code of the chosen country
    if (value && !String(value).trim().startsWith("+")) emit(iso, value);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = btn.current.getBoundingClientRect();
    const h = 300, below = window.innerHeight - r.bottom;
    setPos({ left: r.left, width: Math.max(r.width, 280), ...(below < h && r.top > below ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
    setQ(""); setOpen(true);
  };
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!list.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc, true); };
  }, [open]);
  const pick = (c) => { setIso(c); setOpen(false); emit(c, parsed.national); };
  return (
    <KitScope tag="ui-form-fields">
      <div className="e2e-row" style={{ gap: ".4rem", flexWrap: "nowrap" }}>
        <button ref={btn} type="button" className="e2e-input" aria-haspopup="listbox" aria-expanded={open} aria-label={tx("Landcode")} onClick={toggle}
          style={{ flex: "0 0 auto", width: "auto", display: "inline-flex", alignItems: "center", gap: ".4rem", cursor: "pointer", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: "1.25em", lineHeight: 1 }} aria-hidden="true">{flag(cur)}</span><span>+{dialOf(cur)}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <input id={id} className={`e2e-input${invalid ? " e2e-input--error" : ""}`} style={{ flex: 1, minWidth: 0 }} type="tel" inputMode="tel" autoComplete="tel-national" value={parsed.national} aria-invalid={invalid ? "true" : undefined} aria-required={required ? "true" : undefined} onChange={(e) => emit(cur, e.target.value)} {...rest} />
      </div>
      {open && pos && typeof document !== "undefined" && createPortal(
        <KitScope tag="ui-form-fields"><div ref={list} role="listbox" style={{ position: "fixed", zIndex: 3100, ...pos, maxHeight: 300, display: "flex", flexDirection: "column", background: "var(--card, #fff)", color: "var(--text, inherit)", border: "1px solid var(--line, #d0d5dd)", borderRadius: "var(--radius, 12px)", boxShadow: "0 12px 32px rgba(0,0,0,.22)", overflow: "hidden" }}>
          <div style={{ padding: ".5rem", borderBottom: "1px solid var(--line, #d0d5dd)" }}>
            <input className="e2e-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoeken")} aria-label={tx("Zoeken")} />
          </div>
          <div style={{ overflowY: "auto" }}>
            {shown.map(([c, d, n]) => (
              <button key={c} type="button" role="option" aria-selected={c === cur} onClick={() => pick(c)}
                style={{ display: "flex", alignItems: "center", gap: ".6rem", width: "100%", padding: ".45rem .75rem", border: 0, background: c === cur ? "var(--bg, rgba(0,0,0,.06))" : "transparent", color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer" }}>
                <span style={{ fontSize: "1.25em", lineHeight: 1 }} aria-hidden="true">{flag(c)}</span>
                <span style={{ flex: 1 }}>{n}</span>
                <span style={{ opacity: .65 }}>+{d}</span>
              </button>
            ))}
            {!shown.length && <p style={{ margin: 0, padding: ".75rem", opacity: .65 }}>{tx("Niets gevonden")}</p>}
          </div>
        </div></KitScope>, document.body)}
    </KitScope>
  );
}
