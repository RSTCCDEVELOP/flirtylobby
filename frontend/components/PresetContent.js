// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PriceBlock from "./PriceBlock";
import Tabs from "./Tabs";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";

// the counts of the demo data (system/demo/) that belong to a part
const COUNT = { media: "images", heroes: "heroes", users: "users", plans: "plans", money: "campaigns", faq: "faq", pages: "pages", views: "views" };
const TILES = [["images", "Voorbeeldplaatjes"], ["heroes", "Hero-achtergronden"], ["users", "Gebruikers"], ["plans", "Abonnementen"], ["campaigns", "Donatie-acties"], ["faq", "FAQ-vragen"], ["pages", "Pagina's"], ["views", "Media-systeemobjecten"],
  ["products", "Producten"], ["designs", "Webshop-systeemobjecten"], ["orders", "Bestellingen"], ["documents", "Documenten"], ["folders", "Mappen"], ["tags", "Tags"]];

// "Inhoud en prijs" of a standard installation: pages, modules, plugins, prices and demo data. Superadmins (Super admin → Standaard installaties) can change what the installation holds.
export default function PresetContent({ preset, name, contents, price, showPurchase = true, editable = false, demo = null, parts = null, onClose }) {
  const [tab, setTab] = useState("pages");
  const [opts, setOpts] = useState(null); // what can be chosen (editors only)
  const [w, setW] = useState(null); // the working copy of the choices
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const fill = useCallback((o) => {
    setOpts(o);
    setW({ modules: new Set(o.modules.filter((m) => m.on).map((m) => m.key)), plugins: new Set(o.plugins.filter((p) => p.on).map((p) => p.name)), pages: new Set(o.pages.filter((p) => p.on).map((p) => p.key)),
      drop: new Set(o.demo.parts.filter((p) => !p.on).map((p) => p.key)), media: o.demo.media, heroes: o.demo.heroes, users: o.demo.users });
  }, []);
  useEffect(() => { if (editable && preset) api(`/system/presets/${preset}/edit/`).then(fill).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, [editable, preset, fill]);

  const dirty = useMemo(() => {
    if (!opts || !w) return false;
    const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
    return !same(w.modules, new Set(opts.modules.filter((m) => m.on).map((m) => m.key))) || !same(w.plugins, new Set(opts.plugins.filter((p) => p.on).map((p) => p.name))) || !same(w.pages, new Set(opts.pages.filter((p) => p.on).map((p) => p.key)))
      || !same(w.drop, new Set(opts.demo.parts.filter((p) => !p.on).map((p) => p.key))) || w.media !== opts.demo.media || w.heroes !== opts.demo.heroes || w.users !== opts.demo.users;
  }, [opts, w]);

  const flip = (field, v) => setW((x) => { const s = new Set(x[field]); s.has(v) ? s.delete(v) : s.add(v); return { ...x, [field]: s }; });
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const o = await api(`/system/presets/${preset}/edit/`, { method: "PUT", body: { modules: [...w.modules], plugins: [...w.plugins], pages_on: [...w.pages], demo: { drop: [...w.drop], media: Number(w.media) || 0, heroes: Number(w.heroes) || 0, users: Number(w.users) || 0 } } });
      fill(o); setMsg({ ok: true, text: tx("Opgeslagen. Stel de installatie opnieuw in om de wijzigingen door te voeren.") }); window.dispatchEvent(new Event("presets-changed"));
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const reset = async () => {
    if (!(await confirmDialog(tx("Terug naar de standaard van deze installatie? Je wijzigingen in modules, plugins, pagina's en demo-gegevens gaan weg."), { okLabel: tx("Terugzetten"), cancelLabel: tx("Annuleren"), danger: true }))) return;
    setBusy(true); setMsg(null);
    try { fill(await api(`/system/presets/${preset}/edit/`, { method: "DELETE" })); setMsg({ ok: true, text: tx("Teruggezet naar de standaard.") }); window.dispatchEvent(new Event("presets-changed")); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };

  const Card = ({ on, onChange, disabled, title, sub, badge }) => (
    <label className={`wz-q${on ? " on" : ""}`} style={disabled ? { opacity: .75 } : undefined}>
      <span className="switch"><input type="checkbox" checked={on} disabled={disabled || !editable} onChange={onChange} /><span /></span>
      <span className="wz-text"><strong>{title}{badge && <span className="badge" style={{ marginLeft: ".5rem" }}>{badge}</span>}</strong>{sub && <small className="muted">{sub}</small>}</span>
    </label>
  );
  const ed = editable && opts && w;
  const groups = ed ? [...new Set(opts.modules.map((m) => m.group || ""))] : [];
  const counts = demo?.counts || {};
  const tiles = TILES.filter(([k]) => counts[k]);
  const present = (part) => (COUNT[part] ? Number(counts[COUNT[part]] || 0) > 0 : null);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal pc-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ alignItems: "baseline" }}>
          <h2 style={{ margin: 0 }}>{tx("Inhoud en prijs")}{name ? <span className="muted" style={{ fontWeight: 500 }}> · {tx(name)}</span> : null}</h2>
          {ed && opts.edited && <span className="badge">{tx("Aangepast")}</span>}
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[["pages", `${tx("Pagina's")} (${ed ? w.pages.size : contents?.pages.length ?? 0})`], ["modules", `${tx("Modules")} (${ed ? w.modules.size : contents?.modules.length ?? 0})`], ["plugins", `${tx("Plugins")} (${ed ? w.plugins.size : contents?.plugins.length ?? 0})`], ["price", tx("Prijzen")], ["demo", tx("Demo-gegevens")]]} />
        {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
        <div className="pc-body">
          {tab === "pages" && (ed ? (
            <>
              <p className="muted" style={{ margin: 0 }}>{tx("De pagina's volgen de modules. Zet hier pagina's bij of haal ze weg; ze moeten wel bestaan. Sla eerst wijzigingen in de modules op: de pagina's passen zich daarna aan.")}</p>
              <div className="wz-grid">{opts.pages.map((p) => <Card key={p.key} on={w.pages.has(p.key)} onChange={() => flip("pages", p.key)} title={p.title} sub={p.module ? `${tx("Hoort bij")}: ${p.module.split("|").map((m) => m.replace("plugin:", "")).join(", ")}` : tx("Altijd beschikbaar")} />)}</div>
            </>
          ) : contents?.pages.length ? <ul className="ct-list">{contents.pages.map((g) => <li key={g.key}><strong>{g.title}</strong></li>)}</ul> : <p className="muted">{tx("Geen pagina's.")}</p>)}

          {tab === "modules" && (ed ? (
            <>
              <p className="muted" style={{ margin: 0 }}>{tx("Zet modules aan of uit voor deze installatie. Een module die door een andere nodig is, blijft aan.")}</p>
              {groups.map((g) => (
                <div key={g || "x"} className="stack" style={{ gap: ".5rem" }}>
                  {g && <h3 style={{ margin: ".4rem 0 0" }}>{tx(g)}</h3>}
                  <div className="wz-grid">{opts.modules.filter((m) => (m.group || "") === g).map((m) => {
                    const auto = !w.modules.has(m.key) && m.auto;
                    return <Card key={m.key} on={w.modules.has(m.key) || auto} disabled={auto} onChange={() => flip("modules", m.key)} title={tx(m.label)} sub={auto ? `${tx("Nodig voor")}: ${m.needed_by.map((x) => tx(x)).join(", ")}` : tx(m.desc)} />;
                  })}</div>
                </div>
              ))}
            </>
          ) : contents?.modules.length ? <ul className="ct-list">{contents.modules.map((m) => <li key={m.key}><strong>{tx(m.label)}</strong></li>)}</ul> : <p className="muted">{tx("Geen modules.")}</p>)}

          {tab === "plugins" && (ed ? (
            <>
              <p className="muted" style={{ margin: 0 }}>{tx("Alleen geïnstalleerde plugins zijn te kiezen (Admin → Plugins). Een plugin hoeft nu niet aan te staan: hij gaat aan als je de installatie instelt. Plugins die een andere nodig heeft, gaan vanzelf mee.")}</p>
              {opts.plugins.length ? <div className="wz-grid">{opts.plugins.map((p) => <Card key={p.name} on={w.plugins.has(p.name)} onChange={() => flip("plugins", p.name)} title={p.title} badge={p.enabled ? tx("Aan") : tx("Uit")} sub={`${p.name}${p.requires.length ? ` · ${tx("nodig")}: ${p.requires.join(", ")}` : ""}`} />)}</div> : <p className="muted">{tx("Er zijn geen plugins geïnstalleerd.")}</p>}
            </>
          ) : contents?.plugins.length ? <ul className="ct-list">{contents.plugins.map((g) => <li key={g.name}><strong>{g.title}</strong><small className="muted">{g.name}</small></li>)}</ul> : <p className="muted">{tx("Deze installatie heeft geen plugins.")}</p>)}

          {tab === "price" && (price ? <PriceBlock price={price} purchase={showPurchase} /> : <p className="muted">{tx("Geen prijs beschikbaar.")}</p>)}

          {tab === "demo" && (
            <>
              <p className="muted" style={{ margin: 0 }}>{tx("Voorbeeldgegevens om alles te testen. Je maakt ze bij de installatie met de knop Maak demo-gegevens; wat al aanwezig is, wordt niet dubbel gemaakt.")}</p>
              <div>
                <h3 style={{ margin: "0 0 .5rem" }}>{tx("Nu aanwezig in dit systeem")}</h3>
                {tiles.length ? <div className="dm-tiles">{tiles.map(([k, l]) => <div key={k} className="dm-tile"><strong>{counts[k]}</strong><span>{tx(l)}</span></div>)}</div> : <p className="muted" style={{ margin: 0 }}>{tx("Nog geen demo-gegevens.")}</p>}
              </div>
              <div>
                <h3 style={{ margin: "0 0 .5rem" }}>{tx("Wat deze installatie maakt")}</h3>
                {ed ? (
                  <div className="wz-grid">{opts.demo.parts.map((p) => <Card key={p.key} on={!w.drop.has(p.key)} onChange={() => flip("drop", p.key)} title={tx(p.label)} sub={present(p.key) === null ? null : present(p.key) ? tx("Al aanwezig") : tx("Nog niet gemaakt")} />)}</div>
                ) : (parts || []).length ? (
                  <div className="dm-parts">{(parts || []).map((p) => <div key={p} className="dm-part"><span className={`dm-dot${present(p) ? " on" : ""}`} /><span>{tx(({ media: "Voorbeeldplaatjes", heroes: "Hero-achtergronden", users: "Gebruikers met profiel", plans: "Abonnementen", money: "Donatie-acties met giften", faq: "FAQ-vragen", pages: "Pagina's", views: "Media-systeemobjecten" })[p] || (p.startsWith("plugin:") ? `${tx("Demo van")} ${p.slice(7)}` : p))}</span></div>)}</div>
                ) : <p className="muted" style={{ margin: 0 }}>{tx("Deze installatie heeft geen demo-gegevens.")}</p>}
              </div>
              {ed && (
                <div>
                  <h3 style={{ margin: "0 0 .5rem" }}>{tx("Aantallen")}</h3>
                  <div className="grid2">
                    <label>{tx("Voorbeeldplaatjes")}<input type="number" min="0" max="80" value={w.media} onChange={(e) => setW({ ...w, media: e.target.value === "" ? "" : Number(e.target.value) })} /></label>
                    <label>{tx("Hero-achtergronden")}<input type="number" min="0" max="24" value={w.heroes} onChange={(e) => setW({ ...w, heroes: e.target.value === "" ? "" : Number(e.target.value) })} /></label>
                    <label>{tx("Gebruikers")}<input type="number" min="0" max="200" value={w.users} onChange={(e) => setW({ ...w, users: e.target.value === "" ? "" : Number(e.target.value) })} /></label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="row between pc-foot">
          <div className="row" style={{ gap: ".5rem" }}>
            {ed && tab !== "price" && <button type="button" className="btn primary" disabled={busy || !dirty} onClick={save}>{busy ? tx("Bezig…") : tx("Opslaan")}</button>}
            {ed && opts.edited && <button type="button" className="btn" disabled={busy} onClick={reset}>{tx("Terug naar standaard")}</button>}
          </div>
          <button type="button" className="btn" onClick={onClose}>{tx("Sluiten")}</button>
        </div>
      </div>
    </div>
  );
}
