// System popups (replace the browser's alert / confirm / prompt). They use the popup style from Admin -> Vormgeving.
// Usage (always instead of window.alert/confirm/prompt):
//   if (!(await confirmDialog("Verwijderen?", { danger: true }))) return;
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
