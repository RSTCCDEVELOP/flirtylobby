// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import Tabs from "./Tabs";

const AUD = { all: "Iedereen", members: "Ingelogd", guests: "Bezoekers" };  // who sees the item in the menu
const KIND = { content: "Pagina", link: "Link", menu: "Menu-item" };

// The menu editor (a popup in the page editor): drag and drop the items in order (drop on the middle of an item = submenu of it, two levels),
// switch items on and off, and make link buttons and menu-only items (for a dropdown).
export default function MenuEditorPopup({ onClose }) {
  const [tab, setTab] = useState("menu");
  const [tree, setTree] = useState(null);    // [{p, kids:[p]}] the items in the menu
  const [off, setOff] = useState([]);        // the items that are not in the menu
  const [dead, setDead] = useState([]);      // pages that are not live (off, or their module is off): they are not in the header menu, so not in this list
  const [orig, setOrig] = useState({});      // id -> page as loaded
  const [edits, setEdits] = useState({});    // id -> {title, url}
  const [lang, setLang] = useState({ languages: [], default: "nl" });
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);    // {id, zone}
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const grab = useRef(true);
  const [nw, setNw] = useState({ kind: "link", title: "", url: "" });

  const build = (pages) => {
    const all = pages.filter((p) => p.scope !== "private");
    const list = all.filter((p) => p.available !== false);
    setDead(all.filter((p) => p.available === false).sort((a, b) => a.order - b.order));
    const on = list.filter((p) => p.in_menu);
    const tops = on.filter((p) => !p.parent || !on.some((x) => x.id === p.parent)).sort((a, b) => a.order - b.order);
    setTree(tops.map((p) => ({ p, kids: on.filter((c) => c.parent === p.id).sort((a, b) => a.order - b.order) })));
    setOff(list.filter((p) => !p.in_menu).sort((a, b) => a.order - b.order));
    setOrig(Object.fromEntries(all.map((p) => [p.id, p])));
  };
  useEffect(() => {
    api("/pages/").then((d) => build(d.pages || [])).catch((e) => setErr(errorText(e)));
    api("/languages/").then(setLang).catch(() => {});
  }, []);
  const name = (p) => edits[p.id]?.title ?? (p.title?.[lang.default] || Object.values(p.title || {}).find(Boolean) || p.key);

  // ---- moving
  const take = (t, o, id) => {  // removes the item; returns the node {p, kids}
    let node = null;
    const t2 = [];
    t.forEach((r) => {
      if (r.p.id === id) node = { p: r.p, kids: r.kids };
      else { const k = r.kids.filter((c) => c.id !== id); if (k.length !== r.kids.length) node = { p: r.kids.find((c) => c.id === id), kids: [] }; t2.push({ ...r, kids: k }); }
    });
    const o2 = o.filter((p) => { if (p.id === id) { node = { p, kids: [] }; return false; } return true; });
    return { node, t: t2, o: o2 };
  };
  const drop = (targetId, zone) => {
    if (!drag || drag === targetId) return;
    const { node, t, o } = take(tree, off, drag);
    if (!node) return;
    const set = (nt, no = o) => { setTree(nt); setOff(no); };
    if (zone === "off") { set(t, [...o, node.p, ...node.kids]); return; }
    if (zone === "end") { t.push({ p: { ...node.p, in_menu: true }, kids: node.kids }); set(t); return; }
    const ti = t.findIndex((r) => r.p.id === targetId);
    const kidOf = ti < 0 ? t.findIndex((r) => r.kids.some((c) => c.id === targetId)) : -1;
    if (ti < 0 && kidOf < 0) return;  // (the target is inside the dragged item)
    const live = { ...node.p, in_menu: true };
    const loose = node.kids.map((k) => ({ p: k, kids: [] }));  // (an item with subitems that becomes a sub itself: its subitems go to the main level, next to it)
    if (zone === "into" && ti >= 0) { t[ti] = { ...t[ti], kids: [...t[ti].kids, live] }; t.splice(ti + 1, 0, ...loose); set(t); return; }
    if (zone === "out" && kidOf >= 0) { t.splice(kidOf + 1, 0, { p: live, kids: node.kids }); set(t); return; }  // a sub back to the main level, right after its parent
    if (ti >= 0) { t.splice(zone === "before" ? ti : ti + 1, 0, { p: live, kids: node.kids }); set(t); return; }
    const k = [...t[kidOf].kids]; const ci = k.findIndex((c) => c.id === targetId);
    k.splice(zone === "before" ? ci : ci + 1, 0, live); t[kidOf] = { ...t[kidOf], kids: k }; t.splice(kidOf + 1, 0, ...loose); set(t);
  };
  const zoneOf = (e, canInto, sub) => {
    const r = e.currentTarget.getBoundingClientRect(); const y = (e.clientY - r.top) / r.height;
    if (sub) return e.clientX - r.left < 48 ? "out" : y < .5 ? "before" : "after";  // on the left edge of a sub: back to the main level
    return y < .28 ? "before" : y > .72 ? "after" : "into";
  };
  const toggle = (p) => {  // on: to the end of the menu; off: it goes (with its subitems) to the list below
    if (off.some((x) => x.id === p.id)) { setOff(off.filter((x) => x.id !== p.id)); setTree([...tree, { p: { ...p, in_menu: true }, kids: [] }]); return; }
    const { node, t, o } = take(tree, off, p.id);
    setTree(t); setOff([...o, node.p, ...node.kids]);
  };

  // ---- save
  async function save() {
    setBusy(true); setErr("");
    try {
      const items = [];
      tree.forEach((r) => { items.push({ id: r.p.id, parent: null }); r.kids.forEach((k) => items.push({ id: k.id, parent: r.p.id })); });
      const onIds = new Set(items.map((i) => i.id));
      off.forEach((p) => items.push({ id: p.id, parent: null }));
      dead.forEach((p) => items.push({ id: p.id, parent: null }));
      for (const p of Object.values(orig)) {  // on/off and the edited names and addresses
        const body = {};
        if (!dead.some((d) => d.id === p.id) && !!p.in_menu !== onIds.has(p.id)) body.in_menu = onIds.has(p.id);
        const e = edits[p.id];
        if (e?.title !== undefined && p.kind !== "content") { const main = e.title.trim() || name(p); body.title = Object.fromEntries((lang.languages.length ? lang.languages : [{ code: lang.default }]).map((l) => [l.code, main])); }
        if (e?.audience !== undefined && e.audience !== p.audience) body.audience = e.audience;
        if (e?.url !== undefined && p.kind === "link") body.url = e.url;
        if (Object.keys(body).length) await api(`/pages/${p.id}/`, { method: "PATCH", body });
      }
      await api("/pages/order/", { method: "PUT", body: { items } });
      window.dispatchEvent(new Event("pages-changed"));
      window.location.reload();
    } catch (x) { setErr(errorText(x)); setBusy(false); }
  }
  async function create(e) {
    e.preventDefault();
    if (!nw.title.trim()) { setErr(tx("Vul de naam in.")); return; }
    if (nw.kind === "link" && !nw.url.trim()) { setErr(tx("Vul het adres van de link in.")); return; }
    setBusy(true); setErr("");
    try {
      const title = Object.fromEntries((lang.languages.length ? lang.languages : [{ code: lang.default }]).map((l) => [l.code, nw.title.trim()]));
      const made = await api("/pages/", { method: "POST", body: { kind: nw.kind, scope: "public", title, url: nw.kind === "link" ? nw.url.trim() : "", in_menu: true } });
      setOrig((o) => ({ ...o, [made.id]: made }));
      setTree((t) => [...(t || []), { p: made, kids: [] }]);
      setNw({ kind: nw.kind, title: "", url: "" }); setTab("menu");
    } catch (x) { setErr(errorText(x)); }
    setBusy(false);
  }
  async function remove(p) {
    if (!window.confirm(tx("Dit item verwijderen?"))) return;
    try {
      await api(`/pages/${p.id}/`, { method: "DELETE" });
      setTree((t) => t.map((r) => ({ ...r, kids: r.kids.filter((c) => c.id !== p.id) })).filter((r) => r.p.id !== p.id));
      setOff((o) => o.filter((x) => x.id !== p.id));
    } catch (x) { setErr(errorText(x)); }
  }

  const row = ({ p, sub, canInto, isOff, empty }) => {
    const free = p.kind === "link" || p.kind === "menu";  // (own pages and system pages keep their name; it is changed in their settings)
    const aud = edits[p.id]?.audience ?? p.audience ?? "all";
    return (
      <div key={p.id} className={`mnu-row${sub ? " sub" : ""}${isOff ? " off" : ""}${drag === p.id ? " drag" : ""}${over?.id === p.id ? ` over-${over.zone}` : ""}`}
        draggable onMouseDown={(e) => { grab.current = !/^(INPUT|SELECT|OPTION)$/.test(e.target.tagName); }} onDragStart={(e) => { if (!grab.current) { e.preventDefault(); return; } e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(p.id)); } catch {} setDrag(p.id); }}
        onDragEnd={() => { setDrag(null); setOver(null); }}
        onDragOver={(e) => { if (!drag || drag === p.id) return; e.preventDefault(); const z = zoneOf(e, canInto, sub); if (over?.id !== p.id || over.zone !== z) setOver({ id: p.id, zone: z }); }}
        onDrop={(e) => { if (isOff) return; e.preventDefault(); e.stopPropagation(); drop(p.id, zoneOf(e, canInto, sub)); setDrag(null); setOver(null); }}>
        <span className="mnu-grip" aria-hidden="true">⋮⋮</span>
        {free ? <input className="mnu-name" value={name(p)} maxLength={80} onChange={(e) => setEdits({ ...edits, [p.id]: { ...edits[p.id], title: e.target.value } })} aria-label={tx("Naam")} />
          : <span className="mnu-name">{name(p)}</span>}
        {p.kind === "link" && <input className="mnu-url" value={edits[p.id]?.url ?? p.url ?? ""} placeholder="https://… of /pad" onChange={(e) => setEdits({ ...edits, [p.id]: { ...edits[p.id], url: e.target.value } })} aria-label={tx("Link")} />}
        {empty && <span className="mnu-warn" title={tx("Een menu-item zonder subitems staat niet in de header. Sleep een item op het midden van dit item om er een submenu van te maken.")}>{tx("Nog leeg: niet zichtbaar")}</span>}
        <select className="mnu-aud" value={aud} onChange={(e) => setEdits({ ...edits, [p.id]: { ...edits[p.id], audience: e.target.value } })} aria-label={tx("Wie ziet dit item")} title={tx("Wie ziet dit item in het menu")}>{Object.entries(AUD).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</select>
        <span className="mnu-kind">{tx(KIND[p.kind] || "Pagina")}</span>
        {free && <button type="button" className="mnu-del" onClick={() => remove(p)} title={tx("Verwijderen")} aria-label={tx("Verwijderen")}>×</button>}
        <label className="switch" title={isOff ? tx("In het menu zetten") : tx("Uit het menu halen")}><input type="checkbox" checked={!isOff} onChange={() => toggle(p)} /><span /></label>
      </div>
    );
  };

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="card modal form mnu-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{tx("Menu")}</h2>
        <Tabs tabs={[["menu", "Menu"], ["add", "Item toevoegen"]]} value={tab} onChange={setTab} />
        {tab === "menu" && (!tree ? <p className="muted">{tx("Laden…")}</p> : <>
          <p className="muted mnu-hint">{tx("Sleep de items om de volgorde te wijzigen. Laat een item op het midden van een ander item vallen: het wordt een sub van dat item. Sleep een sub naar de linkerrand van zijn rij om hem weer een hoofditem te maken. Met de schakelaar zet je een item aan of uit.")}</p>
          <div className="mnu-list">
            {tree.map((r) => (
              <div key={r.p.id} className="mnu-group">
                {row({ p: r.p, canInto: true, empty: r.p.kind === "menu" && !r.kids.length })}
                {r.kids.map((k) => row({ p: k, sub: true }))}
              </div>
            ))}
            {!tree.length && <p className="muted">{tx("Het menu is leeg.")}</p>}
            {drag && <div className={`mnu-end${over?.id === "end" ? " over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver({ id: "end", zone: "end" }); }} onDrop={(e) => { e.preventDefault(); drop(null, "end"); setDrag(null); setOver(null); }}>{tx("Hier loslaten: onderaan het hoofdmenu")}</div>}
          </div>
          <div className={`mnu-offzone${over?.id === "off" ? " over" : ""}`} onDragOver={(e) => { if (drag) { e.preventDefault(); setOver({ id: "off", zone: "off" }); } }} onDragLeave={() => setOver(null)} onDrop={(e) => { e.preventDefault(); drop(null, "off"); setDrag(null); setOver(null); }}>
            <strong>{tx("Niet in het menu")}</strong>
            {off.map((p) => row({ p, isOff: true }))}
            {!off.length && <small className="muted">{tx("Sleep een item hierheen om het uit het menu te halen.")}</small>}
          </div>
          {dead.length > 0 && (
            <div className="mnu-offzone mnu-dead">
              <strong>{tx("Niet live")}</strong>
              <small className="muted">{tx("Een pagina staat pas in het menu van de header als hij live staat. Deze staan uit of hun onderdeel staat uit (zet ze live bij Admin → Pagina's).")}</small>
              {dead.map((p) => <div key={p.id} className="mnu-row off"><span className="mnu-name">{name(p)}</span><span className="mnu-kind">{tx(KIND[p.kind] || "Pagina")}</span></div>)}
            </div>
          )}
        </>)}
        {tab === "add" && (
          <form className="form" onSubmit={create}>
            <label>{tx("Soort")}
              <select value={nw.kind} onChange={(e) => setNw({ ...nw, kind: e.target.value })}>
                <option value="link">{tx("Link naar een adres")}</option>
                <option value="menu">{tx("Menu-item (alleen tekst, voor een dropdown)")}</option>
              </select>
            </label>
            <label>{tx("Naam")}<input value={nw.title} maxLength={80} onChange={(e) => setNw({ ...nw, title: e.target.value })} /></label>
            {nw.kind === "menu" && <p className="muted">{tx("Een menu-item heeft alleen een naam en klapt open: het staat pas in de header als er minstens één item onder staat (sleep een item erop in het menu).")}</p>}
            {nw.kind === "link" && <label>{tx("Link")}<input value={nw.url} onChange={(e) => setNw({ ...nw, url: e.target.value })} placeholder="https://… of /pad" /></label>}
            <div className="row"><button className="btn primary" disabled={busy}>{tx("Toevoegen aan het menu")}</button></div>
          </form>
        )}
        {err && <p className="error">{err}</p>}
        <div className="row"><button type="button" className="btn" onClick={onClose}>{tx("Annuleren")}</button>{tab === "menu" && <button type="button" className="btn primary" disabled={busy || !tree} onClick={save}>{busy ? tx("Bezig…") : tx("Opslaan")}</button>}</div>
      </div>
    </div>, document.body);
}
