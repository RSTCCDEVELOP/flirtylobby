"use client";

import { tx } from "../lib/t";
import { useEffect, useRef, useState } from "react";
import { useUi } from "./Ui";

// Open/closed state of a foldable block, remembered per `id` (when "remember" is on). Accordion: opening a block closes the other open
// blocks on the page, unless they are pinned. Shared by <Collapsible /> and <ProfileBlock />.
export function useAccordion(id, defaultOpen = false) {
  const [open, setOpen] = useState(defaultOpen);
  const [pinned, setPinned] = useState(false);
  const { remember_collapse: remember } = useUi();
  const key = `collapse:${id}`;
  const pinKey = `collapse-pin:${id}`;
  const pinRef = useRef(false);
  pinRef.current = pinned;

  useEffect(() => {
    try {
      const saved = id && remember ? localStorage.getItem(key) : null;
      setOpen(saved !== null ? saved === "1" : defaultOpen);
      if (id && remember) setPinned(localStorage.getItem(pinKey) === "1");
    } catch {}
    const all = (e) => setOpen(e.detail);
    // another block was opened: close this one unless it is pinned
    const other = (e) => {
      if (e.detail === id || pinRef.current) return;
      setOpen(false);
      if (id && remember) try { localStorage.setItem(key, "0"); } catch {}
    };
    window.addEventListener("collapse-all", all);
    window.addEventListener("collapse-opened", other);
    return () => { window.removeEventListener("collapse-all", all); window.removeEventListener("collapse-opened", other); };
  }, [key, pinKey, id, remember, defaultOpen]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (id && remember) try { localStorage.setItem(key, next ? "1" : "0"); } catch {}
    if (next) window.dispatchEvent(new CustomEvent("collapse-opened", { detail: id }));
  };
  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    if (id && remember) try { localStorage.setItem(pinKey, next ? "1" : "0"); } catch {}
  };
  return { open, toggle, pinned, togglePin };
}

// Green pin = this block stays open when another one is opened; red = it closes.
export function PinButton({ pinned, onClick }) {
  const label = pinned ? tx("Blijft open als je een ander blok opent") : tx("Wordt gesloten als je een ander blok opent");
  return (
    <button type="button" className={`collapse-pin ${pinned ? "on" : ""}`} onClick={onClick} aria-pressed={pinned} title={label} aria-label={label}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 14v7" /></svg>
    </button>
  );
}

// Card whose body can be folded. <CollapseAll /> folds every block on the page.
export default function Collapsible({ id, title, children, className = "", defaultOpen = false }) {
  const { open, toggle, pinned, togglePin } = useAccordion(id, defaultOpen);
  return (
    <section className={`card collapsible ${open ? "open" : ""} ${className}`}>
      <div className="collapse-row">
        <button type="button" className="collapse-head" onClick={toggle} aria-expanded={open}>
          <h2>{title}</h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <PinButton pinned={pinned} onClick={togglePin} />
      </div>
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
      <button type="button" className="btn sm" onClick={() => send(false)}>{tx("Alles inklappen")}</button>
      <button type="button" className="btn sm" onClick={() => send(true)}>{tx("Alles uitklappen")}</button>
    </span>
  );
}
