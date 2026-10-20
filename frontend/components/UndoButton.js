"use client";

import { useEffect, useState } from "react";
import { alertDialog } from "../lib/dialog";
import { errorText } from "../lib/api";
import { lastUndoLabel, runUndo, subscribeUndo, undoCount } from "../lib/undo";
import { tx } from "../lib/t";
import { useSession } from "./Session";

// Undo in edit mode, at the top right: puts back the last action (up to 10 steps: texts, pictures, blocks and their settings)
export default function UndoButton() {
  const { editing } = useSession();
  const [n, setN] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setN(undoCount()); return subscribeUndo(() => setN(undoCount())); }, []);
  useEffect(() => {
    const key = (e) => { if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z" && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable && undoCount()) { e.preventDefault(); go(); } };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });
  async function go() {
    if (busy || !undoCount()) return;
    setBusy(true);
    try { await runUndo(); } catch (e) { alertDialog(errorText(e)); }
    setBusy(false);
  }
  if (!editing) return null;
  const label = n ? `${tx("Ongedaan maken")}: ${lastUndoLabel()} (${n})` : tx("Niets om ongedaan te maken");
  return (
    <button type="button" className="edit-undo-btn" onClick={go} disabled={!n || busy} title={label} aria-label={label}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 010 11H11" /></svg>
      {n > 0 && <span className="edit-undo-n">{n}</span>}
    </button>
  );
}
