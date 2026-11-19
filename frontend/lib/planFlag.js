// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// The step plan popup of Website ontwerpen ("how do I fill my website?") opens by itself on an empty installation and after a reset.
// markPlan(): a reset or a new installation asks for it (the next time Website ontwerpen opens); the popup puts "off" when it was closed, so it does not keep coming back.
export const markPlan = () => { try { localStorage.setItem("si:plan", "1"); localStorage.removeItem("si:plan-off"); } catch {} };
export const planAsked = () => { try { return { flag: localStorage.getItem("si:plan") === "1", off: localStorage.getItem("si:plan-off") === "1" }; } catch { return { flag: false, off: false }; } };
export const planDone = () => { try { localStorage.removeItem("si:plan"); localStorage.setItem("si:plan-off", "1"); } catch {} };

// The AI explanation (AiWelcome) comes before the step plan: while it is open the plan waits (a popup behind another one is never seen).
import { useEffect, useState } from "react";
let aiOpen = false;
const aiSubs = new Set();
export const setAiWelcomeOpen = (v) => { aiOpen = !!v; aiSubs.forEach((f) => f(aiOpen)); };
export const useAiWelcomeOpen = () => {
  const [v, setV] = useState(aiOpen);
  useEffect(() => { aiSubs.add(setV); setV(aiOpen); return () => { aiSubs.delete(setV); }; }, []);
  return v;
};

// The dark layer with the loader (components/WizardLoader.js): from leaving for the design wizard until the wizard is on the screen (never longer than 20 seconds).
const LOADING = "e2e_wiz_loading", LOADING_MS = 20000;
export const startWizardLoading = () => { try { sessionStorage.setItem(LOADING, String(Date.now())); } catch {} if (typeof window !== "undefined") window.dispatchEvent(new Event("wizard-loading")); };
export const stopWizardLoading = () => { try { sessionStorage.removeItem(LOADING); } catch {} if (typeof window !== "undefined") window.dispatchEvent(new Event("wizard-loading")); };
export const wizardLoadingOn = () => { try { const t = Number(sessionStorage.getItem(LOADING) || 0); return !!t && Date.now() - t < LOADING_MS; } catch { return false; } };
