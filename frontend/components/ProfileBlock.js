"use client";

import { PinButton, useAccordion } from "./Collapsible";

// A clearly separated block on the profile pages: icon in the house colour, title, short explanation, then the fields.
// Folds like every other block (state remembered per `id`, "Alles in-/uitklappen" works too).
export default function ProfileBlock({ id, icon, title, hint, children, className = "", right, defaultOpen = false }) {
  const { open, toggle, pinned, togglePin } = useAccordion(id, defaultOpen);

  return (
    <section className={`card pblock ${open ? "open" : "closed"} ${className}`}>
      <header className="pblock-head">
        <button type="button" className="pblock-toggle" onClick={toggle} aria-expanded={open}>
          {icon && <span className="pblock-ico">{icon}</span>}
          <span className="pblock-title">
            <h2>{title}</h2>
            {hint && <p className="muted">{hint}</p>}
          </span>
          <svg className="pblock-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {right && <div className="pblock-right">{right}</div>}
        <PinButton pinned={pinned} onClick={togglePin} />
      </header>
      {open && <div className="pblock-body">{children}</div>}
    </section>
  );
}
