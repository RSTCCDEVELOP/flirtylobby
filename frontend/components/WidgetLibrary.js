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
import WidgetCategories, { ViewToggle, useWidgetView, widgetGroups, widgetTree } from "./WidgetCategories";

// The library of the widgets (Admin > Thema > Widgets), like the library of the themes: every widget of <source>/widgets/ with an example. An admin installs a widget (it is a system object
// then) or removes it, and sets its options. An installed widget is added to a page in the page editor: Toevoegen > Widgets (click or drag).
export default function WidgetLibrary() {
  const [list, setList] = useState(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [sub, setSub] = useState("");
  const [status, setStatus] = useState("on");  // "" all | on = in use (the default) | off = not installed
  const [view, setView] = useWidgetView();
  const [open, setOpen] = useState("");     // the key of the widget whose options are open
  const [vals, setVals] = useState({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const load = () => api("/widgets/").then((d) => setList(d.widgets)).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  useEffect(() => { api("/widgets/").then((d) => { setList(d.widgets); if (!d.widgets.some((w) => w.installed)) setStatus(""); }).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, []);  // nothing installed yet: show the whole library
  const gc = (w) => w.category, gs = (w) => w.subcategory;
  const tree = useMemo(() => widgetTree(list || [], gc, gs), [list]);
  if (!list) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Bezig…")}</p>;
  const nOn = list.filter((w) => w.installed).length;
  const shown = list.filter((w) => (!status || (status === "on") === !!w.installed) && `${w.name} ${w.description} ${w.category} ${w.subcategory}`.toLowerCase().includes(q.trim().toLowerCase()));
  const groups = widgetGroups(shown, gc, gs, cat, sub);
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
      <div className="wl-top">
        <div className="lg-search" style={{ flex: "1 1 260px", maxWidth: 460 }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoek een widget…")} aria-label={tx("Zoeken")} /></div>
        <div className="lg-seg" role="group" aria-label={tx("Status")}>
          <button type="button" className={!status ? "on" : ""} aria-pressed={!status} onClick={() => setStatus("")}>{tx("Alles")} <small>{list.length}</small></button>
          <button type="button" className={status === "on" ? "on" : ""} aria-pressed={status === "on"} onClick={() => setStatus("on")}>{tx("In gebruik")} <small>{nOn}</small></button>
          <button type="button" className={status === "off" ? "on" : ""} aria-pressed={status === "off"} onClick={() => setStatus("off")}>{tx("Niet geïnstalleerd")} <small>{list.length - nOn}</small></button>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>
      <WidgetCategories tree={tree} total={shown.length} cat={cat} sub={sub} onCat={setCat} onSub={setSub} />
      <div className={view === "list" ? "wl-list" : "wl-grid"}>
        {groups.map((g) => [
          groups.length === 1 ? <h4 key={`h-${g.cat}:${g.sub}`} className="wc-head wl-headrow"><b>{tx(g.cat)}</b>{g.sub && <span>› {tx(g.sub)}</span>}<span>({g.items.length})</span></h4> : null,  // one flowing grid when all categories show: the chips on the tiles say the category
          ...g.items.map((w) => (
            <article key={w.key} className={`wl-card${w.installed ? " on" : ""}`}>
              <div className="wl-prev"><div className="wl-prev-in"><WidgetFrame doc={w.installed ? w.doc : w.example_doc} height={Math.min(w.height, 200)} inert title={w.name} /></div></div>
              <div className="wl-body">
                <div className="wl-title"><strong>{w.name}</strong>{w.installed && <span className="wl-dot" title={tx("Geïnstalleerd")}>✓</span>}</div>
                <div className="wl-meta"><span className="wl-chip">{tx(w.category)}</span>{w.subcategory && <span className="wl-chip sub">{tx(w.subcategory)}</span>}</div>
                <small className="wl-desc">{w.description}</small>
                {open === w.key && w.installed && (
                  <div className="wl-opts">
                    {w.options.length ? w.options.map(field) : <small className="muted">{tx("Dit widget heeft geen opties.")}</small>}
                    {w.options.length > 0 && <div className="row" style={{ justifyContent: "center" }}><button type="button" className="btn sm primary" disabled={!!busy} onClick={() => save(w)}>{tx("Opslaan")}</button></div>}
                  </div>
                )}
              </div>
              <div className="wl-foot">
                {w.installed
                  ? <><button type="button" className="btn sm" disabled={!!busy} onClick={() => { setOpen(open === w.key ? "" : w.key); setVals(w.options_now || {}); }}>{open === w.key ? tx("Opties sluiten") : tx("Opties")}</button>
                      <button type="button" className="btn sm" disabled={!!busy} onClick={() => act(w, "DELETE")}>{tx("Verwijderen")}</button></>
                  : <button type="button" className="btn primary wl-install" disabled={!!busy} onClick={() => act(w, "POST")}>{busy === w.key ? tx("Bezig…") : tx("Installeren")}</button>}
              </div>
            </article>
          )),
        ])}
      </div>
      {!groups.length && <p className="muted">{tx("Geen widget gevonden.")}</p>}
      <small className="muted">{tx("De widgets staan in de map source/widgets/<naam> (widget.json, widget.html, widget.css, widget.js). Een widget dat je zelf toevoegt, staat na het herladen in deze bibliotheek.")}</small>
    </div>
  );
}
