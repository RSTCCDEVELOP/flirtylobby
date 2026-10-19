"use client";

import { useCallback, useEffect, useState } from "react";

// Tiles or list, per screen, remembered for this user (localStorage "view:<id>"). The search text is not remembered.
// const view = useView("integrations");  view.mode = "tiles" | "list";  view.q = search text;  view.match(...texts) -> bool
export function useView(id, initial = "tiles") {
  const [mode, setModeState] = useState(initial);
  const [q, setQ] = useState("");
  useEffect(() => {
    try { const v = localStorage.getItem(`view:${id}`); if (v === "tiles" || v === "list") setModeState(v); } catch {}
  }, [id]);
  const setMode = useCallback((m) => {
    setModeState(m);
    try { localStorage.setItem(`view:${id}`, m); } catch {}
  }, [id]);
  const match = useCallback((...texts) => !q.trim() || texts.filter(Boolean).join(" ").toLowerCase().includes(q.trim().toLowerCase()), [q]);
  return { id, mode, setMode, q, setQ, match, cls: mode === "list" ? " view-list" : "" };
}
