// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useMemo, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";
import WidgetFrame from "./WidgetFrame";

// The library of the widgets (Admin > Thema > Widgets), like the library of the themes: every widget of <source>/widgets/ with an example. An admin installs a widget (it is a system object
// then) or removes it, and sets its options. An installed widget is added to a page in the page editor: Toevoegen > Widgets (click or drag).
export default function WidgetLibrary() {
  const [list, setList] = useState(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState("");     // the key of the widget whose options are open
  const [vals, setVals] = useState({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const load = () => api("/widgets/").then((d) => setList(d.widgets)).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  useEffect(() => { load(); }, []);
  const cats = useMemo(() => [...new Set((list || []).map((w) => w.category))], [list]);
  if (!list) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Bezig…")}</p>;
  const shown = list.filter((w) => (!cat || w.category === cat) && `${w.name} ${w.description} ${w.category}`.toLowerCase().includes(q.trim().toLowerCase()));
  const act = async (w, method) => {
    if (method === "DELETE" && !(await confirmDialog(tx("Dit widget verwijderen? Pagina's waar het op staat tonen het niet meer."), { okLabel: tx("Verwijderen"), cancelLabel: tx("Annuleren") }))) return;
    setBusy(w.key); setMsg(null);
    try { const d = await api(`/widgets/${w.key}/`, { method }); setList(d.widgets); if (method === "DELETE" && open === w.key) setOpen(""); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  };
  const save = async (w) => {
    setBusy(w.key); setMsg(null);
    try { const d = await api(`/widgets/${w.key}/options/`, { method: "PUT", body: { options: vals } }); setList(d.widgets); setMsg({ ok: true, text: tx("Opgeslagen. Het widget is overal aangepast.") }); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  };
  const field = (o) => {
    const v = vals[o.key] ?? o.default;
    const set = (x) => setVals({ ...vals, [o.key]: x });
    if (o.type === "textarea") return <label key={o.key}>{tx(o.label)}<textarea rows={5} value={v} maxLength={1200} onChange={(e) => set(e.target.value)} /></label>;
    if (o.type === "switch") return <label key={o.key} className="hed-sw"><span className="switch"><input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} /><span /></span><span className="hed-swt"><strong>{tx(o.label)}</strong></span></label>;
    if (o.type === "choice") return <label key={o.key}>{tx(o.label)}<select value={v} onChange={(e) => set(e.target.value)}>{o.choices.map((c) => <option key={c.value} value={c.value}>{tx(c.label)}</option>)}</select></label>;
    if (o.type === "number") return <label key={o.key}>{tx(o.label)}<input type="number" min={o.min} max={o.max} step={o.step} value={v} onChange={(e) => set(e.target.value === "" ? "" : Number(e.target.value))} /></label>;
    if (o.type === "color") return <label key={o.key}>{tx(o.label)}<input type="color" value={v} onChange={(e) => set(e.target.value)} style={{ height: 38, padding: 2 }} /></label>;
    return <label key={o.key}>{tx(o.label)}<input type={o.type === "datetime" ? "datetime-local" : "text"} value={v} maxLength={300} onChange={(e) => set(e.target.value)} /></label>;
  };
  return (
    <div className="stack-sm">
      <p className="muted" style={{ margin: 0 }}>{tx("De bibliotheek met widgets: kleine onderdelen (een aftelklok, een klok, een lopende tekst ...) die je installeert en daarna in de paginabewerker op een pagina zet via Toevoegen → Widgets. Elk widget heeft een voorbeeld.")}</p>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      <div className="lg-bar" style={{ marginBottom: 0 }}>
        <div className="lg-search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoek een widget…")} aria-label={tx("Zoeken")} /></div>
        <div className="lg-seg" role="group" aria-label={tx("Soort")}>
          <button type="button" className={!cat ? "on" : ""} onClick={() => setCat("")}>{tx("Alles")}</button>
          {cats.map((c) => <button type="button" key={c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>{tx(c)}</button>)}
        </div>
      </div>
      <div className="wl-grid">
        {shown.map((w) => (
          <article key={w.key} className={`wl-card${w.installed ? " on" : ""}`}>
            <div className="wl-prev"><WidgetFrame doc={w.installed ? w.doc : w.example_doc} height={Math.min(w.height, 200)} inert title={w.name} /></div>
            <div className="wl-body">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: ".4rem" }}><strong>{w.name}</strong><span className={`badge ${w.installed ? "ok" : ""}`}>{w.installed ? tx("Geïnstalleerd") : tx(w.category)}</span></div>
              <small className="muted">{w.description}</small>
              <div className="row" style={{ justifyContent: "flex-start", gap: ".4rem", flexWrap: "wrap" }}>
                {w.installed
                  ? <><button type="button" className="btn sm" disabled={!!busy} onClick={() => { setOpen(open === w.key ? "" : w.key); setVals(w.options_now || {}); }}>{open === w.key ? tx("Opties sluiten") : tx("Opties")}</button>
                      <button type="button" className="btn sm" disabled={!!busy} onClick={() => act(w, "DELETE")}>{tx("Verwijderen")}</button></>
                  : <button type="button" className="btn sm primary" disabled={!!busy} onClick={() => act(w, "POST")}>{busy === w.key ? tx("Bezig…") : tx("Installeren")}</button>}
              </div>
              {open === w.key && w.installed && (
                <div className="wl-opts">
                  {w.options.length ? w.options.map(field) : <small className="muted">{tx("Dit widget heeft geen opties.")}</small>}
                  {w.options.length > 0 && <div className="row" style={{ justifyContent: "flex-start" }}><button type="button" className="btn sm primary" disabled={!!busy} onClick={() => save(w)}>{tx("Opslaan")}</button></div>}
                </div>
              )}
            </div>
          </article>
        ))}
        {!shown.length && <p className="muted">{tx("Geen widget gevonden.")}</p>}
      </div>
      <small className="muted">{tx("De widgets staan in de map source/widgets/<naam> (widget.json, widget.html, widget.css, widget.js). Een widget dat je zelf toevoegt, staat na het herladen in deze bibliotheek.")}</small>
    </div>
  );
}
