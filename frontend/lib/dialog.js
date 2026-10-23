// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// System popups (replace the browser's alert / confirm / prompt). They use the popup style from Admin -> Vormgeving.
// Usage (always instead of window.alert/confirm/prompt):
//   if (!(await confirmDialog("Verwijderen?", { danger: true }))) return;
//   With { options: [{ key, label, hint, checked }], optionsTitle } the confirm shows tick boxes and gives back the ticked keys (an array), or false when cancelled.
//   With { choices: [{ value, label, hint }] } the confirm shows radio buttons and gives back the chosen value (false when cancelled).
//   await alertDialog("Gelukt");   const name = await promptDialog("Nieuwe naam", "oud");
let host = null;

export function registerDialogHost(fn) {
  host = fn;
  return () => { if (host === fn) host = null; };
}

const open = (spec, fallback) => new Promise((resolve) => (host ? host({ ...spec, resolve }) : resolve(fallback)));

export const confirmDialog = (message, opts = {}) => open({ kind: "confirm", message, ...opts }, false);
export const alertDialog = (message, opts = {}) => open({ kind: "alert", message: String(message ?? ""), ...opts }, undefined);
export const promptDialog = (message, value = "", opts = {}) => open({ kind: "prompt", message, value, ...opts }, null);
