// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// The design of the AI creator that is open now: the floating cost window (AiLiveCost) shows what this design costs and lets you reset that counter.
let current = null;
export const getActiveDesign = () => current;
export function setActiveDesign(d) {
  current = d || null;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("e2e-active-design", { detail: current }));
}
export const ACTIVE_DESIGN_EVENT = "e2e-active-design";
