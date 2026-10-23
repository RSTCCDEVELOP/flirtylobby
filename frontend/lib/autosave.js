// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";

// Saves by itself shortly after something changed (no Save button).
//   value: everything the user can change (compared as JSON); ready: false until the page has loaded (the first loaded value is the baseline);
//   save(value): the page's own save function. It may set state with the server's answer: that answer becomes the new baseline.
// Returns {state: idle|saving|saved|error, retry}. A failed value is not retried until the user changes something again.
export function useAutoSave(value, save, { ready = true, delay = 900 } = {}) {
  const [state, setState] = useState("idle");
  const latest = useRef(value);
  const saveRef = useRef(save);
  const base = useRef(null);       // JSON of the last saved (or loaded) value
  const failed = useRef(null);     // JSON that failed to save
  const busy = useRef(false);
  latest.current = value;
  saveRef.current = save;
  const json = ready ? JSON.stringify(value) : null;

  const run = async () => {
    if (busy.current || !ready) return;
    const snap = JSON.stringify(latest.current);
    if (snap === base.current || snap === failed.current) return;
    busy.current = true; setState("saving");
    try {
      const r = await saveRef.current(latest.current);
      if (r === false) throw new Error("save failed");
      failed.current = null;
      setState("saved");
      setTimeout(() => { base.current = JSON.stringify(latest.current); busy.current = false; if (JSON.stringify(latest.current) !== base.current) run(); }, 80);
    } catch {
      failed.current = snap; busy.current = false; setState("error");
    }
  };

  useEffect(() => {
    if (json === null) { base.current = null; return; }
    if (base.current === null) { base.current = json; return; }   // first loaded value: nothing to save
    if (json === base.current || json === failed.current) return;
    const t = setTimeout(run, delay);
    return () => clearTimeout(t);
  }, [json]); // eslint-disable-line react-hooks/exhaustive-deps

  return { state, retry: () => { failed.current = null; run(); } };
}
