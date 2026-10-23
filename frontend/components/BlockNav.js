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
import { useSession } from "./Session";

// A list icon among the icons at the top right with a floating list (it stays open until it is closed) of the blocks of the page (their titles); a click goes to that block.
export default function BlockNav({ items }) {
  const { canEdit, editing } = useSession();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  const box = useRef(null);
  const key = items.map((i) => i.id).join("|");
  useEffect(() => { // which block is in view
    if (!items.length || typeof IntersectionObserver === "undefined") return;
    const seen = new Map();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
      const best = [...seen.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] > 0) setActive(best[0]);
    }, { threshold: [0, .25, .5, .75, 1] });
    items.forEach((i) => { const el = document.getElementById(i.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const show = !!editing && items.length >= 2; // only in edit mode // one block: nothing to choose
  useEffect(() => { // the help and undo icons of edit mode make room for this one
    if (!show) return;
    document.body.classList.add("has-blocknav");
    return () => document.body.classList.remove("has-blocknav");
  }, [show]);
  if (!show) return null;
  const right = `${1 + (canEdit ? 3 : 0) + (editing ? 3.05 : 0)}rem`; // among the icons at the top right: after the settings icons (page settings, block settings), before help and undo
  const go = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    try { window.history.replaceState(null, "", `#${id}`); } catch {}
  };  // the list stays open until the close button is used
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="block-nav" ref={box} style={{ right }}>
      <button type="button" className={`block-nav-btn${open ? " on" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={tx("Blokken van deze pagina")} title={tx("Blokken van deze pagina")}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
      </button>
      {open && (
        <nav className="block-nav-pop" aria-label={tx("Blokken van deze pagina")}>
          <div className="block-nav-head"><strong>{tx("Op deze pagina")}</strong><button type="button" className="block-nav-x" onClick={() => setOpen(false)} aria-label={tx("Sluiten")} title={tx("Sluiten")}>×</button></div>
          {items.map((i) => <a key={i.id} href={`#${i.id}`} className={active === i.id ? "on" : ""} onClick={(e) => { e.preventDefault(); go(i.id); }}>{i.title}</a>)}
        </nav>
      )}
    </div>, document.body);
}
