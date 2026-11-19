// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import KitScope from "../lib/ui-kit/KitScope";
import { tx } from "../lib/t";
import { IconPlus, IconX } from "./Icons";

// The tag system (module Tags): a coloured dot, a colour field, a tag chip and a picker that puts tags on any thing (kind + ref, see backend apps/core/tags.py).
export const SWATCHES = ["#2563eb", "#0ea5e9", "#14b8a6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899", "#a855f7", "#64748b"];

// The coloured dot before a name in a list (nothing when there is no colour).
export function ColorDot({ color, size = 10, title }) {
  if (!color) return null;
  return <i className="e2e-dot" aria-hidden="true" title={title} style={{ width: size, height: size, background: color }} />;
}

// A tag as a small chip with its colour.
export function TagChip({ tag, onRemove }) {
  return (
    <span className="e2e-tag" title={tag.description || ""}>
      <ColorDot color={tag.color} size={9} />{tag.name}
      {onRemove && <button type="button" className="e2e-tag__x" aria-label={tx("Verwijderen")} onClick={onRemove}><IconX width={11} height={11} /></button>}
    </span>
  );
}

// Colour field: only a circle with the chosen colour (a dashed ring when there is none); a click opens a small popup with the colours, an own colour and "no colour".
export function ColorField({ value, onChange, label, disabled = false, allowNone = true, inline = false }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btn = useRef(null);
  const toggle = () => {
    if (disabled) return;
    if (!open && btn.current) { const r = btn.current.getBoundingClientRect(); setPos({ top: Math.min(r.bottom + 8, window.innerHeight - 190), left: Math.min(r.left, window.innerWidth - 200) }); }
    setOpen(!open);
  };
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    const away = (e) => { if (!e.target.closest?.(".e2e-colorpick, [data-colorpick]")) setOpen(false); };
    document.addEventListener("keydown", key); document.addEventListener("mousedown", away); window.addEventListener("resize", close); window.addEventListener("scroll", close, true);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("mousedown", away); window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true); };
  }, [open]);
  const pick = (c) => { onChange(c); setOpen(false); };
  const has = /^#[0-9a-f]{6}$/i.test(value || "");
  // Fully inline styled: the popup sits in a portal and must look the same on every screen, whatever the page CSS does to buttons.
  const card = { position: "fixed", top: pos.top, left: pos.left, zIndex: 3300, width: 212, padding: 14, boxSizing: "border-box", background: "var(--e2e-surface, var(--surface, #fff))", color: "var(--e2e-text, inherit)", border: "1px solid rgba(127,127,127,.28)", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,.22)" };
  const dot = (c) => ({ appearance: "none", WebkitAppearance: "none", width: 28, height: 28, minWidth: 28, padding: 0, margin: 0, borderRadius: "50%", background: c, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: value === c ? `0 0 0 2px var(--e2e-surface, #fff), 0 0 0 4px ${c}` : "inset 0 0 0 1px rgba(0,0,0,.12)", transition: "transform .1s" });
  const pop = (
    <div data-colorpick="1" role="dialog" aria-label={tx("Kleur")} style={card}>
      <div style={{ fontSize: 12, fontWeight: 600, opacity: .7, marginBottom: 10 }}>{tx("Kleur")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 28px)", gap: 10, justifyContent: "space-between" }}>
        {SWATCHES.map((c) => (
          <button key={c} type="button" style={dot(c)} aria-label={c} title={c} aria-pressed={value === c} onClick={() => pick(c)}>
            {value === c ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : null}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(127,127,127,.22)" }}>
        <input type="color" value={has ? value : "#2563eb"} onChange={(e) => onChange(e.target.value)} aria-label={tx("Eigen kleur")} title={tx("Eigen kleur")} style={{ width: 28, height: 28, padding: 0, border: "none", borderRadius: "50%", background: "none", cursor: "pointer", overflow: "hidden" }} />
        <span style={{ fontSize: 13, flex: 1 }}>{tx("Eigen kleur")}</span>
        {allowNone && value ? <button type="button" onClick={() => pick("")} style={{ appearance: "none", background: "none", border: "none", padding: "2px 4px", fontSize: 13, cursor: "pointer", color: "inherit", opacity: .75, textDecoration: "underline" }}>{tx("Geen kleur")}</button> : null}
      </div>
    </div>
  );
  return (
    <KitScope tag="ui-color-field" className={inline ? "kit-inline" : ""}>
      {label && !inline && <label className="e2e-label"><span>{label}</span></label>}
      <div className="e2e-colorpick">
        <button ref={btn} type="button" className={`e2e-colorpick__btn${has ? "" : " is-empty"}`} style={{ width: 28, height: 28, minWidth: 28, padding: 0, borderRadius: "50%", flex: "0 0 auto", cursor: "pointer", border: has ? "2px solid var(--e2e-surface, #fff)" : "2px dashed rgba(127,127,127,.6)", boxShadow: has ? "0 0 0 1px rgba(127,127,127,.4)" : "none", background: has ? value : "transparent" }} aria-label={tx("Kleur kiezen")} title={tx("Kleur kiezen")} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={toggle} />
      </div>
      {open && typeof document !== "undefined" && createPortal(<KitScope tag="ui-color-field">{pop}</KitScope>, document.body)}
    </KitScope>
  );
}

// The tags on one thing: chips with a cross, and a "+" that opens a search over the tags that may be put on it.
export function TagPicker({ kind, refId, canEdit = true, label }) {
  const [ids, setIds] = useState(null);
  const [avail, setAvail] = useState([]);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [making, setMaking] = useState(false); // the small form for a new tag
  const [fresh, setFresh] = useState({ name: "", color: SWATCHES[0] });
  const load = useCallback(() => api(`/tags/links/?kind=${encodeURIComponent(kind)}&ref=${encodeURIComponent(refId)}`).then((r) => { setIds(r.tag_ids); setAvail(r.available); }).catch(() => { setIds([]); setAvail([]); }), [kind, refId]);
  useEffect(() => { if (refId !== undefined && refId !== null && refId !== "") load(); else { setIds([]); setAvail([]); } }, [load, refId]);
  const save = async (next) => {
    setErr("");
    try { await api("/tags/links/", { method: "PUT", body: { kind, ref: String(refId), tag_ids: next } }); setIds(next); window.dispatchEvent(new Event("tags-changed")); }
    catch (e) { setErr(errorText(e)); }
  };
  // a tag that does not exist yet is made here (any administrator may) and put on the thing at once
  const make = async () => {
    setErr("");
    if (!fresh.name.trim()) { setErr(tx("Geef de tag een naam.")); return; }
    try {
      const t = await api("/tags/", { method: "POST", body: { name: fresh.name.trim(), color: fresh.color, scope: "global" } });
      setAvail((a) => [...a, t]);
      await save([...(ids || []), t.id]);
      setMaking(false); setAdding(false); setQ(""); setFresh({ name: "", color: SWATCHES[0] });
    } catch (e) { setErr(errorText(e)); }
  };
  if (ids === null) return null;
  const chosen = ids.map((i) => avail.find((t) => t.id === i)).filter(Boolean);
  const hits = avail.filter((t) => !ids.includes(t.id) && t.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  const open = () => { setAdding(!adding); setQ(""); setMaking(false); };
  return (
    <KitScope tag="ui-tag">
      {label && <label className="e2e-label"><span>{label}</span></label>}
      <div className="e2e-tags">
        {chosen.map((t) => <TagChip key={t.id} tag={t} onRemove={canEdit ? () => save(ids.filter((i) => i !== t.id)) : null} />)}
        {!chosen.length && <span className="muted">{tx("Geen tags.")}</span>}
        {canEdit && <button type="button" className={`e2e-btn e2e-btn--sm${adding ? " e2e-btn--primary" : ""}`} aria-label={tx("Tag toevoegen")} title={tx("Tag toevoegen")} aria-expanded={adding} onClick={open}><IconPlus width={14} height={14} /></button>}
      </div>
      {adding && (
        <div className="e2e-tagadd">
          <input className="e2e-input" autoFocus value={q} onChange={(e) => { setQ(e.target.value); setFresh((f) => ({ ...f, name: e.target.value })); }} onKeyDown={(e) => { if (e.key === "Escape") setAdding(false); if (e.key === "Enter") { e.preventDefault(); if (hits[0]) { save([...ids, hits[0].id]); setQ(""); } else if (q.trim()) { setMaking(true); } } }} placeholder={tx("Zoek of maak een tag")} aria-label={tx("Zoek of maak een tag")} />
          <div className="e2e-tagadd__hits">
            {hits.map((t) => <button type="button" key={t.id} className="e2e-tagadd__hit" onClick={() => { save([...ids, t.id]); setQ(""); }}><ColorDot color={t.color} />{t.name}<small className="muted">{t.description}</small></button>)}
            {!making && <button type="button" className="e2e-tagadd__hit" onClick={() => { setMaking(true); setFresh((f) => ({ ...f, name: q })); }}><IconPlus width={13} height={13} /> {q.trim() ? tx("Nieuwe tag maken: {0}", q.trim()) : tx("Nieuwe tag maken")}</button>}
            {making && (
              <div className="e2e-tagadd__new">
                <ColorField inline value={fresh.color} onChange={(v) => setFresh((f) => ({ ...f, color: v || SWATCHES[0] }))} allowNone={false} />
                <input className="e2e-input" value={fresh.name} maxLength={60} onChange={(e) => setFresh((f) => ({ ...f, name: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); make(); } }} placeholder={tx("Naam van de tag")} aria-label={tx("Naam van de tag")} />
                <button type="button" className="e2e-btn e2e-btn--sm e2e-btn--primary" onClick={make}>{tx("Maken en toevoegen")}</button>
              </div>
            )}
          </div>
        </div>
      )}
      {err && <span className="e2e-error">{err}</span>}
    </KitScope>
  );
}

// The tags of a kind for a list: { tags, links: { ref: [ids] } }; reads again when a tag changed.
export function useTagMap(kind) {
  const [map, setMap] = useState({ tags: [], links: {} });
  const load = useCallback(() => api(`/tags/map/?kind=${encodeURIComponent(kind)}`).then(setMap).catch(() => {}), [kind]);
  useEffect(() => { load(); window.addEventListener("tags-changed", load); return () => window.removeEventListener("tags-changed", load); }, [load]);
  const of = (ref) => (map.links[String(ref)] || []).map((i) => map.tags.find((t) => t.id === i)).filter(Boolean);
  return { of };
}
