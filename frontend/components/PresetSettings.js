// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import DemoData from "./DemoData";
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
  const tabs = [["general", "Algemeen"], ...(manage ? [["ai", "AI"]] : []), ["modules", "Modules"], ...(demo ? [["demo", "Demo-gegevens"]] : [])];
  const num = (k) => (e) => setAi({ ...ai, [k]: e.target.value });
  const body = (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card modal form pgs" role="dialog" aria-label={tx(p.name)} style={{ maxWidth: 640 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: ".6rem" }}><span className="preset-ico"><PresetIcon name={p.icon} /></span>{tx(p.name)}</h2>
          <button type="button" className="btn primary" onClick={onClose}>{tx("Klaar")}</button>
        </div>
        <Tabs value={tab} onChange={setTab} tabs={tabs} />
        <div className="pgs-body">
          {tab === "general" && (<>
            <p className="muted" style={{ margin: 0 }}>{tx(p.desc)}</p>
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
            {p.active && manage && <div><button type="button" className="btn danger" disabled={!!busy} onClick={() => { onClose(); onUnapply(p); }}>{tx("Installatie verwijderen")}</button></div>}
          </>)}
          {tab === "ai" && manage && (<>
            <p className="muted" style={{ margin: 0 }}>{tx("De AI van deze installatie. Deze instellingen worden gezet zodra de installatie wordt ingesteld. De AI-koppeling zelf (API key) staat bij API keys; het gebruik en de prijzen staan bij Super admin → AI.")}</p>
            <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={ai.on} onChange={(e) => setAi({ ...ai, on: e.target.checked, credit_required: e.target.checked && ai.credit_required })} /><span /></span><span>{tx("AI hoort bij deze installatie")}</span></label>
            <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={ai.credit_required} disabled={!ai.on} onChange={(e) => setAi({ ...ai, credit_required: e.target.checked })} /><span /></span>
              <span>{tx("Gebruikers en admins moeten AI-tegoed kopen")}<small className="muted" style={{ display: "block" }}>{tx("Zonder tegoed kunnen zij geen AI gebruiken. Superadmins hebben geen tegoed nodig.")}</small></span></label>
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
            {manage && !adminOnly && <div className="alert ok" style={{ margin: 0 }}>{tx("Easy2edit-koppeling: Stripe")} <small className="muted">{p.system_api?.stripe ? tx("Gekoppeld en aan (Superadmin-koppeling). Hoort bij elke installatie en blijft staan als je een installatie instelt of verwijdert.") : tx("Hoort bij elke installatie, maar is nog niet gekoppeld (API keys → Stripe → Superadmin-koppeling).")}</small></div>}
            <strong>{tx("{0} modules", p.modules.length)}</strong>
            <small className="muted">{p.modules.map((m) => tx(m)).join(", ")}</small>
          </>)}
          {tab === "demo" && demo && <div className="preset-demo"><DemoData preset={p.key} name={p.name} editable={manage && !adminOnly} demoCfg={p.demo_cfg} price={p.price} contents={p.contents} showPurchase={!adminOnly} active={!!p.active} parts={p.demo_parts} shop={(p.plugins || []).some((x) => x.name === "webshop")} /></div>}
        </div>
      </div>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(body, document.body);
}
