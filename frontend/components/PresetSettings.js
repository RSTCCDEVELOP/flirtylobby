// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import DemoData from "./DemoData";
import PresetDesign from "./PresetDesign";
import PresetPlugins from "./PresetPlugins";
import Tabs from "./Tabs";
import { PresetIcon } from "./Icons";

// The settings of one standard installation in a pop-up (tabs): who sees it and when it is offered, the AI of the installation (credit and the amounts of a top-up),
// the modules, and the demo data. p = the installation as the list has it; the callbacks do the work in the list.
export default function PresetSettings({ p, manage, adminOnly, demo, onRelease, onDefault, onUnapply, busy, onClose }) {
  const [tab, setTab] = useState("general");
  const [ai, setAi] = useState({ on: p.ai?.on !== false, credit_required: p.ai?.credit_required !== false, topup_min: p.ai?.topup_min ?? 5, topup_max: p.ai?.topup_max ?? 100, topup_step: p.ai?.topup_step ?? 5 });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const saveAi = async () => {
    setSaving(true); setMsg(null);
    try { await api(`/system/presets/${p.key}/ai/`, { method: "POST", body: ai }); setMsg({ ok: true, text: tx("Opgeslagen. De AI-instellingen gelden zodra deze installatie wordt ingesteld.") }); window.dispatchEvent(new Event("presets-changed")); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setSaving(false);
  };
  // Setup: what the dashboard of this installation shows (Users, Entiteit); saved with the content of the installation (PUT .../edit/)
  const canSetup = manage && !adminOnly;
  const [su, setSu] = useState(null); // { users, entity, kind, name, kinds }
  const [suBase, setSuBase] = useState(null);
  const [suBusy, setSuBusy] = useState(false);
  useEffect(() => {
    if (!canSetup || tab !== "setup" || su) return;
    api(`/system/presets/${p.key}/edit/`).then((o) => { const v = { users: o.setup.users, entity: o.setup.entity, kind: o.entity.kind, name: o.entity.name || "", kinds: o.entity.kinds }; setSu(v); setSuBase(JSON.stringify([v.users, v.entity, v.kind, v.name])); }).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  }, [canSetup, tab, su, p.key]);
  const saveSetup = async () => {
    setSuBusy(true); setMsg(null);
    try {
      const o = await api(`/system/presets/${p.key}/edit/`, { method: "PUT", body: { setup: { users: su.users, entity: su.entity }, entity: { kind: su.kind, name: su.name }, ...(ac ? { access: { auto: ac.auto, steps: ac.steps } } : {}) } });
      if (o.access) { setAc(o.access); setAcBase(JSON.stringify([o.access.auto, o.access.steps])); }
      const v = { users: o.setup.users, entity: o.setup.entity, kind: o.entity.kind, name: o.entity.name || "", kinds: o.entity.kinds };
      setSu(v); setSuBase(JSON.stringify([v.users, v.entity, v.kind, v.name]));
      setMsg({ ok: true, text: tx("Opgeslagen. De dashboard-opties gelden voor deze installatie.") });
      window.dispatchEvent(new Event("presets-changed")); window.dispatchEvent(new Event("entity-changed"));
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setSuBusy(false);
  };
  // Gebruikers en rechten: roles, user groups with their rights and demo users that are made when this installation is set up (the same set-ups as Admin → Users → Standaard setup)
  const STEPS = [["roles", "Rollen aanmaken", "De rollen met hun rechten die de groepen gebruiken."], ["groups", "Groepen aanmaken", "De user groups van deze installatie."], ["grants", "Module-toegang koppelen", "Per groep de modules met het niveau Gebruik, Bewerken of Beheer.", "groups"],
    ["enable_modules", "Benodigde modules aanzetten", "Modules die uitstaan maar nodig zijn worden aangezet. Plugins blijf je zelf beheren.", "groups"], ["people", "Demo-gebruikers aanmaken", "Zonder wachtwoord, ze kunnen niet inloggen en hebben een @example.com-adres.", "groups"]];
  const [ac, setAc] = useState(null); // { auto, steps, summary }
  const [acBase, setAcBase] = useState(null);
  const [acBusy, setAcBusy] = useState(false);
  useEffect(() => {
    if (!canSetup || (tab !== "access" && tab !== "setup") || ac) return;
    api(`/system/presets/${p.key}/edit/`).then((o) => { setAc(o.access); setAcBase(JSON.stringify([o.access.auto, o.access.steps])); }).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  }, [canSetup, tab, ac, p.key]);
  const saveAccess = async () => {
    setAcBusy(true); setMsg(null);
    try {
      const o = await api(`/system/presets/${p.key}/edit/`, { method: "PUT", body: { access: { auto: ac.auto, steps: ac.steps } } });
      setAc(o.access); setAcBase(JSON.stringify([o.access.auto, o.access.steps]));
      setMsg({ ok: true, text: tx("Opgeslagen. De rollen, groepen en rechten worden gemaakt zodra deze installatie wordt ingesteld.") });
      window.dispatchEvent(new Event("presets-changed"));
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setAcBusy(false);
  };
  const tabs = [["general", "Algemeen"], ...(canSetup ? [["setup", "Setup"], ["access", "Gebruikers en rechten"]] : []), ...(manage ? [["ai", "AI"]] : []), ["modules", "Modules"], ["plugins", "Plugins"], ...(canSetup ? [["design", "Design"]] : []), ...(demo ? [["demo", "Demo-gegevens"]] : [])];
  const num = (k) => (e) => setAi({ ...ai, [k]: e.target.value });
  const body = (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card modal form pgs" role="dialog" aria-label={tx(p.name)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: ".6rem" }}><span className="preset-ico"><PresetIcon name={p.icon} /></span>{tx(p.name)}</h2>
          <button type="button" className="btn primary" onClick={onClose}>{tx("Klaar")}</button>
        </div>
        <Tabs value={tab} onChange={setTab} tabs={tabs} />
        <div className="pgs-body">
          {tab === "general" && (<>
            <p className="muted" style={{ margin: 0 }}>{tx(p.desc)}</p>
            <div className="pgs-cols">
            {manage && (
              <label className="check sec-toggle">
                <span className="switch"><input type="checkbox" checked={!!p.admin} onChange={(e) => onRelease(p, e.target.checked)} /><span /></span>
                <span>{tx("Zichtbaar in de admin")}<small className="muted" style={{ display: "block" }}>{tx("Ook beheerders (admin) kunnen deze installatie instellen.")}</small></span>
              </label>
            )}
            {manage && !adminOnly && (
              <label className="check sec-toggle" title={tx("Vink aan welke installaties worden aangeboden als er nog niets is geïnstalleerd. Er is er altijd minstens één.")}>
                <span className="switch"><input type="checkbox" checked={!!p.default} onChange={(e) => onDefault(p, e.target.checked)} /><span /></span>
                <span>{tx("Aanbieden bij eerste installatie")}<small className="muted" style={{ display: "block" }}>{tx("Wordt aangeboden als er nog niets is geïnstalleerd. Er is er altijd minstens één.")}</small></span>
              </label>
            )}
            </div>
            {p.active && manage && <div><button type="button" className="btn danger" disabled={!!busy} onClick={() => { onClose(); onUnapply(p); }}>{tx("Installatie verwijderen")}</button></div>}
          </>)}
          {tab === "setup" && canSetup && (<>
            <h3 style={{ margin: 0 }}>{tx("Opties")}</h3>
            <p className="muted" style={{ margin: 0 }}>{tx("Wat het dashboard van deze installatie laat zien. Staat een optie aan, dan staat hij in het linker menu en als tegel.")}</p>
            {!su ? <p className="muted">{tx("Bezig…")}</p> : (<>
              <div className="pgs-cols">
              <label className="check sec-toggle">
                <span className="switch"><input type="checkbox" checked={su.users} onChange={(e) => setSu({ ...su, users: e.target.checked })} /><span /></span>
                <span>{tx("Users op het dashboard")}<small className="muted" style={{ display: "block" }}>{tx("Users en User groups staan in het linker menu en als tegel.")}</small></span>
              </label>
              <label className="check sec-toggle">
                <span className="switch"><input type="checkbox" checked={su.entity} onChange={(e) => setSu({ ...su, entity: e.target.checked })} /><span /></span>
                <span>{tx("Entiteit op het dashboard")}<small className="muted" style={{ display: "block" }}>{tx("Geef de entiteit een naam: die naam staat in het linker menu en op de tegel. Standaard: Bedrijf.")}</small></span>
              </label>
              {ac && ac.summary && (
                <label className="check sec-toggle">
                  <span className="switch"><input type="checkbox" checked={ac.auto} onChange={(e) => { setAc({ ...ac, auto: e.target.checked }); }} /><span /></span>
                  <span>{tx("Rechten en groepen meenemen bij de installatie")}<small className="muted" style={{ display: "block" }}>{tx("Het profiel van rollen, groepen en demo-gebruikers van deze installatie wordt gemaakt zodra hij wordt ingesteld. Kies de stappen op het tabblad Gebruikers en rechten.")}</small></span>
                </label>
              )}
              </div>
              {su.entity && (
                <div className="grid2">
                  <label>{tx("Naam van de entiteit")}
                    <select value={su.kind} onChange={(e) => setSu({ ...su, kind: e.target.value })}>{su.kinds.map((k) => <option key={k.key} value={k.key}>{tx(k.label)}</option>)}</select>
                  </label>
                  {su.kind === "vrij" && <label>{tx("Vrije naam")}<input value={su.name} maxLength={40} placeholder={tx("Bijvoorbeeld: Stichting")} onChange={(e) => setSu({ ...su, name: e.target.value })} /></label>}
                </div>
              )}
              {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
              <div className="row" style={{ justifyContent: "flex-start" }}><button type="button" className="btn primary" disabled={suBusy || (JSON.stringify([su.users, su.entity, su.kind, su.name]) === suBase && (!ac || JSON.stringify([ac.auto, ac.steps]) === acBase)) || (su.entity && su.kind === "vrij" && !su.name.trim())} onClick={saveSetup}>{suBusy ? tx("Bezig…") : tx("Opslaan")}</button></div>
            </>)}
          </>)}
          {tab === "access" && canSetup && (<>
            <p className="muted" style={{ margin: 0 }}>{tx("Rollen, groepen met toegang tot modules en demo-gebruikers die bij deze installatie horen. Staat dit aan, dan worden ze gemaakt zodra de installatie wordt ingesteld. Er wordt alleen iets toegevoegd: wat al bestaat blijft zoals het is.")}</p>
            {!ac ? <p className="muted">{tx("Bezig…")}</p> : (<>
              <div className="pgs-cols"><label className="check sec-toggle pgs-main">
                <span className="switch"><input type="checkbox" checked={ac.auto} onChange={(e) => setAc({ ...ac, auto: e.target.checked })} /><span /></span>
                <span>{tx("Maken bij het instellen van deze installatie")}<small className="muted" style={{ display: "block" }}>{tx("Staat dit uit, dan kun je ze later zelf maken bij Admin → Users → Standaard setup.")}</small></span>
              </label></div>
              <div className="pgs-cols" style={{ opacity: ac.auto ? 1 : .55 }}>
                {STEPS.map(([k, title, text, need]) => {
                  const off = !!need && !ac.steps[need];
                  return (
                    <label key={k} className="check sec-toggle" style={off ? { opacity: .5 } : undefined}>
                      <span className="switch"><input type="checkbox" disabled={!ac.auto || off} checked={!off && !!ac.steps[k]} onChange={(e) => setAc({ ...ac, steps: { ...ac.steps, [k]: e.target.checked } })} /><span /></span>
                      <span>{tx(title)}<small className="muted" style={{ display: "block" }}>{tx(text)}</small></span>
                    </label>
                  );
                })}
              </div>
              {ac.summary ? (
                <div style={{ display: "grid", gap: ".4rem" }}>
                  <strong>{tx("Wat deze installatie maakt")} <small className="muted">· {ac.summary.groups.length} {tx("groepen")} · {ac.summary.roles.length} {tx("rollen")} · {ac.summary.people} {tx("gebruikers")}</small></strong>
                  <div className="pgs-cols">{ac.summary.groups.map((g) => <div key={g.name} className="pgs-card"><strong>{g.name}</strong><small className="muted">{g.roles.join(", ") || "—"}</small><small className="muted">{g.modules} {tx("modules")} · {g.people} {tx("gebruikers")}</small></div>)}</div>
                </div>
              ) : <p className="muted" style={{ margin: 0 }}>{tx("Voor deze installatie is er geen set van rollen en groepen.")}</p>}
              {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
              <div className="row" style={{ justifyContent: "flex-start" }}><button type="button" className="btn primary" disabled={acBusy || JSON.stringify([ac.auto, ac.steps]) === acBase} onClick={saveAccess}>{acBusy ? tx("Bezig…") : tx("Opslaan")}</button></div>
            </>)}
          </>)}
          {tab === "ai" && manage && (<>
            <p className="muted" style={{ margin: 0 }}>{tx("De AI van deze installatie. Deze instellingen worden gezet zodra de installatie wordt ingesteld. De AI-koppeling zelf (API key) staat bij API keys; het gebruik en de prijzen staan bij Super admin → AI.")}</p>
            <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={ai.on} onChange={(e) => setAi({ ...ai, on: e.target.checked, credit_required: e.target.checked && ai.credit_required })} /><span /></span><span>{tx("AI hoort bij deze installatie")}</span></label>
            <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={ai.credit_required} disabled={!ai.on} onChange={(e) => setAi({ ...ai, credit_required: e.target.checked })} /><span /></span>
              <span>{tx("Iedereen moet AI-tegoed kopen (ook admins en superadmins)")}<small className="muted" style={{ display: "block" }}>{tx("Zonder tegoed kan niemand AI gebruiken: ook een superadmin en superadmin+ kopen eerst tegoed. Het gebruik wordt van het tegoed afgeschreven.")}</small></span></label>
            <div className="grid2" style={{ opacity: ai.on ? 1 : 0.5 }}>
              <label>{tx("Kleinste bedrag om op te waarderen")}<input type="number" min="0" step="0.5" value={ai.topup_min} disabled={!ai.on} onChange={num("topup_min")} /></label>
              <label>{tx("Grootste bedrag om op te waarderen")}<input type="number" min="0" step="0.5" value={ai.topup_max} disabled={!ai.on} onChange={num("topup_max")} /></label>
              <label>{tx("Stap van de schuifbalk")}<input type="number" min="0" step="0.5" value={ai.topup_step} disabled={!ai.on} onChange={num("topup_step")} /></label>
            </div>
            {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
            <div className="row" style={{ justifyContent: "flex-start" }}><button type="button" className="btn primary" disabled={saving} onClick={saveAi}>{tx("Opslaan")}</button></div>
          </>)}
          {tab === "modules" && (<>
            <div className="chips">
              {p.plugins.map((x) => <span key={x.name} className={`badge ${x.installed ? "ok" : "off"}`} title={x.installed ? "" : tx("Niet geïnstalleerd")}>{x.title}</span>)}
              {p.theme !== "normal" && <span className="badge">{tx("Thema")}: {p.theme}</span>}
            </div>
            {manage && !adminOnly && <div className="alert ok" style={{ margin: 0 }}>{tx("easy2edit-koppeling: Stripe")} <small className="muted">{p.system_api?.stripe ? tx("Gekoppeld en aan (Superadmin-koppeling). Hoort bij elke installatie en blijft staan als je een installatie instelt of verwijdert.") : tx("Hoort bij elke installatie, maar is nog niet gekoppeld (API keys → Stripe → Superadmin-koppeling).")}</small></div>}
            <strong>{tx("{0} modules", p.modules.length)}</strong>
            <div className="chips">{p.modules.map((m) => <span key={m} className="badge">{tx(m)}</span>)}</div>
          </>)}
          {tab === "design" && canSetup && <PresetDesign preset={p.key} />}
          {tab === "plugins" && manage && !adminOnly && <PresetPlugins preset={p.key} />}
          {tab === "plugins" && !(manage && !adminOnly) && (<>
            <p className="muted" style={{ margin: 0 }}>{tx("Dit zijn de plugins en modules van deze installatie volgens de standaardconfiguratie. Een superadmin past ze aan.")}</p>
            <h3 style={{ margin: ".2rem 0 0" }}>{tx("Plugins")} ({p.plugins.length})</h3>
            {p.plugins.length ? <ul className="ct-list">{p.plugins.map((x) => <li key={x.name}><strong>{x.title}</strong><small className="muted">{x.name}</small><span className={`badge ${x.installed ? "ok" : "off"}`}>{x.installed ? tx("Geïnstalleerd") : tx("Niet geïnstalleerd")}</span></li>)}</ul> : <p className="muted">{tx("Deze installatie heeft geen plugins.")}</p>}
            <h3 style={{ margin: ".6rem 0 0" }}>{tx("Modules")} ({p.modules.length})</h3>
            {p.modules.length ? <ul className="ct-list">{p.modules.map((m) => <li key={m}><strong>{tx(m)}</strong></li>)}</ul> : <p className="muted">{tx("Geen modules.")}</p>}
          </>)}
          {tab === "demo" && demo && <div className="preset-demo"><DemoData preset={p.key} name={p.name} editable={manage && !adminOnly} demoCfg={p.demo_cfg} price={p.price} contents={p.contents} showPurchase={!adminOnly} active={!!p.active} parts={p.demo_parts} shop={(p.plugins || []).some((x) => x.name === "webshop")} /></div>}
        </div>
      </div>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(body, document.body);
}
