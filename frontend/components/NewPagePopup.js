// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import RightsEditor, { useRightsPeople } from "./RightsEditor";
import Tabs from "./Tabs";

const slugOf = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 58);

// A new page from the editor: title, address (slug), rights, a menu item yes/no and the place in the menu.
export default function NewPagePopup({ onClose }) {
  const [tab, setTab] = useState("page");
  const [f, setF] = useState({ title: "", slug: "", slugEdited: false, in_menu: true, place: "end", rights: [] });
  const [pages, setPages] = useState([]);
  const [lang, setLang] = useState({ languages: [], default: "nl" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const people = useRightsPeople(true);
  useEffect(() => {
    api("/pages/").then((d) => setPages((d.pages || []).filter((p) => p.in_menu && p.scope !== "private"))).catch(() => {});
    api("/languages/").then(setLang).catch(() => {});
  }, []);
  const tops = useMemo(() => pages.filter((p) => !p.parent || !pages.some((x) => x.id === p.parent)).sort((a, b) => a.order - b.order), [pages]);
  const nameOf = (p) => p.title?.[lang.default] || Object.values(p.title || {}).find(Boolean) || p.key;
  const set = (o) => setF((v) => ({ ...v, ...o }));

  async function submit(e) {
    e.preventDefault();
    if (!f.title.trim()) { setTab("page"); setErr(tx("Vul de titel in.")); return; }
    setBusy(true); setErr("");
    try {
      const title = Object.fromEntries((lang.languages.length ? lang.languages : [{ code: lang.default }]).map((l) => [l.code, f.title.trim()]));
      const made = await api("/pages/", { method: "POST", body: { kind: "content", scope: "public", title, key: f.slug || slugOf(f.title), in_menu: f.in_menu, rights: f.rights } });
      if (f.in_menu) {  // the place in the menu (two levels)
        const all = (await api("/pages/")).pages.filter((p) => p.scope !== "private" && p.in_menu);
        const top = all.filter((p) => !p.parent || !all.some((x) => x.id === p.parent)).sort((a, b) => a.order - b.order);
        const rows = top.filter((p) => p.id !== made.id).map((p) => ({ ...p, kids: all.filter((c) => c.parent === p.id && c.id !== made.id).sort((a, b) => a.order - b.order) }));
        const me = { id: made.id, kids: [] };
        const [kind, ref] = f.place.split(":");
        const at = rows.findIndex((r) => String(r.id) === ref);
        if (kind === "start") rows.unshift(me);
        else if (kind === "after" && at >= 0) rows.splice(at + 1, 0, me);
        else if (kind === "under" && at >= 0) rows[at].kids.push(me);
        else rows.push(me);
        const items = [];
        rows.forEach((r) => { items.push({ id: r.id, parent: null }); r.kids.forEach((k) => items.push({ id: k.id, parent: r.id })); });
        if (kind === "under") { const i = items.findIndex((x) => x.id === made.id); if (i >= 0) items[i].parent = Number(ref); }
        await api("/pages/order/", { method: "PUT", body: { items } });
      }
      window.dispatchEvent(new Event("pages-changed"));
      window.location.assign(made.path || `/${made.key}`);
    } catch (x) { setErr(errorText(x)); setBusy(false); }
  }

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{tx("Nieuwe pagina")}</h2>
        <Tabs tabs={[["page", "Pagina"], ["rights", "Rechten"]]} value={tab} onChange={setTab} />
        {tab === "rights" && (
          <RightsEditor entries={f.rights} onChange={(rows) => set({ rights: rows })} people={people}
            emptyText="Geen beperkingen: iedereen met het recht van de module Pagina's."
            hint="De rechten worden gezet als de pagina wordt gemaakt en kun je later wijzigen bij de instellingen van de pagina. Een recht zonder lijst heeft geen beperking." />
        )}
        {tab === "page" && <>
          <label>{tx("Titel van de pagina")}
            <input value={f.title} maxLength={80} required autoFocus onChange={(e) => set({ title: e.target.value, ...(f.slugEdited ? {} : { slug: slugOf(e.target.value) }) })} />
          </label>
          <label>{tx("Slug (het adres van de pagina)")}
            <input value={f.slug} maxLength={58} onChange={(e) => set({ slug: slugOf(e.target.value), slugEdited: true })} placeholder="bijvoorbeeld-over-ons" />
            <small className="muted">/{f.slug || "…"}</small>
          </label>
          <label className="check sec-toggle">
            <span className="switch"><input type="checkbox" checked={f.in_menu} onChange={(e) => set({ in_menu: e.target.checked })} /><span /></span>
            <span>{tx("Menu-item: toon de pagina in het menu")}</span>
          </label>
          {f.in_menu && (
            <label>{tx("Plaats in het menu")}
              <select value={f.place} onChange={(e) => set({ place: e.target.value })}>
                <option value="end">{tx("Onderaan het menu")}</option>
                <option value="start">{tx("Bovenaan het menu")}</option>
                {tops.map((p) => <option key={`a${p.id}`} value={`after:${p.id}`}>{tx("Na")}: {nameOf(p)}</option>)}
                {tops.map((p) => <option key={`u${p.id}`} value={`under:${p.id}`}>{tx("Onder")}: {nameOf(p)} ({tx("submenu")})</option>)}
              </select>
            </label>
          )}
        </>}
        {err && <p className="error">{err}</p>}
        <div className="row"><button type="button" className="btn" onClick={onClose}>{tx("Annuleren")}</button><button className="btn primary" disabled={busy}>{busy ? tx("Bezig…") : tx("Pagina maken")}</button></div>
      </form>
    </div>, document.body);
}
