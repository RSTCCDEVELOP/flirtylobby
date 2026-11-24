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

// The settings of a widget, in the left panel of the page editor: click a widget (or its edit button) and its options are here. The options belong to the widget, so a change counts for the widget on
// every page. A change is saved with the button and the page shows it at once. (The library, Admin > Website > Widgets, has the same options.)
function Field({ o, v, set }) {
  if (o.type === "textarea") return <label>{tx(o.label)}<textarea rows={5} value={v} maxLength={1200} onChange={(e) => set(e.target.value)} /></label>;
  if (o.type === "switch") return <label className="hed-sw"><span className="switch"><input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} /><span /></span><span className="hed-swt"><strong>{tx(o.label)}</strong></span></label>;
  if (o.type === "choice") return <label>{tx(o.label)}<select value={v} onChange={(e) => set(e.target.value)}>{o.choices.map((c) => <option key={c.value} value={c.value}>{tx(c.label)}</option>)}</select></label>;
  if (o.type === "number") return <label>{tx(o.label)}<input type="number" min={o.min} max={o.max} step={o.step} value={v} onChange={(e) => set(e.target.value === "" ? "" : Number(e.target.value))} /></label>;
  if (o.type === "color") return <label>{tx(o.label)}<input type="color" value={v} onChange={(e) => set(e.target.value)} style={{ height: 38, padding: 2 }} /></label>;
  return <label>{tx(o.label)}<input type={o.type === "datetime" ? "datetime-local" : "text"} value={v} maxLength={300} onChange={(e) => set(e.target.value)} /></label>;
}

export default function WidgetOptions({ slug }) {
  const key = String(slug || "").replace(/^widget-/, "");
  const [w, setW] = useState(null);
  const [vals, setVals] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setW(null); setMsg(null);
    api("/widgets/").then((d) => { const x = (d.widgets || []).find((y) => y.key === key); setW(x || false); setVals(x?.options_now || {}); }).catch((e) => { setW(false); setMsg({ ok: false, text: errorText(e) }); });
  }, [key]);
  if (w === null) return <p className="muted" style={{ padding: ".6rem" }}>{tx("Bezig…")}</p>;
  if (!w) return <div className="alert" style={{ margin: ".6rem" }}>{msg?.text || tx("Dit widget is niet gevonden.")}</div>;
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const d = await api(`/widgets/${key}/options/`, { method: "PUT", body: { options: vals } });
      const x = (d.widgets || []).find((y) => y.key === key); if (x) setVals(x.options_now || vals);
      window.dispatchEvent(new Event("sysobjects-changed"));  // the widgets on the page are drawn again with the new options
      setMsg({ ok: true, text: tx("Opgeslagen. Het widget is overal aangepast.") });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  return (
    <div className="stack-sm" style={{ padding: ".6rem" }} onMouseDown={(e) => e.stopPropagation()}>
      <div><strong>{tx(w.name)}</strong><small className="muted" style={{ display: "block" }}>{tx(w.description)}</small></div>
      {!w.options.length ? <p className="muted">{tx("Dit widget heeft geen opties.")}</p> : w.options.map((o) => <Field key={o.key} o={o} v={vals[o.key] ?? o.default} set={(x) => setVals((p) => ({ ...p, [o.key]: x }))} />)}
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      <small className="muted">{tx("Deze instellingen gelden voor dit widget op alle pagina's.")}</small>
      {w.options.length > 0 && <button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? tx("Bezig…") : tx("Opslaan")}</button>}
    </div>
  );
}
