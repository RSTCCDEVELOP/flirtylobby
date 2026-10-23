// Superadmin: switch something on from the place where it is missing, after a question in a popup.
// The popup also offers the modules that belong with it and are still off (ticked = switched on too).
import { tx } from "./t";
import { api } from "./api";
import { confirmDialog } from "./dialog";

// Modules that are worth switching on together with a feature.
export const RELATED = {
  twofa: ["integrations", "communication"],
  faq: ["pages", "languages"],
  community: ["notifications", "media"],
};

async function offModules(keys) {
  const all = await api("/modules/all/").catch(() => []);
  return all.filter((m) => keys.includes(m.key) && !m.enabled);
}

// Ask "do you want this?" and switch on what was ticked. `run` switches the feature itself on.
// spec: { title, message, related: key of RELATED, needs: [labels of what is switched on automatically] }
// Returns true when done, false when cancelled.
export async function enableWithDialog({ title, message, related, needs = [] }, run) {
  const off = await offModules(RELATED[related] || []);
  const note = needs.length ? `\n\n${tx("Dit zet ook aan, omdat het nodig is:")} ${needs.join(", ")}.` : "";
  const picked = await confirmDialog(`${message}${note}`, {
    title, okLabel: tx("Aanzetten"),
    options: off.map((m) => ({ key: m.key, label: m.label, checked: true })),
    optionsTitle: off.length ? tx("Deze onderdelen horen erbij en staan nog uit. Ook aanzetten?") : "",
  });
  if (picked === false) return false;
  await run();
  for (const key of picked) await api(`/modules/${key}/`, { method: "PATCH", body: { enabled: true } });
  return true;
}
