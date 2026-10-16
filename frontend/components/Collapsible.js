"use client";

import { useEffect, useState } from "react";
import { useUi } from "./Ui";

// Card whose body can be folded. State is remembered per `id`; <CollapseAll /> folds every block on the page.
export default function Collapsible({ id, title, children, className = "", defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const { remember_collapse: remember } = useUi();
  const key = `collapse:${id}`;

  useEffect(() => {
    try {
      const saved = remember ? localStorage.getItem(key) : null;
      setOpen(saved !== null ? saved === "1" : defaultOpen);
    } catch {}
    const all = (e) => setOpen(e.detail);
    window.addEventListener("collapse-all", all);
    return () => window.removeEventListener("collapse-all", all);
  }, [key, remember, defaultOpen]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (remember) try { localStorage.setItem(key, next ? "1" : "0"); } catch {}
  }

  return (
    <section className={`card collapsible ${open ? "open" : ""} ${className}`}>
      <button type="button" className="collapse-head" onClick={toggle} aria-expanded={open}>
        <h2>{title}</h2>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && <div className="collapse-body">{children}</div>}
    </section>
  );
}

export function CollapseAll() {
  const { remember_collapse: remember } = useUi();
  const send = (v) => {
    window.dispatchEvent(new CustomEvent("collapse-all", { detail: v }));
    if (remember) try {
      Object.keys(localStorage).filter((k) => k.startsWith("collapse:")).forEach((k) => localStorage.setItem(k, v ? "1" : "0"));
    } catch {}
  };
  return (
    <span className="collapse-all">
      <button type="button" className="btn sm" onClick={() => send(false)}>Alles inklappen</button>
      <button type="button" className="btn sm" onClick={() => send(true)}>Alles uitklappen</button>
    </span>
  );
}
