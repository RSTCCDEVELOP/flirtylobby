"use client";

import { tx } from "../lib/t";
import { useEffect, useRef, useState } from "react";
import { registerDialogHost } from "../lib/dialog";

const TITLES = { confirm: "Bevestigen", alert: "Melding", prompt: "Invullen" };

// Renders the system popups of lib/dialog.js (one at a time). Looks like all other popups (Vormgeving -> Popups).
export default function DialogHost() {
  const [queue, setQueue] = useState([]);
  const [text, setText] = useState("");
  const input = useRef(null), ok = useRef(null);
  const cur = queue[0];

  useEffect(() => registerDialogHost((spec) => setQueue((q) => [...q, spec])), []);
  useEffect(() => {
    if (!cur) return;
    setText(cur.value ?? "");
    setTimeout(() => (cur.kind === "prompt" ? input.current?.select() : ok.current?.focus()), 30);
  }, [cur]);

  if (!cur) return null;
  const close = (result) => { cur.resolve(result); setQueue((q) => q.slice(1)); };
  const cancel = () => close(cur.kind === "confirm" ? false : cur.kind === "prompt" ? null : undefined);
  const accept = () => close(cur.kind === "confirm" ? true : cur.kind === "prompt" ? text : undefined);

  return (
    <div className="overlay" role="alertdialog" aria-modal="true" style={{ zIndex: 4000 }} onClick={cancel}
      onKeyDown={(e) => { if (e.key === "Escape") cancel(); if (e.key === "Enter" && cur.kind !== "prompt") { e.preventDefault(); accept(); } }}>
      <form className="card modal form" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); accept(); }}>
        <h2>{cur.title || tx(TITLES[cur.kind])}</h2>
        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{cur.message}</p>
        {cur.kind === "prompt" && <input ref={input} value={text} onChange={(e) => setText(e.target.value)} />}
        <div className="row">
          {cur.kind !== "alert" && <button type="button" className="btn" onClick={cancel}>{cur.cancelLabel || tx("Annuleren")}</button>}
          <button ref={ok} type="submit" className={`btn ${cur.danger ? "danger" : "primary"}`}>{cur.okLabel || (cur.danger ? tx("Verwijderen") : "OK")}</button>
        </div>
      </form>
    </div>
  );
}
