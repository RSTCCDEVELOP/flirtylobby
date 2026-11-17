// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { tx } from "../lib/t";
import KitHtml from "../lib/ui-kit/KitHtml";
import { useKit } from "../lib/ui-kit/kitDoc";

import Loading from "./Loading";
// The components of the easy2edit UI-kit: pick one (in the page editor) or look at them (Admin > Website > Componenten). Each has an easy2edit_tag: the name that
// the exports, the imports, the designs and the AI prompts use for it. The components take the colours, fonts and corners of the theme that is in use.
export function ComponentLibrary({ onPick, pickLabel = "Toevoegen", compact = false, setKey = "" }) {
  const { kit, tick } = useKit(true, setKey);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [tag, setTag] = useState("");
  const [msg, setMsg] = useState("");
  const all = kit?.KIT_COMPONENTS || [];
  const groups = useMemo(() => [...new Set(all.map((c) => c.group))], [all]);
  const find = q.trim().toLowerCase();
  const list = all.filter((c) => (!group || c.group === group) && (!find || `${c.name} ${c.description} ${c.easy2edit_tag} ${c.category}`.toLowerCase().includes(find)));
  const sel = all.find((c) => c.easy2edit_tag === tag) || list[0] || null;
  const [openG, setOpenG] = useState(null);  // one group is open, the others are closed (a click on another group opens that one); null = the group of the chosen component
  const grouped = groups.map((g) => [g, list.filter((c) => c.group === g)]).filter(([, l]) => l.length);
  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); } catch { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    setMsg(tx("{0} gekopieerd", what)); setTimeout(() => setMsg(""), 1800);
  };
  return (
    <div className="cl" style={{ display: "grid", gridTemplateColumns: compact ? "260px minmax(0,1fr)" : "300px minmax(0,1fr)", gap: "1rem", minHeight: compact ? 0 : 520 }}>
      <div className="stack-sm" style={{ minWidth: 0 }}>
        <input type="search" placeholder={tx("Zoek een component…")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tx("Zoek een component…")} />
        <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label={tx("Groep")}>
          <option value="">{tx("Alle groepen")} ({all.length})</option>
          {groups.map((g) => <option key={g} value={g}>{tx(g)} ({all.filter((c) => c.group === g).length})</option>)}
        </select>
        <div className="cl-list" style={{ display: "grid", gap: ".3rem", maxHeight: compact ? 380 : 620, overflow: "auto", paddingRight: ".2rem" }}>
          {!kit && <small className="muted"><Loading compact /></small>}
          {grouped.map(([g, items]) => {
            const current = openG === null ? (sel?.group || grouped[0]?.[0]) : openG;
            const folded = !find && current !== g;  // a search opens every group that has a hit
            return (
              <div key={g} className="cl-group">
                <button type="button" className="cl-ghead" aria-expanded={!folded} onClick={() => setOpenG(current === g ? "" : g)}>
                  <span className="cl-chev" aria-hidden="true">{folded ? "›" : "⌄"}</span><strong>{tx(g)}</strong><small>{items.length}</small>
                </button>
                {!folded && (
                  <div className="cl-gitems">
                    {items.map((c) => (
                      <button type="button" key={c.easy2edit_tag} className={`btn sm ${sel?.easy2edit_tag === c.easy2edit_tag ? "primary" : ""}`} style={{ justifyContent: "flex-start", textAlign: "left", flexDirection: "column", alignItems: "flex-start", gap: 0 }} onClick={() => setTag(c.easy2edit_tag)}>
                        <strong>{tx(c.name)}</strong><small style={{ opacity: .75 }}>{c.easy2edit_tag}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {kit && !list.length && <small className="muted">{tx("Niets gevonden.")}</small>}
        </div>
      </div>
      <div className="stack-sm" style={{ minWidth: 0 }}>
        {sel ? (
          <>
            <div style={{ display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>
              <strong style={{ fontSize: "1.05rem" }}>{tx(sel.name)}</strong>
              <code className="badge" title="easy2edit_tag">{sel.easy2edit_tag}</code>
              <small className="muted" style={{ flex: 1 }}>{tx(sel.description)}</small>
            </div>
            <div style={{ height: compact ? 360 : 520, overflow: "auto", padding: 14, border: "1px solid var(--line)", borderRadius: 12, background: "var(--bg)", color: "var(--text)" }}><KitHtml stage key={sel.easy2edit_tag} html={sel.html} tag={sel.easy2edit_tag} set={sel.set || ""} /></div>
            <div className="row" style={{ justifyContent: "flex-start", gap: ".5rem", flexWrap: "wrap", alignItems: "center" }}>
              {onPick && <button type="button" className="btn primary" onClick={() => onPick(sel)}>{tx(pickLabel)}</button>}
              <button type="button" className="btn" onClick={() => copy(sel.html, tx("HTML"))}>{tx("Kopieer HTML")}</button>
              <button type="button" className="btn" onClick={() => copy(sel.easy2edit_tag, tx("Tag"))}>{tx("Kopieer easy2edit_tag")}</button>
              {msg && <small className="muted">{msg}</small>}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// The component picker of the page editor (a popup)
export default function ComponentPicker({ onPick, onClose }) {
  return createPortal(
    <div className="pb-objback" style={{ zIndex: 1300 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pb-objpop" role="dialog" aria-label={tx("Component toevoegen")} style={{ width: "min(1100px, 95vw)", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="pb-objhead"><strong>{tx("Component uit de UI-kit")}</strong><span style={{ flex: 1 }} /><button type="button" className="pb-panelx" onClick={onClose} aria-label={tx("Sluiten")}>×</button></div>
        <div style={{ padding: "1rem 1.2rem 1.2rem", overflow: "auto" }}><ComponentLibrary compact onPick={onPick} /></div>
      </div>
    </div>, document.body);
}
