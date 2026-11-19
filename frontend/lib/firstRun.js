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
// The messages come one after the other: licence, terms and conditions, sandbox, manual, update of the system, installation, AI. "Later" (or closing) on one only lets the next one come.
const blockers = new Set(); // "license", "update": messages that are open or still to be asked; the ones after them wait
const licSubs = new Set();
const code = () => `${blockers.has("license") || blockers.has("setup") ? 1 : 0}${blockers.size > 0 ? 1 : 0}${blockers.has("update") ? 1 : 0}${blockers.has("terms") ? 1 : 0}${blockers.has("license") ? 1 : 0}`; // "<licence or set-up form><anything><update><terms><licence message only>": which messages are open (the set-up form, where the licence is made, counts as the licence: the terms and the rest wait for it)
const tell = () => licSubs.forEach((f) => f(code()));
export const setBlock = (name, v) => { if (v) blockers.add(name); else blockers.delete(name); tell(); };
export const setLicenseOpen = (v) => setBlock("license", v);
const set = (v) => { state = v; subs.forEach((f) => f(v)); };

export function useSandboxFirst(enabled = true) {
  const [st, setSt] = useState(state);
  const [lic, setLic] = useState(code());
  useEffect(() => {
    subs.add(setSt); licSubs.add(setLic); setLic(code());
    if (enabled && state === null && !loading) { loading = true; api("/system/sandbox-first/").then(set).catch(() => set({ local: false, asked: true, manual_asked: true, enabled: false })).finally(() => { loading = false; }); }
    return () => { subs.delete(setSt); licSubs.delete(setLic); };
  }, [enabled]);
  const welcomeOpen = !!(st && st.welcome_asked === false);  // the very first question (language and light or dark) comes before everything
  const rawSandbox = !!(st && st.local && !st.asked), rawManual = !!(st && !st.manual_asked);
  // one after the other: licence, sandbox, manual; then the rest (installation, AI)
  const licOpen = lic[0] === "1", licMsgOpen = lic[4] === "1", anyBlock = lic[1] === "1", updOpen = lic[2] === "1", termsOpen = lic[3] === "1";
  const first = welcomeOpen || licOpen || termsOpen; // licence and terms come before sandbox, manual, update, installation and AI
  return { welcomeOpen, licenseOpen: licOpen, licenseMessageOpen: licMsgOpen, sandboxPending: !first && rawSandbox, manualPending: !first && !rawSandbox && rawManual, pendingBase: first || rawSandbox || rawManual, pendingInstall: first || updOpen || rawSandbox || rawManual, pending: anyBlock || rawSandbox || rawManual, known: st !== null, st };
}

export const answerSandbox = async (on) => { try { set(await api("/system/sandbox-first/", { method: "POST", body: { on } })); } catch { set({ ...(state || { local: true }), asked: true }); } };

// the question "look at the manual?" was answered (yes or no)
export const answerManual = async () => { try { set(await api("/system/sandbox-first/", { method: "POST", body: { manual: true } })); } catch { set({ ...(state || {}), manual_asked: true }); } };


// the very first popup of a new installation (language and light or dark) was answered
export const answerWelcome = async () => { try { set(await api("/system/sandbox-first/", { method: "POST", body: { welcome: true } })); } catch { set({ ...(state || {}), welcome_asked: true }); } };
