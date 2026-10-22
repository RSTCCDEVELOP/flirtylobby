"use client";

import { useCallback, useEffect, useState } from "react";
import RunPopup from "./RunPopup";
import PresetContent from "./PresetContent";
import { runDemo } from "../lib/demoRun";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";

const LABELS = {
  images: "Voorbeeldplaatjes", heroes: "Hero-achtergronden", views: "Media-systeemobjecten", users: "Gebruikers", plans: "Abonnementen", campaigns: "Donatie-acties", faq: "FAQ-vragen", pages: "Pagina's",
  products: "Producten", designs: "Webshop-systeemobjecten", orders: "Bestellingen",
};

// One button: make the demo data (after asking how many pictures and users), or remove it when it exists. Super admin only.
export default function DemoData({ preset = "", name = "", shop = false, parts = null, active = true, price = null, contents = null, showPurchase = true, editable = false, demoCfg = null }) {  // active: the installation is set and in use (demo data can only be made then)  // shop: the installation has the webshop: ask which example shop  // preset: only the demo of this standard installation (its modules and plugins)
  const [state, setState] = useState(null); // {exists, counts, presets: [installations that have demo data]}
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ shops: "clothing", media: 16, heroes: 6, users: 8, content: true, objects: true, orders: true });
  const [busy, setBusy] = useState("");
  const [run, setRun] = useState(null); // the status pop-up with the progress
  const [info, setInfo] = useState(false); // the pop-up with what the demo data is and what is there
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (demoCfg) setF((x) => ({ ...x, media: demoCfg.media, heroes: demoCfg.heroes, users: demoCfg.users })); }, [demoCfg?.media, demoCfg?.heroes, demoCfg?.users]); // eslint-disable-line react-hooks/exhaustive-deps
  const load = useCallback(() => api("/system/demo/").then(setState).catch(() => setState({ exists: false, counts: {}, presets: [], incomplete: [] })), []);
  useEffect(() => { load(); window.addEventListener("demo-changed", load); return () => window.removeEventListener("demo-changed", load); }, [load]);
  if (!state) return null;
  const made = state.presets.includes(preset || "_all") && !(state.incomplete || []).includes(preset || "_all"); // the demo data of this installation was made (and is all there)
  const some = state.presets.includes(preset || "_all"); // made, maybe not all of it
  const PART_TEXT = { media: "voorbeeldplaatjes", heroes: "hero-achtergronden", users: "gebruikers met profiel", plans: "abonnementen", money: "donatie-acties met giften", faq: "FAQ-vragen", pages: "pagina's", views: "media-systeemobjecten", "plugin:webshop": "webshop met producten, verzendmethoden en bestellingen" };
  const made_ = parts ? [...new Set(parts.filter((x) => x !== "plans"))].map((x) => (x === "money" ? `${PART_TEXT.plans} en ${PART_TEXT.money}` : PART_TEXT[x])).filter(Boolean) : null;
  const notIn = parts ? [["users", "gebruikers (alleen de beheerder)"], ["money", "abonnementen en donaties"], ["plugin:webshop", "webshop, verzendmethoden en bestellingen"]].filter(([k]) => !parts.includes(k)).map(([, t]) => t) : [];
  const list = (c) => Object.entries(c || {}).filter(([, v]) => v).map(([k, v]) => `${v} ${tx(LABELS[k] || k).toLowerCase()}`).join(", ");
  const make = async () => {
    setOpen(false); setMsg(null);
    setRun({ title: preset ? tx("Demo-gegevens maken voor deze installatie") : tx("Demo-gegevens maken"), steps: [], error: "", done: false });
    const ok = await runDemo(preset, { media: Number(f.media) || 0, heroes: Number(f.heroes) || 0, users: Number(f.users) || 0, content: f.content, objects: f.objects, orders: f.orders, shops: shop ? (f.shops === "all" ? [] : [f.shops]) : undefined }, setRun);
    setRun((r) => (r ? { ...r, done: ok, note: ok ? tx("De demo-gegevens zijn gemaakt.") : "" } : r));
    load(); window.dispatchEvent(new Event("demo-changed"));
  };
  const remove = async () => {
    if (!(await confirmDialog(tx("De demo-gegevens van deze installatie verwijderen? Onderdelen die een andere installatie met demo-gegevens ook gebruikt, blijven staan. Je eigen gegevens blijven altijd staan."), { okLabel: tx("Verwijderen"), cancelLabel: tx("Annuleren"), danger: true }))) return;
    setMsg(null);
    setRun({ title: tx("Demo-gegevens verwijderen"), steps: [{ key: "rm", label: tx("Demo-gegevens van deze installatie verwijderen"), status: "busy" }], error: "", done: false });
    try {
      await api("/system/demo/", { method: "POST", body: { remove: true, preset: preset || undefined } });
      setRun((r) => ({ ...r, steps: r.steps.map((x) => ({ ...x, status: "ok" })), done: true, note: tx("De demo-gegevens zijn verwijderd.") }));
    } catch (e) { setRun((r) => ({ ...r, steps: r.steps.map((x) => ({ ...x, status: "error" })), error: errorText(e) })); }
    load(); window.dispatchEvent(new Event("demo-changed"));
  };
  const sw = (k, label) => (
    <label className="check sec-toggle">
      <span className="switch"><input type="checkbox" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /><span /></span>
      <span>{tx(label)}</span>
    </label>
  );
  return (
    <div style={{ display: "grid", gap: ".8rem" }}>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
            {open && (!made || shop) && (
        <div style={{ display: "grid", gap: ".7rem" }}>
          <strong>{tx("Wat wil je maken?")}</strong>
          {shop && (
            <label>{tx("Voor welke winkel wil je demo-gegevens maken?")}
              <select value={f.shops} onChange={(e) => setF({ ...f, shops: e.target.value })}>
                <option value="clothing">{tx("Kleding (dames, heren, kinderen)")}</option>
                <option value="furniture">{tx("Meubels (woonkamer, slaapkamer, kantoor)")}</option>
                <option value="grocery">{tx("Supermarkt (boodschappen)")}</option>
                <option value="standard">{tx("Standaard producten")}</option>
                <option value="all">{tx("Alle vier de winkels")}</option>
              </select>
            </label>
          )}
          <div className="grid2">
            <label>{tx("Aantal voorbeeldplaatjes")}<input type="number" min="0" max="80" value={f.media} onChange={(e) => setF({ ...f, media: e.target.value })} /></label>
            <label>{tx("Aantal hero-achtergronden")}<input type="number" min="0" max="24" value={f.heroes} onChange={(e) => setF({ ...f, heroes: e.target.value })} /></label>
            <label>{tx("Aantal gebruikers")}<input type="number" min="0" max="200" value={f.users} onChange={(e) => setF({ ...f, users: e.target.value })} /></label>
          </div>
          {sw("content", "Inhoud: abonnementen, donatie-acties, FAQ en pagina's")}
          {sw("objects", "Systeemobjecten van alle plugins (webshop-overzichten, mediaviews)")}
          {sw("orders", "Bestellingen (met transporteurs en verzendmethoden)")}
          <small className="muted">{tx("De webshop maakt vier voorbeeldwinkels: kleding, meubels, supermarkt en standaard producten, met groepen, foto's, varianten en staffelprijzen.")}</small>
        </div>
      )}
      {!active && !some && <small className="muted">{tx("Stel eerst deze installatie in; daarna kun je demo-gegevens maken.")}</small>}
      <RunPopup run={run} onClose={() => setRun(null)} />
      {info && <PresetContent preset={preset} name={name} contents={contents} price={price} showPurchase={showPurchase} editable={editable} demo={state} parts={parts} onClose={() => setInfo(false)} />}
      <div className="row" style={{ gap: ".5rem", flexWrap: "wrap" }}>
        {open && (!made || shop) ? (
          <>
            <button type="button" className="btn primary" disabled={!!busy} onClick={make}>{busy === "make" ? tx("Bezig…") : tx("Maak demo-gegevens")}</button>
            <button type="button" className="btn" disabled={!!busy} onClick={() => setOpen(false)}>{tx("Annuleren")}</button>
          </>
        ) : (
          <>
            <button type="button" className="btn primary" disabled={!!busy || !active || (made && !shop)} title={active ? undefined : tx("Stel eerst deze installatie in")} onClick={() => setOpen(true)}>{made && shop ? tx("Nog een demowinkel toevoegen") : some ? tx("Maak ontbrekende demo-gegevens") : tx("Maak demo-gegevens")}</button>
            <button type="button" className="btn danger" disabled={!!busy || !some} onClick={remove}>{tx("Verwijder demo-gegevens")}</button>
            <button type="button" className="btn" onClick={() => setInfo(true)}>{tx("Inhoud bekijken")}</button>
          </>
        )}
      </div>
    </div>
  );
}
