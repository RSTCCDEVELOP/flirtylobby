// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { useEffect, useState } from "react";
import { api } from "./api";

// The first question on your own computer ("sandbox on?") is answered before the other messages (installation, AI) come: they wait for it.
let state = null; // {local, asked, enabled}
let loading = false;
const subs = new Set();
const set = (v) => { state = v; subs.forEach((f) => f(v)); };

export function useSandboxFirst(enabled = true) {
  const [st, setSt] = useState(state);
  useEffect(() => {
    subs.add(setSt);
    if (enabled && state === null && !loading) { loading = true; api("/system/sandbox-first/").then(set).catch(() => set({ local: false, asked: true, enabled: false })).finally(() => { loading = false; }); }
    return () => subs.delete(setSt);
  }, [enabled]);
  return { pending: !!(st && st.local && !st.asked), known: st !== null, st };
}

export const answerSandbox = async (on) => { try { set(await api("/system/sandbox-first/", { method: "POST", body: { on } })); } catch { set({ local: true, asked: true, enabled: false }); } };
