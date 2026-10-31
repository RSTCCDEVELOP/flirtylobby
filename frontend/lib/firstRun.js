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
let licenseOpen = false; // the question about the licence (it comes first) is open: the other questions wait until it is answered (also when the answer is "Later")
const licSubs = new Set();
export const setLicenseOpen = (v) => { licenseOpen = !!v; licSubs.forEach((f) => f(licenseOpen)); };
const set = (v) => { state = v; subs.forEach((f) => f(v)); };

export function useSandboxFirst(enabled = true) {
  const [st, setSt] = useState(state);
  const [lic, setLic] = useState(licenseOpen);
  useEffect(() => {
    subs.add(setSt); licSubs.add(setLic); setLic(licenseOpen);
    if (enabled && state === null && !loading) { loading = true; api("/system/sandbox-first/").then(set).catch(() => set({ local: false, asked: true, manual_asked: true, enabled: false })).finally(() => { loading = false; }); }
    return () => { subs.delete(setSt); licSubs.delete(setLic); };
  }, [enabled]);
  const rawSandbox = !!(st && st.local && !st.asked), rawManual = !!(st && !st.manual_asked);
  // one after the other: licence, sandbox, manual; then the rest (installation, AI)
  return { sandboxPending: !lic && rawSandbox, manualPending: !lic && !rawSandbox && rawManual, pending: lic || rawSandbox || rawManual, known: st !== null, st };
}

export const answerSandbox = async (on) => { try { set(await api("/system/sandbox-first/", { method: "POST", body: { on } })); } catch { set({ ...(state || { local: true }), asked: true }); } };

// the question "look at the manual?" was answered (yes or no)
export const answerManual = async () => { try { set(await api("/system/sandbox-first/", { method: "POST", body: { manual: true } })); } catch { set({ ...(state || {}), manual_asked: true }); } };
