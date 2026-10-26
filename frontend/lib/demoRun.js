// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { api, errorText } from "./api";
import { tx } from "./t";

// The steps of making demo data, one request each, so a screen can show the progress.
export const STEP_LABEL = {
  media: "Voorbeeldplaatjes maken", heroes: "Hero-achtergronden maken", users: "Gebruikers met profiel maken", plans: "Abonnementen maken", money: "Donatie-acties, giften en abonnees maken",
  faq: "FAQ-vragen maken", pages: "Pagina's maken", views: "Media-systeemobjecten maken", "plugin:webshop": "Webshop: producten, systeemobjecten, verzendmethoden en bestellingen maken",
};
export const stepLabel = (k) => tx(STEP_LABEL[k] || (k.startsWith("plugin:") ? `${k.slice(7)}: demo-gegevens maken` : k));

// run: {title, steps: [{key, label, status: wait|busy|ok|error}], error, done, fix}; set: a state setter for it.
// When a plugin that a step needs is off, the run stops at that step with `run.fix` and the pop-up offers "Aanzetten en verder gaan" (resumeDemo).
export async function runDemo(preset, body, set, resume = null) {
  const update = (fn) => set((r) => (r ? fn(JSON.parse(JSON.stringify(r))) : r));
  const mark = (key, status) => update((r) => { const s = r.steps.find((x) => x.key === key); if (s) s.status = status; return r; });
  const base = { preset: preset || undefined, ...body };
  try {
    let keys;
    if (resume) { keys = resume.keys; update((r) => { r.error = ""; delete r.fix; return r; }); }
    else {
      keys = (await api("/system/demo/", { method: "POST", body: { ...base, plan: true } })).steps;
      update((r) => { r.steps.push(...keys.map((k) => ({ key: k, label: stepLabel(k), status: "wait" })), { key: "_finish", label: tx("Afronden"), status: "wait" }); return r; });
    }
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      mark(k, "busy");
      try { await api("/system/demo/", { method: "POST", body: { ...base, step: k } }); }
      catch (e) {
        if (e?.status === 409 && e.data?.needs_plugin) {
          // a plugin that is needed is off: stop here, the pop-up has a button to switch it on and go on (this changes the price per month)
          const extra = Number(e.data.extra || 0);
          const money = extra > 0 ? tx("De maandprijs van je licentie wordt dan € {0} per maand (excl. btw) hoger.", extra.toFixed(2).replace(".", ",")) : tx("De maandprijs van je licentie verandert hierdoor niet: wat nodig is, zit al in de prijs.");
          const more = (e.data.plugins || []).length > 1 ? ` ${tx("Ook nodig")}: ${e.data.plugins.slice(1).join(", ")}.` : "";
          update((r) => {
            const b = r.steps.find((x) => x.key === k); if (b) b.status = "error";
            r.error = `${tx("De plugin {0} staat uit en is nodig voor deze stap.", e.data.title)} ${money}${more}`;
            r.fix = { plugin: e.data.needs_plugin, title: e.data.title, preset, body, keys: keys.slice(i) };
            return r;
          });
          return false;
        }
        throw e;
      }
      mark(k, "ok");
    }
    mark("_finish", "busy");
    await api("/system/demo/", { method: "POST", body: { ...base, finish: true } });
    mark("_finish", "ok");
    return true;
  } catch (e) {
    update((r) => { const b = r.steps.find((x) => x.status === "busy"); if (b) b.status = "error"; r.error = errorText(e); return r; });
    return false;
  }
}

// "Aanzetten en verder gaan": switch the missing plugin on (looking for it first when it is not registered yet, then installing it from the library) and carry on with the step where it stopped.
export async function resumeDemo(run, set, onDone) {
  const fix = run?.fix;
  if (!fix) return;
  const update = (fn) => set((r) => (r ? fn(JSON.parse(JSON.stringify(r))) : r));
  update((r) => { r.fixing = true; return r; });
  try {
    if (!((await api("/plugins/")).plugins || []).some((p) => p.name === fix.plugin)) await api("/plugins/scan/", { method: "POST" }); // the plugin is in the plugins folder but not known yet
    // (a plugin that is not installed yet comes from the library of the product, with the plugins it needs: the server does that when it is switched on)
    await api(`/plugins/${fix.plugin}/`, { method: "PATCH", body: { enabled: true, with_requires: true } });
    if (typeof window !== "undefined") window.dispatchEvent(new Event("plugins-changed"));
  } catch (e) {
    update((r) => { r.fixing = false; r.error = errorText(e); return r; });
    return;
  }
  update((r) => { r.fixing = false; return r; });
  const ok = await runDemo(fix.preset, fix.body, set, { keys: fix.keys });
  update((r) => { r.done = ok; if (ok) r.note = tx("De demo-gegevens zijn gemaakt."); return r; });
  if (ok) onDone?.();
}
