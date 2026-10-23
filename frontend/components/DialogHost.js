"use client";

import { tx } from "../lib/t";
import { useEffect, useRef, useState } from "react";
import { registerDialogHost } from "../lib/dialog";

const TITLES = { confirm: "Bevestigen", alert: "Melding", prompt: "Invullen" };

// Renders the system popups of lib/dialog.js (one at a time). Looks like all other popups (Vormgeving -> Popups).
export default function DialogHost() {
  const [queue, setQueue] = useState([]);
  const [text, setText] = useState("");
  const [choice, setChoice] = useState(null); // confirm with `choices`: the chosen one
  const [picked, setPicked] = useState([]); // confirm with `options`: the ticked ones
  const input = useRef(null), ok = useRef(null);
  const cur = queue[0];

  useEffect(() => registerDialogHost((spec) => setQueue((q) => [...q, spec])), []);
  useEffect(() => {
    if (!cur) return;
    setText(cur.value ?? "");
    setChoice(cur.choices?.[0]?.value ?? null);
    setPicked((cur.options || []).filter((o) => o.checked).map((o) => o.key));
    setTimeout(() => (cur.kind === "prompt" ? input.current?.select() : ok.current?.focus()), 30);
  }, [cur]);

  if (!cur) return null;
  const close = (result) => { cur.resolve(result); setQueue((q) => q.slice(1)); };
  const cancel = () => close(cur.kind === "confirm" ? false : cur.kind === "prompt" ? null : undefined);
  const accept = () => close(cur.kind === "confirm" ? (cur.choices ? choice : cur.options ? picked : true) : cur.kind === "prompt" ? text : undefined);

  return (
    <div className="overlay" role="alertdialog" aria-modal="true" style={{ zIndex: 4000 }} onClick={cancel}
      onKeyDown={(e) => { if (e.key === "Escape") cancel(); if (e.key === "Enter" && cur.kind !== "prompt") { e.preventDefault(); accept(); } }}>
      <form className="card modal form" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); accept(); }}>
        <h2>{cur.title || tx(TITLES[cur.kind])}</h2>
        <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{cur.message}</p>
        {cur.choices?.length > 0 && (
          <div className="form" style={{ gap: ".5rem" }}>
            {cur.choices.map((c) => (
              <label key={c.value} className="check">
                <input type="radio" name="dialog-choice" checked={choice === c.value} onChange={() => setChoice(c.value)} />
                <span><strong>{c.label}</strong>{c.hint && <><br /><small className="muted">{c.hint}</small></>}</span>
              </label>
            ))}
          </div>
        )}
        {cur.options?.length > 0 && (
          <div className="form" style={{ gap: ".4rem" }}>
            {cur.optionsTitle && <strong>{cur.optionsTitle}</strong>}
            {cur.options.map((o) => (
              <label key={o.key} className="check">
                <input type="checkbox" checked={picked.includes(o.key)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, o.key] : p.filter((k) => k !== o.key)))} />
                <span>{o.label}{o.hint && <small className="muted"> {o.hint}</small>}</span>
              </label>
            ))}
          </div>
        )}
        {cur.kind === "prompt" && <input ref={input} type={cur.password ? "password" : "text"} autoComplete={cur.password ? "current-password" : "off"} value={text} onChange={(e) => setText(e.target.value)} />}
        <div className="row">
          {cur.kind !== "alert" && <button type="button" className="btn" onClick={cancel}>{cur.cancelLabel || tx("Annuleren")}</button>}
          <button ref={ok} type="submit" className={`btn ${cur.danger ? "danger" : "primary"}`}>{cur.okLabel || (cur.danger ? tx("Verwijderen") : "OK")}</button>
        </div>
      </form>
    </div>
  );
}
