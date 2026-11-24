// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import Tabs from "./Tabs";
import WidgetFrame from "./WidgetFrame";

// The settings of a widget, in the left panel of the page editor: click a widget (or its edit button) and its options are here, in tabs (Inhoud, Uiterlijk, Gedrag) under a card with the widget.
// The options belong to the widget, so a change counts for the widget on every page. A change is saved with the button and the page shows it at once. (The library, Admin > Website > Widgets, has the same options.)
const GROUPS = [["content", "Inhoud"], ["look", "Uiterlijk"], ["behaviour", "Gedrag"]];
const LOOK = /^(style|stijl|shape|vorm|size|grootte|speed|color|kleur|bg|accent)/i;
const groupOf = (o) => (o.group && GROUPS.some(([k]) => k === o.group) ? o.group : o.type === "color" || (o.type === "choice" && LOOK.test(o.key)) || LOOK.test(o.key) ? "look" : o.type === "switch" || o.type === "number" || o.type === "datetime" || o.type === "choice" ? "behaviour" : "content");
const LABEL = { display: "grid", gap: ".3rem", fontSize: ".85rem", fontWeight: 600 };

function Field({ o, v, set }) {
  if (o.type === "textarea") return <label style={LABEL}>{tx(o.label)}<textarea rows={5} value={v} maxLength={1200} onChange={(e) => set(e.target.value)} /></label>;
  if (o.type === "switch") return <label className="hed-sw" style={{ padding: ".55rem .7rem", border: "1px solid var(--line)", borderRadius: 10, background: "color-mix(in srgb, var(--blue) 4%, var(--card, #fff))" }}><span className="switch"><input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} /><span /></span><span className="hed-swt"><strong>{tx(o.label)}</strong></span></label>;
  if (o.type === "choice") return <label style={LABEL}>{tx(o.label)}<select value={v} onChange={(e) => set(e.target.value)}>{o.choices.map((c) => <option key={c.value} value={c.value}>{tx(c.label)}</option>)}</select></label>;
  if (o.type === "number") return <label style={LABEL}>{tx(o.label)}<input type="number" min={o.min} max={o.max} step={o.step} value={v} onChange={(e) => set(e.target.value === "" ? "" : Number(e.target.value))} /></label>;
  if (o.type === "color") return (
    <label style={LABEL}>{tx(o.label)}
      <span style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
        <input type="color" value={v} onChange={(e) => set(e.target.value)} style={{ width: 44, height: 38, padding: 2, flex: "none" }} />
        <input type="text" value={v} maxLength={7} onChange={(e) => set(e.target.value)} style={{ flex: 1, fontFamily: "ui-monospace, Menlo, monospace" }} aria-label={tx(o.label)} />
      </span>
    </label>
  );
  return <label style={LABEL}>{tx(o.label)}<input type={o.type === "datetime" ? "datetime-local" : "text"} value={v} maxLength={300} onChange={(e) => set(e.target.value)} /></label>;
}

export default function WidgetOptions({ slug }) {
  const key = String(slug || "").replace(/^widget-/, "");
  const [w, setW] = useState(null);
  const [vals, setVals] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("");
  useEffect(() => {
    setW(null); setMsg(null); setTab("");
    api("/widgets/").then((d) => { const x = (d.widgets || []).find((y) => y.key === key); setW(x || false); setVals(x?.options_now || {}); }).catch((e) => { setW(false); setMsg({ ok: false, text: errorText(e) }); });
  }, [key]);
  if (w === null) return <p className="muted" style={{ padding: ".6rem" }}>{tx("Bezig…")}</p>;
  if (!w) return <div className="alert" style={{ margin: ".6rem" }}>{msg?.text || tx("Dit widget is niet gevonden.")}</div>;
  const groups = GROUPS.map(([k, l]) => [k, l, w.options.filter((o) => groupOf(o) === k)]).filter(([, , os]) => os.length);
  const cur = groups.find(([k]) => k === tab) || groups[0];
  const dirty = JSON.stringify(vals) !== JSON.stringify(w.options_now || {});
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const d = await api(`/widgets/${key}/options/`, { method: "PUT", body: { options: vals } });
      const x = (d.widgets || []).find((y) => y.key === key); if (x) { setW(x); setVals(x.options_now || vals); }
      window.dispatchEvent(new Event("sysobjects-changed"));  // the widgets on the page are drawn again with the new options
      setMsg({ ok: true, text: tx("Opgeslagen. Het widget is overal aangepast.") });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }} onMouseDown={(e) => e.stopPropagation()}>
      <div style={{ margin: ".6rem", padding: ".8rem .9rem", border: "1px solid var(--line)", borderRadius: 14, background: "color-mix(in srgb, var(--blue) 6%, var(--card, #fff))", display: "grid", gap: ".5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" }}>
          <strong style={{ fontSize: "1rem" }}>{tx(w.name)}</strong>
          {w.category && <span className="wl-chip">{tx(w.category)}</span>}
          {w.subcategory && <span className="wl-chip sub">{tx(w.subcategory)}</span>}
        </div>
        <small className="muted">{tx(w.description)}</small>
        {w.doc && <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--line)", background: "var(--card, #fff)", maxHeight: 130, pointerEvents: "none" }}><WidgetFrame doc={w.doc} height={Math.min(w.height || 120, 130)} inert title={w.name} /></div>}
      </div>
      {!w.options.length ? <p className="muted" style={{ margin: ".6rem" }}>{tx("Dit widget heeft geen opties.")}</p> : (
        <>
          {groups.length > 1 && <div style={{ margin: "0 .6rem" }}><Tabs value={cur[0]} onChange={setTab} tabs={groups.map(([k, l]) => [k, l])} className="tabs-one-row" /></div>}
          <div style={{ display: "grid", gap: ".8rem", padding: ".8rem .6rem" }}>
            {cur[2].map((o) => <Field key={o.key} o={o} v={vals[o.key] ?? o.default} set={(x) => setVals((p) => ({ ...p, [o.key]: x }))} />)}
          </div>
          <div style={{ position: "sticky", bottom: 0, display: "grid", gap: ".4rem", padding: ".7rem .6rem", borderTop: "1px solid var(--line)", background: "var(--bg, var(--card, #fff))" }}>
            {msg && <div className={msg.ok ? "alert ok" : "alert"} role="status" style={{ margin: 0 }}>{msg.text}</div>}
            <small className="muted">{tx("Deze instellingen gelden voor dit widget op alle pagina's.")}</small>
            <button type="button" className="btn primary" disabled={busy || !dirty} onClick={save}>{busy ? tx("Bezig…") : tx("Opslaan")}</button>
          </div>
        </>
      )}
    </div>
  );
}
