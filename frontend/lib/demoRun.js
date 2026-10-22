import { api, errorText } from "./api";
import { tx } from "./t";

// The steps of making demo data, one request each, so a screen can show the progress.
export const STEP_LABEL = {
  media: "Voorbeeldplaatjes maken", heroes: "Hero-achtergronden maken", users: "Gebruikers met profiel maken", plans: "Abonnementen maken", money: "Donatie-acties, giften en abonnees maken",
  faq: "FAQ-vragen maken", pages: "Pagina's maken", views: "Media-systeemobjecten maken", "plugin:webshop": "Webshop: producten, systeemobjecten, verzendmethoden en bestellingen maken",
};
export const stepLabel = (k) => tx(STEP_LABEL[k] || (k.startsWith("plugin:") ? `${k.slice(7)}: demo-gegevens maken` : k));

// run: {title, steps: [{key, label, status: wait|busy|ok|error}], error, done}; set: a state setter for it.
export async function runDemo(preset, body, set, first = []) {
  const update = (fn) => set((r) => (r ? fn(JSON.parse(JSON.stringify(r))) : r));
  const mark = (key, status) => update((r) => { const s = r.steps.find((x) => x.key === key); if (s) s.status = status; return r; });
  const base = { preset: preset || undefined, ...body };
  try {
    const keys = (await api("/system/demo/", { method: "POST", body: { ...base, plan: true } })).steps;
    update((r) => { r.steps.push(...keys.map((k) => ({ key: k, label: stepLabel(k), status: "wait" })), { key: "_finish", label: tx("Afronden"), status: "wait" }); return r; });
    for (const k of keys) {
      mark(k, "busy");
      await api("/system/demo/", { method: "POST", body: { ...base, step: k } });
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
